-- Supprimer toutes versions
DROP FUNCTION IF EXISTS search_knowledge_base_hybrid(text, vector, text, text, integer, double precision, boolean) CASCADE;
DROP FUNCTION IF EXISTS search_knowledge_base_hybrid(text, vector, text, integer, double precision, boolean, integer) CASCADE;
DROP FUNCTION IF EXISTS search_knowledge_base_hybrid(text, vector, text, integer, double precision, boolean) CASCADE;

-- Version simplifiée sans format() - utilise IF/ELSE pour éviter les bugs %
CREATE OR REPLACE FUNCTION search_knowledge_base_hybrid(
  p_query_text text,
  p_embedding vector,
  p_category text DEFAULT NULL,
  p_doc_type text DEFAULT NULL,
  p_limit integer DEFAULT 15,
  p_threshold double precision DEFAULT 0.35,
  p_use_openai boolean DEFAULT false
)
RETURNS TABLE (
  knowledge_base_id uuid,
  chunk_id uuid,
  title text,
  category text,
  chunk_content text,
  chunk_index integer,
  similarity double precision,
  bm25_rank double precision,
  hybrid_score double precision,
  metadata jsonb
) AS $$
BEGIN
  IF p_use_openai THEN
    RETURN QUERY
    WITH vector_search AS (
      SELECT
        kbc.knowledge_base_id,
        kbc.id as chunk_id,
        kb.title,
        kb.category::text,
        kbc.content as chunk_content,
        kbc.chunk_index,
        (1 - (kbc.embedding_openai <=> p_embedding))::double precision as similarity,
        0.0::double precision as bm25_rank,
        kbc.metadata
      FROM knowledge_base_chunks kbc
      INNER JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kb.is_indexed = true
        AND kb.is_active = true
        AND kbc.embedding_openai IS NOT NULL
        AND (1 - (kbc.embedding_openai <=> p_embedding)) >= p_threshold
        AND (p_category IS NULL OR kb.category::text = p_category)
        AND (p_doc_type IS NULL OR kb.doc_type::text = p_doc_type)
      ORDER BY kbc.embedding_openai <=> p_embedding
      LIMIT p_limit
    ),
    bm25_search AS (
      SELECT
        kbc.knowledge_base_id,
        kbc.id as chunk_id,
        kb.title,
        kb.category::text,
        kbc.content as chunk_content,
        kbc.chunk_index,
        0.0::double precision as similarity,
        ts_rank(kbc.content_tsvector, plainto_tsquery('arabic', p_query_text))::double precision as bm25_rank,
        kbc.metadata
      FROM knowledge_base_chunks kbc
      INNER JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kb.is_indexed = true
        AND kb.is_active = true
        AND kbc.content_tsvector @@ plainto_tsquery('arabic', p_query_text)
        AND (p_category IS NULL OR kb.category::text = p_category)
        AND (p_doc_type IS NULL OR kb.doc_type::text = p_doc_type)
      ORDER BY bm25_rank DESC
      LIMIT p_limit
    ),
    combined AS (SELECT * FROM vector_search UNION ALL SELECT * FROM bm25_search),
    ranked AS (
      SELECT c.knowledge_base_id, c.chunk_id, c.title, c.category, c.chunk_content, c.chunk_index,
        MAX(c.similarity) as similarity, MAX(c.bm25_rank) as bm25_rank, c.metadata
      FROM combined c
      GROUP BY c.knowledge_base_id, c.chunk_id, c.title, c.category, c.chunk_content, c.chunk_index, c.metadata
    )
    SELECT r.knowledge_base_id, r.chunk_id, r.title, r.category, r.chunk_content, r.chunk_index,
      r.similarity, r.bm25_rank,
      (0.7 * r.similarity + 0.3 * LEAST(r.bm25_rank * 10, 1.0))::double precision as hybrid_score,
      r.metadata
    FROM ranked r
    ORDER BY hybrid_score DESC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    WITH vector_search AS (
      SELECT
        kbc.knowledge_base_id,
        kbc.id as chunk_id,
        kb.title,
        kb.category::text,
        kbc.content as chunk_content,
        kbc.chunk_index,
        (1 - (kbc.embedding <=> p_embedding))::double precision as similarity,
        0.0::double precision as bm25_rank,
        kbc.metadata
      FROM knowledge_base_chunks kbc
      INNER JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kb.is_indexed = true
        AND kb.is_active = true
        AND kbc.embedding IS NOT NULL
        AND (1 - (kbc.embedding <=> p_embedding)) >= p_threshold
        AND (p_category IS NULL OR kb.category::text = p_category)
        AND (p_doc_type IS NULL OR kb.doc_type::text = p_doc_type)
      ORDER BY kbc.embedding <=> p_embedding
      LIMIT p_limit
    ),
    bm25_search AS (
      SELECT
        kbc.knowledge_base_id,
        kbc.id as chunk_id,
        kb.title,
        kb.category::text,
        kbc.content as chunk_content,
        kbc.chunk_index,
        0.0::double precision as similarity,
        ts_rank(kbc.content_tsvector, plainto_tsquery('arabic', p_query_text))::double precision as bm25_rank,
        kbc.metadata
      FROM knowledge_base_chunks kbc
      INNER JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kb.is_indexed = true
        AND kb.is_active = true
        AND kbc.content_tsvector @@ plainto_tsquery('arabic', p_query_text)
        AND (p_category IS NULL OR kb.category::text = p_category)
        AND (p_doc_type IS NULL OR kb.doc_type::text = p_doc_type)
      ORDER BY bm25_rank DESC
      LIMIT p_limit
    ),
    combined AS (SELECT * FROM vector_search UNION ALL SELECT * FROM bm25_search),
    ranked AS (
      SELECT c.knowledge_base_id, c.chunk_id, c.title, c.category, c.chunk_content, c.chunk_index,
        MAX(c.similarity) as similarity, MAX(c.bm25_rank) as bm25_rank, c.metadata
      FROM combined c
      GROUP BY c.knowledge_base_id, c.chunk_id, c.title, c.category, c.chunk_content, c.chunk_index, c.metadata
    )
    SELECT r.knowledge_base_id, r.chunk_id, r.title, r.category, r.chunk_content, r.chunk_index,
      r.similarity, r.bm25_rank,
      (0.7 * r.similarity + 0.3 * LEAST(r.bm25_rank * 10, 1.0))::double precision as hybrid_score,
      r.metadata
    FROM ranked r
    ORDER BY hybrid_score DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_knowledge_base_hybrid IS 'Recherche hybride vectorielle + BM25 avec support doc_type. Utilise IF/ELSE au lieu de format() pour éviter les bugs.';
