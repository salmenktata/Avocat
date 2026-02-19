-- Migration: Ajouter les 14 crons manquants au dashboard monitoring
-- Date: 2026-02-20
-- Description: Enregistre tous les crons VPS dans cron_schedules pour visibilité dashboard

-- =====================================================
-- 1. Ajouter colonne is_active si manquante
-- =====================================================
ALTER TABLE cron_schedules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- 2. Insérer les 14 crons manquants
-- =====================================================
INSERT INTO cron_schedules (cron_name, display_name, description, cron_expression, timeout_ms, alert_on_failure, is_active)
VALUES
  (
    'analyze-kb-weekend',
    'Analyse KB Weekend',
    'Analyse qualité batch des docs KB via Ollama (sans coût OpenAI), weekends uniquement',
    '0 8,10,12,14,16,18,20,22 * * 6,0',
    600000,
    true,
    true
  ),
  (
    'reindex-kb-openai',
    'Réindex KB OpenAI',
    'Réindexe 50 chunks/jour prioritisés par fréquence de citation et qualité',
    '0 5 * * *',
    120000,
    true,
    true
  ),
  (
    'cleanup-executions',
    'Nettoyage Exécutions',
    'Supprime les anciennes exécutions cron (>7 jours) pour limiter la taille de la table',
    '0 4 * * *',
    10000,
    false,
    true
  ),
  (
    'cleanup-orphaned-jobs',
    'Nettoyage Jobs Orphelins',
    'Marque en échec les jobs d''indexation/crawl bloqués depuis >10-20 min',
    '*/15 * * * *',
    15000,
    false,
    true
  ),
  (
    'check-freshness',
    'Vérif Fraîcheur Docs',
    'Détecte les documents juridiques obsolètes nécessitant un re-crawl',
    '0 6 * * *',
    15000,
    true,
    true
  ),
  (
    'check-impersonations',
    'Vérif Impersonations',
    'Détecte les sessions d''impersonation admin actives depuis >1h (sécurité)',
    '0 * * * *',
    35000,
    true,
    true
  ),
  (
    'check-rag-config',
    'Vérif Config RAG',
    'Valide la configuration RAG (embeddings, KB, providers) via /api/health',
    '0 8 * * *',
    30000,
    true,
    true
  ),
  (
    'ollama-keepalive',
    'Keep-Alive Ollama',
    'Ping keep-alive aux modèles Ollama pour éviter les cold-starts de 30-60s',
    '*/15 * * * *',
    25000,
    false,
    true
  ),
  (
    'pipeline-auto-advance',
    'Pipeline Auto-Advance',
    'Avance les docs KB à travers les étapes du pipeline (crawl→index→quality)',
    '0 */2 * * *',
    700000,
    false,
    true
  ),
  (
    'send-notifications',
    'Envoi Notifications',
    'Dispatch les notifications utilisateurs quotidiennes (6h-10h)',
    '0 6-10 * * *',
    130000,
    true,
    true
  ),
  (
    'cleanup-corrupted-kb',
    'Nettoyage KB Corrompue',
    'Identifie et réinitialise les docs KB avec >50% de chunks corrompus',
    '0 2 * * *',
    300000,
    true,
    true
  ),
  (
    'detect-config-drift',
    'Détection Drift Config',
    'Compare le hash de config actuel vs attendu, alerte si drift détecté',
    '*/5 * * * *',
    10000,
    true,
    true
  ),
  (
    'watchdog-vps',
    'Watchdog VPS',
    'Surveille santé Docker/RAM/CPU et redémarre le container si seuils dépassés',
    '*/5 * * * *',
    15000,
    true,
    true
  ),
  (
    'scheduler-worker',
    'Worker Planification',
    'Vérifie et déclenche les crons planifiés dont l''heure est passée',
    '* * * * *',
    30000,
    false,
    true
  )
ON CONFLICT (cron_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  cron_expression = EXCLUDED.cron_expression,
  timeout_ms = EXCLUDED.timeout_ms,
  alert_on_failure = EXCLUDED.alert_on_failure,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- =====================================================
-- 3. Mettre à jour les descriptions des 8 crons existants
-- =====================================================
UPDATE cron_schedules SET
  display_name = 'Monitor Budget OpenAI',
  description = 'Vérifie le budget OpenAI ($10/mois) et envoie alertes si seuil $5 dépassé',
  is_active = true,
  updated_at = NOW()
WHERE cron_name = 'monitor-openai';

UPDATE cron_schedules SET
  display_name = 'Alertes Système',
  description = 'Vérifie tous les systèmes d''alerte (KB quality, batches, budgets, stuck jobs)',
  is_active = true,
  updated_at = NOW()
WHERE cron_name = 'check-alerts';

UPDATE cron_schedules SET
  display_name = 'Rafraîchissement Vues Matérialisées',
  description = 'Rafraîchit les vues matérialisées (stats metadata, compteurs) pour le dashboard',
  is_active = true,
  updated_at = NOW()
WHERE cron_name = 'refresh-mv-metadata';

UPDATE cron_schedules SET
  display_name = 'Réanalyse Échecs KB',
  description = 'Réanalyse les documents KB avec score qualité faible (score=50) via Ollama',
  is_active = true,
  updated_at = NOW()
WHERE cron_name = 'reanalyze-kb-failures';

UPDATE cron_schedules SET
  display_name = 'Indexation KB Progressive',
  description = 'Indexation progressive des nouveaux docs KB (batch 5 docs, triple embedding OpenAI+Ollama+Gemini)',
  cron_expression = '0 1-5 * * *',
  is_active = true,
  updated_at = NOW()
WHERE cron_name = 'index-kb';

UPDATE cron_schedules SET
  display_name = 'Rapport Acquisition Hebdo',
  description = 'Génère et envoie le rapport hebdomadaire d''acquisition clients (chaque lundi 8h)',
  is_active = true,
  updated_at = NOW()
WHERE cron_name = 'acquisition-weekly';

UPDATE cron_schedules SET
  display_name = 'Drift Detection RAG',
  description = 'Détection hebdomadaire de drift RAG : similarité, abstention, hallucination, satisfaction utilisateur',
  is_active = true,
  updated_at = NOW()
WHERE cron_name = 'drift-detection';

UPDATE cron_schedules SET
  display_name = 'Évaluation RAG Hebdomadaire',
  description = 'Benchmark 20 questions gold dataset, détection régression automatique avec alerte email (dimanche 3h)',
  is_active = true,
  updated_at = NOW()
WHERE cron_name = 'eval-rag-weekly';
