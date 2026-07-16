"""Integration: full start_test -> N Q&A -> report path with mocked LLMs.

M3 spec calls for ~30 questions; the test uses a 6-question bank for
speed (the InMemorySaver + RAG select path is the same regardless of bank
size). All LLM calls are mocked with FakeListChatModel + monkeypatched
get_chat_model, and the embedding provider is a deterministic 4-dim mock.
"""
from __future__ import annotations

import json

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graphs.psych_test import build_psych_test_graph
from app.graphs.nodes._test_bank_cache import TestBankCache


class _MockEmbedding:
    """Deterministic 4-dim embeddings keyed off text length."""

    dim = 4

    async def embed(self, texts):
        return [
            [float(len(t) % 7), float(len(t) % 5), float(len(t) % 3), float(len(t) % 2)]
            for t in texts
        ]


@pytest.fixture
def small_bank(tmp_path, monkeypatch):
    """Write a 6-question bank (2 per dimension across 3 dims) and reset cache."""
    bank = [
        {
            "id": f"{dim}_{i:02d}",
            "text": f"{dim} q{i}",
            "dimension": dim,
            "dimension_cn": dim,
            "keywords": "",
        }
        for dim in ("mood", "sleep", "anxiety")
        for i in range(2)
    ]
    bank_path = tmp_path / "question_bank.json"
    bank_path.write_text(json.dumps(bank, ensure_ascii=False), encoding="utf-8")
    import app.graphs.nodes._test_bank_cache as cache_mod
    monkeypatch.setattr(cache_mod, "QUESTION_BANK_PATH", bank_path)
    cache_mod._cache = TestBankCache()
    return bank


@pytest.mark.asyncio
async def test_full_qa_loop(small_bank, monkeypatch):
    monkeypatch.setenv("LANGGRAPH_MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("LANGGRAPH_QWEN_API_KEY", "test-key")
    monkeypatch.setenv("LANGGRAPH_EMBEDDING_API_KEY", "test-key")

    # Reset cache for this test (fixture also resets, but defensive)
    import app.graphs.nodes._test_bank_cache as cache_mod
    cache_mod._cache = TestBankCache()

    # Patch the embedding provider in load_test_template AND
    # generate_first_question module namespaces (same M2 pattern).
    from app.graphs.nodes import generate_first_question as gfq_mod
    from app.graphs.nodes import load_test_template as lt_mod

    monkeypatch.setattr(lt_mod, "get_embedding_provider", lambda name: _MockEmbedding())
    monkeypatch.setattr(gfq_mod, "get_embedding_provider", lambda name: _MockEmbedding())

    # Build LLM responses — sequence is:
    #   1) generate_first_question intake confirmation
    #   2..N+1) analyze_answer for each of N questions
    #   last) generate_report
    intake_resp = "我理解你的状态。"
    analyze_responses = [json.dumps({"score": 2, "emotion_tags": ["焦虑"]})] * 6
    report_resp = "总分较高。建议：寻求专业支持。"
    fake = FakeListChatModel(responses=[intake_resp] + analyze_responses + [report_resp])

    # Monkeypatch get_chat_model in all relevant nodes.
    import app.graphs.nodes.analyze_answer as aa
    import app.graphs.nodes.generate_report as gr

    for mod in (gfq_mod, aa, gr):
        monkeypatch.setattr(mod, "get_chat_model", lambda name, _f=fake: _f)

    try:
        graph = await build_psych_test_graph()
    except Exception as e:
        pytest.skip(f"Postgres unavailable: {e}")
    config = {"configurable": {"thread_id": "test-thread-1"}}

    # Phase 1: start_test -> intake confirmation + 6 questions loaded
    out1 = await graph.ainvoke(
        {
            "intent": "start_test",
            "messages": [{"role": "user", "content": "我最近心情低落"}],
            "user_id": "u1",
        },
        config=config,
    )
    assert "questions" in out1
    assert len(out1["questions"]) == 6
    assert "assistant_reply" in out1

    # Phase 2: answer all 6 (one at a time) — the checkpointer threads state
    state = dict(out1)
    for i in range(6):
        pending = state.get("pending_question") or {}
        if not pending:
            break
        result = await graph.ainvoke(
            {
                "intent": "answer",
                "messages": [
                    {"role": "assistant", "content": pending.get("text", "")},
                    {"role": "user", "content": f"answer {i}"},
                ],
            },
            config=config,
        )
        state.update(result)

    assert "report" in state
    assert state["report"]["total_score"] == 12  # 6 questions x score 2
    assert state["report"]["total_max"] == 24  # 6 questions x max 4
    assert state.get("test_record_id", "").startswith("stub-")