-- ============================================================================
-- Script SQL: Activer crawl JavaScript avancé pour IORT
-- ============================================================================
--
-- Objectif: Découvrir les pages dynamiques générées par WebDev
--
-- Exécution:
--   docker cp enable-iort-advanced-crawl-prod.sql moncabinet-postgres:/tmp/
--   docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -f /tmp/enable-iort-advanced-crawl-prod.sql
--
-- ============================================================================

BEGIN;

-- Mettre à jour la configuration dynamique pour interaction JavaScript
UPDATE web_sources
SET
  -- Augmenter la profondeur pour découvrir plus de pages
  max_depth = 8,

  -- Augmenter le timeout pour les pages lentes
  timeout_ms = 45000,

  -- Merger la nouvelle configuration avec l'existante
  dynamic_config = dynamic_config || '{
    "postLoadDelayMs": 4000,
    "dynamicTimeoutMs": 20000,
    "clickSelectors": [
      "a.menu-item",
      "a[href*=\"PAGE_\"]",
      "a[href*=\"siteiort\"]",
      ".navigation a",
      "[class*=\"menu\"] a",
      "[id*=\"menu\"] a",
      "a[onclick]"
    ],
    "maxClicksPerPage": 10,
    "clickDelayMs": 1000,
    "scrollBeforeClick": true,
    "waitAfterClick": 2000
  }'::jsonb

WHERE base_url = 'https://www.iort.tn';

-- Forcer le prochain crawl immédiatement
UPDATE web_sources
SET next_crawl_at = NOW() - interval '1 minute'
WHERE base_url = 'https://www.iort.tn';

COMMIT;

-- Vérification
SELECT
  id,
  name,
  max_depth,
  timeout_ms,
  dynamic_config->>'postLoadDelayMs' as post_load_delay,
  dynamic_config->>'clickSelectors' as click_selectors,
  next_crawl_at
FROM web_sources
WHERE base_url = 'https://www.iort.tn';

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Configuration JavaScript avancée activée pour IORT!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Nouveaux paramètres:';
  RAISE NOTICE '   - Profondeur maximale: 8 niveaux';
  RAISE NOTICE '   - Timeout: 45 secondes';
  RAISE NOTICE '   - Délai post-chargement: 4 secondes';
  RAISE NOTICE '   - Clics automatiques: 10 max par page';
  RAISE NOTICE '   - Délai entre clics: 1 seconde';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Sélecteurs de menus ciblés:';
  RAISE NOTICE '   - Liens avec "PAGE_" dans l''URL';
  RAISE NOTICE '   - Liens avec "siteiort" dans l''URL';
  RAISE NOTICE '   - Éléments de navigation et menus';
  RAISE NOTICE '   - Liens avec événements onclick';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Le prochain crawl prendra plus de temps (~5-10 min)';
  RAISE NOTICE '   car il va interagir avec les menus JavaScript.';
  RAISE NOTICE '';
END $$;
