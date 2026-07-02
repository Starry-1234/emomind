"""End-to-end test for the ai_doctor text path: graph + streaming."""
import json

import pytest

from app.graphs.ai_doctor import build_ai_doctor_graph
from app.streaming import stream_graph


def _parse_sse(frames: list[str]):
    """Return list of (event_name, data_dict) from raw SSE frames."""
    out = []
    for frame in frames:
        # frame like "event: foo\ndata: {...}\n\n"
        lines = frame.split("\n")
        event = next((l[len("event: "):] for l in lines if l.startswith("event: ")), "")
        data_line = next((l[len("data: "):] for l in lines if l.startswith("data: ")), "{}")
        out.append((event, json.loads(data_line)))
    return out


@pytest.mark.asyncio
async def test_text_only_path_emits_full_sse(mock_minimax_model, monkeypatch):
    """Run the ai_doctor graph and assert we get run_start/node_start/token/message_end."""
    # Direct node-level path — uses the model= kwarg.
    from app.graphs.nodes.analyze_text import analyze_text
    from app.graphs.nodes.finalize import finalize
    from app.graphs.nodes.emit_response import emit_response

    state = {
        "messages": [{"role": "user", "content": "我最近很难入睡"}],
        "modality": "text",
        "user_id": "u1",
        "thread_id": "t1",
        "run_id": "r1",
    }

    state.update(await analyze_text(state, model=mock_minimax_model))
    state.update(await finalize(state))
    state.update(await emit_response(state))

    # Direct-node path: assert analyze_text → finalize produced the canned
    # reply in analysis_result. This block is a real test of the three nodes
    # in isolation; the compiled-graph path below re-mutates the same dict.
    assert state["analyses"]["text"] == "我理解你的感受，能多说说吗？"
    assert state["analysis_result"] == "我理解你的感受，能多说说吗？"

    # Reset state for the compiled-graph path so its nodes start clean.
    state = {
        "messages": [{"role": "user", "content": "我最近很难入睡"}],
        "modality": "text",
        "user_id": "u1",
        "thread_id": "t2",
        "run_id": "r2",
    }

    # Full graph path — inject the fake model via monkeypatch so the compiled
    # graph calls our FakeListChatModel instead of the real MinMax endpoint.
    # `analyze_text` does `from app.models.factory import get_chat_model`, which
    # binds the name in its module namespace; patching that binding replaces
    # the factory call inside the compiled graph without touching the real
    # provider module.
    monkeypatch.setattr(
        "app.graphs.nodes.analyze_text.get_chat_model",
        lambda name: mock_minimax_model,
    )

    graph = build_ai_doctor_graph()
    config = {"configurable": {"thread_id": "t2", "user_id": "u1", "run_id": "r2"}}

    frames = []
    async for f in stream_graph(graph, state, config, run_id="r2", timeout_seconds=15):
        frames.append(f)

    events = _parse_sse(frames)
    event_names = [e[0] for e in events]
    assert "node_start" in event_names
    assert "token" in event_names
    assert "message_end" in event_names

    msg_end = next(d for e, d in events if e == "message_end")
    assert msg_end["thread_id"] == "t2"
    assert msg_end["run_id"] == "r2"
    assert msg_end["full_content"]