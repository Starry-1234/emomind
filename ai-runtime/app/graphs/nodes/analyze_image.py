"""M2 analyze_image: read image file, call Qwen3-Omni vision API."""
from __future__ import annotations

import base64
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.state import AiDoctorState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.memory.cache import get_meta, read_file
from app.prompts.loader import render_prompt


async def analyze_image(state: AiDoctorState, model: Any | None = None) -> dict:
    files = state.get("files") or []
    user_id = state.get("user_id") or ""
    for f in files:
        mime = (f.get("mime") or "").lower()
        if not mime.startswith("image/"):
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
        b64 = base64.b64encode(content).decode("ascii")
        system_prompt = render_prompt("ai_doctor", "system_prompt")
        user_prompt = render_prompt("ai_doctor", "analyze_image", image_b64=b64, mime=mime)
        llm = model if model is not None else get_chat_model("qwen3-omni")
        reply = await call_llm(llm, [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])
        text = reply.content if isinstance(reply.content, str) else str(reply.content)
        analyses = dict(state.get("analyses") or {})
        analyses["image"] = text
        return {"analyses": analyses}
    return {"analyses": dict(state.get("analyses") or {})}
