#!/bin/bash
#
# Cron automatique : Réanalyse des documents KB échoués
#
# Schedule recommandé : Quotidien 4h du matin (après indexation overnight)
# Crontab : 0 4 * * * /opt/qadhya/scripts/cron-reanalyze-kb-failures.sh
#
# Logs : /var/log/qadhya/reanalyze-kb.log
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/var/log/qadhya"
LOG_FILE="${LOG_DIR}/reanalyze-kb.log"
API_URL="http://localhost:7002/api/admin/kb/reanalyze-failed"
BATCH_SIZE=50
MAX_BATCHES=5  # Maximum 5 batches = 250 docs/jour

# Créer répertoire logs si nécessaire
mkdir -p "$LOG_DIR"

# Fonction de logging
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Début réanalyse automatique KB échecs"
log "=========================================="

# Récupérer le CRON_SECRET depuis le conteneur
if ! CRON_SECRET=$(docker exec qadhya-nextjs env | grep CRON_SECRET | cut -d= -f2); then
  log "❌ ERREUR: Impossible de récupérer CRON_SECRET"
  exit 1
fi

if [ -z "$CRON_SECRET" ]; then
  log "❌ ERREUR: CRON_SECRET vide"
  exit 1
fi

log "✅ CRON_SECRET récupéré"

# Vérifier nombre d'échecs à traiter
log "📊 Vérification nombre d'échecs..."

FAILURES_COUNT=$(docker exec qadhya-postgres psql -U moncabinet -d qadhya -t -c \
  "SELECT COUNT(*) FROM knowledge_base WHERE is_active = true AND quality_score = 50;" | tr -d ' ')

log "📋 Échecs détectés: $FAILURES_COUNT"

if [ "$FAILURES_COUNT" -eq 0 ]; then
  log "✅ Aucun échec à corriger - Terminé"
  exit 0
fi

# Calculer nombre de batches nécessaires
BATCHES_NEEDED=$(( (FAILURES_COUNT + BATCH_SIZE - 1) / BATCH_SIZE ))
BATCHES_TO_RUN=$(( BATCHES_NEEDED < MAX_BATCHES ? BATCHES_NEEDED : MAX_BATCHES ))

log "🚀 Lancement de $BATCHES_TO_RUN batch(es) de $BATCH_SIZE documents"

TOTAL_SUCCESS=0
TOTAL_FAILED=0
TOTAL_IMPROVED=0

# Exécuter les batches
for i in $(seq 1 $BATCHES_TO_RUN); do
  log ""
  log "📦 Batch $i/$BATCHES_TO_RUN en cours..."

  # Appeler l'API de réanalyse
  RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "X-Cron-Secret: $CRON_SECRET" \
    -d "{\"limit\": $BATCH_SIZE, \"dryRun\": false}")

  # Parser la réponse JSON
  if echo "$RESPONSE" | jq -e . >/dev/null 2>&1; then
    SUCCEEDED=$(echo "$RESPONSE" | jq -r '.stats.succeeded // 0')
    FAILED=$(echo "$RESPONSE" | jq -r '.stats.failed // 0')
    IMPROVED=$(echo "$RESPONSE" | jq -r '.stats.improved // 0')
    PROCESSED=$(echo "$RESPONSE" | jq -r '.stats.processed // 0')

    TOTAL_SUCCESS=$((TOTAL_SUCCESS + SUCCEEDED))
    TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
    TOTAL_IMPROVED=$((TOTAL_IMPROVED + IMPROVED))

    log "   ✅ Traités: $PROCESSED | Succès: $SUCCEEDED | Améliorés: $IMPROVED | Échecs: $FAILED"

    # Si aucun document traité, arrêter (plus d'échecs disponibles)
    if [ "$PROCESSED" -eq 0 ]; then
      log "   ℹ️  Aucun document à traiter - Arrêt anticipé"
      break
    fi
  else
    log "   ❌ Erreur API: $RESPONSE"
    TOTAL_FAILED=$((TOTAL_FAILED + BATCH_SIZE))
  fi

  # Pause entre batches (éviter surcharge)
  if [ $i -lt $BATCHES_TO_RUN ]; then
    sleep 5
  fi
done

# Statistiques finales
log ""
log "=========================================="
log "📈 Résultat final"
log "=========================================="
log "✅ Succès total: $TOTAL_SUCCESS"
log "📈 Améliorés: $TOTAL_IMPROVED"
log "❌ Échecs: $TOTAL_FAILED"

# Vérifier échecs restants
FAILURES_REMAINING=$(docker exec qadhya-postgres psql -U moncabinet -d qadhya -t -c \
  "SELECT COUNT(*) FROM knowledge_base WHERE is_active = true AND quality_score = 50;" | tr -d ' ')

log "📊 Échecs restants: $FAILURES_REMAINING"

# Score moyen KB
AVG_SCORE=$(docker exec qadhya-postgres psql -U moncabinet -d qadhya -t -c \
  "SELECT ROUND(AVG(quality_score), 1) FROM knowledge_base WHERE is_active = true AND quality_score IS NOT NULL;" | tr -d ' ')

log "⭐ Score moyen KB: $AVG_SCORE"

log ""
log "✅ Réanalyse automatique terminée"
log "=========================================="

# Exit avec code approprié
if [ "$TOTAL_FAILED" -gt 0 ]; then
  log "⚠️  WARNING: Certains documents n'ont pas pu être corrigés"
  exit 0  # Ne pas bloquer le cron pour autant
else
  log "🎉 Tous les batches ont réussi"
  exit 0
fi
