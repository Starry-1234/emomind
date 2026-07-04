"""POST /v1/chat — main entry point.

Spring Boot (with X-Internal-Token) calls this. We dispatch to the
ai_doctor graph (M1 only — psych_test graph arrives in M3) and stream
the graph's events back as SSE.

M5 will add Redis-backed cancel flags here; M1 just streams to completion
or timeout.
"""
from __future__ import annotations

import uuid
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.auth import verify_internal_token
from app.graphs.ai_doctor import build_ai_doctor_graph
from app.streaming import format_sse_event, stream_graph

router = APIRouter()

_GRAPH_BUILDERS: dict[str, Any] = {
    "ai-doctor": build_ai_doctor_graph,
}


class ChatRequest(BaseModel):
    graph: str = Field(..., min_length=1)
    thread_id: str = ""
    input: dict[str, Any] = Field(default_factory=dict)


@router.post("/chat")
async def chat(
    body: ChatRequest,
    user_id: str = Depends(verify_internal_token),
) -> StreamingResponse:
    builder = _GRAPH_BUILDERS.get(body.graph)
    if builder is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "GRAPH_NOT_FOUND", "graph": body.graph,
                    "known": list(_GRAPH_BUILDERS)},
        )

    thread_id = body.thread_id or f"thread_{uuid.uuid4().hex}"
    run_id = f"run_{uuid.uuid4().hex}"
    graph = builder()

    config = {"configurable": {"thread_id": thread_id, "user_id": user_id, "run_id": run_id}}
    input_state: dict[str, Any] = dict(body.input)
    input_state.setdefault("user_id", user_id)
    input_state.setdefault("thread_id", thread_id)
    input_state.setdefault("run_id", run_id)
    # M2: propagate files from request body into graph state
    if "files" in body.input:
        input_state["files"] = body.input["files"]




    async def event_gen() -> AsyncIterator[str]:
        # Emit run_start immediately so the client knows the request was accepted.
        yield format_sse_event("run_start", {
            "thread_id": thread_id,
            "run_id": run_id,
            "graph": body.graph,
        })
        async for frame in stream_graph(graph, input_state, config, run_id):
            yield frame

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream;charset=UTF-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
