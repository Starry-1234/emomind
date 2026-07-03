"""M1 ai_doctor graph builder — text-only path.

START -> classify_input -> analyze_text -> finalize -> emit_response -> END

Multimodal branches (audio/video/image/doc/fusion) are added in M2.
"""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from app.graphs.nodes.analyze_text import analyze_text
from app.graphs.nodes.classify_input import classify_input
from app.graphs.nodes.emit_response import emit_response
from app.graphs.nodes.finalize import finalize
from app.graphs.state import AiDoctorState


def build_ai_doctor_graph():
    g = StateGraph(AiDoctorState)
    g.add_node("classify_input", classify_input)
    g.add_node("analyze_text", analyze_text)
    g.add_node("finalize", finalize)
    g.add_node("emit_response", emit_response)

    g.add_edge(START, "classify_input")
    g.add_edge("classify_input", "analyze_text")  # M1: always text
    g.add_edge("analyze_text", "finalize")
    g.add_edge("finalize", "emit_response")
    g.add_edge("emit_response", END)

    # M4 will add: g = g.compile(checkpointer=get_checkpointer())
    # For M1 we compile without checkpointer.
    return g.compile()
