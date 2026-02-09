-- ============================================================================
-- Script SQL: Mettre à jour la source IORT avec configuration optimisée
-- ============================================================================

BEGIN;

UPDATE web_sources
SET
  name = 'IORT - Imprimerie Officielle de la République Tunisienne',
  description = 'Site officiel de l''Imprimerie Officielle (IORT) - Journal Officiel de la République Tunisienne (JORT)',
  priority = 9,
  crawl_frequency = '7 days'::interval,
  max_depth = 5,
  max_pages = 5000,
  requires_javascript = true,
  respect_robots_txt = false,
  ignore_ssl_errors = false,
  download_files = true,
  auto_index_files = true,
  rate_limit_ms = 2000,
  timeout_ms = 30000,
  url_patterns = ARRAY['https://www.iort.tn/**', 'https://iort.tn/**'],
  excluded_patterns = ARRAY['**/logout**', '**/admin/**', '**/login**'],
  css_selectors = '{
    "content": ["main", "article", ".content", "body"],
    "title": ["h1", "h2", "title"],
    "exclude": ["script", "style", "nav", "header", "footer", ".navigation", ".menu"]
  }'::jsonb,
  seed_urls = ARRAY['https://www.iort.tn'],
  custom_headers = '{"Accept-Language": "fr-TN,fr;q=0.9,ar-TN;q=0.8,ar;q=0.7"}'::jsonb,
  dynamic_config = '{
    "waitUntil": "networkidle",
    "postLoadDelayMs": 2000,
    "waitForLoadingToDisappear": true,
    "loadingIndicators": ["<!--loading-->", ".loading", "[data-loading]", ".spinner"],
    "dynamicTimeoutMs": 15000
  }'::jsonb,
  updated_at = NOW()
WHERE base_url = 'https://www.iort.tn';

COMMIT;

-- Afficher la configuration mise à jour
SELECT
  id,
  name,
  base_url,
  category,
  priority,
  requires_javascript,
  crawl_frequency,
  max_pages,
  dynamic_config IS NOT NULL as has_dynamic_config,
  auto_index_files,
  updated_at
FROM web_sources
WHERE base_url = 'https://www.iort.tn';
