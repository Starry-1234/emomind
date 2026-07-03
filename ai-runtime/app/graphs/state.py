"""Shared GraphState TypedDict. M1 only needs the text-path fields."""
from __future__ import annotations

from typing import Optional, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class GraphState(TypedDict, total=False):
    """Base state for all graphs.

    `total=False` so tests can construct partial states without every key.
    """

    # Standard message accumulator (LangGraph convention)
    messages: list[BaseMessage]

    # Common metadata
    user_id: Optional[str]
    thread_id: Optional[str]
    run_id: Optional[str]


class AiDoctorState(GraphState):
    """ai_doctor graph state.

    For M1 we only support the text modality branch; multimodal nodes
    and fields are added in M2.
    """

    modality: Optional[str]      # "text" | "audio" | "video" | "image" | "doc" | "multimodal"
    analyses: Optional[dict]     # {"text": "...", "audio": "..."} — partial results
    analysis_result: Optional[str]  # finalized reply, set by finalize
