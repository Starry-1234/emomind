"""M2 classify_input: route to one or more analysis nodes.

M1 only routed to 'text'. M2 supports:
  - text only (no files) -> ["text"]
  - single file of one type -> [<that_type>]
  - multiple files of mixed types -> ["image", "audio", "video", "doc", "text"] (fusion)
"""
from __future__ import annotations

from typing import Optional


_MIME_TO_MODALITY = {
    "image": "image",
    "audio": "audio",
    "video": "video",
    "application/pdf": "doc",
    "text/plain": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "doc",
}


def _file_modality(file: dict) -> Optional[str]:
    mime = (file.get("mime") or "").lower()
    # exact match
    if mime in _MIME_TO_MODALITY:
        return _MIME_TO_MODALITY[mime]
    # prefix match (e.g. "image/png" -> "image")
    prefix = mime.split("/")[0] if "/" in mime else ""
    return _MIME_TO_MODALITY.get(prefix)


def _files_to_modalities(files: list[dict]) -> list[str]:
    """Return distinct modalities in stable order (text first if present, then image/audio/video/doc)."""
    seen = set()
    out: list[str] = []
    for f in files:
        m = _file_modality(f)
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out


async def classify_input(state) -> dict:
    files = state.get("files") or []
    if not files:
        # text-only path
        return {"modality": "text", "modalities": ["text"]}
    modalities = _files_to_modalities(files)
    if not modalities:
        # files present but unrecognizable mime -> treat as text fallback
        return {"modality": "text", "modalities": ["text"]}
    if len(modalities) == 1:
        return {"modality": modalities[0], "modalities": modalities}
    return {"modality": "multimodal", "modalities": modalities}
