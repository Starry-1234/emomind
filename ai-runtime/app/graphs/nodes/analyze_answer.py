"""M3 analyze_answer: LLM scores 0-4 + extracts emotion tags.

Reads state.pending_question + state.messages[-1] (user's answer).
Calls MinMax LLM with analyze_answer.j2 prompt.
Parses JSON {score, emotion_tags}. Appends to state.answers and
state.emotion_tags; updates state.test_progress.scores[dim].

Note: scores.setdefault(dim, []) guards against questions whose
dimension is not in the primary-dim seed dict (e.g., a question
selected from a related dim in generate_first_question's Phase 2/3).
"""
from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.state import PsychTestState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt


def _extract_json(text: str) -> dict:
    """Robustly extract the first JSON object from LLM output.

    Tries direct json.loads first; falls back to regex r"{.*}" (DOTALL)
    to handle markdown-fenced or trailing-prose output. Returns {} on
    total failure.
    """
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    return {}


async def analyze_answer(state: PsychTestState, model: Any | None = None) -> dict:
    pending = state.get("pending_question") or {}
    messages = state.get("messages") or []
    if not pending or not messages:
        return {}
    last_msg = messages[-1]
    answer_text = last_msg.get("content") if isinstance(last_msg, dict) else str(last_msg)

    system_prompt = render_prompt("psych_test", "system_prompt")
    user_prompt = render_prompt(
        "psych_test",
        "analyze_answer",
        question_text=pending.get("text", ""),
        dimension=pending.get("dimension_cn", pending.get("dimension", "")),
        answer_text=answer_text,
    )
    llm = model if model is not None else get_chat_model("minimax")
    reply = await call_llm(
        llm,
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ],
    )
    raw = reply.content if isinstance(reply.content, str) else str(reply.content)
    parsed = _extract_json(raw)
    score = int(parsed.get("score", 0))
    score = max(0, min(4, score))  # clamp 0-4
    emotion_tags = parsed.get("emotion_tags", []) or []

    answers = list(state.get("answers") or [])
    answers.append(
        {
            "question_id": pending.get("id"),
            "score": score,
            "answer_text": answer_text,
        }
    )
    tags = list(state.get("emotion_tags") or []) + list(emotion_tags)
    progress = dict(state.get("test_progress") or {})
    scores = dict(progress.get("scores") or {})
    dim = pending.get("dimension")
    # setdefault guards against non-primary dims: Phase 2/3 of
    # generate_first_question may select questions whose dimension
    # is not in the seeded scores dict.
    scores.setdefault(dim, []).append(score)
    progress["scores"] = scores

    return {
        "answers": answers,
        "emotion_tags": tags,
        "test_progress": progress,
        "answer_ambiguous": False,  # M3 always False
    }
