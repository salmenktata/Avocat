-- Sprint 4: Ajouter le cron drift-detection hebdomadaire
-- Détecte automatiquement la dégradation silencieuse du RAG

INSERT INTO cron_schedules (cron_name, schedule, endpoint, description, is_active)
VALUES (
  'drift-detection',
  '0 9 * * 1',
  '/api/admin/monitoring/drift',
  'Détection hebdomadaire de drift RAG (similarité, abstention, hallucination, satisfaction)',
  true
)
ON CONFLICT (cron_name) DO NOTHING;
