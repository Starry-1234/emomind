"""M2 ai_doctor graph builder — multimodal path with parallel fan-out.

Graph (text + single-file path):
  START -> classify_input -> [analyze_text|analyze_audio|analyze_video|
                                analyze_image|extract_doc] -> finalize
                                                    -> emit_response -> END

Graph (multimodal path):
  classify_input -> Send(fan-out per modality) -> [analyze_*]
                -> finalize -> emit_response -> END

extract_doc -> analyze_doc (chained in same Send branch).

M3 perf cleanup: dropped the parallel `fusion_analyze` Send. It used to
fan out an empty-analyses slice (its Send branch saw no `analyses` from
its siblings) and always returned `{"fused": ""}`, so `finalize` had to
re-do the fusion inline. Result was 2 LLM calls per multimodal run.
Now `finalize` owns inline fusion as the primary path (1 LLM call).
The standalone `fusion_analyze` function is still importable for direct
unit testing / future callers; it's just no longer wired into the graph.
"""
from __future__ import annotations

from langgraph.constants import Send
from langgraph.graph import END, START, StateGraph

from app.graphs.nodes.analyze_audio import analyze_audio
from app.graphs.nodes.analyze_doc import analyze_doc
from app.graphs.nodes.analyze_image import analyze_image
from app.graphs.nodes.analyze_text import analyze_text
from app.graphs.nodes.analyze_video import analyze_video
from app.graphs.nodes.classify_input import _files_to_modalities, classify_input
from app.graphs.nodes.emit_response import emit_response
from app.graphs.nodes.extract_doc import extract_doc
from app.graphs.nodes.finalize import finalize
from app.graphs.state import AiDoctorState


_MODALITY_TO_NODE = {
    "text": "analyze_text",
    "audio": "analyze_audio",
    "video": "analyze_video",
    "image": "analyze_image",
    "doc": "extract_doc",
}


def _files_of_modality(state: AiDoctorState, modality: str) -> list[dict]:
    files = state.get("files") or []
    prefix = {
        "text": None,  # text comes from messages, not files
        "audio": "audio/",
        "video": "video/",
        "image": "image/",
        "doc": None,  # doc is pdf/txt/docx; check exact mime
    }.get(modality)
    doc_mimes = {
        "application/pdf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    out: list[dict] = []
    for f in files:
        mime = (f.get("mime") or "").lower()
        if modality == "doc":
            if mime in doc_mimes:
                out.append(f)
        elif prefix and mime.startswith(prefix):
            out.append(f)
    return out


def _route_after_classify(state: AiDoctorState):
    """Return one node name (single-modality) or list of Sends (multimodal)."""
    modalities = state.get("modalities") or ["text"]
    if not modalities:
        return "analyze_text"
    if len(modalities) == 1:
        m = modalities[0]
        if m == "doc":
            return "extract_doc"
        return _MODALITY_TO_NODE.get(m, "analyze_text")
    # multimodal: fan out per modality. Inline fusion happens in `finalize`
    # after all per-modality branches write into state['analyses'].
    sends: list[Send] = []
    for m in modalities:
        node = _MODALITY_TO_NODE.get(m)
        if node is None:
            continue
        # Pass a slice of state with only this modality's files
        sliced = {**state, "files": _files_of_modality(state, m)}
        sends.append(Send(node, sliced))
    return sends


def build_ai_doctor_graph():
    g = StateGraph(AiDoctorState)
    g.add_node("classify_input", classify_input)
    g.add_node("analyze_text", analyze_text)
    g.add_node("analyze_audio", analyze_audio)
    g.add_node("analyze_video", analyze_video)
    g.add_node("analyze_image", analyze_image)
    g.add_node("extract_doc", extract_doc)
    g.add_node("analyze_doc", analyze_doc)
    g.add_node("finalize", finalize)
    g.add_node("emit_response", emit_response)

    g.add_edge(START, "classify_input")
    g.add_conditional_edges("classify_input", _route_after_classify, {
        "analyze_text": "analyze_text",
        "analyze_audio": "analyze_audio",
        "analyze_video": "analyze_video",
        "analyze_image": "analyze_image",
        "extract_doc": "extract_doc",
    })
    g.add_edge("extract_doc", "analyze_doc")
    # Each modality branch edges directly to finalize. The `analyses`
    # field uses a reducer (shallow merge) so parallel writes from
    # analyze_* branches all merge into the final dict before finalize
    # reads it. finalize owns inline fusion for multimodal paths.
    g.add_edge("analyze_text", "finalize")
    g.add_edge("analyze_audio", "finalize")
    g.add_edge("analyze_video", "finalize")
    g.add_edge("analyze_image", "finalize")
    g.add_edge("analyze_doc", "finalize")
    g.add_edge("finalize", "emit_response")
    g.add_edge("emit_response", END)
    return g.compile()
