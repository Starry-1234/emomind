"""Internal token validator. Used by every /v1/* endpoint.

Spring Boot injects X-Internal-Token (must match LANGGRAPH_INTERNAL_TOKEN)
and X-User-Id on every request. Returns the user_id to the route handler.
"""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from app.config import settings


async def verify_internal_token(
    x_internal_token: str | None = Header(None, alias="X-Internal-Token"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> str:
    """Constant-time compare to prevent timing attacks.

    Headers are optional at the FastAPI layer so missing/empty values
    produce a 401 (INVALID_INTERNAL_TOKEN) rather than a 422 from
    Pydantic body validation. The contract: any /v1/* caller MUST
    present both headers; if not, it is 401.
    """
    if not x_internal_token or not hmac.compare_digest(
        x_internal_token, settings.internal_token
    ):
        raise HTTPException(status_code=401, detail={"code": "INVALID_INTERNAL_TOKEN"})
    if not x_user_id:
        # Same trust boundary as the token check: missing/empty X-User-Id is a
        # credential problem, not a client error. Use 401 + INVALID_INTERNAL_TOKEN
        # so clients see a single status code for any auth-header problem.
        raise HTTPException(status_code=401, detail={"code": "INVALID_INTERNAL_TOKEN"})
    return x_user_id
