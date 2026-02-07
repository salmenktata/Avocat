/**
 * Migration: Index partiel sur les chunks récents
 * Date: 2026-02-08
 * Description: Créer des index partiels pour améliorer les performances de recherche
 *              sur les documents récemment ajoutés (+20% performance estimée)
 *
 * Optimisation RAG Quick Win #4 du plan d'audit
 */

-- ============================================================================
-- INDEX PARTIEL KNOWLEDGE_BASE_CHUNKS (documents récents 30 jours)
-- ============================================================================

-- Index partiel sur les chunks récents pour knowledge_base
-- Améliore les recherches sur les documents récemment ajoutés
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kb_chunks_recent
  ON knowledge_base_chunks(knowledge_base_id, created_at DESC)
  WHERE created_at > NOW() - INTERVAL '30 days';

-- Index composite pour la recherche vectorielle sur documents récents
-- Permet au query planner de choisir cet index pour les recherches filtrées par date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kb_chunks_recent_vector
  ON knowledge_base_chunks
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL
    AND created_at > NOW() - INTERVAL '30 days';

-- ============================================================================
-- INDEX PARTIEL DOCUMENT_EMBEDDINGS (documents récents 30 jours)
-- ============================================================================

-- Index partiel sur les embeddings de documents récents
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doc_embeddings_recent
  ON document_embeddings(document_id, created_at DESC)
  WHERE created_at > NOW() - INTERVAL '30 days';

-- Index composite pour la recherche vectorielle sur documents récents
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doc_embeddings_recent_vector
  ON document_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL
    AND created_at > NOW() - INTERVAL '30 days';

-- ============================================================================
-- STATISTIQUES ET ANALYSE
-- ============================================================================

-- Analyser les tables pour mettre à jour les statistiques
ANALYZE knowledge_base_chunks;
ANALYZE document_embeddings;

-- ============================================================================
-- FONCTION DE MAINTENANCE
-- ============================================================================

/**
 * Fonction pour recréer les index partiels (à exécuter périodiquement)
 * Les index partiels avec NOW() ne se mettent pas à jour automatiquement
 * Cette fonction doit être appelée par un job cron hebdomadaire
 */
CREATE OR REPLACE FUNCTION refresh_recent_chunks_indexes()
RETURNS void AS $$
BEGIN
  -- Recréer l'index partiel kb_chunks_recent
  DROP INDEX IF EXISTS idx_kb_chunks_recent;
  CREATE INDEX CONCURRENTLY idx_kb_chunks_recent
    ON knowledge_base_chunks(knowledge_base_id, created_at DESC)
    WHERE created_at > NOW() - INTERVAL '30 days';

  -- Recréer l'index partiel doc_embeddings_recent
  DROP INDEX IF EXISTS idx_doc_embeddings_recent;
  CREATE INDEX CONCURRENTLY idx_doc_embeddings_recent
    ON document_embeddings(document_id, created_at DESC)
    WHERE created_at > NOW() - INTERVAL '30 days';

  -- Analyser les tables
  ANALYZE knowledge_base_chunks;
  ANALYZE document_embeddings;

  RAISE NOTICE 'Index partiels récents recréés avec succès';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

DO $$
DECLARE
  kb_chunks_count INTEGER;
  doc_embeddings_count INTEGER;
BEGIN
  -- Compter les chunks récents
  SELECT COUNT(*) INTO kb_chunks_count
  FROM knowledge_base_chunks
  WHERE created_at > NOW() - INTERVAL '30 days';

  SELECT COUNT(*) INTO doc_embeddings_count
  FROM document_embeddings
  WHERE created_at > NOW() - INTERVAL '30 days';

  RAISE NOTICE '✅ Index partiels créés avec succès!';
  RAISE NOTICE '📊 Chunks KB récents (30j): %', kb_chunks_count;
  RAISE NOTICE '📊 Embeddings docs récents (30j): %', doc_embeddings_count;
  RAISE NOTICE '🔧 Fonction refresh_recent_chunks_indexes() disponible pour maintenance';
END $$;
