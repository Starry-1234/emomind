"""Health check endpoint."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness check. Always returns 200 if the process is running."""
    return {"status": "ok", "service": "ai-runtime", "milestone": "M0"}
