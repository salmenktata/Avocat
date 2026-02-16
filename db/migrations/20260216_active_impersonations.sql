-- Migration : Table de suivi des impersonnalisations actives
-- Date : 2026-02-16
-- Description : Permet de tracker en temps réel les sessions d'impersonnalisation

CREATE TABLE IF NOT EXISTS active_impersonations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour requêtes rapides sur sessions actives
CREATE INDEX IF NOT EXISTS idx_active_impersonations_active
  ON active_impersonations(is_active, started_at DESC)
  WHERE is_active = true;

-- Index sur admin pour voir ses sessions
CREATE INDEX IF NOT EXISTS idx_active_impersonations_admin
  ON active_impersonations(admin_id, is_active);

-- Index sur utilisateur cible
CREATE INDEX IF NOT EXISTS idx_active_impersonations_target
  ON active_impersonations(target_user_id, is_active);

-- Commentaires
COMMENT ON TABLE active_impersonations IS 'Suivi temps réel des sessions d''impersonnalisation actives';
COMMENT ON COLUMN active_impersonations.expires_at IS 'Date d''expiration automatique (started_at + 2h)';
COMMENT ON COLUMN active_impersonations.is_active IS 'false si session arrêtée manuellement ou expirée';
