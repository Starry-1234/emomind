"""Integration tests for the GET /v1/files list endpoint + list_user_files helper.

M5 T4 — user-scoped file listing. The list endpoint and the cache helper
must filter by user_id (taken from X-User-Id, never from a query param),
optionally by name prefix, and return newest-first.
"""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from app.memory.cache import list_user_files, write_file


INTERNAL_TOKEN = "changeme-internal-token-must-be-32-chars-long"


@pytest.fixture
def tmp_storage(monkeypatch, tmp_path):
    """Override LANGGRAPH_STORAGE_PATH to a tmp dir for isolation."""
    monkeypatch.setenv("LANGGRAPH_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "storage_path", str(tmp_path))
    return tmp_path


@pytest.mark.asyncio
async def test_files_list_filters_by_user_id(tmp_storage):
    """list_user_files must only return records owned by the given user_id.

    The returned dicts do not include user_id (caller already knows who
    they are); verify the user-scope by checking returned names — only
    that user's file should appear.
    """
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())
    write_file(user_id=user_a, content=b"A1", mime="image/png", name="a1.png")
    write_file(user_id=user_b, content=b"B1", mime="image/png", name="b1.png")

    files_a = await list_user_files(user_a)
    names_a = {f["name"] for f in files_a}
    assert names_a == {"a1.png"}, (
        f"names_a was {names_a}, expected only a1.png (user B's file must be filtered out)"
    )

    files_b = await list_user_files(user_b)
    names_b = {f["name"] for f in files_b}
    assert names_b == {"b1.png"}, (
        f"names_b was {names_b}, expected only b1.png (user A's file must be filtered out)"
    )


@pytest.mark.asyncio
async def test_files_list_returns_newest_first(tmp_storage):
    """Multiple files for the same user should be sorted by uploaded_at desc."""
    user = str(uuid.uuid4())
    # Pass explicit uploaded_at values 1 ms apart so the test is not
    # dependent on the host clock's microsecond resolution (Windows can
    # collapse sub-millisecond writes into the same microsecond).
    write_file(
        user_id=user, content=b"first", mime="image/png", name="first.png",
        uploaded_at="2026-01-01T00:00:00.000000+00:00",
    )
    write_file(
        user_id=user, content=b"second", mime="image/png", name="second.png",
        uploaded_at="2026-01-01T00:00:00.001000+00:00",
    )
    write_file(
        user_id=user, content=b"third", mime="image/png", name="third.png",
        uploaded_at="2026-01-01T00:00:00.002000+00:00",
    )

    files = await list_user_files(user)
    assert len(files) == 3
    names = [f["name"] for f in files]
    # newest-first → last write shows up at the head
    assert names[0] == "third.png"
    assert names[-1] == "first.png"


@pytest.mark.asyncio
async def test_files_list_prefix_filter(tmp_storage):
    """When prefix is provided, only matching names are returned."""
    user = str(uuid.uuid4())
    write_file(user_id=user, content=b"x", mime="image/png", name="alpha.png")
    write_file(user_id=user, content=b"y", mime="image/png", name="beta.png")
    write_file(user_id=user, content=b"z", mime="image/png", name="alphabet.png")

    only_alpha = await list_user_files(user, prefix="alpha")
    names = {f["name"] for f in only_alpha}
    assert names == {"alpha.png", "alphabet.png"}, names


@pytest.mark.asyncio
async def test_files_list_empty_when_no_dir(tmp_storage):
    """If the storage path does not exist, list_user_files returns []."""
    # tmp_storage exists (it's the tmp_path); but list_user_files should be
    # safe even on a missing base. Simulate by pointing at a non-existent dir.
    settings.storage_path = str(tmp_storage / "does-not-exist")
    out = await list_user_files("any-user")
    assert out == []


@pytest.mark.asyncio
async def test_files_list_endpoint_returns_user_scoped_files(tmp_storage, monkeypatch):
    """GET /v1/files uses X-User-Id (never query param) to scope results."""
    monkeypatch.setattr(settings, "internal_token", INTERNAL_TOKEN)

    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())
    write_file(user_id=user_a, content=b"a-data", mime="image/png", name="a.png")
    write_file(user_id=user_b, content=b"b-data", mime="image/png", name="b.png")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/v1/files",
            headers={
                "X-Internal-Token": INTERNAL_TOKEN,
                "X-User-Id": user_a,
            },
        )
    assert resp.status_code == 200, await resp.aread()
    body = resp.json()
    assert isinstance(body, list)
    names = {f["name"] for f in body}
    assert names == {"a.png"}, names
    # Every returned record has the expected shape
    for rec in body:
        assert set(rec.keys()) >= {"file_id", "mime", "size", "name", "uploaded_at"}


@pytest.mark.asyncio
async def test_files_list_endpoint_rejects_missing_token(tmp_storage):
    """Without X-Internal-Token, GET /v1/files returns 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/v1/files")
    assert resp.status_code == 401