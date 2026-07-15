"""M3 psych_test graph builder — 12 nodes + 2 routing functions.

Graph:
  START -> load_test_template -> load_memory -> intent_classifier
  intent_classifier -> [route_by_intent]
      ask_howto/chitchat -> guide_assistant -> emit_response -> END
      start_test       -> generate_first_question -> emit_response -> END
      answer           -> analyze_answer -> update_progress
                            -> [route_after_answer]
                                current<total:  next_question -> generate_next_question -> emit_response
                                current==total: complete -> generate_report -> persist_test_record
                                                                          -> emit_response -> END
  clarify_answer: M3 always-skipped (route_after_answer never returns 'clarify'
    unless state.answer_ambiguous is set, which analyze_answer never does in M3).

Phase collision resolution:
  Both intent_classifier and generate_first_question write state.phase="testing"
  on the start_test path. They produce the same value, so the second write is a
  no-op against the LangGraph reducer (TypedDict field assignment with the same
  value). intent_classifier owns the intent->phase mapping for ALL routes;
  generate_first_question additionally writes phase="testing" defensively to
  keep its existing M3 Task 3 unit-test contract (test_generate_first_question.py
  asserts `out["phase"] == "testing"`). Both writes are aligned; no graph
  assertion breaks.

M4: builder is now async and uses AsyncPostgresSaver via
  await get_checkpointer(). Module-level InMemorySaver was removed
  (T6).
"""
from __future__ import annotations

from langgraph.constants import END, START
from langgraph.graph import StateGraph

from app.graphs.nodes.analyze_answer import analyze_answer
from app.graphs.nodes.clarify_answer import clarify_answer
from app.graphs.nodes.emit_response import emit_response
from app.graphs.nodes.generate_first_question import generate_first_question
from app.graphs.nodes.generate_next_question import generate_next_question
from app.graphs.nodes.generate_report import generate_report
from app.graphs.nodes.guide_assistant import guide_assistant
from app.graphs.nodes.intent_classifier import intent_classifier
from app.graphs.nodes.load_memory import load_memory
from app.graphs.nodes.load_test_template import load_test_template
from app.graphs.nodes.persist_test_record import persist_test_record
from app.graphs.nodes.update_progress import update_progress
from app.graphs.state import PsychTestState
from app.memory.checkpointer import get_checkpointer


def route_by_intent(state: PsychTestState) -> str:
    """Route after intent_classifier. Returns a node name string (no Send)."""
    intent = state.get("intent")
    if intent in ("ask_howto", "chitchat"):
        return "guide_assistant"
    if intent == "start_test":
        return "generate_first_question"
    if intent == "answer":
        return "analyze_answer"
    return "guide_assistant"  # default: route any unknown intent to guide


def route_after_answer(state: PsychTestState) -> str:
    """Route after update_progress. Returns the next node name.

    M3 never sets answer_ambiguous=True, so 'clarify_answer' is unreachable
    in M3. M5 will add LLM-based ambiguity detection.
    """
    if state.get("answer_ambiguous"):
        return "clarify_answer"
    progress = state.get("test_progress") or {}
    current = progress.get("current", 0)
    total = progress.get("total", 1)
    if current >= total:
        return "generate_report"
    return "generate_next_question"


# M4: Module-level InMemorySaver was removed. The checkpointer is now
# AsyncPostgresSaver, acquired via await get_checkpointer() at build time.


async def build_psych_test_graph():
    g = StateGraph(PsychTestState)
    g.add_node("load_test_template", load_test_template)
    g.add_node("load_memory", load_memory)
    g.add_node("intent_classifier", intent_classifier)
    g.add_node("guide_assistant", guide_assistant)
    g.add_node("generate_first_question", generate_first_question)
    g.add_node("generate_next_question", generate_next_question)
    g.add_node("analyze_answer", analyze_answer)
    g.add_node("update_progress", update_progress)
    g.add_node("clarify_answer", clarify_answer)
    g.add_node("generate_report", generate_report)
    g.add_node("persist_test_record", persist_test_record)
    g.add_node("emit_response", emit_response)

    g.add_edge(START, "load_test_template")
    g.add_edge("load_test_template", "load_memory")
    g.add_edge("load_memory", "intent_classifier")

    g.add_conditional_edges("intent_classifier", route_by_intent)
    g.add_edge("guide_assistant", "emit_response")
    g.add_edge("generate_first_question", "emit_response")
    g.add_edge("emit_response", END)

    g.add_edge("analyze_answer", "update_progress")
    g.add_conditional_edges("update_progress", route_after_answer)
    g.add_edge("generate_next_question", "emit_response")
    g.add_edge("clarify_answer", "emit_response")
    g.add_edge("generate_report", "persist_test_record")
    g.add_edge("persist_test_record", "emit_response")

    checkpointer = await get_checkpointer()
    return g.compile(checkpointer=checkpointer)