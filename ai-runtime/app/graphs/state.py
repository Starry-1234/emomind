"""Shared GraphState TypedDict. M1 has text fields; M2 adds multimodal."""
from __future__ import annotations

from typing import Annotated, Any, Optional, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class GraphState(TypedDict, total=False):
    """Base state for all graphs.

    `total=False` so tests can construct partial states without every key.
    """

    messages: list[BaseMessage]
    user_id: Optional[str]
    thread_id: Optional[str]
    run_id: Optional[str]


def _merge_analyses(a: Optional[dict], b: Optional[dict]) -> dict:
    """Reducer for parallel analyze_* branches: shallow merge keys per-modality."""
    out: dict[str, Any] = {}
    if a:
        out.update(a)
    if b:
        out.update(b)
    return out


class AiDoctorState(GraphState):
    """ai_doctor graph state.

    M1: text-only path.
    M2: adds multimodal (files, modalities, fused).
    """

    modality: Optional[str]      # "text" | "audio" | "video" | "image" | "doc" | "multimodal"
    modalities: Optional[list[str]]  # M2: list of detected modalities (for fan-out)
    # `analyses` uses a reducer so parallel branches in multimodal mode merge
    # per-modality keys into one dict (instead of clobbering).
    analyses: Annotated[Optional[dict], _merge_analyses]
    analysis_result: Optional[str]

    # M2 additions
    files: Optional[list[dict]]  # [{"file_id": ..., "mime": ..., ...}]
    doc_text: Optional[str]      # intermediate: extract_doc -> analyze_doc
    fused: Optional[str]         # output of fusion_analyze


class PsychTestState(GraphState):
    """psych_test graph state (M3).

    For M3 only the text path is supported; multimodal nodes
    (added in M4) will reuse the ai_doctor multimodal graph.
    """

    # intent routing
    intent: Optional[str]                    # "ask_howto" | "start_test" | "answer" | "chitchat"
    phase: Optional[str]                     # "guide" | "testing" | "reporting"

    # test bank (loaded by load_test_template; same for all sessions)
    test_bank: Optional[dict]

    # 30 selected questions for the current test
    questions: Optional[list[str]]
    pending_question: Optional[dict]
    current: Optional[int]
    answers: Optional[list[dict]]

    # progress
    test_progress: Optional[dict]
    emotion_tags: Optional[list[str]]
    answer_ambiguous: Optional[bool]          # M3 always False

    # report
    report: Optional[dict]
    test_record_id: Optional[str]
