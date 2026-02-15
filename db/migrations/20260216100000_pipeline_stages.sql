-- =====================================================================
-- Migration: Pipeline Supervisé KB - Étapes de validation
-- Date: 2026-02-16
-- Description: Ajout du système pipeline à 7 étapes pour validation
--   manuelle des documents KB par le super-admin.
-- =====================================================================

-- 1. COLONNES PIPELINE SUR knowledge_base
-- =====================================================================

ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'crawled'
    CHECK (pipeline_stage IN (
      'source_configured', 'crawled', 'content_reviewed', 'classified',
      'indexed', 'quality_analyzed', 'rag_active',
      'rejected', 'needs_revision'
    )),
  ADD COLUMN IF NOT EXISTS pipeline_stage_updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS pipeline_notes TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_rejected_reason TEXT;

-- 2. TABLE AUDIT PIPELINE
-- =====================================================================

CREATE TABLE IF NOT EXISTS document_pipeline_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'auto_advance', 'admin_approve', 'admin_reject', 'admin_edit',
    'admin_replay', 'admin_override', 'system_error', 'backfill'
  )),
  performed_by UUID REFERENCES users(id),
  changes_made JSONB DEFAULT '{}',
  notes TEXT,
  quality_score_at_transition INTEGER,
  metadata_snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDEX
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_kb_pipeline_stage ON knowledge_base(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_kb_pipeline_stage_updated ON knowledge_base(pipeline_stage, pipeline_stage_updated_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_history_kb ON document_pipeline_history(knowledge_base_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_history_action ON document_pipeline_history(action, created_at DESC);

-- 4. BACKFILL EXISTANTS (positionnement intelligent)
-- =====================================================================
-- STRATÉGIE: On positionne les docs selon leur état actuel
-- MAIS on NE TOUCHE PAS à is_approved pour ne pas couper le RAG

-- Docs avec quality_score → quality_analyzed
UPDATE knowledge_base
SET pipeline_stage = 'quality_analyzed', pipeline_stage_updated_at = NOW()
WHERE quality_score IS NOT NULL AND is_indexed = true AND is_active = true
  AND pipeline_stage IS NULL;

-- Docs indexés sans quality → indexed
UPDATE knowledge_base
SET pipeline_stage = 'indexed', pipeline_stage_updated_at = NOW()
WHERE quality_score IS NULL AND is_indexed = true AND is_active = true
  AND pipeline_stage IS NULL;

-- Docs non indexés → crawled
UPDATE knowledge_base
SET pipeline_stage = 'crawled', pipeline_stage_updated_at = NOW()
WHERE is_indexed = false AND is_active = true
  AND pipeline_stage IS NULL;

-- Docs inactifs → rejected
UPDATE knowledge_base
SET pipeline_stage = 'rejected', pipeline_stage_updated_at = NOW()
WHERE is_active = false
  AND pipeline_stage IS NULL;

-- Docs déjà approuvés → rag_active (ils restent searchables)
UPDATE knowledge_base
SET pipeline_stage = 'rag_active', pipeline_stage_updated_at = NOW()
WHERE is_approved = true AND is_active = true
  AND pipeline_stage IS NULL;

-- 5. LOG BACKFILL DANS HISTORIQUE
-- =====================================================================

INSERT INTO document_pipeline_history (knowledge_base_id, from_stage, to_stage, action, notes)
SELECT id, NULL, pipeline_stage, 'backfill', 'Migration pipeline supervisé - positionnement initial'
FROM knowledge_base
WHERE pipeline_stage IS NOT NULL;

-- 6. VÉRIFICATION
-- =====================================================================

DO $$
DECLARE
  stage_counts TEXT;
BEGIN
  SELECT string_agg(pipeline_stage || ': ' || cnt::text, ', ')
  INTO stage_counts
  FROM (
    SELECT pipeline_stage, COUNT(*) as cnt
    FROM knowledge_base
    GROUP BY pipeline_stage
    ORDER BY pipeline_stage
  ) sub;

  RAISE NOTICE 'Pipeline stages backfill: %', stage_counts;
END $$;

SELECT 'Migration pipeline_stages appliquée avec succès!' AS status;
