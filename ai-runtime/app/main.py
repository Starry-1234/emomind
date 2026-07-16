"""FastAPI entrypoint for ai-runtime."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.chat import router as chat_router
from app.api.files import router as files_router
from app.memory.checkpointer import close_checkpointer, get_checkpointer

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await get_checkpointer()
        log.info("PostgresSaver ready")
    except Exception as exc:
        log.error("PostgresSaver init failed (continuing without): %s", exc)
    yield
    await close_checkpointer()


app = FastAPI(
    title="EmoMind AI Runtime",
    version="0.3.0",
    description=(
        "LangGraph-based AI runtime for EmoMind. "
        "M2: SSE streaming + multimodal files + X-Internal-Token auth."
    ),
    lifespan=lifespan,
)

app.include_router(chat_router, prefix="/v1")
app.include_router(files_router, prefix="/v1")


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "service": "ai-runtime", "milestone": "M2"}
