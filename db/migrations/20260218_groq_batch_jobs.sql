-- Migration: Table de tracking des jobs Groq Batch API
-- Utilisé pour kb-quality-analysis en mode asynchrone (24h window, -50% coût)

CREATE TABLE IF NOT EXISTS groq_batch_jobs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  groq_batch_id       TEXT        NOT NULL UNIQUE,
  groq_file_id        TEXT        NOT NULL,
  result_file_id      TEXT,
  error_file_id       TEXT,
  operation           TEXT        NOT NULL DEFAULT 'kb-quality-analysis',
  document_ids        JSONB       NOT NULL DEFAULT '[]',
  status              TEXT        NOT NULL DEFAULT 'submitted'
                                  CHECK (status IN ('submitted', 'validating', 'in_progress', 'finalizing', 'completed', 'failed', 'expired', 'cancelled')),
  total_requests      INT         NOT NULL DEFAULT 0,
  completed_requests  INT         NOT NULL DEFAULT 0,
  failed_requests     INT         NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  error               TEXT
);

CREATE INDEX IF NOT EXISTS idx_groq_batch_jobs_status
  ON groq_batch_jobs (status)
  WHERE status IN ('submitted', 'validating', 'in_progress', 'finalizing');

CREATE INDEX IF NOT EXISTS idx_groq_batch_jobs_created
  ON groq_batch_jobs (created_at DESC);

COMMENT ON TABLE groq_batch_jobs IS
  'Jobs Groq Batch API — traitement asynchrone 24h, -50% coût vs API sync';
