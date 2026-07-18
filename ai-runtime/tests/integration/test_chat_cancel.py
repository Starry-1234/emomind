"""M5 T1 integration test: chat cancel sets the Redis flag.

Verifies:
- POST /v1/conversations/{thread_id}/cancel sets the Redis flag.
- The endpoint returns 200 with {cancelled: true, thread_id, user_id}.
- The flag persists in Redis (via is_cancelled) until cleared.

Skipped if Postgres OR Redis is unavailable (matches M4's T3-T4
test skip pattern).
"""
from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


INTERNAL_TOKEN = "test-internal-token-32-chars-long-pad"


@pytest.mark.asyncio
async def test_chat_cancel_sets_redis_flag(monkeypatch):
    try:
        from app.memory.checkpointer import get_checkpointer
        await get_checkpointer()
    except Exception as e:
        pytest.skip(f"Postgres unavailable: {e}")
    try:
        from app.memory.cache import set_cancel_flag, is_cancelled, clear_cancel_flag
    except Exception as e:
        pytest.skip(f"Redis unavailable: {e}")

    thread_id = "t-cancel-" + str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/v1/conversations/{thread_id}/cancel",
            headers={
                "X-Internal-Token": INTERNAL_TOKEN,
                "X-User-Id": user_id,
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["thread_id"] == thread_id
    assert body["cancelled"] is True
    assert body["user_id"] == user_id

    # Verify the Redis flag was actually set
    assert await is_cancelled(thread_id) is True

    # Cleanup
    await clear_cancel_flag(thread_id)


@pytest.mark.asyncio
async def test_chat_cancel_rejects_missing_token():
    # No X-Internal-Token -> 401.
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/conversations/t-anything/cancel",
        )
    assert resp.status_code == 401
