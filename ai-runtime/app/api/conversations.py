"""Conversation cancellation endpoint (M5).

POST /v1/conversations/{thread_id}/cancel -> set Redis cancel flag.
The graph's next-node check (added in T2) reads is_cancelled(thread_id)
and exits early with an error.code="CANCELLED" SSE event.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.auth import verify_internal_token
from app.memory.cache import set_cancel_flag

log = logging.getLogger(__name__)

router = APIRouter()


@router.post("/{thread_id}/cancel")
async def cancel_conversation(
    thread_id: str,
    user_id: str = Depends(verify_internal_token),
) -> dict:
    if not thread_id:
        raise HTTPException(
            status_code=400, detail={"code": "MISSING_THREAD_ID"}
        )
    try:
        await set_cancel_flag(thread_id)
    except Exception as e:
        log.exception("set_cancel_flag failed for thread_id=%s: %s", thread_id, e)
        raise HTTPException(
            status_code=503, detail={"code": "REDIS_UNAVAILABLE"}
        )
    log.info("cancel_conversation user=%s thread_id=%s", user_id, thread_id)
    return {"thread_id": thread_id, "cancelled": True, "user_id": user_id}
