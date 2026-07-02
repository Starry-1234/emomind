import pytest

from app.graphs.nodes.finalize import finalize


@pytest.mark.asyncio
async def test_finalize_picks_text_analysis_when_modality_is_text():
    state = {
        "modality": "text",
        "analyses": {"text": "我理解你的感受。"},
    }
    out = await finalize(state)
    assert out == {"analysis_result": "我理解你的感受。"}


@pytest.mark.asyncio
async def test_finalize_falls_back_when_modality_missing():
    state = {"analyses": {"text": "hi"}}
    out = await finalize(state)
    assert out == {"analysis_result": "hi"}


@pytest.mark.asyncio
async def test_finalize_returns_empty_string_when_nothing_to_finalize():
    state = {"modality": "text"}
    out = await finalize(state)
    assert out == {"analysis_result": ""}