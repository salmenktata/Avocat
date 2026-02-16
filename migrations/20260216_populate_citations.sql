-- Script de population des citations et article_id (Phase 2)
-- Extrait automatiquement depuis les titres existants

-- =============================================================================
-- 1. POPULATION CITATIONS CODES JURIDIQUES (Français)
-- =============================================================================

UPDATE knowledge_base
SET
  citation = CASE
    WHEN title ~* '^(Code[^,]+),?\s+(?:article|art\.?)\s+(\d+(?:\s+(?:bis|ter|quater))?)' THEN
      regexp_replace(
        title,
        '^(Code[^,]+),?\s+(?:article|art\.?)\s+(\d+(?:\s+(?:bis|ter|quater))?)',
        '\1, art. \2',
        'i'
      )
    ELSE NULL
  END,
  article_id = CASE
    WHEN title ~* 'article?\s+(\d+(?:\s+(?:bis|ter|quater))?)' THEN
      'art_' || lower(regexp_replace(
        regexp_replace(title, '.*article?\s+(\d+(?:\s+(?:bis|ter|quater))?)', '\1', 'i'),
        '\s+', '_', 'g'
      ))
    ELSE NULL
  END
WHERE category IN ('codes', 'legislation', 'constitution')
  AND citation IS NULL
  AND language = 'fr'
  AND is_active = true;

-- =============================================================================
-- 2. POPULATION CITATIONS CODES JURIDIQUES (Arabe)
-- =============================================================================

UPDATE knowledge_base
SET
  citation_ar = CASE
    WHEN title ~ '^(المجلة\s+[^،]+)،?\s+(?:الفصل|فصل)\s+(\d+(?:\s+مكرر)?)' THEN
      regexp_replace(
        title,
        '^(المجلة\s+[^،]+)،?\s+(?:الفصل|فصل)\s+(\d+(?:\s+مكرر)?)',
        '\1، الفصل \2'
      )
    ELSE NULL
  END,
  article_id = CASE
    WHEN title ~ '(?:الفصل|فصل)\s+(\d+)' THEN
      'fasl_' || regexp_replace(title, '.*(?:الفصل|فصل)\s+(\d+).*', '\1')
    ELSE NULL
  END
WHERE category IN ('codes', 'legislation', 'constitution')
  AND citation_ar IS NULL
  AND language = 'ar'
  AND is_active = true;

-- =============================================================================
-- 3. POPULATION CITATIONS JURISPRUDENCE (Français)
-- =============================================================================

UPDATE knowledge_base
SET
  citation = CASE
    WHEN title ~* '(Arrêt|Décision)\s+(?:de\s+la\s+)?(Cour\s+[^n]+)\s+n°?\s*(\d+)(?:\s+du\s+([0-9/]+))?' THEN
      regexp_replace(
        title,
        '(Arrêt|Décision)\s+(?:de\s+la\s+)?(Cour\s+[^n]+)\s+n°?\s*(\d+)(?:\s+du\s+([0-9/]+))?',
        '\1 \2 n°\3\4',
        'i'
      )
    ELSE NULL
  END
WHERE category = 'jurisprudence'
  AND citation IS NULL
  AND language = 'fr'
  AND is_active = true;

-- =============================================================================
-- 4. POPULATION CITATIONS JURISPRUDENCE (Arabe)
-- =============================================================================

UPDATE knowledge_base
SET
  citation_ar = CASE
    WHEN title ~ '(قرار|حكم)\s+([^\s]+)\s+عدد\s+(\d+)(?:\s+بتاريخ\s+([0-9/]+))?' THEN
      regexp_replace(
        title,
        '(قرار|حكم)\s+([^\s]+)\s+عدد\s+(\d+)(?:\s+بتاريخ\s+([0-9/]+))?',
        '\1 \2 عدد \3\4'
      )
    ELSE NULL
  END
WHERE category = 'jurisprudence'
  AND citation_ar IS NULL
  AND language = 'ar'
  AND is_active = true;

-- =============================================================================
-- 5. AFFICHER RÉSUMÉ
-- =============================================================================

DO $$
DECLARE
  v_total INTEGER;
  v_with_citation INTEGER;
  v_with_article_id INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM knowledge_base WHERE is_active = true;

  SELECT COUNT(*) INTO v_with_citation
  FROM knowledge_base
  WHERE is_active = true
    AND (citation IS NOT NULL OR citation_ar IS NOT NULL);

  SELECT COUNT(*) INTO v_with_article_id
  FROM knowledge_base
  WHERE is_active = true
    AND article_id IS NOT NULL;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Population des citations - Résumé';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total documents actifs: %', v_total;
  RAISE NOTICE 'Avec citations: % (% %%)', v_with_citation, ROUND(100.0 * v_with_citation / v_total, 1);
  RAISE NOTICE 'Avec article_id: % (% %%)', v_with_article_id, ROUND(100.0 * v_with_article_id / v_total, 1);
  RAISE NOTICE '=================================================================';
END $$;

-- Afficher quelques exemples
SELECT
  category,
  language,
  LEFT(title, 50) as title_preview,
  citation,
  citation_ar,
  article_id
FROM knowledge_base
WHERE (citation IS NOT NULL OR citation_ar IS NOT NULL)
  AND is_active = true
LIMIT 10;
