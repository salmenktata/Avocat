-- ============================================================================
-- Migration: Stockage des clés API en base de données
-- ============================================================================

-- Table de configuration plateforme (clés API, secrets, etc.)
CREATE TABLE IF NOT EXISTS platform_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  is_secret BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_platform_config_key ON platform_config(key);
CREATE INDEX IF NOT EXISTS idx_platform_config_category ON platform_config(category);

-- Commentaire sur la table
COMMENT ON TABLE platform_config IS 'Configuration centralisée de la plateforme (clés API, secrets)';

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_platform_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_platform_config_updated ON platform_config;
CREATE TRIGGER trigger_platform_config_updated
  BEFORE UPDATE ON platform_config
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_config_timestamp();

-- ============================================================================
-- Insertion des clés par défaut
-- ============================================================================

-- Les valeurs réelles sont injectées via le script sync-to-prod.sh
-- Ce fichier ne contient que les placeholders pour la structure
INSERT INTO platform_config (key, value, description, category, is_secret) VALUES
  -- LLM
  ('GROQ_API_KEY', 'CHANGE_ME_GROQ_API_KEY', 'Clé API Groq pour LLM (prioritaire)', 'llm', true),
  ('GROQ_MODEL', 'llama-3.3-70b-versatile', 'Modèle Groq à utiliser', 'llm', false),

  -- OpenAI
  ('OPENAI_API_KEY', 'CHANGE_ME_OPENAI_API_KEY', 'Clé API OpenAI pour embeddings', 'llm', true),

  -- Email
  ('RESEND_API_KEY', 'CHANGE_ME_RESEND_API_KEY', 'Clé API Resend pour emails transactionnels', 'email', true),
  ('BREVO_API_KEY', 'CHANGE_ME_BREVO_API_KEY', 'Clé API Brevo pour notifications', 'email', true),
  ('BREVO_SENDER_EMAIL', 'notifications@moncabinet.tn', 'Email expéditeur Brevo', 'email', false),
  ('BREVO_SENDER_NAME', 'Qadhya', 'Nom expéditeur Brevo', 'email', false),

  -- Auth
  ('NEXTAUTH_SECRET', 'CHANGE_ME_NEXTAUTH_SECRET', 'Secret NextAuth pour sessions', 'auth', true),
  ('CRON_SECRET', 'CHANGE_ME_CRON_SECRET', 'Secret pour tâches CRON', 'auth', true)

ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

-- ============================================================================
-- Fonction helper pour récupérer une config
-- ============================================================================

CREATE OR REPLACE FUNCTION get_platform_config(config_key VARCHAR)
RETURNS TEXT AS $$
DECLARE
  config_value TEXT;
BEGIN
  SELECT value INTO config_value
  FROM platform_config
  WHERE key = config_key AND is_active = true;

  RETURN config_value;
END;
$$ LANGUAGE plpgsql;

-- Exemple d'utilisation: SELECT get_platform_config('GROQ_API_KEY');
