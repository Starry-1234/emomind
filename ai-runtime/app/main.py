"""FastAPI entrypoint for ai-runtime."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.chat import router as chat_router
from app.api.files import router as files_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # M2: nothing extra to warm up; local-FS storage is created on first
    # upload by cache.write_file. M4 will init PostgresSaver here.
    yield


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
