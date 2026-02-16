-- Migration: Ajouter stratégie de chunking (Phase 3)
-- Date: 2026-02-16
-- Description: Permet de tracker quelle stratégie a été utilisée pour chunker chaque document

-- =============================================================================
-- 1. AJOUTER COLONNE CHUNKING_STRATEGY
-- =============================================================================

-- Créer enum pour les stratégies de chunking
DO $$ BEGIN
    CREATE TYPE chunking_strategy AS ENUM ('adaptive', 'article', 'semantic');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ajouter colonne à knowledge_base (défaut: adaptive pour rétrocompat)
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS chunking_strategy chunking_strategy DEFAULT 'adaptive';

-- Index pour filtrage par stratégie (utile pour monitoring)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_chunking_strategy
ON knowledge_base(chunking_strategy)
WHERE is_active = true;

-- Commentaire
COMMENT ON COLUMN knowledge_base.chunking_strategy IS 'Stratégie utilisée pour chunker ce document : adaptive (taille fixe), article (1 article = 1 chunk), semantic (chunking sémantique futur)';

-- =============================================================================
-- 2. VUES STATISTIQUES
-- =============================================================================

-- Vue: Distribution par stratégie de chunking
CREATE OR REPLACE VIEW vw_kb_stats_by_chunking_strategy AS
SELECT
  chunking_strategy,
  COUNT(*) as total_docs,
  COUNT(*) FILTER (WHERE is_indexed = true) as indexed_docs,
  ROUND(AVG(quality_score), 2) as avg_quality,
  ROUND(AVG(chunk_count), 2) as avg_chunks_per_doc,
  SUM(chunk_count) as total_chunks,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_indexed = true) / COUNT(*), 2) as indexation_rate
FROM knowledge_base
WHERE is_active = true
GROUP BY chunking_strategy
ORDER BY total_docs DESC;

COMMENT ON VIEW vw_kb_stats_by_chunking_strategy IS 'Statistiques agrégées par stratégie de chunking (adaptive, article, semantic)';

-- Vue: Documents codes éligibles pour article-level chunking
CREATE OR REPLACE VIEW vw_kb_article_chunking_candidates AS
SELECT
  kb.id,
  kb.title,
  kb.category,
  kb.language,
  kb.chunking_strategy,
  kb.chunk_count,
  LENGTH(kb.full_text) as text_length,
  -- Détecte si le document contient des articles
  CASE
    WHEN kb.language = 'fr' AND kb.full_text ~* '(?:Article|art\.?)\s+\d+' THEN true
    WHEN kb.language = 'ar' AND kb.full_text ~ '(?:الفصل|فصل)\s+\d+' THEN true
    ELSE false
  END as has_articles,
  -- Estime nombre d'articles
  CASE
    WHEN kb.language = 'fr' THEN
      (SELECT COUNT(*) FROM regexp_matches(kb.full_text, '(?:Article|art\.?)\s+\d+', 'gi'))
    WHEN kb.language = 'ar' THEN
      (SELECT COUNT(*) FROM regexp_matches(kb.full_text, '(?:الفصل|فصل)\s+\d+', 'g'))
    ELSE 0
  END as estimated_articles
FROM knowledge_base kb
WHERE kb.is_active = true
  AND kb.category IN ('codes', 'legislation', 'constitution')
  AND kb.chunking_strategy = 'adaptive'  -- Pas encore migré
ORDER BY estimated_articles DESC;

COMMENT ON VIEW vw_kb_article_chunking_candidates IS 'Documents codes qui pourraient bénéficier du chunking article-level (pas encore migrés)';

-- =============================================================================
-- 3. FONCTIONS UTILITAIRES
-- =============================================================================

-- Fonction: Marquer document pour re-chunking
CREATE OR REPLACE FUNCTION mark_for_rechunking(
  p_document_id UUID,
  p_new_strategy chunking_strategy DEFAULT 'article'
) RETURNS BOOLEAN AS $$
BEGIN
  -- Marquer document comme non indexé et changer stratégie
  UPDATE knowledge_base
  SET
    chunking_strategy = p_new_strategy,
    is_indexed = false,
    chunk_count = 0,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_document_id
    AND is_active = true;

  -- Supprimer anciens chunks
  DELETE FROM knowledge_base_chunks
  WHERE knowledge_base_id = p_document_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_for_rechunking IS 'Marque un document pour re-chunking avec une nouvelle stratégie (supprime anciens chunks)';

-- =============================================================================
-- RÉSUMÉ DE LA MIGRATION
-- =============================================================================

DO $$
DECLARE
  v_total_docs INTEGER;
  v_codes_adaptive INTEGER;
  v_estimated_articles INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_docs FROM knowledge_base WHERE is_active = true;

  SELECT COUNT(*) INTO v_codes_adaptive
  FROM knowledge_base
  WHERE is_active = true
    AND category IN ('codes', 'legislation', 'constitution')
    AND chunking_strategy = 'adaptive';

  SELECT SUM(estimated_articles) INTO v_estimated_articles
  FROM vw_kb_article_chunking_candidates;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Migration chunking_strategy - Résumé';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total documents actifs: %', v_total_docs;
  RAISE NOTICE 'Codes avec chunking adaptive (candidats migration): %', v_codes_adaptive;
  RAISE NOTICE 'Articles estimés dans codes: %', v_estimated_articles;
  RAISE NOTICE '=================================================================';
END $$;
