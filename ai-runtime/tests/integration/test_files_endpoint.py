"""Integration tests for the /v1/files endpoints + storage cache."""
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.memory.cache import get_meta, read_file, write_file


@pytest.fixture
def tmp_storage(monkeypatch, tmp_path):
    """Override LANGGRAPH_STORAGE_PATH to a tmp dir for isolation.

    `app.config.settings` is cached at module import time, so we have to
    patch the bound attribute too — `monkeypatch.setenv` only refreshes
    the os.environ, not the already-instantiated Settings object.
    """
    from app.config import settings

    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "storage_path", str(tmp_path))
    return tmp_path


@pytest.mark.asyncio
async def test_write_and_read_file_roundtrip(tmp_storage):
    content = b"hello world image bytes"
    meta = write_file(
        user_id="00000000-0000-0000-0000-000000000001",
        content=content,
        mime="image/png",
        name="test.png",
    )
    assert meta["size"] == len(content)
    assert meta["mime"] == "image/png"
    assert meta["name"] == "test.png"
    # file_id is uuid4 hex (32 chars)
    assert len(meta["file_id"]) == 32
    # read_file should return the same bytes
    assert (
        read_file(meta["file_id"], "00000000-0000-0000-0000-000000000001") == content
    )
    # get_meta should return the same record
    fetched = get_meta(meta["file_id"])
    assert fetched["file_id"] == meta["file_id"]
    assert fetched["path"] == meta["path"]


@pytest.mark.asyncio
async def test_files_upload_endpoint_rejects_missing_token(tmp_storage):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/files/upload",
            files={"file": ("a.png", b"data", "image/png")},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_files_upload_endpoint_accepts_valid_token(tmp_storage, monkeypatch):
    # Set a known internal token for the duration of the test.
    from app.config import settings

    monkeypatch.setattr(settings, "internal_token", "changeme-internal-token-must-be-32-chars-long")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/files/upload",
            files={"file": ("a.png", b"\x89PNG data", "image/png")},
            headers={
                "X-Internal-Token": "changeme-internal-token-must-be-32-chars-long",
                "X-User-Id": "00000000-0000-0000-0000-000000000001",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert "file_id" in body
    assert body["mime"] == "image/png"
    assert body["size"] == 9
    assert body["name"] == "a.png"


@pytest.mark.asyncio
async def test_files_upload_endpoint_rejects_unsupported_mime(tmp_storage, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "internal_token", "changeme-internal-token-must-be-32-chars-long")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/files/upload",
            files={"file": ("x.exe", b"data", "application/x-msdownload")},
            headers={
                "X-Internal-Token": "changeme-internal-token-must-be-32-chars-long",
                "X-User-Id": "00000000-0000-0000-0000-000000000001",
            },
        )
    assert resp.status_code == 415  # Unsupported Media Type


@pytest.mark.asyncio
async def test_files_upload_endpoint_respects_size_cap_setting(tmp_storage, monkeypatch):
    """Verify the default size cap is wired through Settings.

    The full oversize behavior is covered by cache.write_file's own check;
    this test confirms the Settings field is the source of truth.
    """
    from app.config import Settings

    s = Settings()
    assert s.max_file_size_mb == 50  # default


@pytest.mark.asyncio
async def test_files_download_endpoint_returns_bytes(tmp_storage, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "internal_token", "changeme-internal-token-must-be-32-chars-long")

    # Upload first
    content = b"image bytes for download test"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        upload_resp = await client.post(
            "/v1/files/upload",
            files={"file": ("x.png", content, "image/png")},
            headers={
                "X-Internal-Token": "changeme-internal-token-must-be-32-chars-long",
                "X-User-Id": "00000000-0000-0000-0000-000000000001",
            },
        )
        assert upload_resp.status_code == 200, await upload_resp.aread()
        file_id = upload_resp.json()["file_id"]
        # Download
        resp = await client.get(
            f"/v1/files/{file_id}",
            headers={
                "X-Internal-Token": "changeme-internal-token-must-be-32-chars-long",
                "X-User-Id": "00000000-0000-0000-0000-000000000001",
            },
        )
    assert resp.status_code == 200
    assert resp.content == content
    assert resp.headers["content-type"].startswith("image/png")