-- ============================================================================
-- Script SQL: Ajouter IORT comme source web en PRODUCTION
-- ============================================================================
--
-- Exécution sur VPS:
--   psql -U moncabinet -d moncabinet -f add-iort-source-prod.sql
--
-- ============================================================================

BEGIN;

-- Vérifier si la source existe déjà
DO $$
DECLARE
  v_source_exists BOOLEAN;
  v_admin_id UUID;
  v_source_id UUID;
BEGIN
  -- Vérifier l'existence
  SELECT EXISTS (
    SELECT 1 FROM web_sources WHERE base_url = 'https://www.iort.tn'
  ) INTO v_source_exists;

  IF v_source_exists THEN
    RAISE NOTICE '⚠️  La source IORT existe déjà - Aucune action effectuée';
    RETURN;
  END IF;

  -- Récupérer un admin
  SELECT id INTO v_admin_id
  FROM users
  WHERE role IN ('admin', 'super_admin')
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '❌ Aucun utilisateur admin trouvé';
  END IF;

  RAISE NOTICE '✓ Admin trouvé: %', v_admin_id;

  -- Créer la source
  INSERT INTO web_sources (
    name,
    base_url,
    description,
    category,
    language,
    priority,
    crawl_frequency,
    max_depth,
    max_pages,
    requires_javascript,
    respect_robots_txt,
    ignore_ssl_errors,
    download_files,
    auto_index_files,
    rate_limit_ms,
    timeout_ms,
    url_patterns,
    excluded_patterns,
    css_selectors,
    seed_urls,
    custom_headers,
    dynamic_config,
    is_active,
    created_by,
    next_crawl_at
  ) VALUES (
    'IORT - Imprimerie Officielle de la République Tunisienne',
    'https://www.iort.tn',
    'Site officiel de l''Imprimerie Officielle (IORT) - Journal Officiel de la République Tunisienne (JORT)',
    'jort',
    'mixed',
    9,
    '7 days'::interval,
    5,
    5000,
    true,
    false,
    false,
    true,
    true,
    2000,
    30000,
    ARRAY['https://www.iort.tn/**', 'https://iort.tn/**'],
    ARRAY['**/logout**', '**/admin/**', '**/login**'],
    '{
      "content": ["main", "article", ".content", "body"],
      "title": ["h1", "h2", "title"],
      "exclude": ["script", "style", "nav", "header", "footer", ".navigation", ".menu"]
    }'::jsonb,
    ARRAY['https://www.iort.tn'],
    '{"Accept-Language": "fr-TN,fr;q=0.9,ar-TN;q=0.8,ar;q=0.7"}'::jsonb,
    '{
      "waitUntil": "networkidle",
      "postLoadDelayMs": 2000,
      "waitForLoadingToDisappear": true,
      "loadingIndicators": ["<!--loading-->", ".loading", "[data-loading]", ".spinner"],
      "dynamicTimeoutMs": 15000
    }'::jsonb,
    true,
    v_admin_id,
    NOW()
  )
  RETURNING id INTO v_source_id;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Source IORT créée avec succès!';
  RAISE NOTICE '   ID: %', v_source_id;
  RAISE NOTICE '   Nom: IORT - Imprimerie Officielle';
  RAISE NOTICE '   URL: https://www.iort.tn';
  RAISE NOTICE '   Catégorie: jort';
  RAISE NOTICE '   Priorité: 9';
  RAISE NOTICE '   JavaScript requis: Oui ✓';
  RAISE NOTICE '   Fréquence crawl: 7 days';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Prochaines étapes:';
  RAISE NOTICE '   1. Tester le crawl:';
  RAISE NOTICE '      curl -X POST https://moncabinet.tn/api/admin/web-sources/%/crawl \', v_source_id;
  RAISE NOTICE '        -H "Content-Type: application/json" \';
  RAISE NOTICE '        -d ''{"type":"single_page","targetUrl":"https://www.iort.tn"}''';
  RAISE NOTICE '';
  RAISE NOTICE '   2. Surveiller les pages:';
  RAISE NOTICE '      curl https://moncabinet.tn/api/admin/web-sources/%/pages | jq', v_source_id;
  RAISE NOTICE '';
  RAISE NOTICE '   3. Indexer dans KB:';
  RAISE NOTICE '      curl -X POST https://moncabinet.tn/api/admin/web-sources/%/index', v_source_id;

END $$;

COMMIT;

-- Vérification finale
SELECT
  id,
  name,
  base_url,
  category,
  priority,
  requires_javascript,
  is_active,
  created_at
FROM web_sources
WHERE base_url = 'https://www.iort.tn';
