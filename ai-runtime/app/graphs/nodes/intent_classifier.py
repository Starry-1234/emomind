"""M3 intent_classifier: thin validator. Trusts frontend intent.

Replaces the spec's LLM-based classifier (per user decision 2026-07-05).
Sets state.phase based on intent.
"""
from __future__ import annotations

from app.graphs.state import PsychTestState

_VALID_INTENTS = {"ask_howto", "start_test", "answer", "chitchat"}

_INTENT_TO_PHASE = {
    "ask_howto": "guide",
    "chitchat": "guide",
    "start_test": "testing",
    "answer": "testing",
}


async def intent_classifier(state: PsychTestState) -> dict:
    intent = state.get("intent")
    if intent not in _VALID_INTENTS:
        raise ValueError(
            f"Invalid intent: {intent!r}. Valid: {sorted(_VALID_INTENTS)}"
        )
    return {"phase": _INTENT_TO_PHASE.get(intent, "guide")}
