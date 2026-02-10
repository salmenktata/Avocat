-- Migration : Peupler les métadonnées des pages crawlées de 9anoun.tn/kb/codes
-- Contexte : Les 155 pages de المجلات القانونية ont legal_domain=NULL et code_slug=NULL
-- Ce qui empêche le TreeView de les regrouper correctement par code juridique

BEGIN;

-- 1. Peupler legal_domain = 'codes' pour toutes les pages /kb/codes/
UPDATE web_pages
SET legal_domain = 'codes'
WHERE web_source_id = (SELECT id FROM web_sources WHERE name = 'المجلات القانونية')
  AND url ~ '/kb/codes/'
  AND legal_domain IS NULL;

-- 2. Peupler site_structure.code_slug depuis l'URL pour les pages /kb/codes/XXX
UPDATE web_pages
SET site_structure = COALESCE(site_structure, '{}'::jsonb) ||
  jsonb_build_object('code_slug', substring(url from '/kb/codes/([^/]+)'))
WHERE web_source_id = (SELECT id FROM web_sources WHERE name = 'المجلات القانونية')
  AND url ~ '/kb/codes/[^/]+'
  AND (site_structure->>'code_slug') IS NULL;

COMMIT;
