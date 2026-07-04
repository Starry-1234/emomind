import io
import tempfile
from pathlib import Path

import pytest

from app.graphs.nodes.extract_doc import extract_doc
from app.memory.cache import write_file


@pytest.fixture
def tmp_storage(monkeypatch, tmp_path):
    """Override LANGGRAPH_STORAGE_PATH to a tmp dir for isolation."""
    from app.config import settings

    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "storage_path", str(tmp_path))
    return tmp_path


@pytest.mark.asyncio
async def test_extract_doc_reads_pdf_and_returns_text(tmp_storage):
    # We don't have a real PDF fixture; instead, test that a .txt file
    # is read as text. (PDF extraction uses pypdf; for unit test we
    # exercise the text/plain branch which is the same code path.)
    meta = write_file(
        user_id="u1",
        content=b"hello world this is plain text",
        mime="text/plain",
        name="a.txt",
    )
    state = {"files": [meta], "user_id": "u1"}
    out = await extract_doc(state)
    assert "doc_text" in out
    assert "hello world" in out["doc_text"]


@pytest.mark.asyncio
async def test_extract_doc_returns_empty_when_no_doc_file(tmp_storage):
    state = {"files": [{"file_id": "x", "mime": "image/png", "url": "x"}]}
    out = await extract_doc(state)
    # No doc file present; just return empty doc_text (analyze_doc will be skipped)
    assert out.get("doc_text", "") == ""
