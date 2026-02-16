#!/bin/bash

###############################################################################
# Cron - Ollama Keep-Alive (maintenir modèles en mémoire)
# Prévient cold start (30-60s → <5s)
#
# Phase 4.7 - Optimisations - Ollama Keep-Alive
# Fréquence: Toutes les 15 minutes
# Durée: ~2-5s par modèle
###############################################################################

set -e

# Charger library de logging cron
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/cron-logger.sh"

# Démarrer l'exécution
cron_start "ollama-keepalive" "scheduled"

# Vérifier si Ollama est activé
if [ "${OLLAMA_ENABLED}" != "true" ]; then
  cron_complete "{\"skipped\": true, \"reason\": \"OLLAMA_ENABLED=false\"}"
  exit 0
fi

# API Ollama
OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"

# Modèles à maintenir chauds
MODELS=("qwen2.5:3b" "qwen3-embedding:0.6b")

echo "🔥 Ollama Keep-Alive - Maintaining warm models..."
echo "📡 API: $OLLAMA_URL"

KEPT_ALIVE=0
FAILED=0

# Envoyer keep-alive pour chaque modèle
for MODEL in "${MODELS[@]}"; do
  echo "⏱️ Keep-alive: $MODEL"

  # Requête keep-alive (0 tokens générés, juste maintenir en mémoire)
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    --max-time 10 \
    -X POST "$OLLAMA_URL/api/generate" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"$MODEL\",
      \"prompt\": \"\",
      \"keep_alive\": \"30m\",
      \"options\": {
        \"num_predict\": 0
      }
    }" \
    2>&1)

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ $MODEL kept alive"
    KEPT_ALIVE=$((KEPT_ALIVE + 1))
  else
    echo "❌ $MODEL failed (HTTP $HTTP_CODE)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "📊 Stats: $KEPT_ALIVE kept alive, $FAILED failed"

# Compléter avec succès si au moins 1 modèle OK
if [ $KEPT_ALIVE -gt 0 ]; then
  cron_complete "{\"kept_alive\": $KEPT_ALIVE, \"failed\": $FAILED}"
else
  cron_fail "{\"error\": \"All models failed\", \"failed\": $FAILED}"
  exit 1
fi
