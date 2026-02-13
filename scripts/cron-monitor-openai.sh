#!/bin/bash
# Cron quotidien : Monitoring usage OpenAI
# Alerte si budget proche de la limite
#
# Installation cron (en tant que root sur le serveur):
#   crontab -e
#   0 9 * * * /opt/qadhya/scripts/cron-monitor-openai.sh >> /var/log/qadhya/openai-monitor.log 2>&1

set -e

# Timestamp
echo "=============================================="
echo "$(date '+%Y-%m-%d %H:%M:%S') - Monitoring OpenAI"
echo "=============================================="

# Récupérer le secret cron
CRON_SECRET=$(grep CRON_SECRET /opt/qadhya/.env.production.local | cut -d= -f2)

if [ -z "$CRON_SECRET" ]; then
  echo "❌ CRON_SECRET introuvable dans .env.production.local"
  exit 1
fi

# Appeler l'API de monitoring
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "X-Cron-Secret: $CRON_SECRET" \
  https://qadhya.tn/api/admin/monitor-openai)

# Extraire le code HTTP et le body
HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_CODE | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Vérifier le niveau d'alerte
ALERT_LEVEL=$(echo "$BODY" | jq -r '.alert.level' 2>/dev/null || echo "unknown")
ALERT_MESSAGE=$(echo "$BODY" | jq -r '.alert.message' 2>/dev/null || echo "")

if [ "$ALERT_LEVEL" = "critical" ]; then
  echo "⚠️  ALERTE CRITIQUE: $ALERT_MESSAGE"
  echo "   Action: Vérifier solde OpenAI ou basculer sur Ollama"

  # TODO: Envoyer notification (email, Slack, etc.)
  # curl -X POST https://hooks.slack.com/... -d "{\"text\": \"OpenAI Alert: $ALERT_MESSAGE\"}"

  exit 1
elif [ "$ALERT_LEVEL" = "warning" ]; then
  echo "⚡ WARNING: $ALERT_MESSAGE"
fi

echo ""
echo "✅ Monitoring terminé"
echo ""
