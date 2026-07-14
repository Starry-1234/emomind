-- V5: add conversation_meta table for LangGraph thread-level business metadata.
-- Each row maps (user, graph, thread_id) to a stable title + free-form metadata
-- payload, written by Spring (ConversationMetaController) when ai-runtime opens a
-- new thread. Read back from /api/v1/ai/conversations to populate the chat
-- sidebar / "Resume session" UI without re-querying LangGraph checkpoints.

CREATE TABLE conversation_meta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    graph VARCHAR(64) NOT NULL,
    thread_id VARCHAR(128) NOT NULL,
    title VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, graph, thread_id)
);

CREATE INDEX idx_conversation_meta_user_id ON conversation_meta(user_id);
CREATE INDEX idx_conversation_meta_thread_id ON conversation_meta(graph, thread_id);

COMMENT ON TABLE conversation_meta IS '业务侧会话元数据，与 LangGraph checkpoint 通过 (user_id, graph, thread_id) 关联';
COMMENT ON COLUMN conversation_meta.graph IS 'ai-runtime graph name: ai-doctor / psych_test';
COMMENT ON COLUMN conversation_meta.thread_id IS 'LangGraph thread_id (uuid or short hash)';
COMMENT ON COLUMN conversation_meta.metadata IS 'free-form JSON: summary, last-intent, tags, etc.';
