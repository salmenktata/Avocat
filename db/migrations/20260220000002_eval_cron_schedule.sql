-- Ajouter le cron eval-rag-weekly dans cron_schedules
-- Exécution hebdomadaire dimanche 3h CET (hors heures de pointe)

INSERT INTO cron_schedules (cron_name, display_name, description, cron_expression, is_enabled, is_active)
VALUES (
  'eval-rag-weekly',
  'Évaluation RAG Hebdomadaire',
  'Benchmark 20 questions aléatoires du gold dataset, détection de régression automatique avec alerte email',
  '0 3 * * 0',
  true,
  true
)
ON CONFLICT (cron_name) DO NOTHING;
