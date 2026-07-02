"""Pick the final reply from analysis branches and stuff into analysis_result."""
from __future__ import annotations

from app.graphs.state import AiDoctorState


async def finalize(state: AiDoctorState) -> dict:
    """Return the analysis text matching the modality.

    For M1 only 'text' branch exists; if a key is missing we fall back to
    the first available analysis, then to empty string.
    """
    analyses = state.get("analyses") or {}
    modality = state.get("modality") or "text"
    text = analyses.get(modality) or next(iter(analyses.values()), "")
    return {"analysis_result": text}