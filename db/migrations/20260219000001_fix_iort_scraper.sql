-- Migration : Correction Scraper IORT + Ajout Jurisite
-- Date : 19 Février 2026

BEGIN;

-- 1. Mise à jour de la configuration IORT pour le framework WebDev
-- Correction baseUrl (http://www.iort.gov.tn), catégorie jort, rate limit 5s
UPDATE web_sources
SET
  base_url = 'http://www.iort.gov.tn',
  category = 'jort',
  respect_robots_txt = false,
  user_agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  timeout_ms = 60000,
  rate_limit_ms = 5000,
  is_active = true,
  form_crawl_config = '{"type": "webdev-iort"}'::jsonb,
  dynamic_config = '{
    "waitUntil": "load",
    "postLoadDelayMs": 3000,
    "dynamicTimeoutMs": 60000
  }'::jsonb
WHERE base_url ILIKE '%iort%';

-- 2. Ajout de Jurisite Tunisie comme source (HTML statique propre)
INSERT INTO web_sources (
  name,
  base_url,
  category,
  is_active,
  respect_robots_txt,
  crawl_frequency,
  max_depth,
  max_pages
) VALUES (
  'Jurisite Tunisie',
  'http://www.jurisitetunisie.com/',
  'doctrine',
  true,
  true,
  '7 days',
  5,
  2000
)
ON CONFLICT (base_url) DO UPDATE SET is_active = true;

COMMIT;
