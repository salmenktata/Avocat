-- Migration : Système de tracking des tentatives de retry du pipeline
-- Date : 2026-02-17
-- Phase : Infrastructure Base

-- Table de tracking des tentatives de replay/retry par étape
CREATE TABLE IF NOT EXISTS pipeline_retry_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Résultat de la tentative
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
  error_message TEXT,
  duration_ms INTEGER,

  -- Métadonnées et contexte
  retry_reason TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance des requêtes fréquentes
CREATE INDEX idx_retry_attempts_kb_stage
  ON pipeline_retry_attempts(knowledge_base_id, stage);

CREATE INDEX idx_retry_attempts_status
  ON pipeline_retry_attempts(status, created_at DESC);

CREATE INDEX idx_retry_attempts_triggered
  ON pipeline_retry_attempts(triggered_at DESC);

CREATE INDEX idx_retry_attempts_kb_id
  ON pipeline_retry_attempts(knowledge_base_id);

-- Trigger pour updated_at automatique
CREATE TRIGGER set_updated_at_pipeline_retry_attempts
  BEFORE UPDATE ON pipeline_retry_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Commentaires pour documentation
COMMENT ON TABLE pipeline_retry_attempts IS 'Historique des tentatives de replay/retry pour chaque étape du pipeline de documents';
COMMENT ON COLUMN pipeline_retry_attempts.attempt_number IS 'Numéro séquentiel de la tentative pour ce document et cette étape';
COMMENT ON COLUMN pipeline_retry_attempts.retry_reason IS 'Raison du retry (manual, auto, batch, etc.)';
COMMENT ON COLUMN pipeline_retry_attempts.metadata IS 'Métadonnées additionnelles (batch_id, config, etc.)';
