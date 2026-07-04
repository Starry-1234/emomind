"""Extract text from a document file (pdf/docx/txt).

Reads state.files[0] (the doc file), reads the binary from
cache, runs pypdf / python-docx / raw decode, stores the result
in state['doc_text'] for analyze_doc to consume.
"""
from __future__ import annotations

from app.memory.cache import get_meta, read_file


def _extract_text(content: bytes, mime: str) -> str:
    if mime == "text/plain":
        return content.decode("utf-8", errors="replace")
    if mime == "application/pdf":
        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(content))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""
    if mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            import docx
            import io
            d = docx.Document(io.BytesIO(content))
            return "\n\n".join(p.text for p in d.paragraphs)
        except Exception:
            return ""
    return ""


async def extract_doc(state) -> dict:
    files = state.get("files") or []
    user_id = state.get("user_id") or ""
    for f in files:
        mime = (f.get("mime") or "").lower()
        if not mime.startswith("application/pdf") and mime != "text/plain" \
           and "wordprocessingml" not in mime:
            continue
        file_id = f.get("file_id")
        if not file_id:
            continue
        meta = get_meta(file_id)
        if meta is None or meta.get("user_id") != user_id:
            continue
        content = read_file(file_id, user_id)
        if content is None:
            continue
        return {"doc_text": _extract_text(content, mime)}
    return {"doc_text": ""}
