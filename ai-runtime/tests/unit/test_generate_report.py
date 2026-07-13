"""Unit tests for generate_report (M3 Task 5).

Validates:
- per-dimension aggregate (sum) + total_score / total_max computed from
  state.test_progress.scores.
- 1 MinMax LLM call (FakeListChatModel) yields interpretation + recommendations.
- Sets state.report with total_score, total_max, dimension_breakdown, etc.
"""
from __future__ import annotations

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.nodes.generate_report import generate_report


@pytest.mark.asyncio
async def test_generate_report_computes_dim_and_total(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    fake = FakeListChatModel(responses=["综合评估：总分较高。建议：寻求专业支持。"])
    state = {
        "test_progress": {
            "current": 30, "total": 30,
            "scores": {"mood": [3, 2, 3], "sleep": [4, 4, 3]},  # 2 dims, 3 questions each
        },
        "emotion_tags": ["焦虑", "失眠"],
        "answers": [{"question_id": f"q{i}", "score": 3, "answer_text": ""} for i in range(6)],
    }
    out = await generate_report(state, model=fake)
    report = out["report"]
    assert report["total_score"] == 19  # 3+2+3 + 4+4+3
    assert report["total_max"] == 24  # 6 questions x 4
    assert "mood" in report["dimension_breakdown"]
    assert "interpretation" in report
    assert "recommendations" in report
