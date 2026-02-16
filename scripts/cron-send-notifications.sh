#!/bin/bash

###############################################################################
# Cron - Envoi des notifications quotidiennes
# Remplace Supabase Edge Function send-notifications
#
# Phase 4.3 - Notification API (remplacer Supabase)
# Fréquence: Toutes les heures (06:00-10:00) pour gérer les différents fuseaux
# Durée: ~30s-2min selon nombre d'utilisateurs
###############################################################################

set -e

# Charger library de logging cron
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/cron-logger.sh"

# Démarrer l'exécution
cron_start "send-notifications" "scheduled"

# API Endpoint
API_URL="${CRON_API_BASE:-http://localhost:3000}/api/notifications/send"

# Récupérer CRON_SECRET depuis environnement ou Docker
if [ -z "$CRON_SECRET" ]; then
  # Essayer de récupérer depuis container Docker si disponible
  if command -v docker &> /dev/null; then
    CRON_SECRET=$(docker exec qadhya-nextjs printenv CRON_SECRET 2>/dev/null || echo "")
  fi
fi

if [ -z "$CRON_SECRET" ]; then
  cron_fail "{\"error\": \"CRON_SECRET not configured\"}"
  exit 1
fi

# Appeler l'API de notification
echo "🔔 Envoi des notifications quotidiennes..."
echo "📡 API: $API_URL"

# Effectuer l'appel HTTP avec timeout 120s
RESPONSE=$(curl -s -w "\n%{http_code}" \
  --max-time 120 \
  -X POST "$API_URL" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  2>&1)

# Séparer body et code HTTP
HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

# Vérifier succès
if [ "$HTTP_CODE" -eq 200 ]; then
  # Parser stats depuis JSON response
  SENT=$(echo "$HTTP_BODY" | jq -r '.stats.sent // 0' 2>/dev/null || echo "0")
  FAILED=$(echo "$HTTP_BODY" | jq -r '.stats.failed // 0' 2>/dev/null || echo "0")
  TOTAL=$(echo "$HTTP_BODY" | jq -r '.stats.total // 0' 2>/dev/null || echo "0")

  echo "✅ Notifications envoyées avec succès"
  echo "📊 Stats: $SENT/$TOTAL envoyés, $FAILED échecs"

  # Compléter avec succès
  cron_complete "{\"sent\": $SENT, \"failed\": $FAILED, \"total\": $TOTAL}"
else
  # Erreur HTTP
  ERROR_MSG=$(echo "$HTTP_BODY" | jq -r '.error // .details // "Unknown error"' 2>/dev/null || echo "HTTP $HTTP_CODE")
  echo "❌ Erreur HTTP $HTTP_CODE: $ERROR_MSG"
  cron_fail "{\"error\": \"HTTP $HTTP_CODE\", \"message\": \"$ERROR_MSG\"}"
  exit 1
fi
