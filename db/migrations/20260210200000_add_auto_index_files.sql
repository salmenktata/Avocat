-- Migration: Ajouter la colonne auto_index_files aux sources web
-- Permet de parser + indexer automatiquement les PDFs pendant le crawl

ALTER TABLE web_sources ADD COLUMN IF NOT EXISTS auto_index_files BOOLEAN DEFAULT false;
