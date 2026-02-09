-- Migration: Add composite index for provider usage dashboard
-- Date: 2026-02-11
-- Description: Optimise les requêtes de la matrice provider × operation

-- Index composite pour améliorer performance des GROUP BY (provider, operation_type)
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider_operation_date
  ON ai_usage_logs (provider, operation_type, created_at DESC)
  WHERE provider IS NOT NULL AND operation_type IS NOT NULL;

-- Vérifier la performance de la query matrice
EXPLAIN ANALYZE
SELECT
  provider,
  operation_type,
  COUNT(*) as request_count,
  SUM(input_tokens + output_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd
FROM ai_usage_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND provider IS NOT NULL
  AND operation_type IS NOT NULL
GROUP BY provider, operation_type
ORDER BY total_cost_usd DESC;

-- Vérifier la performance de la query trends
EXPLAIN ANALYZE
SELECT
  DATE(created_at) as date,
  provider,
  SUM(input_tokens + output_tokens) as tokens,
  SUM(cost_usd) as cost,
  COUNT(*) as requests
FROM ai_usage_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND provider IS NOT NULL
GROUP BY DATE(created_at), provider
ORDER BY date DESC, provider;

-- Afficher les statistiques de l'index
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'ai_usage_logs'
ORDER BY idx_scan DESC;
