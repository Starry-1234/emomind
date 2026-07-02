"""M1 classify_input: text-only routing.

Multimodal classification (audio/video/image/doc/multimodal) is added in M2.
For M1, any input with no files (or empty files list) is routed to 'text'.
"""
from __future__ import annotations


async def classify_input(state) -> dict:
    """Decide which analysis node to call next.

    For M1: route everything to text unless files are present (in which case
    we still route to text but emit a warning — true file handling lands in M2).
    """
    files = state.get("files") or []
    if files:
        # M2 will branch here. For M1 we just go text and ignore files.
        return {"modality": "text"}
    return {"modality": "text"}