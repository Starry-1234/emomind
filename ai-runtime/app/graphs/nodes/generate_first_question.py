"""M3 generate_first_question: RAG select ~30 questions + intake confirmation.

Algorithm (per spec):
  1. Embed user input (1 Qwen API call)
  2. Cosine similarity to each dim centroid -> rank -> top 3 primary dims
  3. From primary dims, take top 10 questions each (by per-question
     cosine sim to user embedding)
  4. If total < 30, fall back to RELATED_DIMS for that dim
  5. If still < 30, fill from any remaining questions
  6. Write state.questions (~30 ids), state.current=0,
     state.pending_question=first question, state.test_progress
  7. Call MinMax LLM for intake confirmation text
     ("I understand you're concerned about X, Y, Z; I'll ask N
     questions about these areas")
"""
from __future__ import annotations

import math
from typing import Any, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.nodes._test_bank_cache import ensure_loaded
from app.graphs.state import PsychTestState
from app.llm_retry import call_llm
from app.models.embedding import EmbeddingProvider
from app.models.factory import get_chat_model, get_embedding_provider
from app.prompts.loader import render_prompt


RELATED_DIMS: dict[str, list[str]] = {
    "mood": ["interest", "motivation"],
    "interest": ["mood", "motivation"],
    "sleep": ["cognitive", "anxiety"],
    "cognitive": ["sleep", "anxiety"],
    "anxiety": ["sleep", "cognitive", "irritability"],
    "irritability": ["anxiety", "social"],
    "social": ["irritability", "mood"],
    "motivation": ["mood", "interest", "stress"],
    "stress": ["anxiety", "sleep", "motivation"],
}


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _select_questions(
    user_embedding: list[float],
    cache,
    primary_dims: list[str],
    n_per_dim: int = 10,
    target_total: int = 30,
) -> list[str]:
    """Pick up to target_total questions, top n_per_dim from each primary dim,
    falling back to related dims and then any remaining if needed.

    Three phases (single, consolidated function — no monkey-patching):
      1. Primary dims: top n_per_dim per dim by cosine sim to user embedding.
      2. Related dims: for each primary, iterate RELATED_DIMS[d], top n_per_dim.
      3. Wildcard: any remaining questions not yet selected, top target_total.
    """
    selected: list[str] = []
    selected_set: set[str] = set()

    def add(dim: str, n: int) -> None:
        cands = [
            (qid, _cosine(user_embedding, cache.question_embeddings[qid]))
            for qid in (q["id"] for q in cache.questions if q["dimension"] == dim)
            if qid not in selected_set
        ]
        cands.sort(key=lambda x: x[1], reverse=True)
        for qid, _ in cands[:n]:
            if qid not in selected_set:
                selected.append(qid)
                selected_set.add(qid)

    # Phase 1: primary dims
    for dim in primary_dims:
        add(dim, n_per_dim)
        if len(selected) >= target_total:
            return selected[:target_total]

    # Phase 2: related dims
    for dim in primary_dims:
        for rel in RELATED_DIMS.get(dim, []):
            add(rel, n_per_dim)
            if len(selected) >= target_total:
                return selected[:target_total]

    # Phase 3: wildcard — any remaining questions
    remaining = [
        (qid, _cosine(user_embedding, cache.question_embeddings[qid]))
        for qid in (q["id"] for q in cache.questions)
        if qid not in selected_set
    ]
    remaining.sort(key=lambda x: x[1], reverse=True)
    for qid, _ in remaining:
        if qid not in selected_set:
            selected.append(qid)
            selected_set.add(qid)
            if len(selected) >= target_total:
                return selected[:target_total]

    return selected[:target_total]


async def generate_first_question(
    state: PsychTestState,
    *,
    model: Any | None = None,
    embedding_provider: Optional[EmbeddingProvider] = None,
) -> dict:
    """Select ~30 questions via RAG; emit intake confirmation.

    Returns empty dict if intent != 'start_test' or no user message (the
    caller / route_by_intent is responsible for skipping this node in
    those cases; we keep the safety check here as a defensive guard).
    """
    if state.get("intent") != "start_test":
        return {}

    user_messages = state.get("messages") or []
    if not user_messages:
        return {}
    last = user_messages[-1]
    user_text = last.get("content") if isinstance(last, dict) else str(last)

    # 1. Ensure cache loaded; embed user input; 2. RAG select
    embedding_provider = embedding_provider or get_embedding_provider("text-embedding-v3")
    cache = await ensure_loaded(embedding_provider)
    user_vec = (await embedding_provider.embed([user_text]))[0]

    # Rank dimensions by centroid similarity
    dim_scores = [
        (dim, _cosine(user_vec, centroid))
        for dim, centroid in cache.dim_centroids.items()
    ]
    dim_scores.sort(key=lambda x: x[1], reverse=True)
    primary_dims = [d for d, _ in dim_scores[:3]]

    # Select questions (up to 30)
    selected_ids = _select_questions(
        user_vec, cache, primary_dims, n_per_dim=10, target_total=30
    )

    # Look up question dicts
    qid_to_q = {q["id"]: q for q in cache.questions}
    selected_qs = [qid_to_q[qid] for qid in selected_ids]

    # 3. LLM intake confirmation
    primary_dims_cn = []
    for d in primary_dims:
        for q in selected_qs:
            if q["dimension"] == d and q["dimension_cn"] not in primary_dims_cn:
                primary_dims_cn.append(q["dimension_cn"])
                break
    system_prompt = render_prompt("psych_test", "system_prompt")
    user_prompt = render_prompt(
        "psych_test",
        "intake_confirmation",
        user_text=user_text,
        primary_dims=", ".join(primary_dims_cn) if primary_dims_cn else "未明确",
        question_count=len(selected_qs),
    )
    llm = model if model is not None else get_chat_model("minimax")
    reply = await call_llm(
        llm,
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ],
    )
    assistant_reply = reply.content if isinstance(reply.content, str) else str(reply.content)

    # 4. Write state
    return {
        "questions": selected_ids,
        "current": 0,
        "pending_question": selected_qs[0] if selected_qs else None,
        "test_progress": {
            "current": 0,
            "total": len(selected_qs),
            "scores": {d: [] for d in primary_dims},
        },
        "phase": "testing",
        "assistant_reply": assistant_reply,
    }