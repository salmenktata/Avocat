-- Migration: Ajouter seed_urls et form_crawl_config à web_sources
-- Permet au crawler de partir d'URLs d'entrée supplémentaires (seed URLs)
-- et de soumettre des formulaires POST (ex: TYPO3 cassation.tn)

ALTER TABLE web_sources ADD COLUMN IF NOT EXISTS seed_urls TEXT[] DEFAULT '{}';
ALTER TABLE web_sources ADD COLUMN IF NOT EXISTS form_crawl_config JSONB DEFAULT NULL;
