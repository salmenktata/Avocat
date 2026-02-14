#\!/bin/bash
set -e

# Charger library cron logging
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/cron-logger.sh"

# Récupérer CRON_SECRET (priorité: env var > docker exec)
if [ -z "$CRON_SECRET" ]; then
  NEXTJS_CONTAINER=$(docker ps --filter "name=nextjs" --format "{{.Names}}" | head -1)
  if [ -z "$NEXTJS_CONTAINER" ]; then
    echo "❌ ERREUR: Conteneur Next.js non trouvé"
    exit 1
  fi

  CRON_SECRET=$(docker exec "$NEXTJS_CONTAINER" env | grep CRON_SECRET | cut -d= -f2)
  export CRON_SECRET

  if [ -z "$CRON_SECRET" ]; then
    echo "❌ CRON_SECRET introuvable"
    exit 1
  fi
fi

# Définir CRON_API_BASE si pas déjà défini
export CRON_API_BASE="${CRON_API_BASE:-https://qadhya.tn}"

# Démarrer tracking cron
cron_start "acquisition-weekly" "scheduled"

# Désactiver trap avant exécution
trap '
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    cron_fail "API call failed" $EXIT_CODE
  fi
' EXIT

# Appeler API d'acquisition via endpoint Next.js
echo "🚀 Appel API acquisition hebdomadaire..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${CRON_API_BASE}/api/admin/acquisition/run-weekly" \
  -H "Content-Type: application/json" \
  -H "X-Cron-Secret: $CRON_SECRET")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP $HTTP_CODE"
echo "$BODY" | head -20

if [ "$HTTP_CODE" \!= "200" ]; then
  echo "❌ ERREUR API (HTTP $HTTP_CODE)"
  trap - EXIT
  cron_fail "API error HTTP $HTTP_CODE" 1
  exit 1
fi

# Désactiver trap avant succès
trap - EXIT

# Parser résultat (optionnel)
SOURCES=$(echo "$BODY" | grep -o '"sources":[0-9]*' | cut -d: -f2 || echo "0")
PAGES=$(echo "$BODY" | grep -o '"pages":[0-9]*' | cut -d: -f2 || echo "0")

# Compléter avec succès
cron_complete "{\"sources\": $SOURCES, \"pages\": $PAGES}"

echo "✅ Acquisition-weekly terminé"
