#!/bin/bash
# =============================================================================
# Script de diagnostic des erreurs LLM en production (qadhya.tn)
# =============================================================================
#
# Problème signalé :
#   - Groq : 401 Invalid API Key
#   - DeepSeek : 401 Authentication Fails
#   - Ollama : modèle qwen2.5:3b non disponible (?)
#
# Ce script diagnostique les clés API sur le serveur production
# =============================================================================

set -e

VPS_HOST="root@84.247.165.187"
CONTAINER="moncabinet-nextjs"

echo "==================================================================="
echo "🔍 Diagnostic LLM Production - $(date)"
echo "==================================================================="
echo ""

echo "📊 Étape 1/5 : Vérification clés API en base de données production"
echo "-------------------------------------------------------------------"
ssh $VPS_HOST "docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c \"
SELECT
  provider,
  label,
  is_active,
  last_used_at,
  last_error,
  error_count,
  LEFT(api_key_encrypted, 20) || '...' as key_preview
FROM api_keys
ORDER BY provider;
\""
echo ""

echo "📊 Étape 2/5 : Vérification variables d'environnement container"
echo "-------------------------------------------------------------------"
ssh $VPS_HOST "docker exec $CONTAINER sh -c 'echo \"OLLAMA_ENABLED=\$OLLAMA_ENABLED\"'"
ssh $VPS_HOST "docker exec $CONTAINER sh -c 'echo \"OLLAMA_BASE_URL=\$OLLAMA_BASE_URL\"'"
ssh $VPS_HOST "docker exec $CONTAINER sh -c 'echo \"OLLAMA_CHAT_MODEL=\$OLLAMA_CHAT_MODEL\"'"
ssh $VPS_HOST "docker exec $CONTAINER sh -c 'echo \"NODE_ENV=\$NODE_ENV\"'"
echo ""

echo "📊 Étape 3/5 : Test connectivité Ollama depuis container"
echo "-------------------------------------------------------------------"
ssh $VPS_HOST "docker exec $CONTAINER sh -c 'curl -s http://host.docker.internal:11434/api/tags 2>&1 | head -20'"
echo ""

echo "📊 Étape 4/5 : Vérification modèles Ollama disponibles sur VPS"
echo "-------------------------------------------------------------------"
ssh $VPS_HOST "ollama list"
echo ""

echo "📊 Étape 5/5 : Logs récents des erreurs LLM"
echo "-------------------------------------------------------------------"
ssh $VPS_HOST "docker logs $CONTAINER --tail 50 | grep -iE '(401|api.key|authentication|LLM-Fallback)' | tail -20"
echo ""

echo "==================================================================="
echo "✅ Diagnostic terminé"
echo "==================================================================="
echo ""
echo "📝 Actions recommandées :"
echo ""
echo "   1. Si clés API manquantes en production :"
echo "      → Importer clés : npm run db:import-api-keys (sur VPS)"
echo ""
echo "   2. Si modèle Ollama manquant :"
echo "      → Pull modèle : ssh $VPS_HOST 'ollama pull qwen2.5:3b'"
echo ""
echo "   3. Si erreurs 401 persistent malgré clés valides :"
echo "      → Régénérer clés API sur les dashboards providers"
echo "      → Mettre à jour en base via scripts/import-api-keys-to-db.ts"
echo ""
