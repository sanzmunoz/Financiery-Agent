-- SUPABASE SCHEMA - FinBot
-- PASO 1: Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector;


-- PASO 2: Tabla RAG
-- metadata JSONB requerido por n8n Supabase Vector Store node

CREATE TABLE IF NOT EXISTS rag_documents (
                                             id         BIGSERIAL PRIMARY KEY,
                                             content    TEXT NOT NULL,
                                             embedding  VECTOR(1536) NOT NULL,
    metadata   JSONB DEFAULT '{}',       -- Requerido por n8n Supabase Vector Store
    source_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS rag_documents_embedding_idx
    ON rag_documents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);


-- PASO 3: Tabla Caché Semántico

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


-- PASO 4: Función RAG
-- Firma exacta requerida por n8n Supabase Vector Store node:
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


-- PASO 5: Función Caché Semántico

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


-- PASO 6: Deshabilitar RLS

ALTER TABLE rag_documents   DISABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_cache  DISABLE ROW LEVEL SECURITY;


-- VERIFICACIÓN

-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- SELECT proname FROM pg_proc WHERE proname LIKE 'match_%';
-- SELECT * FROM pg_extension WHERE extname = 'vector';