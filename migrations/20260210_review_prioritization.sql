-- Migration: Ajout colonnes review_priority et review_estimated_effort
-- Date: 2026-02-10
-- Description: Ajoute les colonnes de priorisation pour la revue humaine des classifications

-- Étape 0: Ajouter colonne created_at si elle n'existe pas
ALTER TABLE legal_classifications
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Étape 1: Ajouter les nouvelles colonnes à legal_classifications
ALTER TABLE legal_classifications
  ADD COLUMN IF NOT EXISTS review_priority TEXT CHECK (review_priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS review_estimated_effort TEXT CHECK (review_estimated_effort IN ('quick', 'moderate', 'complex')),
  ADD COLUMN IF NOT EXISTS validation_reason TEXT;

-- Étape 2: Créer index pour performance queries de queue
CREATE INDEX IF NOT EXISTS idx_legal_classifications_review_queue
  ON legal_classifications(requires_validation, review_priority, created_at)
  WHERE requires_validation = true;

-- Étape 3: Créer table classification_feedback si elle n'existe pas déjà
CREATE TABLE IF NOT EXISTS classification_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id UUID NOT NULL REFERENCES classification_corrections(id) ON DELETE CASCADE,
  is_useful BOOLEAN NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classification_feedback_correction
  ON classification_feedback(correction_id);

CREATE INDEX IF NOT EXISTS idx_classification_feedback_useful
  ON classification_feedback(is_useful, created_at);

-- Étape 4: Fonction SQL pour récupérer la queue de revue avec priorisation
CREATE OR REPLACE FUNCTION get_classification_review_queue(
  p_priority TEXT[] DEFAULT NULL,
  p_effort TEXT[] DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  web_page_id UUID,
  url TEXT,
  title TEXT,
  confidence_score NUMERIC,
  review_priority TEXT,
  review_estimated_effort TEXT,
  validation_reason TEXT,
  primary_category TEXT,
  domain TEXT,
  source_name TEXT,
  created_at TIMESTAMP
) AS \$\$
BEGIN
  RETURN QUERY
  SELECT
    wp.id AS web_page_id,
    wp.url,
    wp.title,
    lc.confidence_score,
    lc.review_priority,
    lc.review_estimated_effort,
    lc.validation_reason,
    lc.primary_category,
    lc.domain,
    ws.name AS source_name,
    lc.created_at
  FROM web_pages wp
  JOIN legal_classifications lc ON lc.web_page_id = wp.id
  JOIN web_sources ws ON ws.id = wp.web_source_id
  WHERE lc.requires_validation = true
    AND (p_priority IS NULL OR lc.review_priority = ANY(p_priority))
    AND (p_effort IS NULL OR lc.review_estimated_effort = ANY(p_effort))
    AND (p_source_id IS NULL OR wp.web_source_id = p_source_id)
  ORDER BY
    CASE lc.review_priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
      ELSE 5
    END,
    lc.created_at ASC
  LIMIT p_limit OFFSET p_offset;
END;
\$\$ LANGUAGE plpgsql STABLE;

-- Étape 5: Fonction pour obtenir stats queue de revue
CREATE OR REPLACE FUNCTION get_review_queue_stats()
RETURNS TABLE (
  urgent_count BIGINT,
  high_count BIGINT,
  medium_count BIGINT,
  low_count BIGINT,
  no_priority_count BIGINT,
  total_count BIGINT
) AS \$\$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE review_priority = 'urgent') AS urgent_count,
    COUNT(*) FILTER (WHERE review_priority = 'high') AS high_count,
    COUNT(*) FILTER (WHERE review_priority = 'medium') AS medium_count,
    COUNT(*) FILTER (WHERE review_priority = 'low') AS low_count,
    COUNT(*) FILTER (WHERE review_priority IS NULL) AS no_priority_count,
    COUNT(*) AS total_count
  FROM legal_classifications
  WHERE requires_validation = true;
END;
\$\$ LANGUAGE plpgsql STABLE;

-- Étape 6: Mettre à jour les classifications existantes avec priorité par défaut
UPDATE legal_classifications
SET
  review_priority = CASE
    WHEN confidence_score < 0.3 THEN 'low'
    WHEN confidence_score < 0.5 THEN 'high'
    WHEN confidence_score < 0.6 THEN 'urgent'
    ELSE 'medium'
  END,
  review_estimated_effort = CASE
    WHEN confidence_score < 0.3 THEN 'quick'
    WHEN confidence_score < 0.5 THEN 'complex'
    ELSE 'moderate'
  END,
  validation_reason = CASE
    WHEN confidence_score < 0.3 THEN 'Confiance très faible - probablement hors périmètre'
    WHEN confidence_score < 0.5 THEN 'Confiance faible - nécessite expertise'
    WHEN confidence_score < 0.6 THEN 'Signaux contradictoires - revue urgente'
    ELSE 'Revue standard'
  END
WHERE requires_validation = true
  AND review_priority IS NULL;

-- Étape 7: Ajouter commentaire sur les colonnes
COMMENT ON COLUMN legal_classifications.review_priority IS 'Priorité de revue humaine: urgent > high > medium > low';
COMMENT ON COLUMN legal_classifications.review_estimated_effort IS 'Effort estimé pour correction: quick < moderate < complex';
COMMENT ON COLUMN legal_classifications.validation_reason IS 'Raison lisible par humain expliquant pourquoi requires_validation = true';
