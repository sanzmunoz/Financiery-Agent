-- SUPABASE SCHEMA - Financial Agent
-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: RAG documents table
-- metadata JSONB column is required by the n8n Supabase Vector Store node

CREATE TABLE IF NOT EXISTS rag_documents (
    id         BIGSERIAL PRIMARY KEY,
    content    TEXT NOT NULL,
    embedding  VECTOR(1536) NOT NULL,
    metadata   JSONB DEFAULT '{}',       -- Required by n8n Supabase Vector Store
    source_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rag_documents_embedding_idx
    ON rag_documents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Step 3: Semantic cache table

CREATE TABLE IF NOT EXISTS semantic_cache (
    id              BIGSERIAL PRIMARY KEY,
    query_text      TEXT NOT NULL,
    query_embedding VECTOR(1536) NOT NULL,
    response        TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS semantic_cache_embedding_idx
    ON semantic_cache
    USING ivfflat (query_embedding vector_cosine_ops)
    WITH (lists = 100);

-- Step 4: RAG retrieval function
-- Exact signature required by the n8n Supabase Vector Store node:
-- (query_embedding, filter, match_count)

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  filter          JSONB DEFAULT '{}',
  match_count     INT  DEFAULT 3
)
RETURNS TABLE (
  id         BIGINT,
  content    TEXT,
  metadata   JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
RETURN QUERY
SELECT
    rag_documents.id,
    rag_documents.content,
    rag_documents.metadata,
    1 - (rag_documents.embedding <=> query_embedding) AS similarity
FROM rag_documents
WHERE rag_documents.metadata @> filter
ORDER BY rag_documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 5: Semantic cache lookup function

CREATE OR REPLACE FUNCTION match_cache (
  query_embedding_input VECTOR(1536),
  match_threshold       FLOAT DEFAULT 0.90,
  match_count           INT   DEFAULT 1
)
RETURNS TABLE (
  id         BIGINT,
  query_text TEXT,
  response   TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
SELECT
    id,
    query_text,
    response,
    1 - (semantic_cache.query_embedding <=> query_embedding_input) AS similarity
FROM semantic_cache
WHERE 1 - (semantic_cache.query_embedding <=> query_embedding_input) > match_threshold
ORDER BY similarity DESC
    LIMIT match_count;
$$;

-- Step 6: Disable Row Level Security (service_role key bypasses RLS, but disabling avoids
-- permission errors when calling RPC functions from the backend)

ALTER TABLE rag_documents   DISABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_cache  DISABLE ROW LEVEL SECURITY;