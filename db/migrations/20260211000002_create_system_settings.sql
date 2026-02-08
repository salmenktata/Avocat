-- Création table system_settings pour tokens système
-- Auteur: Claude Code
-- Date: 2026-02-11

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Commentaire
COMMENT ON TABLE system_settings IS 'Configuration système et tokens partagés (Google Drive, etc.)';
COMMENT ON COLUMN system_settings.key IS 'Clé unique de configuration';
COMMENT ON COLUMN system_settings.value IS 'Valeur (JSON pour objets complexes)';
COMMENT ON COLUMN system_settings.encrypted IS 'Indique si la valeur est chiffrée';
