import pytest
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.llm_retry import call_llm


class _TransientThenOK:
    """Fake model that raises a transient-looking error once, then succeeds."""

    def __init__(self):
        self.calls = 0

    async def ainvoke(self, messages: list[BaseMessage]) -> BaseMessage:
        self.calls += 1
        if self.calls == 1:
            raise Exception("RateLimitError: try again")  # matches retryable pattern
        return AIMessage(content="ok")


class _AlwaysFails:
    def __init__(self):
        self.calls = 0

    async def ainvoke(self, messages):
        self.calls += 1
        raise Exception("BadRequestError: invalid")


@pytest.mark.asyncio
async def test_call_llm_retries_on_transient_then_succeeds():
    m = _TransientThenOK()
    out = await call_llm(m, [])  # type: ignore[arg-type]
    assert out.content == "ok"
    assert m.calls == 2


@pytest.mark.asyncio
async def test_call_llm_does_not_retry_on_hard_error():
    m = _AlwaysFails()
    with pytest.raises(Exception, match="BadRequestError"):
        await call_llm(m, [])  # type: ignore[arg-type]
    assert m.calls == 1