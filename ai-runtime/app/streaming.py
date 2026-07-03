"""graph.astream_events -> SSE frame serializer.

M1 implements:
  - on_chain_start for known node names -> SSE 'node_start'
  - on_chat_model_stream (AIMessageChunk content delta) -> SSE 'token'
  - on_chain_end for emit_response -> SSE 'message_end' with full_content

We deliberately do NOT try to handle every astream event type — only
the ones the frontend cares about. Other events are silently dropped.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from langchain_core.messages import AIMessageChunk

# Node names whose on_chain_start we surface as SSE 'node_start'.
_TRACKED_NODE_NAMES = frozenset({
    "classify_input",
    "analyze_text",
    "finalize",
    "emit_response",
})


def format_sse_event(event: str, data: dict[str, Any]) -> str:
    """One SSE frame: 'event: <name>\\ndata: <json>\\n\\n'."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def stream_graph(
    graph: Any,
    input_state: dict[str, Any],
    config: dict[str, Any],
    run_id: str,
    *,
    timeout_seconds: int = 120,
) -> AsyncIterator[str]:
    """Yield SSE frames from graph.astream_events(version='v2')."""
    thread_id = config.get("configurable", {}).get("thread_id", "")
    accumulated = ""
    full_content = ""

    try:
        async with asyncio.timeout(timeout_seconds):
            async for event in graph.astream_events(input_state, config=config, version="v2"):
                kind = event.get("event")
                name = event.get("name", "")
                data = event.get("data", {}) or {}

                if kind == "on_chain_start" and name in _TRACKED_NODE_NAMES:
                    yield format_sse_event("node_start", {"name": name, "ts": datetime.now(timezone.utc).isoformat()})

                elif kind == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    if isinstance(chunk, AIMessageChunk):
                        delta = chunk.content or ""
                        if isinstance(delta, str) and delta:
                            accumulated += delta
                            yield format_sse_event("token", {
                                "delta": delta,
                                "thread_id": thread_id,
                                "run_id": run_id,
                            })

                elif kind == "on_chain_end" and name == "emit_response":
                    # The 'analysis_result' key was written by finalize earlier
                    output = data.get("output") or {}
                    full_content = output.get("analysis_result") or accumulated
                    yield format_sse_event("message_end", {
                        "thread_id": thread_id,
                        "run_id": run_id,
                        "full_content": full_content,
                        "files": [],
                    })

    except asyncio.TimeoutError:
        yield format_sse_event("error", {
            "code": "LLM_TIMEOUT",
            "message": "Graph execution timed out",
            "recoverable": True,
            "thread_id": thread_id,
            "run_id": run_id,
        })
    except asyncio.CancelledError:
        # User-initiated stop; the streaming layer above is responsible for
        # any cleanup. Don't emit an error event.
        return
    except Exception as exc:
        yield format_sse_event("error", {
            "code": "INTERNAL_ERROR",
            "message": str(exc),
            "recoverable": False,
            "thread_id": thread_id,
            "run_id": run_id,
        })
