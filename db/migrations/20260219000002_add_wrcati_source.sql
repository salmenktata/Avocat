-- Migration: Ajouter source WRCATI - منظومة حقوق المرأة التونسية (ورقتي)
-- Site CAWTAR : droits des femmes et enfants en Tunisie
-- ~294 textes juridiques + ~289 FAQ + publications + glossaire

INSERT INTO web_sources (
  name, base_url, description, category, language,
  priority, requires_javascript, timeout_ms, rate_limit_ms,
  max_pages, max_depth, follow_links, download_files,
  use_sitemap, respect_robots_txt,
  url_patterns, excluded_patterns, seed_urls,
  is_active
)
SELECT
  'WRCATI - حقوق المرأة التونسية',
  'https://wrcati.cawtar.org',
  'منظومة حقوق المرأة التونسية (ورقتي) - CAWTAR. +300 texte juridique (législation tunisienne et internationale), ~290 FAQ juridiques, publications et glossaire. Droits civils, statut personnel, violence basée sur le genre, protection de l''enfance.',
  'legislation',
  'ar',
  7,      -- Priorité moyenne-haute : source spécialisée fiable
  false,  -- Site PHP classique, pas de JS requis
  30000,  -- 30s timeout standard
  1500,   -- 1.5s entre requêtes (poli)
  1000,   -- ~600 pages estimées (294 lois + 289 FAQ + pages listing)
  3,      -- Profondeur 3 suffisante
  true,
  true,   -- Télécharger les PDFs liés
  false,  -- Pas de sitemap disponible
  false,  -- Pas de robots.txt
  ARRAY['index\.php\?a=d&law=', 'index\.php\?a=d&faq=',
        'index\.php\?a=i&limit=law', 'index\.php\?a=i&limit=faq',
        'index\.php\?a=a', 'index\.php\?a=g', 'index\.php\?topic='],
  ARRAY['index\.php\?a=s', 'index\.php\?a=static', 'InfoChallenge\.com'],
  ARRAY[
    'https://wrcati.cawtar.org/index.php?a=i&limit=law&topic=',
    'https://wrcati.cawtar.org/index.php?a=i&limit=faq&topic=',
    'https://wrcati.cawtar.org/index.php?a=a',
    'https://wrcati.cawtar.org/index.php?a=g'
  ],
  true
WHERE NOT EXISTS (SELECT 1 FROM web_sources WHERE base_url LIKE '%wrcati.cawtar.org%');
