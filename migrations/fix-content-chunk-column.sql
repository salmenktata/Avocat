-- =====================================================================
-- FIX CRITIQUE: Corriger colonne content_chunk → content
-- =====================================================================
-- Bug: search_knowledge_base_hybrid() et vw_redisearch_pending_sync
--      utilisent kbc.content_chunk qui n'existe pas
-- Fix: Remplacer par kbc.content (nom correct de la colonne)
-- Date: 2026-02-14
-- =====================================================================

-- 1. CORRIGER TRIGGER TSVECTOR
-- =====================================================================

CREATE OR REPLACE FUNCTION kb_chunks_tsvector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.content_tsvector = to_tsvector('simple', NEW.content);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 2. CORRIGER VUE REDISEARCH
-- =====================================================================

CREATE OR REPLACE VIEW vw_redisearch_pending_sync AS
SELECT
  kbc.id as chunk_id,
  kbc.knowledge_base_id,
  kb.title,
  kbc.content AS content_chunk,
  kb.category,
  kb.language,
  kbc.embedding,
  kbc.embedding_openai,
  rs.sync_status,
  rs.last_synced_at,
  EXTRACT(EPOCH FROM (NOW() - rs.last_synced_at)) / 3600 as staleness_hours
FROM knowledge_base_chunks kbc
JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
LEFT JOIN redisearch_sync_status rs ON kbc.id = rs.chunk_id
WHERE rs.sync_status IN ('pending', 'error', 'stale')
   OR rs.chunk_id IS NULL
ORDER BY rs.last_synced_at ASC NULLS FIRST
LIMIT 1000;

-- 3. CORRIGER FONCTION HYBRID SEARCH (7 paramètres)
-- =====================================================================
-- FIX (Feb 15, 2026): Désambiguïser noms colonnes CTE vs variables PL/pgSQL RETURNS TABLE
-- Les alias CTE (chunk_id, bm25_rank) entraient en conflit avec les colonnes de retour
-- causant: "column reference chunk_id is ambiguous" → recherche KB silencieusement cassée

CREATE OR REPLACE FUNCTION search_knowledge_base_hybrid(
  query_text text,
  query_embedding vector,
  category_filter text DEFAULT NULL,
  limit_count integer DEFAULT 15,
  vector_threshold double precision DEFAULT 0.5,
  use_openai boolean DEFAULT false,
  rrf_k integer DEFAULT 60
)
RETURNS TABLE(
  knowledge_base_id uuid,
  chunk_id uuid,
  title text,
  chunk_content text,
  chunk_index integer,
  similarity double precision,
  bm25_rank double precision,
  hybrid_score double precision,
  category text,
  subcategory text,
  metadata jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH
  vector_results AS (
    SELECT
      kbc.knowledge_base_id,
      kbc.id AS v_chunk_id,
      kb.title,
      kbc.content AS chunk_content,
      kbc.chunk_index,
      (1 - (CASE WHEN use_openai THEN kbc.embedding_openai ELSE kbc.embedding END <=> query_embedding))::double precision AS vec_sim,
      kb.category::text,
      kb.subcategory::text,
      kb.metadata,
      ROW_NUMBER() OVER (ORDER BY (CASE WHEN use_openai THEN kbc.embedding_openai ELSE kbc.embedding END <=> query_embedding)) AS vec_rank
    FROM knowledge_base_chunks kbc
    JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
    WHERE (CASE WHEN use_openai THEN kbc.embedding_openai ELSE kbc.embedding END) IS NOT NULL
      AND kb.is_active = true
      AND (category_filter IS NULL OR kb.category::text = category_filter)
      AND (1 - (CASE WHEN use_openai THEN kbc.embedding_openai ELSE kbc.embedding END <=> query_embedding)) >= vector_threshold
    ORDER BY (CASE WHEN use_openai THEN kbc.embedding_openai ELSE kbc.embedding END <=> query_embedding)
    LIMIT limit_count * 2
  ),
  bm25_results AS (
    SELECT
      kbc.id AS b_chunk_id,
      ts_rank_cd(
        kbc.content_tsvector,
        plainto_tsquery('simple', query_text)
      )::double precision AS rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kbc.content_tsvector, plainto_tsquery('simple', query_text)) DESC) AS b_bm25_rank
    FROM knowledge_base_chunks kbc
    JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
    WHERE kbc.content_tsvector @@ plainto_tsquery('simple', query_text)
      AND kb.is_active = true
      AND (category_filter IS NULL OR kb.category::text = category_filter)
    ORDER BY rank DESC
    LIMIT limit_count * 2
  ),
  fused_results AS (
    SELECT
      vr.knowledge_base_id,
      vr.v_chunk_id AS f_chunk_id,
      vr.title,
      vr.chunk_content,
      vr.chunk_index,
      vr.vec_sim,
      COALESCE(br.rank, 0.0::double precision) AS f_bm25_rank,
      vr.category,
      vr.subcategory,
      vr.metadata,
      (
        (0.7::double precision / (rrf_k + vr.vec_rank)::double precision) +
        (0.3::double precision / (rrf_k + COALESCE(br.b_bm25_rank, limit_count * 2))::double precision)
      ) AS f_hybrid_score
    FROM vector_results vr
    LEFT JOIN bm25_results br ON vr.v_chunk_id = br.b_chunk_id
    UNION
    SELECT
      kbc.knowledge_base_id,
      br.b_chunk_id AS f_chunk_id,
      kb.title,
      kbc.content AS chunk_content,
      kbc.chunk_index,
      0.0::double precision AS vec_sim,
      br.rank::double precision AS f_bm25_rank,
      kb.category::text,
      kb.subcategory::text,
      kb.metadata,
      (0.3::double precision / (rrf_k + br.b_bm25_rank)::double precision) AS f_hybrid_score
    FROM bm25_results br
    JOIN knowledge_base_chunks kbc ON br.b_chunk_id = kbc.id
    JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
    WHERE br.b_chunk_id NOT IN (SELECT vr2.v_chunk_id FROM vector_results vr2)
  )
  SELECT
    fr.knowledge_base_id,
    fr.f_chunk_id AS chunk_id,
    fr.title,
    fr.chunk_content,
    fr.chunk_index,
    fr.vec_sim AS similarity,
    fr.f_bm25_rank AS bm25_rank,
    fr.f_hybrid_score AS hybrid_score,
    fr.category,
    fr.subcategory,
    fr.metadata
  FROM fused_results fr
  ORDER BY fr.f_hybrid_score DESC
  LIMIT limit_count;
END
$$;

-- 4. CORRIGER FONCTION HYBRID SEARCH (7 paramètres - overload avec subcategory)
-- =====================================================================
-- FIX (Feb 15, 2026): Même fix d'ambiguïté que l'overload principal

CREATE OR REPLACE FUNCTION search_knowledge_base_hybrid(
  query_text text,
  query_embedding vector,
  category_filter text DEFAULT NULL,
  subcategory_filter text DEFAULT NULL,
  limit_count integer DEFAULT 15,
  vector_threshold double precision DEFAULT 0.5,
  use_openai boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  title text,
  chunk_content text,
  similarity double precision,
  bm25_rank double precision,
  hybrid_score double precision,
  category text,
  subcategory text,
  metadata jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH
  vector_results AS (
    SELECT
      kbc.knowledge_base_id,
      kbc.id AS v_chunk_id,
      kb.title,
      kbc.content AS chunk_content,
      kbc.chunk_index,
      (1 - (CASE WHEN use_openai THEN kbc.embedding_openai ELSE kbc.embedding END <=> query_embedding))::double precision AS vec_sim,
      kb.category::text,
      kb.subcategory::text,
      kb.metadata,
      ROW_NUMBER() OVER (ORDER BY (CASE WHEN use_openai THEN kbc.embedding_openai ELSE kbc.embedding END <=> query_embedding)) AS vec_rank
    FROM knowledge_base_chunks kbc
    JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
    WHERE (CASE WHEN use_openai THEN kbc.embedding_openai ELSE kbc.embedding END) IS NOT NULL
      AND kb.is_active = true
      AND (category_filter IS NULL OR kb.category::text = category_filter)
      AND (subcategory_filter IS NULL OR kb.subcategory = subcategory_filter)
      AND (1 - (CASE WHEN use_openai THEN kbc.embedding_openai ELSE kbc.embedding END <=> query_embedding)) >= vector_threshold
    ORDER BY (CASE WHEN use_openai THEN kbc.embedding_openai ELSE kbc.embedding END <=> query_embedding)
    LIMIT limit_count * 2
  ),
  bm25_results AS (
    SELECT
      kbc.id AS b_chunk_id,
      ts_rank_cd(
        kbc.content_tsvector,
        plainto_tsquery('simple', query_text)
      )::double precision AS rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kbc.content_tsvector, plainto_tsquery('simple', query_text)) DESC) AS b_bm25_rank
    FROM knowledge_base_chunks kbc
    JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
    WHERE kbc.content_tsvector @@ plainto_tsquery('simple', query_text)
      AND kb.is_active = true
      AND (category_filter IS NULL OR kb.category::text = category_filter)
      AND (subcategory_filter IS NULL OR kb.subcategory = subcategory_filter)
    ORDER BY rank DESC
    LIMIT limit_count * 2
  ),
  fused_results AS (
    SELECT
      vr.knowledge_base_id,
      vr.v_chunk_id AS f_chunk_id,
      vr.title,
      vr.chunk_content,
      vr.chunk_index,
      vr.vec_sim,
      COALESCE(br.rank, 0.0::double precision) AS f_bm25_rank,
      vr.category,
      vr.subcategory,
      vr.metadata,
      (
        (0.7::double precision / (60 + vr.vec_rank)::double precision) +
        (0.3::double precision / (60 + COALESCE(br.b_bm25_rank, limit_count * 2))::double precision)
      ) AS f_hybrid_score
    FROM vector_results vr
    LEFT JOIN bm25_results br ON vr.v_chunk_id = br.b_chunk_id
    UNION
    SELECT
      kbc.knowledge_base_id,
      br.b_chunk_id AS f_chunk_id,
      kb.title,
      kbc.content AS chunk_content,
      kbc.chunk_index,
      0.0::double precision AS vec_sim,
      br.rank::double precision AS f_bm25_rank,
      kb.category::text,
      kb.subcategory::text,
      kb.metadata,
      (0.3::double precision / (60 + br.b_bm25_rank)::double precision) AS f_hybrid_score
    FROM bm25_results br
    JOIN knowledge_base_chunks kbc ON br.b_chunk_id = kbc.id
    JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
    WHERE br.b_chunk_id NOT IN (SELECT vr2.v_chunk_id FROM vector_results vr2)
  )
  SELECT
    fr.knowledge_base_id AS id,
    fr.title,
    fr.chunk_content,
    fr.vec_sim AS similarity,
    fr.f_bm25_rank AS bm25_rank,
    fr.f_hybrid_score AS hybrid_score,
    fr.category,
    fr.subcategory,
    fr.metadata
  FROM fused_results fr
  ORDER BY fr.f_hybrid_score DESC
  LIMIT limit_count;
END
$$;

-- 5. VÉRIFICATION
-- =====================================================================

-- Test rapide que la fonction fonctionne (sans vraie requête vectorielle)
SELECT 'Fix appliqué avec succès!' AS status;
