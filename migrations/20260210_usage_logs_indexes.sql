-- Migration: Index DB pour optimisation queries tracking opérations
-- Date: 2026-02-10
-- Description: Ajouter index pour améliorer performance queries sur ai_usage_logs
--              par operation_type et provider (pour dashboard provider-usage)

-- Index pour queries par operation_type et date (ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_operation_date
ON ai_usage_logs(operation_type, created_at DESC)
WHERE operation_type IS NOT NULL;

-- Index pour queries par provider et operation_type
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider_operation
ON ai_usage_logs(provider, operation_type, created_at DESC)
WHERE provider IS NOT NULL AND operation_type IS NOT NULL;

-- Index pour queries par date uniquement (stats globales)
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
ON ai_usage_logs(created_at DESC);

-- Commentaires pour documentation
COMMENT ON INDEX idx_ai_usage_logs_operation_date IS
  'Index pour queries filtrant par operation_type (classification, extraction, etc.) avec tri par date';

COMMENT ON INDEX idx_ai_usage_logs_provider_operation IS
  'Index pour queries filtrant par provider ET operation_type (dashboard matrice usage)';

COMMENT ON INDEX idx_ai_usage_logs_created_at IS
  'Index pour queries de stats globales par période sans filtres';
