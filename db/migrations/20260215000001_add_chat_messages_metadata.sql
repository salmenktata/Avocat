/**
 * Migration: Ajouter colonne metadata à chat_messages
 * Date: 2026-02-15
 * Description: Support pour actionType (chat, structure, consult) dans interface unifiée Qadhya IA
 */

-- Ajouter colonne metadata JSONB
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Index GIN pour recherche dans metadata
CREATE INDEX IF NOT EXISTS idx_chat_messages_metadata_action_type
ON chat_messages USING GIN ((metadata -> 'actionType'));

-- Commentaire
COMMENT ON COLUMN chat_messages.metadata IS 'Métadonnées du message (actionType, abrogationAlerts, etc.)';

-- Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Colonne metadata ajoutée à chat_messages';
  RAISE NOTICE '📊 Index GIN créé pour metadata->actionType';
END $$;
