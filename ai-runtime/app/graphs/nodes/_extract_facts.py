"""extract_facts + extract_facts_and_persist (fire-and-forget long-term memory).

extract_facts: LLM call to MinMax -> [facts]
extract_facts_and_persist: extract -> embed each fact -> upsert in pgvector.
Failures are written to long_term_dead_letter.

These are NOT graph nodes (per spec 06-components); they are
triggered as asyncio.create_task from emit_response. Underscore
prefix on the module name keeps pytest from collecting it as a
test class.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.models.factory import get_embedding_provider
from app.prompts.loader import render_prompt
from app.memory.long_term import UserMemoryStore, MemoryFact

log = logging.getLogger(__name__)

_store: Optional[UserMemoryStore] = None


async def get_user_memory_store() -> UserMemoryStore:
    global _store
    if _store is None:
        _store = await UserMemoryStore.create()
    return _store


def _extract_json_list(text: str) -> list[dict]:
    """Parse LLM JSON list output, robust to code-fenced responses."""
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except Exception:
        pass
    import re
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return []


async def extract_facts(state, model=None) -> list[dict]:
    """LLM call: extract user facts from state.messages.

    Returns [{"key": str, "value": str, "importance": float}, ...]
    """
    llm = model or get_chat_model("minimax")
    messages = state.get("messages", [])
    # Coerce dicts to {"role", "content"} shape if needed
    norm = []
    for m in messages:
        if isinstance(m, dict):
            norm.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        else:
            norm.append({"role": getattr(m, "type", "user"), "content": getattr(m, "content", "")})
    system_prompt = render_prompt("ai_doctor", "system_prompt")
    user_prompt = render_prompt("ai_doctor", "extract_facts", messages=norm)
    reply = await call_llm(llm, [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])
    text = reply.content if isinstance(reply.content, str) else str(reply.content)
    return _extract_json_list(text)


async def extract_facts_and_persist(state) -> None:
    """Fire-and-forget: extract -> embed -> upsert. Failures -> dead_letter."""
    user_id = state.get("user_id")
    try:
        facts = await extract_facts(state)
        if not facts:
            return
        store = await get_user_memory_store()
        embedder = get_embedding_provider("text-embedding-v3")
        # Batch all fact values into one embedding call
        values = [f.get("value", "") for f in facts]
        embeddings = (await embedder.embed(values)) or []
        for f, emb in zip(facts, embeddings):
            try:
                await store.upsert_fact(
                    user_id=user_id,
                    key=f.get("key", "")[:128],
                    value=f.get("value", ""),
                    importance=float(f.get("importance", 0.5)),
                    embedding=list(emb),
                )
            except Exception as inner:
                log.warning("upsert_fact failed for key=%s: %s", f.get("key"), inner)
                # don't abort the whole batch
    except Exception as e:
        log.warning("extract_facts_and_persist failed for user=%s: %s", user_id, e)
        try:
            store = await get_user_memory_store()
            await store.record_dead_letter(
                user_id=user_id,
                payload={"state_keys": list(state.keys())},
                error=str(e),
            )
        except Exception:
            log.exception("dead_letter write also failed")
