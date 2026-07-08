import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

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


@pytest.mark.asyncio
async def test_finalize_returns_fused_when_multimodal():
    # M3: finalize now owns inline fusion itself. No pre-set state['fused'].
    # We inject the fake model via the `model=` kwarg so we don't depend
    # on get_chat_model (which would need a real api key).
    fake = FakeListChatModel(responses=["综合分析：图片+音频+视频。"])
    state = {
        "modality": "multimodal",
        "analyses": {"image": "...", "audio": "..."},
    }
    out = await finalize(state, model=fake)
    assert out["analysis_result"] == "综合分析：图片+音频+视频。"
    # M3 contract: finalize no longer mirrors the fused value back into
    # state['fused'] (fusion_analyze is gone from the graph). The graph
    # has only `analysis_result` written.
    assert "fused" not in out


@pytest.mark.asyncio
async def test_finalize_skips_inline_fusion_for_single_modality():
    # M3: single-modality paths must NOT trigger an LLM call. finalize
    # should return the analyses[modality] directly. If we don't pass a
    # model and the path tried to call get_chat_model, it would fail
    # (no api key); the fact that this returns cleanly proves no call.
    state = {
        "modality": "text",
        "analyses": {"text": "我理解你的感受。"},
    }
    out = await finalize(state)
    assert out == {"analysis_result": "我理解你的感受。"}
