"""Unit tests for intent_classifier (M3 Task 5).

Validates:
- start_test intent -> phase=testing
- ask_howto intent -> phase=guide
- invalid intent -> ValueError
"""
from __future__ import annotations

import pytest

from app.graphs.nodes.intent_classifier import intent_classifier


@pytest.mark.asyncio
async def test_intent_classifier_sets_phase_for_start_test():
    state = {"intent": "start_test"}
    out = await intent_classifier(state)
    assert out["phase"] == "testing"


@pytest.mark.asyncio
async def test_intent_classifier_ask_howto_phase_guide():
    state = {"intent": "ask_howto"}
    out = await intent_classifier(state)
    assert out["phase"] == "guide"


@pytest.mark.asyncio
async def test_intent_classifier_invalid_intent_raises():
    state = {"intent": "invalid_thing"}
    with pytest.raises(ValueError, match="Invalid intent"):
        await intent_classifier(state)
