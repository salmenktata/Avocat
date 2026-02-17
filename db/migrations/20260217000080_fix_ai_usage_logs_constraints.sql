/**
 * Migration: Étendre les contraintes ai_usage_logs pour tous les providers
 * Date: 2026-02-17
 * Description: La contrainte initiale n'acceptait que 'openai' et 'anthropic'.
 *              L'app utilise 6 providers (gemini, groq, deepseek, ollama, openai, anthropic).
 */

-- Supprimer la contrainte provider restrictive (openai, anthropic only)
ALTER TABLE ai_usage_logs DROP CONSTRAINT IF EXISTS ai_usage_logs_provider_check;

-- Supprimer la contrainte operation_type restrictive
ALTER TABLE ai_usage_logs DROP CONSTRAINT IF EXISTS ai_usage_logs_operation_type_check;

-- Recréer contrainte provider avec tous les providers utilisés
ALTER TABLE ai_usage_logs ADD CONSTRAINT ai_usage_logs_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'gemini', 'groq', 'deepseek', 'ollama'));

-- Recréer contrainte operation_type avec toutes les valeurs possibles
ALTER TABLE ai_usage_logs ADD CONSTRAINT ai_usage_logs_operation_type_check
  CHECK (operation_type IN (
    'embedding', 'chat', 'generation', 'classification', 'extraction',
    'indexation', 'reranking', 'assistant', 'consultation'
  ));

-- Note: estimated_cost_usd existe déjà depuis la migration initiale

DO $$ BEGIN
  RAISE NOTICE '✅ Contraintes ai_usage_logs étendues pour tous les providers';
  RAISE NOTICE '📊 Providers acceptés: openai, anthropic, gemini, groq, deepseek, ollama';
  RAISE NOTICE '🔧 operation_type étendu: +indexation, +reranking, +assistant, +consultation';
END $$;
