import pytest

from app.graphs.nodes.classify_input import classify_input


@pytest.mark.asyncio
async def test_classify_input_returns_text_for_text_only_input():
    state = {
        "messages": [{"role": "user", "content": "我最近睡不好"}],
        "files": [],
    }
    out = await classify_input(state)
    assert out == {"modality": "text"}