-- Migration: Ajouter `source_tier` (primaire / secondaire) sur knowledge_base
-- Date: 2026-02-21
-- Sprint 2 RAG Audit-Proof — Hiérarchie des sources
--
-- Objectif: Les sources secondaires (doctrine, guides) ne peuvent pas
-- "créer" des règles de droit — elles ne peuvent qu'expliquer des règles
-- déjà prouvées par des sources primaires (codes, lois, jurisprudence).

-- =============================================================================
-- 1. ENUM source_tier
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE source_tier AS ENUM ('primaire', 'secondaire');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. COLONNE source_tier
-- =============================================================================

ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS source_tier source_tier DEFAULT 'secondaire';

COMMENT ON COLUMN knowledge_base.source_tier IS
'Hiérarchie des sources: primaire (codes, lois, jurisprudence, JO) vs secondaire (doctrine, guides, commentaires)';

-- =============================================================================
-- 3. PEUPLEMENT AUTOMATIQUE
-- =============================================================================

UPDATE knowledge_base SET source_tier = (
  CASE
    WHEN category::text IN (
      'legislation',
      'codes',
      'constitution',
      'jort',
      'conventions',
      'jurisprudence'
    ) THEN 'primaire'
    ELSE 'secondaire'
  END
)::source_tier;

-- =============================================================================
-- 4. INDEX ET SYNC METADATA
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_kb_source_tier
  ON knowledge_base(source_tier);

-- Sync source_tier dans la colonne metadata JSONB
-- → Accessible via ...row.metadata dans searchHybridSingle sans modifier le SQL
UPDATE knowledge_base
SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object('source_tier', source_tier::text);

-- =============================================================================
-- 5. STATISTIQUES
-- =============================================================================

CREATE OR REPLACE VIEW vw_kb_tier_distribution AS
SELECT
  source_tier::text,
  category::text,
  COUNT(*) AS doc_count
FROM knowledge_base
WHERE is_active = true
GROUP BY source_tier, category
ORDER BY source_tier, doc_count DESC;

COMMENT ON VIEW vw_kb_tier_distribution IS
'Distribution tier primaire/secondaire par catégorie dans la KB';
