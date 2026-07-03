"""FastAPI entrypoint for ai-runtime."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.chat import router as chat_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # M1: nothing to warm up (no checkpointer, no long-term memory, no file storage).
    # Future milestones add PostgresSaver / Redis / file storage init here.
    yield


app = FastAPI(
    title="EmoMind AI Runtime",
    version="0.2.0",
    description="LangGraph-based AI runtime for EmoMind. M1: SSE streaming + X-Internal-Token auth.",
    lifespan=lifespan,
)

app.include_router(chat_router, prefix="/v1")


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "service": "ai-runtime", "milestone": "M1"}
