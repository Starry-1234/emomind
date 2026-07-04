"""Local filesystem file storage for uploaded user files.

Layout:
  ${LANGGRAPH_STORAGE_PATH}/
    2026/
      07/
        04/
          <file_id>.png
          ...
        _meta/
          2026-07-04.jsonl  # one record per line

Each meta record:
  {"file_id": "...", "user_id": "...", "mime": "...", "size": N,
   "name": "original.png", "path": "/abs/path/...png", "uploaded_at": "ISO-8601"}

Per-user ACL lands in M4; M2 trusts the X-Internal-Token boundary.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import settings

_MIME_WHITELIST = frozenset({
    # images
    "image/jpeg", "image/png", "image/webp", "image/gif",
    # audio
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm",
    # video
    "video/mp4", "video/webm", "video/quicktime",
    # documents
    "application/pdf", "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
})

_MIME_TO_EXT = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
    "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/ogg": ".ogg",
    "audio/mp4": ".m4a", "audio/webm": ".webm",
    "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov",
    "application/pdf": ".pdf", "text/plain": ".txt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}


def _is_mime_allowed(mime: str) -> bool:
    return mime in _MIME_WHITELIST


def _ext_for(mime: str) -> str:
    return _MIME_TO_EXT.get(mime, ".bin")


def _meta_log_for(now: datetime, base: Path) -> Path:
    yyyy = now.strftime("%Y")
    mm = now.strftime("%m")
    dd = now.strftime("%d")
    return base / yyyy / mm / dd / "_meta" / f"{yyyy}-{mm}-{dd}.jsonl"


def write_file(
    *, user_id: str, content: bytes, mime: str, name: str
) -> dict:
    """Write content to disk, append meta record, return meta dict."""
    if not _is_mime_allowed(mime):
        raise ValueError(f"Unsupported mime type: {mime!r}")
    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise ValueError(
            f"File too large: {len(content)} bytes (max {settings.max_file_size_mb} MB)"
        )
    now = datetime.now(timezone.utc)
    file_id = uuid.uuid4().hex
    base = Path(settings.storage_path)
    yyyy, mm, dd = now.strftime("%Y"), now.strftime("%m"), now.strftime("%d")
    ext = _ext_for(mime)
    target_dir = base / yyyy / mm / dd
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"{file_id}{ext}"
    target_path.write_bytes(content)
    meta_log = _meta_log_for(now, base)
    meta_log.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "file_id": file_id,
        "user_id": user_id,
        "mime": mime,
        "size": len(content),
        "name": name,
        "path": str(target_path),
        "uploaded_at": now.isoformat(),
    }
    with open(meta_log, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
    return record


def get_meta(file_id: str) -> Optional[dict]:
    """Find the meta record for file_id. Walks meta logs."""
    base = Path(settings.storage_path)
    if not base.exists():
        return None
    # meta logs live at <base>/YYYY/MM/DD/_meta/YYYY-MM-DD.jsonl
    for log_path in base.glob("**/_meta/*.jsonl"):
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    rec = json.loads(line)
                    if rec.get("file_id") == file_id:
                        return rec
        except (OSError, json.JSONDecodeError):
            continue
    return None


def read_file(file_id: str, user_id: str) -> Optional[bytes]:
    """Read file bytes; checks user_id matches (M2 soft ACL; M4 hard ACL)."""
    meta = get_meta(file_id)
    if meta is None:
        return None
    if meta.get("user_id") != user_id:
        return None
    path = Path(meta["path"])
    if not path.exists():
        return None
    return path.read_bytes()