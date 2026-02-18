-- Migration: Ajouter sources gouvernementales tunisiennes
-- legislation.tn, jort.gov.tn, sgg.gov.tn, fr.tunisie.gov.tn, bct.gov.tn, pm.gov.tn, presidence.tn
-- + Mettre à jour da5ira.com avec allowed_pdf_domains

-- 1. Ajouter colonne allowed_pdf_domains si pas encore faite
ALTER TABLE web_sources
  ADD COLUMN IF NOT EXISTS allowed_pdf_domains TEXT[] DEFAULT '{}';

-- 2. Mise à jour da5ira.com : autoriser PDFs de legislation.tn et da5ira.com
UPDATE web_sources
SET allowed_pdf_domains = ARRAY['legislation.tn', 'da5ira.com', 'www.da5ira.com']
WHERE base_url LIKE '%da5ira.com%';

-- 3. Législation Tunisienne (legislation.tn)
INSERT INTO web_sources (
  name, base_url, description, category, language,
  priority, requires_javascript, timeout_ms, rate_limit_ms,
  max_pages, max_depth, follow_links, download_files,
  use_sitemap, url_patterns, excluded_patterns, seed_urls,
  allowed_pdf_domains, auto_index_files, is_active
)
SELECT
  'Législation Tunisienne',
  'https://legislation.tn',
  'Portail officiel des codes et textes législatifs de la République Tunisienne (AR/FR). Codes pénal, civil, commercial, travail, famille, procédure civile et pénale, etc.',
  'legislation',
  'mixed',
  9,  -- Haute priorité : source officielle
  true,  -- Angular SPA
  120000,  -- 2min (site Angular lent)
  2000,
  5000,
  4,
  true,
  true,  -- Télécharger les PDFs
  false,  -- Pas de sitemap (Angular)
  ARRAY['/fr/legislation-', '/ar/legislation-', '/fr/code-', '/ar/code-',
        '/fr/loi-', '/ar/loi-', '/fr/decret-', '/ar/decret-',
        '/fr/arrete-', '/ar/arrete-'],
  ARRAY['/recherche', '/contact', '/apropos', '/about', '/jobs',
        '/login', '/register', '/api/', '/assets/'],
  ARRAY['https://legislation.tn/fr/codes', 'https://legislation.tn/ar/codes',
        'https://legislation.tn/fr/legislation', 'https://legislation.tn/ar/legislation'],
  ARRAY['legislation.tn'],
  true,  -- Auto-indexer les PDFs
  true
WHERE NOT EXISTS (SELECT 1 FROM web_sources WHERE base_url LIKE '%legislation.tn%');

-- 4. Journal Officiel de la République Tunisienne (JORT)
INSERT INTO web_sources (
  name, base_url, description, category, language,
  priority, requires_javascript, timeout_ms, rate_limit_ms,
  max_pages, max_depth, follow_links, download_files,
  use_sitemap, excluded_patterns, seed_urls,
  allowed_pdf_domains, auto_index_files, is_active
)
SELECT
  'JORT - Journal Officiel',
  'https://www.jort.gov.tn',
  'Journal Officiel de la République Tunisienne. Publication officielle des lois, décrets, arrêtés et avis gouvernementaux. Source primaire du droit tunisien.',
  'jort',
  'mixed',
  10,  -- Priorité maximale : source primaire
  false,
  60000,
  2000,
  10000,
  3,
  true,
  true,
  false,
  ARRAY['/contact', '/about', '/mentions', '/login', '/api/'],
  ARRAY['https://www.jort.gov.tn/fr', 'https://www.jort.gov.tn/ar'],
  ARRAY['jort.gov.tn', 'www.jort.gov.tn'],
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM web_sources WHERE base_url LIKE '%jort.gov.tn%');

-- 5. Secrétariat Général du Gouvernement (SGG)
INSERT INTO web_sources (
  name, base_url, description, category, language,
  priority, requires_javascript, timeout_ms, rate_limit_ms,
  max_pages, max_depth, follow_links, download_files,
  use_sitemap, excluded_patterns,
  allowed_pdf_domains, auto_index_files, is_active
)
SELECT
  'SGG - Secrétariat Général du Gouvernement',
  'https://www.sgg.gov.tn',
  'Secrétariat Général du Gouvernement tunisien. Publie circulaires, instructions et textes réglementaires officiels.',
  'legislation',
  'mixed',
  8,
  false,
  60000,
  2000,
  2000,
  3,
  true,
  true,
  false,
  ARRAY['/contact', '/about', '/login', '/api/'],
  ARRAY['sgg.gov.tn', 'www.sgg.gov.tn'],
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM web_sources WHERE base_url LIKE '%sgg.gov.tn%');

-- 6. Portail National Tunisien (fr.tunisie.gov.tn)
INSERT INTO web_sources (
  name, base_url, description, category, language,
  priority, requires_javascript, timeout_ms, rate_limit_ms,
  max_pages, max_depth, follow_links, download_files,
  use_sitemap, excluded_patterns,
  allowed_pdf_domains, auto_index_files, is_active
)
SELECT
  'Tunisie.gov.tn - Portail National',
  'http://fr.tunisie.gov.tn',
  'Portail officiel du gouvernement tunisien. Informations sur les procédures administratives, services publics et actualités gouvernementales.',
  'procedures',
  'mixed',
  7,
  false,
  60000,
  2000,
  3000,
  3,
  true,
  true,
  false,
  ARRAY['/contact', '/about', '/login', '/api/', '/actualite/'],
  ARRAY['tunisie.gov.tn', 'fr.tunisie.gov.tn'],
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM web_sources WHERE base_url LIKE '%tunisie.gov.tn%');

-- 7. Banque Centrale de Tunisie (BCT)
INSERT INTO web_sources (
  name, base_url, description, category, language,
  priority, requires_javascript, timeout_ms, rate_limit_ms,
  max_pages, max_depth, follow_links, download_files,
  use_sitemap, url_patterns, excluded_patterns,
  allowed_pdf_domains, auto_index_files, is_active
)
SELECT
  'BCT - Banque Centrale de Tunisie',
  'https://www.bct.gov.tn',
  'Banque Centrale de Tunisie. Circulaires aux banques, réglementation monétaire et financière, textes de change.',
  'legislation',
  'mixed',
  7,
  false,
  60000,
  2000,
  3000,
  3,
  true,
  true,
  false,
  ARRAY['/circulaires/', '/reglementation/', '/legislation/', '/textes-legislatifs/'],
  ARRAY['/contact', '/about', '/login', '/api/', '/presse/'],
  ARRAY['bct.gov.tn', 'www.bct.gov.tn'],
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM web_sources WHERE base_url LIKE '%bct.gov.tn%');

-- 8. Primature (pm.gov.tn)
INSERT INTO web_sources (
  name, base_url, description, category, language,
  priority, requires_javascript, timeout_ms, rate_limit_ms,
  max_pages, max_depth, follow_links, download_files,
  use_sitemap, excluded_patterns,
  allowed_pdf_domains, auto_index_files, is_active
)
SELECT
  'Primature - Gouvernement Tunisien',
  'https://www.pm.gov.tn',
  'Site de la Primature tunisienne. Décrets gouvernementaux, circulaires et textes officiels du Chef du Gouvernement.',
  'legislation',
  'mixed',
  8,
  false,
  60000,
  2000,
  2000,
  3,
  true,
  true,
  false,
  ARRAY['/contact', '/about', '/login', '/api/', '/actualite/'],
  ARRAY['pm.gov.tn', 'www.pm.gov.tn'],
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM web_sources WHERE base_url LIKE '%pm.gov.tn%');

-- 9. Présidence de la République
INSERT INTO web_sources (
  name, base_url, description, category, language,
  priority, requires_javascript, timeout_ms, rate_limit_ms,
  max_pages, max_depth, follow_links, download_files,
  use_sitemap, excluded_patterns,
  allowed_pdf_domains, auto_index_files, is_active
)
SELECT
  'Présidence de la République Tunisienne',
  'https://www.presidence.tn',
  'Site officiel de la Présidence de la République Tunisienne. Décrets présidentiels, discours et textes officiels.',
  'legislation',
  'mixed',
  8,
  false,
  60000,
  2000,
  2000,
  3,
  true,
  true,
  false,
  ARRAY['/contact', '/about', '/login', '/api/', '/galerie/', '/video/'],
  ARRAY['presidence.tn', 'www.presidence.tn'],
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM web_sources WHERE base_url LIKE '%presidence.tn%');

-- 10. Ministère de l'Intérieur
INSERT INTO web_sources (
  name, base_url, description, category, language,
  priority, requires_javascript, timeout_ms, rate_limit_ms,
  max_pages, max_depth, follow_links, download_files,
  use_sitemap, excluded_patterns,
  allowed_pdf_domains, auto_index_files, is_active
)
SELECT
  'Ministère de l''Intérieur Tunisien',
  'https://www.interieur.gov.tn',
  'Ministère de l''Intérieur tunisien. Textes réglementaires, procédures administratives (CNI, passeports, état civil).',
  'procedures',
  'mixed',
  6,
  false,
  60000,
  2000,
  2000,
  3,
  true,
  true,
  false,
  ARRAY['/contact', '/about', '/login', '/api/', '/galerie/'],
  ARRAY['interieur.gov.tn', 'www.interieur.gov.tn'],
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM web_sources WHERE base_url LIKE '%interieur.gov.tn%');
