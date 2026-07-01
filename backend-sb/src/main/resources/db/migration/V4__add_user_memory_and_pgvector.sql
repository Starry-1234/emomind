-- V4: add user long-term memory with pgvector for embedding search.
-- Requires the `vector` extension; created here if missing.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE user_memory (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fact_text TEXT NOT NULL,
    fact_text_hash CHAR(64) NOT NULL,
    embedding vector(1024) NOT NULL,
    category VARCHAR(50) NOT NULL,
    importance REAL NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    source_thread_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, fact_text_hash)
);

CREATE INDEX user_memory_embedding_hnsw_idx
    ON user_memory
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX user_memory_user_id_created_at_idx
    ON user_memory (user_id, created_at DESC);

CREATE TABLE user_memory_dead_letter (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    fact_text TEXT NOT NULL,
    category VARCHAR(50),
    error TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_memory IS 'AI 用户长期记忆（与 LangGraph checkpoint 通过 thread_id 关联）';
COMMENT ON COLUMN user_memory.fact_text_hash IS 'SHA-256(fact_text) for dedup';
COMMENT ON COLUMN user_memory.embedding IS 'Qwen text-embedding-v3 (1024 dim)';