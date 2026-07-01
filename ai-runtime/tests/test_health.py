"""Smoke test for /healthz endpoint."""
from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_healthz_returns_ok():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/healthz")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "ai-runtime"
    assert body["milestone"] == "M0"


async def test_root_returns_service_info():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "emomind-ai-runtime"
    assert body["milestone"] == "M0"
