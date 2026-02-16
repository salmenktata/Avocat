-- Migration: Enrichir les relations juridiques (Phase 4)
-- Date: 2026-02-16
-- Description: Ajoute nouveaux types de relations (similar_to, complements, contradicts, etc.)
--              et poids de relation pour améliorer le re-ranking

-- =============================================================================
-- 1. NOUVEAUX TYPES DE RELATIONS
-- =============================================================================

-- Vérifier si l'enum existe déjà
DO $$ BEGIN
    -- Supprimer l'ancien type s'il existe
    DROP TYPE IF EXISTS legal_relation_type CASCADE;

    -- Créer le nouveau type avec tous les types de relations
    CREATE TYPE legal_relation_type AS ENUM (
        -- Existants (relations de citation)
        'cites',                  -- Source cite Target
        'cited_by',               -- Inverse de cites
        'doctrine_cites',         -- Doctrine cite jurisprudence
        'jurisprudence_applies',  -- Jurisprudence applique texte

        -- Phase 4: Nouveaux types de relations
        'similar_to',             -- Notions juridiques proches (symétrique)
        'complements',            -- Documents complémentaires (symétrique)
        'contradicts',            -- Jurisprudence contradictoire
        'amends',                 -- Texte modifie un autre
        'abrogates',              -- Texte abroge un autre
        'supersedes'              -- Version remplace une autre
    );
END $$;

-- =============================================================================
-- 2. ENRICHIR TABLE kb_legal_relations
-- =============================================================================

-- Ajouter colonne relation_type si elle n'existe pas
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kb_legal_relations' AND column_name = 'relation_type'
    ) THEN
        ALTER TABLE kb_legal_relations
        ADD COLUMN relation_type legal_relation_type DEFAULT 'cites';
    END IF;
END $$;

-- Ajouter colonne relation_strength (poids 0-1)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kb_legal_relations' AND column_name = 'relation_strength'
    ) THEN
        ALTER TABLE kb_legal_relations
        ADD COLUMN relation_strength NUMERIC DEFAULT 0.8 CHECK (relation_strength >= 0 AND relation_strength <= 1);
    END IF;
END $$;

-- Commentaires
COMMENT ON COLUMN kb_legal_relations.relation_type IS 'Type de relation juridique : cites, similar_to, complements, contradicts, amends, abrogates, supersedes';
COMMENT ON COLUMN kb_legal_relations.relation_strength IS 'Poids de la relation (0-1) : 1 = très forte, 0 = faible. Utilisé pour le re-ranking.';

-- =============================================================================
-- 3. INDEX POUR PERFORMANCES
-- =============================================================================

-- Index pour recherches par type de relation
CREATE INDEX IF NOT EXISTS idx_kb_legal_relations_type
ON kb_legal_relations(relation_type, validated)
WHERE validated = true;

-- Index pour recherches similar_to rapides
CREATE INDEX IF NOT EXISTS idx_kb_legal_relations_similar_to
ON kb_legal_relations(source_kb_id, relation_type)
WHERE relation_type = 'similar_to' AND validated = true;

-- Index composite pour re-ranking (source + type + strength)
CREATE INDEX IF NOT EXISTS idx_kb_legal_relations_reranking
ON kb_legal_relations(source_kb_id, relation_type, relation_strength DESC)
WHERE validated = true;

-- =============================================================================
-- 4. VUES STATISTIQUES
-- =============================================================================

-- Vue: Distribution par type de relation
CREATE OR REPLACE VIEW vw_kb_relations_by_type AS
SELECT
  relation_type,
  COUNT(*) as total_relations,
  COUNT(*) FILTER (WHERE validated = true) as validated_relations,
  ROUND(AVG(relation_strength), 3) as avg_strength,
  ROUND(100.0 * COUNT(*) FILTER (WHERE validated = true) / COUNT(*), 2) as validation_rate
FROM kb_legal_relations
GROUP BY relation_type
ORDER BY total_relations DESC;

COMMENT ON VIEW vw_kb_relations_by_type IS 'Statistiques agrégées par type de relation juridique';

-- Vue: Documents avec le plus de relations similar_to
CREATE OR REPLACE VIEW vw_kb_most_similar_docs AS
SELECT
  kb.id,
  kb.title,
  kb.category,
  kb.doc_type,
  COUNT(DISTINCT rel.target_kb_id) as similar_docs_count,
  ROUND(AVG(rel.relation_strength), 3) as avg_similarity_strength
FROM knowledge_base kb
INNER JOIN kb_legal_relations rel
  ON kb.id = rel.source_kb_id
WHERE rel.relation_type = 'similar_to'
  AND rel.validated = true
  AND kb.is_active = true
GROUP BY kb.id, kb.title, kb.category, kb.doc_type
HAVING COUNT(DISTINCT rel.target_kb_id) >= 3  -- Au moins 3 documents similaires
ORDER BY similar_docs_count DESC, avg_similarity_strength DESC;

COMMENT ON VIEW vw_kb_most_similar_docs IS 'Documents avec le plus de relations similar_to validées (minimum 3)';

-- Vue: Candidats détection automatique similar_to
CREATE OR REPLACE VIEW vw_kb_similar_to_candidates AS
SELECT
  kb1.id as doc1_id,
  kb1.title as doc1_title,
  kb1.category as doc1_category,
  kb2.id as doc2_id,
  kb2.title as doc2_title,
  kb2.category as doc2_category,
  -- Similarité embedding (si disponible)
  CASE
    WHEN kb1.embedding IS NOT NULL AND kb2.embedding IS NOT NULL THEN
      1 - (kb1.embedding <=> kb2.embedding)  -- Cosine similarity
    ELSE NULL
  END as embedding_similarity,
  -- Mêmes tags (overlap)
  CASE
    WHEN array_length(kb1.tags, 1) > 0 AND array_length(kb2.tags, 1) > 0 THEN
      ROUND(
        CAST(
          (SELECT COUNT(*) FROM unnest(kb1.tags) t WHERE t = ANY(kb2.tags))
        AS NUMERIC) / GREATEST(array_length(kb1.tags, 1), array_length(kb2.tags, 1)),
        3
      )
    ELSE 0
  END as tags_overlap
FROM knowledge_base kb1
CROSS JOIN knowledge_base kb2
WHERE kb1.id < kb2.id  -- Éviter doublons (paires uniques)
  AND kb1.is_active = true
  AND kb2.is_active = true
  AND kb1.category = kb2.category  -- Même catégorie
  AND kb1.language = kb2.language  -- Même langue
  AND kb1.id != kb2.id
  -- Pas déjà en relation similar_to
  AND NOT EXISTS (
    SELECT 1 FROM kb_legal_relations rel
    WHERE (rel.source_kb_id = kb1.id AND rel.target_kb_id = kb2.id)
       OR (rel.source_kb_id = kb2.id AND rel.target_kb_id = kb1.id)
    AND rel.relation_type = 'similar_to'
  )
  -- Seuil embedding similarity > 0.85
  AND (
    kb1.embedding IS NULL OR kb2.embedding IS NULL
    OR (1 - (kb1.embedding <=> kb2.embedding)) > 0.85
  )
ORDER BY embedding_similarity DESC NULLS LAST, tags_overlap DESC
LIMIT 1000;  -- Limiter pour performances

COMMENT ON VIEW vw_kb_similar_to_candidates IS 'Paires de documents candidats pour relation similar_to (embedding >0.85, même catégorie/langue, pas déjà liés)';

-- =============================================================================
-- 5. FONCTIONS UTILITAIRES
-- =============================================================================

-- Fonction: Créer relation bidirectionnelle similar_to
CREATE OR REPLACE FUNCTION create_similar_to_relation(
  p_doc1_id UUID,
  p_doc2_id UUID,
  p_strength NUMERIC DEFAULT 0.85,
  p_auto_validate BOOLEAN DEFAULT false
) RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Vérifier si relation existe déjà (dans un sens ou l'autre)
  SELECT EXISTS(
    SELECT 1 FROM kb_legal_relations
    WHERE (source_kb_id = p_doc1_id AND target_kb_id = p_doc2_id)
       OR (source_kb_id = p_doc2_id AND target_kb_id = p_doc1_id)
    AND relation_type = 'similar_to'
  ) INTO v_exists;

  IF v_exists THEN
    RAISE NOTICE 'Relation similar_to existe déjà entre % et %', p_doc1_id, p_doc2_id;
    RETURN false;
  END IF;

  -- Créer relation bidirectionnelle (2 entrées pour simplifier les requêtes)
  INSERT INTO kb_legal_relations (source_kb_id, target_kb_id, relation_type, relation_strength, validated, created_at)
  VALUES
    (p_doc1_id, p_doc2_id, 'similar_to', p_strength, p_auto_validate, NOW()),
    (p_doc2_id, p_doc1_id, 'similar_to', p_strength, p_auto_validate, NOW());

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_similar_to_relation IS 'Crée une relation similar_to bidirectionnelle entre deux documents avec poids (0-1)';

-- Fonction: Obtenir documents similaires pour re-ranking
CREATE OR REPLACE FUNCTION get_similar_documents(
  p_doc_id UUID,
  p_min_strength NUMERIC DEFAULT 0.7,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  similar_doc_id UUID,
  relation_strength NUMERIC,
  title TEXT,
  category TEXT,
  doc_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rel.target_kb_id,
    rel.relation_strength,
    kb.title,
    kb.category::text,
    kb.doc_type::text
  FROM kb_legal_relations rel
  INNER JOIN knowledge_base kb ON rel.target_kb_id = kb.id
  WHERE rel.source_kb_id = p_doc_id
    AND rel.relation_type = 'similar_to'
    AND rel.validated = true
    AND rel.relation_strength >= p_min_strength
    AND kb.is_active = true
  ORDER BY rel.relation_strength DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_similar_documents IS 'Retourne les documents similaires à un document donné (pour re-ranking)';

-- Fonction: Marquer relation comme validée
CREATE OR REPLACE FUNCTION validate_relation(
  p_relation_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE kb_legal_relations
  SET validated = true, validated_at = NOW()
  WHERE id = p_relation_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_relation IS 'Marque une relation comme validée (review humain)';

-- =============================================================================
-- 6. PEUPLER RELATIONS EXISTANTES (RÉTROCOMPATIBILITÉ)
-- =============================================================================

-- Mettre à jour relations existantes avec type par défaut 'cites'
UPDATE kb_legal_relations
SET relation_type = 'cites'
WHERE relation_type IS NULL;

-- Initialiser relation_strength à 0.8 pour relations existantes
UPDATE kb_legal_relations
SET relation_strength = 0.8
WHERE relation_strength IS NULL;

-- =============================================================================
-- RÉSUMÉ DE LA MIGRATION
-- =============================================================================

DO $$
DECLARE
  v_total_relations INTEGER;
  v_by_type RECORD;
BEGIN
  SELECT COUNT(*) INTO v_total_relations FROM kb_legal_relations;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Migration enrichissement relations juridiques - Résumé';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total relations: %', v_total_relations;
  RAISE NOTICE '';
  RAISE NOTICE 'Distribution par type:';

  FOR v_by_type IN
    SELECT relation_type, COUNT(*) as count
    FROM kb_legal_relations
    GROUP BY relation_type
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  % : % relations', v_by_type.relation_type, v_by_type.count;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Nouveaux types disponibles:';
  RAISE NOTICE '  - similar_to     : Notions juridiques proches';
  RAISE NOTICE '  - complements    : Documents complémentaires';
  RAISE NOTICE '  - contradicts    : Jurisprudence contradictoire';
  RAISE NOTICE '  - amends         : Texte modifie un autre';
  RAISE NOTICE '  - abrogates      : Texte abroge un autre';
  RAISE NOTICE '  - supersedes     : Version remplace une autre';
  RAISE NOTICE '=================================================================';
END $$;
