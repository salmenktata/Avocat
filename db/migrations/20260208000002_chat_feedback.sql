/**
 * Migration: Système de feedback pour les messages chat
 * Date: 2026-02-08
 * Description: Permet aux utilisateurs autorisés de donner du feedback sur les réponses IA
 */

-- ============================================================================
-- PERMISSION FEEDBACK SUR USERS
-- ============================================================================

-- Ajouter la colonne can_provide_feedback si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'can_provide_feedback'
  ) THEN
    ALTER TABLE users ADD COLUMN can_provide_feedback BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- TABLE CHAT_MESSAGE_FEEDBACK
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  reasons TEXT[] DEFAULT '{}',
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Index pour récupérer le feedback d'un message
CREATE INDEX IF NOT EXISTS idx_chat_feedback_message
  ON chat_message_feedback(message_id);

-- Index pour les stats par utilisateur
CREATE INDEX IF NOT EXISTS idx_chat_feedback_user
  ON chat_message_feedback(user_id);

-- Index pour les stats par rating
CREATE INDEX IF NOT EXISTS idx_chat_feedback_rating
  ON chat_message_feedback(rating);

-- Trigger updated_at
CREATE TRIGGER update_chat_feedback_updated_at
  BEFORE UPDATE ON chat_message_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FONCTIONS
-- ============================================================================

/**
 * Vérifie si un utilisateur peut donner du feedback
 * Retourne true si super admin OU can_provide_feedback = true
 */
CREATE OR REPLACE FUNCTION can_user_provide_feedback(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
      AND (is_super_admin = true OR can_provide_feedback = true)
  );
END;
$$ LANGUAGE plpgsql;

/**
 * Ajoute ou met à jour un feedback
 */
CREATE OR REPLACE FUNCTION upsert_message_feedback(
  p_message_id UUID,
  p_user_id UUID,
  p_rating TEXT,
  p_reasons TEXT[] DEFAULT '{}',
  p_comment TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_feedback_id UUID;
  v_can_feedback BOOLEAN;
BEGIN
  -- Vérifier permission
  SELECT can_user_provide_feedback(p_user_id) INTO v_can_feedback;
  IF NOT v_can_feedback THEN
    RAISE EXCEPTION 'Utilisateur non autorisé à donner du feedback';
  END IF;

  -- Upsert feedback
  INSERT INTO chat_message_feedback (message_id, user_id, rating, reasons, comment)
  VALUES (p_message_id, p_user_id, p_rating, p_reasons, p_comment)
  ON CONFLICT (message_id, user_id)
  DO UPDATE SET
    rating = EXCLUDED.rating,
    reasons = EXCLUDED.reasons,
    comment = EXCLUDED.comment,
    updated_at = NOW()
  RETURNING id INTO v_feedback_id;

  RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Récupère le feedback d'un message par un utilisateur
 */
CREATE OR REPLACE FUNCTION get_message_feedback(
  p_message_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  rating TEXT,
  reasons TEXT[],
  comment TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.rating, f.reasons, f.comment, f.created_at
  FROM chat_message_feedback f
  WHERE f.message_id = p_message_id AND f.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Statistiques globales du feedback
 */
CREATE OR REPLACE FUNCTION get_feedback_stats()
RETURNS TABLE (
  total_feedback BIGINT,
  positive_count BIGINT,
  negative_count BIGINT,
  positive_percentage NUMERIC,
  top_negative_reasons JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE rating = 'positive') as positive,
      COUNT(*) FILTER (WHERE rating = 'negative') as negative
    FROM chat_message_feedback
  ),
  reason_counts AS (
    SELECT reason, COUNT(*) as cnt
    FROM chat_message_feedback, unnest(reasons) as reason
    WHERE rating = 'negative'
    GROUP BY reason
    ORDER BY cnt DESC
    LIMIT 5
  )
  SELECT
    s.total as total_feedback,
    s.positive as positive_count,
    s.negative as negative_count,
    CASE WHEN s.total > 0 THEN ROUND((s.positive::NUMERIC / s.total) * 100, 1) ELSE 0 END as positive_percentage,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('reason', reason, 'count', cnt)) FROM reason_counts),
      '[]'::jsonb
    ) as top_negative_reasons
  FROM stats s;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Table chat_message_feedback créée avec succès!';
  RAISE NOTICE '👍 Fonctions: can_user_provide_feedback, upsert_message_feedback, get_feedback_stats';
END $$;
