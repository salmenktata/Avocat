-- ============================================================================
-- Script SQL: Corriger les URL patterns IORT en production
-- ============================================================================
--
-- Problème: Les patterns glob ** ne sont pas valides en regex JavaScript
-- Solution: Remplacer par des patterns regex valides
--
-- Exécution:
--   docker cp fix-iort-url-patterns-prod.sql moncabinet-postgres:/tmp/
--   docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -f /tmp/fix-iort-url-patterns-prod.sql
--
-- ============================================================================

BEGIN;

-- Mettre à jour les URL patterns et excluded patterns
UPDATE web_sources
SET
  url_patterns = ARRAY[
    'https://www\.iort\.tn/.*',
    'https://iort\.tn/.*'
  ],
  excluded_patterns = ARRAY[
    '.*/logout.*',
    '.*/admin/.*',
    '.*/login.*'
  ]
WHERE base_url = 'https://www.iort.tn';

-- Vérification
SELECT
  id,
  name,
  url_patterns,
  excluded_patterns
FROM web_sources
WHERE base_url = 'https://www.iort.tn';

COMMIT;

-- Afficher un message de confirmation
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ URL patterns IORT corrigés avec succès!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Nouveaux patterns:';
  RAISE NOTICE '   URL patterns:';
  RAISE NOTICE '     - https://www\.iort\.tn/.*';
  RAISE NOTICE '     - https://iort\.tn/.*';
  RAISE NOTICE '';
  RAISE NOTICE '   Excluded patterns:';
  RAISE NOTICE '     - .*/logout.*';
  RAISE NOTICE '     - .*/admin/.*';
  RAISE NOTICE '     - .*/login.*';
  RAISE NOTICE '';
END $$;
