-- Migration: Ajouter Gemini Embeddings (768 dimensions) — Triple Embedding
-- Date: 2026-02-18
-- Objectif: Ajouter embedding_gemini (text-embedding-004, 768-dim) comme 3ème provider
--
-- Impact: 3 espaces vectoriels indépendants → coverage maximale
-- Gemini multilingue excellent sur textes arabes
-- Dual → Triple embedding parallèle à la recherche

-- =============================================================================
-- 1. NOUVELLE COLONNE embedding_gemini
-- =============================================================================

ALTER TABLE knowledge_base_chunks
ADD COLUMN IF NOT EXISTS embedding_gemini vector(768);

COMMENT ON COLUMN knowledge_base_chunks.embedding_gemini IS
'Embedding Gemini text-embedding-004 (768 dims) - Excellent multilingue AR/FR';

-- =============================================================================
-- 2. INDEX IVFFLAT POUR RECHERCHE VECTORIELLE GEMINI
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding_gemini_ivfflat
ON knowledge_base_chunks
USING ivfflat (embedding_gemini vector_cosine_ops)
WITH (lists = 100);

-- =============================================================================
-- 3. MISE À JOUR search_knowledge_base_hybrid
--    use_openai boolean → embedding_provider text ('openai'|'ollama'|'gemini')
--    + doc_type_filter text (paramètre manquant dans l'ancienne version)
--    + tri par IF/ELSIF/ELSE pour éviter mismatch dimension pgvector
--
--    IMPORTANT: Supprimer l'ancienne signature boolean avant de créer la nouvelle
-- =============================================================================

-- Supprimer l'ancienne version avec use_openai boolean
DROP FUNCTION IF EXISTS search_knowledge_base_hybrid(text, vector, text, int, double precision, boolean, int);

CREATE OR REPLACE FUNCTION search_knowledge_base_hybrid(
  query_text text,
  query_embedding vector,
  category_filter text DEFAULT NULL,
  doc_type_filter text DEFAULT NULL,
  limit_count int DEFAULT 15,
  vector_threshold double precision DEFAULT 0.35,
  embedding_provider text DEFAULT 'ollama',
  rrf_k int DEFAULT 60
)
RETURNS TABLE (
  knowledge_base_id uuid,
  chunk_id uuid,
  title text,
  chunk_content text,
  chunk_index int,
  similarity double precision,
  bm25_rank double precision,
  hybrid_score double precision,
  category text,
  subcategory text,
  metadata jsonb
) AS $$
BEGIN
  IF embedding_provider = 'openai' THEN
    -- ===== RECHERCHE AVEC EMBEDDING OPENAI (1536-dim) =====
    RETURN QUERY
    WITH
    vector_results AS (
      SELECT
        kbc.knowledge_base_id,
        kbc.id AS v_chunk_id,
        kb.title,
        kbc.content AS chunk_content,
        kbc.chunk_index,
        (1 - (kbc.embedding_openai <=> query_embedding))::double precision AS vec_sim,
        kb.category::text,
        kb.subcategory::text,
        kb.metadata,
        ROW_NUMBER() OVER (ORDER BY kbc.embedding_openai <=> query_embedding) AS vec_rank
      FROM knowledge_base_chunks kbc
      JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kbc.embedding_openai IS NOT NULL
        AND kb.is_active = true
        AND (category_filter IS NULL OR kb.category::text = category_filter)
        AND (doc_type_filter IS NULL OR kb.doc_type::text = doc_type_filter)
        AND (1 - (kbc.embedding_openai <=> query_embedding)) >= vector_threshold
      ORDER BY kbc.embedding_openai <=> query_embedding
      LIMIT limit_count * 2
    ),
    bm25_results AS (
      SELECT
        kbc.id AS b_chunk_id,
        ts_rank_cd(kbc.content_tsvector, plainto_tsquery('simple', query_text))::double precision AS rank,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kbc.content_tsvector, plainto_tsquery('simple', query_text)) DESC) AS b_bm25_rank
      FROM knowledge_base_chunks kbc
      JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kbc.content_tsvector @@ plainto_tsquery('simple', query_text)
        AND kb.is_active = true
        AND (category_filter IS NULL OR kb.category::text = category_filter)
        AND (doc_type_filter IS NULL OR kb.doc_type::text = doc_type_filter)
      ORDER BY rank DESC
      LIMIT limit_count * 2
    ),
    fused_results AS (
      SELECT
        vr.knowledge_base_id, vr.v_chunk_id AS f_chunk_id, vr.title, vr.chunk_content, vr.chunk_index,
        vr.vec_sim, COALESCE(br.rank, 0.0::double precision) AS f_bm25_rank,
        vr.category, vr.subcategory, vr.metadata,
        ((0.7::double precision / (rrf_k + vr.vec_rank)::double precision) +
         (0.3::double precision / (rrf_k + COALESCE(br.b_bm25_rank, limit_count * 2))::double precision)) AS f_hybrid_score
      FROM vector_results vr
      LEFT JOIN bm25_results br ON vr.v_chunk_id = br.b_chunk_id
      UNION
      SELECT
        kbc.knowledge_base_id, br.b_chunk_id AS f_chunk_id, kb.title, kbc.content AS chunk_content, kbc.chunk_index,
        0.0::double precision AS vec_sim, br.rank::double precision AS f_bm25_rank,
        kb.category::text, kb.subcategory::text, kb.metadata,
        (0.3::double precision / (rrf_k + br.b_bm25_rank)::double precision) AS f_hybrid_score
      FROM bm25_results br
      JOIN knowledge_base_chunks kbc ON br.b_chunk_id = kbc.id
      JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE br.b_chunk_id NOT IN (SELECT vr2.v_chunk_id FROM vector_results vr2)
    )
    SELECT
      fr.knowledge_base_id, fr.f_chunk_id AS chunk_id, fr.title, fr.chunk_content, fr.chunk_index,
      fr.vec_sim AS similarity, fr.f_bm25_rank AS bm25_rank, fr.f_hybrid_score AS hybrid_score,
      fr.category, fr.subcategory, fr.metadata
    FROM fused_results fr
    ORDER BY fr.f_hybrid_score DESC
    LIMIT limit_count;

  ELSIF embedding_provider = 'gemini' THEN
    -- ===== RECHERCHE AVEC EMBEDDING GEMINI (768-dim) =====
    RETURN QUERY
    WITH
    vector_results AS (
      SELECT
        kbc.knowledge_base_id,
        kbc.id AS v_chunk_id,
        kb.title,
        kbc.content AS chunk_content,
        kbc.chunk_index,
        (1 - (kbc.embedding_gemini <=> query_embedding))::double precision AS vec_sim,
        kb.category::text,
        kb.subcategory::text,
        kb.metadata,
        ROW_NUMBER() OVER (ORDER BY kbc.embedding_gemini <=> query_embedding) AS vec_rank
      FROM knowledge_base_chunks kbc
      JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kbc.embedding_gemini IS NOT NULL
        AND kb.is_active = true
        AND (category_filter IS NULL OR kb.category::text = category_filter)
        AND (doc_type_filter IS NULL OR kb.doc_type::text = doc_type_filter)
        AND (1 - (kbc.embedding_gemini <=> query_embedding)) >= vector_threshold
      ORDER BY kbc.embedding_gemini <=> query_embedding
      LIMIT limit_count * 2
    ),
    bm25_results AS (
      SELECT
        kbc.id AS b_chunk_id,
        ts_rank_cd(kbc.content_tsvector, plainto_tsquery('simple', query_text))::double precision AS rank,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kbc.content_tsvector, plainto_tsquery('simple', query_text)) DESC) AS b_bm25_rank
      FROM knowledge_base_chunks kbc
      JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kbc.content_tsvector @@ plainto_tsquery('simple', query_text)
        AND kb.is_active = true
        AND (category_filter IS NULL OR kb.category::text = category_filter)
        AND (doc_type_filter IS NULL OR kb.doc_type::text = doc_type_filter)
      ORDER BY rank DESC
      LIMIT limit_count * 2
    ),
    fused_results AS (
      SELECT
        vr.knowledge_base_id, vr.v_chunk_id AS f_chunk_id, vr.title, vr.chunk_content, vr.chunk_index,
        vr.vec_sim, COALESCE(br.rank, 0.0::double precision) AS f_bm25_rank,
        vr.category, vr.subcategory, vr.metadata,
        ((0.7::double precision / (rrf_k + vr.vec_rank)::double precision) +
         (0.3::double precision / (rrf_k + COALESCE(br.b_bm25_rank, limit_count * 2))::double precision)) AS f_hybrid_score
      FROM vector_results vr
      LEFT JOIN bm25_results br ON vr.v_chunk_id = br.b_chunk_id
      UNION
      SELECT
        kbc.knowledge_base_id, br.b_chunk_id AS f_chunk_id, kb.title, kbc.content AS chunk_content, kbc.chunk_index,
        0.0::double precision AS vec_sim, br.rank::double precision AS f_bm25_rank,
        kb.category::text, kb.subcategory::text, kb.metadata,
        (0.3::double precision / (rrf_k + br.b_bm25_rank)::double precision) AS f_hybrid_score
      FROM bm25_results br
      JOIN knowledge_base_chunks kbc ON br.b_chunk_id = kbc.id
      JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE br.b_chunk_id NOT IN (SELECT vr2.v_chunk_id FROM vector_results vr2)
    )
    SELECT
      fr.knowledge_base_id, fr.f_chunk_id AS chunk_id, fr.title, fr.chunk_content, fr.chunk_index,
      fr.vec_sim AS similarity, fr.f_bm25_rank AS bm25_rank, fr.f_hybrid_score AS hybrid_score,
      fr.category, fr.subcategory, fr.metadata
    FROM fused_results fr
    ORDER BY fr.f_hybrid_score DESC
    LIMIT limit_count;

  ELSE
    -- ===== RECHERCHE AVEC EMBEDDING OLLAMA (1024-dim) =====
    RETURN QUERY
    WITH
    vector_results AS (
      SELECT
        kbc.knowledge_base_id,
        kbc.id AS v_chunk_id,
        kb.title,
        kbc.content AS chunk_content,
        kbc.chunk_index,
        (1 - (kbc.embedding <=> query_embedding))::double precision AS vec_sim,
        kb.category::text,
        kb.subcategory::text,
        kb.metadata,
        ROW_NUMBER() OVER (ORDER BY kbc.embedding <=> query_embedding) AS vec_rank
      FROM knowledge_base_chunks kbc
      JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kbc.embedding IS NOT NULL
        AND kb.is_active = true
        AND (category_filter IS NULL OR kb.category::text = category_filter)
        AND (doc_type_filter IS NULL OR kb.doc_type::text = doc_type_filter)
        AND (1 - (kbc.embedding <=> query_embedding)) >= vector_threshold
      ORDER BY kbc.embedding <=> query_embedding
      LIMIT limit_count * 2
    ),
    bm25_results AS (
      SELECT
        kbc.id AS b_chunk_id,
        ts_rank_cd(kbc.content_tsvector, plainto_tsquery('simple', query_text))::double precision AS rank,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kbc.content_tsvector, plainto_tsquery('simple', query_text)) DESC) AS b_bm25_rank
      FROM knowledge_base_chunks kbc
      JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE kbc.content_tsvector @@ plainto_tsquery('simple', query_text)
        AND kb.is_active = true
        AND (category_filter IS NULL OR kb.category::text = category_filter)
        AND (doc_type_filter IS NULL OR kb.doc_type::text = doc_type_filter)
      ORDER BY rank DESC
      LIMIT limit_count * 2
    ),
    fused_results AS (
      SELECT
        vr.knowledge_base_id, vr.v_chunk_id AS f_chunk_id, vr.title, vr.chunk_content, vr.chunk_index,
        vr.vec_sim, COALESCE(br.rank, 0.0::double precision) AS f_bm25_rank,
        vr.category, vr.subcategory, vr.metadata,
        ((0.7::double precision / (rrf_k + vr.vec_rank)::double precision) +
         (0.3::double precision / (rrf_k + COALESCE(br.b_bm25_rank, limit_count * 2))::double precision)) AS f_hybrid_score
      FROM vector_results vr
      LEFT JOIN bm25_results br ON vr.v_chunk_id = br.b_chunk_id
      UNION
      SELECT
        kbc.knowledge_base_id, br.b_chunk_id AS f_chunk_id, kb.title, kbc.content AS chunk_content, kbc.chunk_index,
        0.0::double precision AS vec_sim, br.rank::double precision AS f_bm25_rank,
        kb.category::text, kb.subcategory::text, kb.metadata,
        (0.3::double precision / (rrf_k + br.b_bm25_rank)::double precision) AS f_hybrid_score
      FROM bm25_results br
      JOIN knowledge_base_chunks kbc ON br.b_chunk_id = kbc.id
      JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
      WHERE br.b_chunk_id NOT IN (SELECT vr2.v_chunk_id FROM vector_results vr2)
    )
    SELECT
      fr.knowledge_base_id, fr.f_chunk_id AS chunk_id, fr.title, fr.chunk_content, fr.chunk_index,
      fr.vec_sim AS similarity, fr.f_bm25_rank AS bm25_rank, fr.f_hybrid_score AS hybrid_score,
      fr.category, fr.subcategory, fr.metadata
    FROM fused_results fr
    ORDER BY fr.f_hybrid_score DESC
    LIMIT limit_count;

  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_knowledge_base_hybrid IS
'Recherche hybride triple provider (OpenAI 1536-dim / Gemini 768-dim / Ollama 1024-dim) + BM25 avec RRF. Pondération: 70% vectoriel, 30% BM25.';

-- =============================================================================
-- 4. MISE À JOUR vue statistiques
-- =============================================================================

CREATE OR REPLACE VIEW vw_kb_embedding_migration_stats AS
SELECT
  COUNT(*) AS total_chunks,
  COUNT(kbc.embedding) AS chunks_ollama,
  COUNT(kbc.embedding_openai) AS chunks_openai,
  COUNT(kbc.embedding_gemini) AS chunks_gemini,
  COUNT(CASE WHEN kbc.embedding IS NOT NULL AND kbc.embedding_openai IS NOT NULL THEN 1 END) AS chunks_openai_and_ollama,
  COUNT(CASE WHEN kbc.embedding_openai IS NOT NULL AND kbc.embedding_gemini IS NOT NULL THEN 1 END) AS chunks_openai_and_gemini,
  COUNT(CASE WHEN kbc.embedding IS NOT NULL AND kbc.embedding_openai IS NOT NULL AND kbc.embedding_gemini IS NOT NULL THEN 1 END) AS chunks_all_three,
  COUNT(CASE WHEN kbc.embedding IS NULL AND kbc.embedding_openai IS NULL AND kbc.embedding_gemini IS NULL THEN 1 END) AS chunks_none,
  ROUND(100.0 * COUNT(kbc.embedding_openai) / NULLIF(COUNT(*), 0), 1) AS pct_openai,
  ROUND(100.0 * COUNT(kbc.embedding_gemini) / NULLIF(COUNT(*), 0), 1) AS pct_gemini
FROM knowledge_base_chunks kbc
JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
WHERE kb.is_active = true;

COMMENT ON VIEW vw_kb_embedding_migration_stats IS
'Statistiques de couverture embeddings : Ollama (1024-dim) + OpenAI (1536-dim) + Gemini (768-dim)';

-- =============================================================================
-- ROLLBACK (si besoin)
-- =============================================================================

-- Pour rollback cette migration :
--
-- DROP VIEW IF EXISTS vw_kb_embedding_migration_stats;
-- DROP FUNCTION IF EXISTS search_knowledge_base_hybrid(text, vector, text, text, int, double precision, text, int);
-- DROP INDEX IF EXISTS idx_kb_chunks_embedding_gemini_ivfflat;
-- ALTER TABLE knowledge_base_chunks DROP COLUMN IF EXISTS embedding_gemini;
--
-- Puis réappliquer la migration 20260217000030_add_hybrid_search.sql
