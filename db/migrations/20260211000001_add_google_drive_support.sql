-- Extension de web_sources pour Google Drive
-- Auteur: Claude Code
-- Date: 2026-02-11

-- Ajouter colonne drive_config
ALTER TABLE web_sources
  ADD COLUMN IF NOT EXISTS drive_config JSONB DEFAULT NULL;

-- Index pour filtrer sources Google Drive
CREATE INDEX IF NOT EXISTS idx_web_sources_gdrive
  ON web_sources(category)
  WHERE category = 'google_drive' AND is_active = true;

-- Ajouter 'google_drive' comme catégorie valide
ALTER TABLE web_sources
  DROP CONSTRAINT IF EXISTS web_sources_category_check;

ALTER TABLE web_sources
  ADD CONSTRAINT web_sources_category_check
  CHECK (category IN (
    'legislation', 'jurisprudence', 'doctrine', 'jort',
    'codes', 'constitution', 'conventions',
    'modeles', 'procedures', 'formulaires', 'guides', 'lexique',
    'google_drive', 'autre'
  ));

-- Fonction helper pour extraire folderId depuis baseUrl
CREATE OR REPLACE FUNCTION extract_gdrive_folder_id(base_url TEXT)
RETURNS TEXT AS $$
BEGIN
  IF base_url LIKE 'gdrive://%' THEN
    RETURN SUBSTRING(base_url FROM 9); -- Remove 'gdrive://'
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Commentaires
COMMENT ON COLUMN web_sources.drive_config IS 'Configuration spécifique Google Drive: {folderId, recursive, fileTypes, serviceAccountEmail}';
COMMENT ON FUNCTION extract_gdrive_folder_id IS 'Extrait le folderId depuis une baseUrl format gdrive://...';
