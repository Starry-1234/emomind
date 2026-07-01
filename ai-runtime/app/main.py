"""FastAPI application entry point (M0 skeleton)."""
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.api.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # M0: no resources to initialize. M1 will init PostgresSaver + Redis.
    yield


app = FastAPI(
    title="EmoMind AI Runtime",
    version="0.1.0",
    description="LangGraph-based AI runtime for EmoMind. M0 skeleton.",
    lifespan=lifespan,
)

app.include_router(health_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "emomind-ai-runtime", "milestone": "M0", "docs": "/docs"}
