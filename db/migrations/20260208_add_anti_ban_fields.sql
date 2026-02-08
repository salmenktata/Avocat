-- Migration: Ajout des champs anti-bannissement à web_sources
-- Date: 2026-02-08
-- Description: Ajoute les champs pour la protection anti-bannissement (stealth mode, quotas)

-- Ajouter les nouveaux champs à web_sources
ALTER TABLE web_sources
  ADD COLUMN IF NOT EXISTS stealth_mode BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_pages_per_hour INTEGER,
  ADD COLUMN IF NOT EXISTS max_pages_per_day INTEGER;

-- Commentaires sur les colonnes
COMMENT ON COLUMN web_sources.stealth_mode IS 'Mode stealth: utilise des User-Agents réalistes au lieu du bot déclaré';
COMMENT ON COLUMN web_sources.max_pages_per_hour IS 'Quota maximum de pages à crawler par heure (NULL = pas de limite)';
COMMENT ON COLUMN web_sources.max_pages_per_day IS 'Quota maximum de pages à crawler par jour (NULL = pas de limite)';

-- Créer une table pour tracker les bannissements
CREATE TABLE IF NOT EXISTS web_source_ban_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_source_id UUID NOT NULL REFERENCES web_sources(id) ON DELETE CASCADE,

  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  banned_at TIMESTAMPTZ,
  retry_after TIMESTAMPTZ,

  reason TEXT,
  detection_confidence TEXT CHECK (detection_confidence IN ('low', 'medium', 'high')),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un seul statut par source (dernière entrée)
  CONSTRAINT unique_source_ban_status UNIQUE (web_source_id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_web_source_ban_status_source_id ON web_source_ban_status(web_source_id);
CREATE INDEX IF NOT EXISTS idx_web_source_ban_status_is_banned ON web_source_ban_status(is_banned, retry_after);

-- Commentaires
COMMENT ON TABLE web_source_ban_status IS 'Statut de bannissement des sources web';
COMMENT ON COLUMN web_source_ban_status.is_banned IS 'Indique si la source est actuellement bannie';
COMMENT ON COLUMN web_source_ban_status.retry_after IS 'Date après laquelle on peut réessayer le crawl';
COMMENT ON COLUMN web_source_ban_status.detection_confidence IS 'Niveau de confiance de la détection du bannissement';

-- Créer une table pour les métriques de crawl (monitoring)
CREATE TABLE IF NOT EXISTS crawler_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_source_id UUID NOT NULL REFERENCES web_sources(id) ON DELETE CASCADE,

  -- Période de mesure
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Métriques de succès
  total_requests INTEGER NOT NULL DEFAULT 0,
  successful_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,2),

  -- Erreurs HTTP
  errors_429 INTEGER NOT NULL DEFAULT 0,
  errors_403 INTEGER NOT NULL DEFAULT 0,
  errors_503 INTEGER NOT NULL DEFAULT 0,
  errors_5xx INTEGER NOT NULL DEFAULT 0,

  -- Bannissement
  ban_detections INTEGER NOT NULL DEFAULT 0,

  -- Performance
  avg_response_time_ms INTEGER,
  median_response_time_ms INTEGER,
  p95_response_time_ms INTEGER,

  -- Quotas
  pages_this_hour INTEGER NOT NULL DEFAULT 0,
  pages_this_day INTEGER NOT NULL DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Index unique par source et période
  CONSTRAINT unique_metrics_period UNIQUE (web_source_id, period_start, period_end)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_crawler_health_metrics_source_id ON crawler_health_metrics(web_source_id);
CREATE INDEX IF NOT EXISTS idx_crawler_health_metrics_period ON crawler_health_metrics(period_start, period_end);

-- Commentaires
COMMENT ON TABLE crawler_health_metrics IS 'Métriques de santé du crawler par source et période';
COMMENT ON COLUMN crawler_health_metrics.success_rate IS 'Taux de succès en pourcentage (0-100)';

-- Fonction pour calculer le success_rate automatiquement
CREATE OR REPLACE FUNCTION update_crawler_success_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_requests > 0 THEN
    NEW.success_rate := (NEW.successful_requests::NUMERIC / NEW.total_requests::NUMERIC) * 100;
  ELSE
    NEW.success_rate := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-calculer le success_rate
DROP TRIGGER IF EXISTS trigger_update_crawler_success_rate ON crawler_health_metrics;
CREATE TRIGGER trigger_update_crawler_success_rate
  BEFORE INSERT OR UPDATE ON crawler_health_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_crawler_success_rate();

-- Fonction utilitaire pour marquer une source comme bannie
CREATE OR REPLACE FUNCTION mark_source_as_banned(
  p_source_id UUID,
  p_reason TEXT,
  p_confidence TEXT,
  p_retry_after_ms INTEGER DEFAULT 3600000
)
RETURNS void AS $$
BEGIN
  INSERT INTO web_source_ban_status (
    web_source_id,
    is_banned,
    banned_at,
    retry_after,
    reason,
    detection_confidence
  )
  VALUES (
    p_source_id,
    TRUE,
    NOW(),
    NOW() + (p_retry_after_ms || ' milliseconds')::INTERVAL,
    p_reason,
    p_confidence
  )
  ON CONFLICT (web_source_id)
  DO UPDATE SET
    is_banned = TRUE,
    banned_at = NOW(),
    retry_after = NOW() + (p_retry_after_ms || ' milliseconds')::INTERVAL,
    reason = p_reason,
    detection_confidence = p_confidence,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Fonction utilitaire pour débannir une source
CREATE OR REPLACE FUNCTION unban_source(p_source_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE web_source_ban_status
  SET
    is_banned = FALSE,
    updated_at = NOW()
  WHERE web_source_id = p_source_id;
END;
$$ LANGUAGE plpgsql;

-- Commentaires sur les fonctions
COMMENT ON FUNCTION mark_source_as_banned IS 'Marque une source web comme bannie avec raison et durée';
COMMENT ON FUNCTION unban_source IS 'Débannit une source web';
