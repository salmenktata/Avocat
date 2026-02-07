-- Migration: Ajouter les préférences providers email et messagerie
-- Date: 2026-02-07

-- Configuration du provider email
INSERT INTO platform_config (key, value, description, category, is_secret) VALUES
  ('EMAIL_PROVIDER', 'auto', 'Provider email actif: brevo, resend, ou auto (failover)', 'email', false),
  ('EMAIL_FAILOVER_ORDER', '["brevo","resend"]', 'Ordre de priorité pour le failover automatique', 'email', false),
  ('WHATSAPP_ENABLED', 'true', 'WhatsApp Business activé globalement', 'messaging', false)
ON CONFLICT (key) DO NOTHING;

-- Note: Les clés API (BREVO_API_KEY, RESEND_API_KEY, WHATSAPP_TOKEN, etc.)
-- sont déjà gérées dans platform_config via les migrations précédentes
