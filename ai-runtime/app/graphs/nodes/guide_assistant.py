"""M3 guide_assistant: LLM reply for ask_howto/chitchat intents."""
from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.graphs.state import PsychTestState
from app.llm_retry import call_llm
from app.models.factory import get_chat_model
from app.prompts.loader import render_prompt


async def guide_assistant(state: PsychTestState, model: Any | None = None) -> dict:
    messages = state.get("messages") or []
    user_text = messages[-1].get("content") if messages and isinstance(messages[-1], dict) else ""
    system_prompt = render_prompt("psych_test", "system_prompt")
    user_prompt = (
        "来访者问：\n" + user_text + "\n\n"
        "请基于'小心'的角色设定，回答 TA 关于心理测评的问题。直接输出回复。"
    )
    llm = model if model is not None else get_chat_model("minimax")
    reply = await call_llm(llm, [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])
    text = reply.content if isinstance(reply.content, str) else str(reply.content)
    return {"assistant_reply": text}
