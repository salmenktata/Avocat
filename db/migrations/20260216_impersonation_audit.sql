-- Migration : Traçabilité des actions pendant impersonation
-- Date : 2026-02-16
-- Description : Ajoute colonnes pour tracer les actions effectuées pendant une session d'impersonnalisation

-- Ajouter colonnes à admin_audit_logs
ALTER TABLE admin_audit_logs
  ADD COLUMN IF NOT EXISTS is_impersonation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS impersonated_user_id UUID REFERENCES users(id);

-- Index pour requêtes rapides sur impersonations
CREATE INDEX IF NOT EXISTS idx_audit_logs_impersonation
  ON admin_audit_logs(is_impersonation)
  WHERE is_impersonation = true;

-- Index sur user impersoné pour retrouver toutes actions sur un utilisateur
CREATE INDEX IF NOT EXISTS idx_audit_logs_impersonated_user
  ON admin_audit_logs(impersonated_user_id)
  WHERE impersonated_user_id IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN admin_audit_logs.is_impersonation IS 'Indique si cette action a été effectuée pendant une impersonnalisation';
COMMENT ON COLUMN admin_audit_logs.impersonated_user_id IS 'ID de l''utilisateur impersoné si is_impersonation=true';
