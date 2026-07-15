"""M4: Real long-term memory load via pgvector similarity search.

Reads state.messages[-1] content, embeds it, queries pgvector for
top-K facts, returns them in state["long_term_memory"].
"""
from __future__ import annotations

from app.graphs.nodes._extract_facts import get_user_memory_store
from app.graphs.state import AiDoctorState


async def load_memory(state: AiDoctorState) -> dict:
    user_id = state.get("user_id")
    messages = state.get("messages") or []
    if not user_id or not messages:
        return {}

    # Use last user message as the query
    last_user = None
    for m in reversed(messages):
        if isinstance(m, dict):
            role = m.get("role", "")
            content = m.get("content", "")
        else:
            role = getattr(m, "type", "")
            content = getattr(m, "content", "")
        if role in ("user", "human") and content:
            last_user = content
            break
    if not last_user:
        return {}

    store = await get_user_memory_store()
    facts = await store.retrieve(user_id, last_user, top_k=5)
    return {
        "long_term_memory": [
            {"key": f.key, "value": f.value, "importance": f.importance, "score": f.score}
            for f in facts
        ]
    }