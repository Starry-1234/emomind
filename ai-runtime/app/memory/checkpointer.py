"""AsyncPostgresSaver singleton for LangGraph thread state persistence.

Replaces M3's InMemorySaver. State survives ai-runtime restarts.
Tables are auto-created via ``setup()`` on first call; setup is idempotent.
"""
from __future__ import annotations

import logging
from typing import AsyncContextManager, Optional

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.config import settings

log = logging.getLogger(__name__)

_checkpointer: Optional[AsyncPostgresSaver] = None
_checkpointer_context: Optional[AsyncContextManager[AsyncPostgresSaver]] = None


async def get_checkpointer() -> AsyncPostgresSaver:
    """Return the initialized process-wide checkpointer singleton."""
    global _checkpointer, _checkpointer_context
    if _checkpointer is None:
        log.info(
            "Initializing AsyncPostgresSaver with database_url=%s",
            settings.database_url,
        )
        context = AsyncPostgresSaver.from_conn_string(settings.database_url)
        _checkpointer = await context.__aenter__()
        _checkpointer_context = context
        try:
            await _checkpointer.setup()
        except Exception:
            await close_checkpointer()
            raise
    return _checkpointer


async def close_checkpointer() -> None:
    """Close and clear the process-wide checkpointer, if initialized."""
    global _checkpointer, _checkpointer_context
    context = _checkpointer_context
    _checkpointer = None
    _checkpointer_context = None
    if context is not None:
        await context.__aexit__(None, None, None)
