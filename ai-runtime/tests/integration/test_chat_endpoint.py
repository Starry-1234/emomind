"""HTTP-route integration test for POST /v1/chat.

Exercises the FastAPI handler + StreamingResponse wrapper around
stream_graph. Closes the gap where the existing
tests/integration/test_ai_doctor_text.py calls stream_graph() directly
but never goes through the route. A bug in chat.py's event_gen() or
in format_sse_event callers would pass that test.
"""
import json

import pytest
from httpx import ASGITransport, AsyncClient
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.main import app
from app.config import settings


INTERNAL_TOKEN = "test-internal-token-32-chars-long-pad"  # 38 chars, >= 16 min


def _event_names(frames: list[str]) -> list[str]:
    """Pull the 'event: <name>' line out of each SSE frame."""
    out: list[str] = []
    for frame in frames:
        for line in frame.split("\n"):
            if line.startswith("event: "):
                out.append(line[len("event: "):])
                break
    return out


@pytest.mark.asyncio
async def test_chat_endpoint_emits_run_start_and_message_end(
    mock_minimax_model, monkeypatch
):
    # The router-level graph builder is what chat.py imports, so patch the
    # binding inside app.api.chat (the compiled graph's analyze_text node also
    # imports get_chat_model by name; both must be patched).
    monkeypatch.setattr(
        "app.graphs.nodes.analyze_text.get_chat_model",
        lambda name: mock_minimax_model,
    )
    # Make sure the internal_token check passes; the test fixture's env
    # only sets LANGGRAPH_MINIMAX_API_KEY, not the token.
    monkeypatch.setattr(settings, "internal_token", INTERNAL_TOKEN)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        async with client.stream(
            "POST",
            "/v1/chat",
            headers={
                "X-Internal-Token": INTERNAL_TOKEN,
                "X-User-Id": "u-http",
            },
            json={
                "graph": "ai-doctor",
                "thread_id": "t_http",
                "input": {
                    "messages": [{"role": "user", "content": "hi"}],
                },
            },
        ) as r:
            assert r.status_code == 200, await r.aread()
            frames: list[str] = []
            async for chunk in r.aiter_text():
                if chunk:
                    # httpx gives us chunks that may span multiple frames;
                    # we split on the SSE frame terminator "\n\n".
                    frames.extend(
                        f + "\n\n" for f in chunk.split("\n\n") if f.strip()
                    )

    names = _event_names(frames)
    assert "run_start" in names, f"missing run_start in {names!r}"
    assert "message_end" in names, f"missing message_end in {names!r}"

    # Verify run_start payload mentions the thread_id we sent.
    run_start_frame = next(f for f in frames if "event: run_start" in f)
    data_line = next(
        l for l in run_start_frame.split("\n") if l.startswith("data: ")
    )
    payload = json.loads(data_line[len("data: "):])
    assert payload["thread_id"] == "t_http"
    assert payload["graph"] == "ai-doctor"


@pytest.mark.asyncio
async def test_chat_endpoint_rejects_missing_token(monkeypatch):
    # No X-Internal-Token, no X-User-Id — must be 401.
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post(
            "/v1/chat",
            json={
                "graph": "ai-doctor",
                "input": {"messages": [{"role": "user", "content": "hi"}]},
            },
        )
    assert r.status_code == 401
    body = r.json()
    assert body["detail"]["code"] == "INVALID_INTERNAL_TOKEN"


@pytest.mark.asyncio
async def test_chat_endpoint_rejects_missing_user_id(monkeypatch):
    # Valid token, missing X-User-Id — same 401 trust boundary (I3).
    monkeypatch.setattr(settings, "internal_token", INTERNAL_TOKEN)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.post(
            "/v1/chat",
            headers={"X-Internal-Token": INTERNAL_TOKEN},
            json={
                "graph": "ai-doctor",
                "input": {"messages": [{"role": "user", "content": "hi"}]},
            },
        )
    assert r.status_code == 401
    body = r.json()
    assert body["detail"]["code"] == "INVALID_INTERNAL_TOKEN"


@pytest.mark.asyncio
async def test_chat_endpoint_propagates_files_to_graph(monkeypatch, tmp_path):
    """M2: input.files flows into graph state and reaches the analyze_* node.

    T5's contract is narrower than "triggers multimodal path":
    chat.py must propagate body.input.files -> state.files so that
    classify_input sees the file and routes to the corresponding
    analyze_* node (T4's routing concern, exercised elsewhere).

    For a single image upload, T4 routes to analyze_image directly
    (no fusion_analyze). We mock analyze_image to return canned
    Chinese text starting with 图 (matching the M2 j2 prompt) and
    assert SSE carries that text in message_end.
    """
    from app.memory.cache import write_file

    monkeypatch.setattr(settings, "internal_token", INTERNAL_TOKEN)
    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "storage_path", str(tmp_path))

    # Upload a file first so write_file returns a meta dict with file_id.
    meta = write_file(
        user_id="00000000-0000-0000-0000-000000000001",
        content=b"PNG data",
        mime="image/png",
        name="i.png",
    )

    fake_image = FakeListChatModel(responses=["图：一只猫"])
    monkeypatch.setattr(
        "app.graphs.nodes.analyze_image.get_chat_model", lambda name: fake_image
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/chat",
            json={
                "graph": "ai-doctor",
                "thread_id": "t-m2",
                "input": {
                    "messages": [{"role": "user", "content": "看看这张图"}],
                    "files": [meta],
                },
            },
            headers={
                "X-Internal-Token": INTERNAL_TOKEN,
                "X-User-Id": "00000000-0000-0000-0000-000000000001",
            },
        )
    assert resp.status_code == 200
    # Read SSE stream
    body = b""
    async for chunk in resp.aiter_bytes():
        body += chunk
    text = body.decode("utf-8", errors="replace")
    assert "event: run_start" in text
    assert "event: message_end" in text
    # Single image: analyze_image runs and produces canned "图..." text.
    # This proves files reached state.files and the routing node ran.
    assert "图" in text
    # fusion_analyze must NOT run for single-modality under T4 routing.
    assert "综合分析" not in text
