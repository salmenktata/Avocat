-- Migration: Ajouter support doc_type dans la recherche hybride
-- Date: 2026-02-16
-- Description: Étend la fonction search_knowledge_base_hybrid pour supporter
--              le filtrage par doc_type (meta-catégorie)

-- Supprimer TOUTES les versions existantes de la fonction (surcharges)
DROP FUNCTION IF EXISTS search_knowledge_base_hybrid(text, vector, text, integer, double precision, boolean, integer) CASCADE;
DROP FUNCTION IF EXISTS search_knowledge_base_hybrid(text, vector, text, text, integer, double precision, boolean) CASCADE;

-- Créer la nouvelle version avec support doc_type
CREATE OR REPLACE FUNCTION search_knowledge_base_hybrid(
  p_query_text text,
  p_embedding vector,
  p_category text DEFAULT NULL,
  p_doc_type text DEFAULT NULL,  -- Nouveau paramètre
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
DECLARE
  v_embedding_column text;
BEGIN
  -- Déterminer quelle colonne d'embedding utiliser
  v_embedding_column := CASE WHEN p_use_openai THEN 'embedding_openai' ELSE 'embedding' END;

  -- Recherche hybride: vectorielle (70%) + BM25 (30%) avec RRF fusion
  RETURN QUERY
  EXECUTE format('
    WITH vector_search AS (
      SELECT
        kbc.knowledge_base_id,
        kbc.id as chunk_id,
        kb.title,
        kb.category,
        kbc.content as chunk_content,
        kbc.chunk_index,
        (1 - (kbc.%I <=> $1)) as similarity,
        0.0 as bm25_rank,
        kbc.metadata
      FROM knowledge_base_chunks kbc
      INNER JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kb.is_indexed = true
        AND kb.is_active = true
        AND kbc.%I IS NOT NULL
        AND (1 - (kbc.%I <=> $1)) >= $4
        AND ($2::text IS NULL OR kb.category = $2)
        AND ($3::document_type IS NULL OR kb.doc_type = $3::document_type)
      ORDER BY kbc.%I <=> $1
      LIMIT $5
    ),
    bm25_search AS (
      SELECT
        kbc.knowledge_base_id,
        kbc.id as chunk_id,
        kb.title,
        kb.category,
        kbc.content as chunk_content,
        kbc.chunk_index,
        0.0 as similarity,
        ts_rank(kbc.content_tsvector, plainto_tsquery(''arabic'', $6)) as bm25_rank,
        kbc.metadata
      FROM knowledge_base_chunks kbc
      INNER JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kb.is_indexed = true
        AND kb.is_active = true
        AND kbc.content_tsvector @@ plainto_tsquery(''arabic'', $6)
        AND ($2::text IS NULL OR kb.category = $2)
        AND ($3::document_type IS NULL OR kb.doc_type = $3::document_type)
      ORDER BY bm25_rank DESC
      LIMIT $5
    ),
    combined AS (
      SELECT * FROM vector_search
      UNION ALL
      SELECT * FROM bm25_search
    ),
    ranked AS (
      SELECT
        knowledge_base_id,
        chunk_id,
        title,
        category,
        chunk_content,
        chunk_index,
        MAX(similarity) as similarity,
        MAX(bm25_rank) as bm25_rank,
        metadata
      FROM combined
      GROUP BY knowledge_base_id, chunk_id, title, category, chunk_content, chunk_index, metadata
    )
    SELECT
      knowledge_base_id,
      chunk_id,
      title,
      category,
      chunk_content,
      chunk_index,
      similarity,
      bm25_rank,
      -- RRF fusion: 70% vectoriel + 30% BM25
      (0.7 * similarity + 0.3 * LEAST(bm25_rank * 10, 1.0)) as hybrid_score,
      metadata
    FROM ranked
    ORDER BY hybrid_score DESC
    LIMIT $5
  ', v_embedding_column, v_embedding_column, v_embedding_column, v_embedding_column)
  USING p_embedding, p_category, p_doc_type, p_threshold, p_limit, p_query_text;
END;
$$ LANGUAGE plpgsql STABLE;

-- Commentaire
COMMENT ON FUNCTION search_knowledge_base_hybrid IS 'Recherche hybride (vectorielle + BM25) avec support du filtrage par doc_type (meta-catégorie)';
