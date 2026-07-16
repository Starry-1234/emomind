"""pgvector-based long-term user memory.

Stores extracted facts (key/value) per user with vector embeddings
for similarity search. Schema is auto-created on first call.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Optional

import asyncpg

from app.config import settings
from app.models.factory import get_embedding_provider

log = logging.getLogger(__name__)

EMBED_DIM = 1024  # text-embedding-v3 dimension


@dataclass
class MemoryFact:
    key: str
    value: str
    importance: float
    score: float  # cosine similarity 0..1


class UserMemoryStore:
    def __init__(self, db_pool: asyncpg.Pool, embedding_provider):
        self._db = db_pool
        self._embedding = embedding_provider

    @classmethod
    async def create(cls) -> "UserMemoryStore":
        db = await asyncpg.create_pool(
            settings.database_url, min_size=2, max_size=10
        )
        inst = cls(db, get_embedding_provider("text-embedding-v3"))
        await inst.ensure_schema()
        return inst

    async def close(self) -> None:
        await self._db.close()

    async def ensure_schema(self) -> None:
        async with self._db.acquire() as conn:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            await conn.execute(f"""
                CREATE TABLE IF NOT EXISTS user_memory (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    importance REAL NOT NULL DEFAULT 0.5,
                    embedding vector({EMBED_DIM}),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(user_id, key)
                );""")
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS hnsw_user_memory_embedding
                    ON user_memory
                    USING hnsw (embedding vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64);""")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS long_term_dead_letter (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID,
                    payload JSONB NOT NULL,
                    error TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );""")

    async def retrieve(self, user_id: str, query: str, top_k: int = 5) -> list[MemoryFact]:
        emb = (await self._embedding.embed([query]))[0]
        async with self._db.acquire() as conn:
            rows = await conn.fetch("""
                SELECT key, value, importance, 1 - (embedding <=> $1::vector) AS score
                FROM user_memory
                WHERE user_id = $2::uuid
                ORDER BY embedding <=> $1::vector
                LIMIT $3
            """, emb, user_id, top_k)
        return [
            MemoryFact(r["key"], r["value"], r["importance"], r["score"])
            for r in rows
        ]

    async def upsert_fact(
        self, user_id: str, key: str, value: str,
        importance: float, embedding: list[float],
    ) -> None:
        async with self._db.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_memory (user_id, key, value, importance, embedding)
                VALUES ($1::uuid, $2, $3, $4, $5::vector)
                ON CONFLICT (user_id, key) DO UPDATE
                SET value = EXCLUDED.value,
                    importance = EXCLUDED.importance,
                    embedding = EXCLUDED.embedding,
                    updated_at = NOW()
            """, user_id, key, value, importance, embedding)

    async def record_dead_letter(self, user_id: Optional[str], payload: dict, error: str) -> None:
        async with self._db.acquire() as conn:
            await conn.execute(
                "INSERT INTO long_term_dead_letter (user_id, payload, error) VALUES ($1, $2, $3)",
                user_id, json.dumps(payload), error,
            )
