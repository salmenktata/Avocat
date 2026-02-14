#!/bin/bash
set -e

# DEBUG: Afficher toutes les variables d'environnement
echo "[DEBUG] Variables d'environnement reçues:"
env | grep -i cron || echo "Aucune variable CRON trouvée"

# Charger library cron logging
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/cron-logger.sh"

# Récupérer CRON_SECRET (priorité: env var > docker exec)
echo "[DEBUG] CRON_SECRET actuel: [$CRON_SECRET]"
if [ -z "$CRON_SECRET" ]; then
  echo "[DEBUG] Tentative récupération via docker exec"
  # Mode manuel/cron: récupérer depuis container
  NEXTJS_CONTAINER=$(docker ps --filter "name=nextjs" --format "{{.Names}}" | head -1)
  if [ -n "$NEXTJS_CONTAINER" ]; then
    CRON_SECRET=$(docker exec "$NEXTJS_CONTAINER" env | grep CRON_SECRET | cut -d= -f2)
    export CRON_SECRET
    echo "[DEBUG] CRON_SECRET récupéré: [${CRON_SECRET:0:10}...]"
  fi
else
  echo "[DEBUG] CRON_SECRET trouvé en env"
fi

if [ -z "$CRON_SECRET" ]; then
  echo "❌ CRON_SECRET introuvable"
  exit 1
fi

# Démarrer tracking cron
cron_start "cleanup-executions" "scheduled"

# Détection container PostgreSQL
POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)
if [ -z "$POSTGRES_CONTAINER" ]; then
  cron_fail "Conteneur PostgreSQL non trouvé" 1
  exit 1
fi

# Nettoyer exécutions >7 jours
echo "🧹 Nettoyage exécutions >7 jours..."
RESULT=$(docker exec $POSTGRES_CONTAINER psql -U moncabinet -d qadhya -t -c "DELETE FROM cron_executions WHERE started_at < NOW() - INTERVAL '7 days';")
DELETED=$(echo "$RESULT" | grep -oP 'DELETE \K[0-9]+' || echo "0")

echo "✅ $DELETED lignes supprimées"

# Désactiver trap avant succès
trap - EXIT

# Compléter avec succès
cron_complete "{\"deletedCount\": $DELETED}"
