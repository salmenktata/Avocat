-- Migration: Re-hash des URLs IORT vers le format stable year/textType/issueNumber
-- Ancien format: http://www.iort.gov.tn/jort/YEAR/ISSUE/TYPE/TITLE-SLUG
-- Nouveau format: http://www.iort.gov.tn/jort/YEAR/TYPE/ISSUE (ou YEAR/TYPE/HASH si pas d'issueNumber)
--
-- IMPORTANT: Ce fichier SQL installe pgcrypto pour permettre le hash SHA256 en SQL.
-- Alternativement, exécuter le script TS: npx tsx scripts/migrate-iort-urls.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migrer les pages IORT avec issueNumber
UPDATE web_pages
SET
  url = 'http://www.iort.gov.tn/jort/' || (structured_data->>'year') || '/' ||
        replace(structured_data->>'textType', ' ', '-') || '/' ||
        (structured_data->>'issueNumber'),
  url_hash = encode(digest(
    'http://www.iort.gov.tn/jort/' || (structured_data->>'year') || '/' ||
    replace(structured_data->>'textType', ' ', '-') || '/' ||
    (structured_data->>'issueNumber'),
    'sha256'), 'hex'),
  canonical_url = 'http://www.iort.gov.tn/jort/' || (structured_data->>'year') || '/' ||
                  replace(structured_data->>'textType', ' ', '-') || '/' ||
                  (structured_data->>'issueNumber'),
  updated_at = NOW()
WHERE structured_data->>'source' = 'iort'
AND structured_data->>'issueNumber' IS NOT NULL
AND structured_data->>'issueNumber' != '';

-- Pour les pages sans issueNumber, utiliser un hash du titre comme fallback
-- Ces pages garderont leur URL actuelle sauf si on les re-crawle
-- (le nouveau code TypeScript générera la bonne URL au prochain crawl)
