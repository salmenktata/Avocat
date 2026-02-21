-- Migration: Peupler `branch` sur knowledge_base depuis category/title
-- Date: 2026-02-21
-- Sprint 1 RAG Audit-Proof — Peuplement automatique branche

-- =============================================================================
-- 1. PEUPLEMENT DEPUIS TITRE ET CATÉGORIE
-- =============================================================================

UPDATE knowledge_base SET branch = (
  CASE
    -- ===== TRAVAIL =====
    WHEN title ILIKE '%الشغل%'
      OR title ILIKE '%travail%'
      OR title ILIKE '%عمل%'
      OR (category::text = 'legislation' AND title ILIKE '%عامل%')
    THEN 'travail'

    -- ===== PÉNAL =====
    WHEN title ILIKE '%الجزائية%'
      OR title ILIKE '%الجزائي%'
      OR title ILIKE '%المجلة الجزائية%'
      OR title ILIKE '%pénal%'
      OR title ILIKE '%جنائي%'
      OR title ILIKE '%عقوبات%'
    THEN 'pénal'

    -- ===== PROCÉDURE (avant civil/commercial pour éviter faux positifs) =====
    WHEN title ILIKE '%المرافعات%'
      OR title ILIKE '%procédure%'
      OR title ILIKE '%الإجراءات الجزائية%'
      OR title ILIKE '%إجراءات%'
    THEN 'procédure'

    -- ===== CIVIL =====
    WHEN title ILIKE '%الالتزامات والعقود%'
      OR title ILIKE '%م.ا.ع%'
      OR title ILIKE '%obligations%'
      OR title ILIKE '%contrats%'
      OR (title ILIKE '%مدني%' AND category::text IN ('codes', 'legislation'))
    THEN 'civil'

    -- ===== FAMILLE =====
    WHEN title ILIKE '%الأحوال الشخصية%'
      OR title ILIKE '%م.أ.ش%'
      OR title ILIKE '%statut personnel%'
      OR title ILIKE '%أسرة%'
    THEN 'famille'

    -- ===== MARCHÉS PUBLICS =====
    WHEN title ILIKE '%الصفقات العمومية%'
      OR title ILIKE '%الصفقات الحكومية%'
      OR title ILIKE '%marchés publics%'
      OR title ILIKE '%صفقة عمومية%'
      OR (title ILIKE '%صفقات%' AND category::text IN ('legislation', 'codes'))
    THEN 'marchés_publics'

    -- ===== COMMERCIAL =====
    WHEN title ILIKE '%تجاري%'
      OR title ILIKE '%التجارية%'
      OR title ILIKE '%المجلة التجارية%'
      OR title ILIKE '%الشركات%'
      OR title ILIKE '%commercial%'
      OR title ILIKE '%إفلاس%'
      OR title ILIKE '%تفليس%'
    THEN 'commercial'

    -- ===== FISCAL =====
    WHEN title ILIKE '%ضريب%'
      OR title ILIKE '%جبائ%'
      OR title ILIKE '%fiscal%'
      OR title ILIKE '%الأداء%'
      OR (title ILIKE '%مالي%' AND category::text IN ('legislation', 'codes'))
    THEN 'fiscal'

    -- ===== BANCAIRE =====
    WHEN title ILIKE '%بنك%'
      OR title ILIKE '%مصرف%'
      OR title ILIKE '%bancaire%'
      OR title ILIKE '%ائتمان%'
    THEN 'bancaire'

    -- ===== IMMOBILIER =====
    WHEN title ILIKE '%عقار%'
      OR title ILIKE '%immobili%'
      OR title ILIKE '%عينية%'
      OR title ILIKE '%الحقوق العينية%'
    THEN 'immobilier'

    -- ===== ADMINISTRATIF =====
    WHEN title ILIKE '%إداري%'
      OR title ILIKE '%administratif%'
      OR (category::text = 'jurisprudence' AND subcategory ILIKE '%administr%')
    THEN 'administratif'

    -- ===== BRANCHES VIA CATÉGORIE =====
    WHEN category::text = 'jurisprudence' AND subcategory ILIKE '%pénal%' THEN 'pénal'
    WHEN category::text = 'jurisprudence' AND subcategory ILIKE '%travail%' THEN 'travail'
    WHEN category::text = 'jurisprudence' AND subcategory ILIKE '%commercial%' THEN 'commercial'
    WHEN category::text = 'jurisprudence' AND subcategory ILIKE '%civil%' THEN 'civil'
    WHEN category::text = 'jurisprudence' AND subcategory ILIKE '%famille%' THEN 'famille'

    -- ===== DÉFAUT =====
    ELSE 'autre'
  END
)::legal_branch
WHERE is_active = true;

-- =============================================================================
-- 2. PROPAGATION BRANCH VERS knowledge_base_chunks
-- =============================================================================

UPDATE knowledge_base_chunks kbc
SET branch = kb.branch
FROM knowledge_base kb
WHERE kbc.knowledge_base_id = kb.id
  AND kbc.branch IS NULL;

-- =============================================================================
-- 3. SYNC branch ET source_tier DANS LA COLONNE metadata JSONB
--    → Accessible automatiquement via ...row.metadata dans searchHybridSingle
--    → Sans modifier la signature SQL de search_knowledge_base_hybrid
-- =============================================================================

UPDATE knowledge_base
SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object('branch', branch::text)
WHERE is_active = true;

-- =============================================================================
-- 4. STATISTIQUES POST-MIGRATION
-- =============================================================================

-- Vue de distribution
CREATE OR REPLACE VIEW vw_kb_branch_distribution AS
SELECT
  branch::text,
  COUNT(*) AS doc_count,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
FROM knowledge_base
WHERE is_active = true
GROUP BY branch
ORDER BY doc_count DESC;

COMMENT ON VIEW vw_kb_branch_distribution IS
'Distribution des branches juridiques dans la KB — pour monitoring post-migration';
