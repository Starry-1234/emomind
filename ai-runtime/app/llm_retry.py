"""Tenacity-based retry decorator for LLM calls.

Retries on transient errors (rate limit, timeout, server errors); gives up
immediately on hard errors (bad request, auth). Spec: 05-testing-milestones.md
§2.2 'LLM 抛 BadRequestError → 不重试；LLM 抛 RateLimitError → 重试 2 次后抛'.
"""
import logging
from typing import Any

from langchain_core.messages import BaseMessage
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

log = logging.getLogger(__name__)


def _is_retryable(exc: BaseException) -> bool:
    """Return True for transient errors worth retrying.

    Checks both the exception class name (e.g. RateLimitError, APITimeoutError)
    and the message text, so that bare ``Exception("RateLimitError: ...")``
    used in tests is also classified correctly.
    """
    name = exc.__class__.__name__.lower()
    msg = str(exc).lower()
    transient_markers = (
        "ratelimit",
        "ratelimitexceeded",
        "timeout",
        "timeoutexception",
        "apitimeouterror",
        "apiconnectionerror",
        "serviceunavailable",
        "internalservererror",
    )
    return any(m in name or m in msg for m in transient_markers)


async def call_llm(model: Any, messages: list[BaseMessage]) -> BaseMessage:
    """Call model.ainvoke with up to 3 attempts on transient errors."""

    @retry(
        retry=retry_if_exception(_is_retryable),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        reraise=True,
        before_sleep=lambda rs: log.warning(
            "llm retry attempt=%s exc=%s", rs.attempt_number, rs.outcome.exception()
        ),
    )
    async def _go() -> BaseMessage:
        return await model.ainvoke(messages)

    return await _go()
