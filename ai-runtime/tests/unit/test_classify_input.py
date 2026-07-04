import pytest

from app.graphs.nodes.classify_input import classify_input, _files_to_modalities


@pytest.mark.asyncio
async def test_classify_input_routes_text_when_no_files():
    state = {
        "messages": [{"role": "user", "content": "我最近睡不好"}],
        "files": [],
    }
    out = await classify_input(state)
    assert out["modality"] == "text"
    assert out["modalities"] == ["text"]


@pytest.mark.asyncio
async def test_classify_input_routes_image_for_single_image():
    state = {
        "messages": [{"role": "user", "content": "看看这张图"}],
        "files": [{"file_id": "a", "mime": "image/png", "size": 100, "url": "x"}],
    }
    out = await classify_input(state)
    assert out["modality"] == "image"
    assert out["modalities"] == ["image"]


@pytest.mark.asyncio
async def test_classify_input_routes_audio_for_single_audio():
    state = {"files": [{"file_id": "a", "mime": "audio/wav"}]}
    out = await classify_input(state)
    assert out["modality"] == "audio"
    assert out["modalities"] == ["audio"]


@pytest.mark.asyncio
async def test_classify_input_routes_video_for_single_video():
    state = {"files": [{"file_id": "a", "mime": "video/mp4"}]}
    out = await classify_input(state)
    assert out["modality"] == "video"
    assert out["modalities"] == ["video"]


@pytest.mark.asyncio
async def test_classify_input_routes_doc_for_single_doc():
    state = {"files": [{"file_id": "a", "mime": "application/pdf"}]}
    out = await classify_input(state)
    assert out["modality"] == "doc"
    assert out["modalities"] == ["doc"]


@pytest.mark.asyncio
async def test_classify_input_routes_multimodal_for_mixed_types():
    state = {
        "files": [
            {"file_id": "a", "mime": "image/png"},
            {"file_id": "b", "mime": "audio/wav"},
        ]
    }
    out = await classify_input(state)
    assert out["modality"] == "multimodal"
    assert set(out["modalities"]) == {"image", "audio"}


def test_files_to_modalities_groups_correctly():
    files = [
        {"mime": "image/png"},
        {"mime": "image/jpeg"},
        {"mime": "audio/wav"},
    ]
    mods = _files_to_modalities(files)
    assert set(mods) == {"image", "audio"}
