-- Migration: Ajouter colonne allowed_pdf_domains à web_sources
-- Permet de définir une whitelist de domaines depuis lesquels télécharger les PDFs
-- Ex: da5ira.com peut autoriser legislation.tn pour récupérer les PDFs liés

ALTER TABLE web_sources
  ADD COLUMN IF NOT EXISTS allowed_pdf_domains TEXT[] DEFAULT '{}';

COMMENT ON COLUMN web_sources.allowed_pdf_domains IS
  'Whitelist de domaines autorisés pour le téléchargement des PDFs liés. '
  'Vide = pas de restriction (télécharge tous les PDFs détectés). '
  'Ex: {''legislation.tn'', ''jort.gov.tn''} = télécharge uniquement les PDFs de ces domaines.';
