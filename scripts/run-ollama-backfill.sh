#!/bin/bash
# ==============================================================================
# Script de backfill complet des embeddings Ollama
#
# Appelle /api/admin/reindex-kb-ollama en boucle jusqu'à completion.
# Ollama est lent (~1s/embedding), temps estimé pour 25k chunks : ~3.5h
#
# Usage:
#   CRON_SECRET=xxx ./scripts/run-ollama-backfill.sh [--batch-size=50] [--concurrency=2]
#
# Ou depuis le VPS:
#   ssh user@84.247.165.187 "CRON_SECRET=xxx bash /opt/qadhya/scripts/run-ollama-backfill.sh"
# ==============================================================================

set -e

BASE_URL="${BASE_URL:-https://qadhya.tn}"
BATCH_SIZE=50
CONCURRENCY=2
SLEEP_BETWEEN=2

# Parse args
for arg in "$@"; do
  case $arg in
    --batch-size=*) BATCH_SIZE="${arg#*=}" ;;
    --concurrency=*) CONCURRENCY="${arg#*=}" ;;
    --base-url=*) BASE_URL="${arg#*=}" ;;
  esac
done

if [ -z "$CRON_SECRET" ]; then
  echo "❌ CRON_SECRET manquant"
  echo "Usage: CRON_SECRET=xxx ./scripts/run-ollama-backfill.sh"
  exit 1
fi

ENDPOINT="${BASE_URL}/api/admin/reindex-kb-ollama?batch_size=${BATCH_SIZE}&concurrency=${CONCURRENCY}"

echo "======================================================================"
echo "🚀 Backfill Ollama Embeddings"
echo "======================================================================"
echo "  URL         : $ENDPOINT"
echo "  Batch size  : $BATCH_SIZE"
echo "  Concurrency : $CONCURRENCY"
echo "  Sleep       : ${SLEEP_BETWEEN}s entre batches"
echo ""

# Vérifier statut initial
echo "📊 Statut initial :"
INITIAL=$(curl -s -X GET "$BASE_URL/api/admin/reindex-kb-ollama" \
  -H "Authorization: Bearer $CRON_SECRET")
echo "$INITIAL" | python3 -c "
import sys, json
d = json.load(sys.stdin)
e = d.get('embeddings', {})
ol = e.get('ollama', {})
print(f\"  Total chunks : {d.get('total', '?')}\")
print(f\"  Ollama indexés : {ol.get('indexed', '?')} ({ol.get('pct', '?')}%)\")
print(f\"  Restants : {ol.get('remaining', '?')}\")
print(f\"  Ollama dispo : {d.get('ollamaAvailable', '?')}\")
print(f\"  Temps estimé : {d.get('estimatedTime', '?')}\")
" 2>/dev/null || echo "$INITIAL"

echo ""
echo "Démarrage dans 3s... (Ctrl+C pour annuler)"
sleep 3
echo ""

ITERATION=0
TOTAL_INDEXED=0
START_TIME=$(date +%s)

while true; do
  ITERATION=$((ITERATION + 1))
  ELAPSED=$(( $(date +%s) - START_TIME ))

  echo -n "[$( date '+%H:%M:%S')] Batch #${ITERATION} ... "

  RESULT=$(curl -s -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    --max-time 300)

  if [ $? -ne 0 ]; then
    echo "❌ Erreur réseau (timeout ou connexion refusée)"
    sleep 10
    continue
  fi

  # Parser le résultat
  BATCH_INDEXED=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('batch',{}).get('indexed',0))" 2>/dev/null || echo "?")
  BATCH_ERRORS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('batch',{}).get('errors',0))" 2>/dev/null || echo "?")
  REMAINING=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('progress',{}).get('remaining',0))" 2>/dev/null || echo "?")
  PERCENTAGE=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('progress',{}).get('percentage',0))" 2>/dev/null || echo "?")

  if [ "$BATCH_INDEXED" = "?" ]; then
    echo "❌ Réponse inattendue :"
    echo "$RESULT" | head -c 300
    echo ""
    sleep 10
    continue
  fi

  TOTAL_INDEXED=$((TOTAL_INDEXED + BATCH_INDEXED))
  RATE=0
  if [ $ELAPSED -gt 0 ]; then
    RATE=$(( TOTAL_INDEXED * 60 / ELAPSED ))
  fi

  echo "✅ +${BATCH_INDEXED} (erreurs: ${BATCH_ERRORS}) | ${PERCENTAGE}% done | restants: ${REMAINING} | vitesse: ${RATE}/min"

  # Terminé ?
  if [ "$REMAINING" = "0" ] || [ "$REMAINING" = "" ]; then
    TOTAL_ELAPSED=$(( $(date +%s) - START_TIME ))
    TOTAL_MIN=$(( TOTAL_ELAPSED / 60 ))
    echo ""
    echo "======================================================================"
    echo "🎉 Backfill Ollama terminé !"
    echo "  Total indexés : $TOTAL_INDEXED"
    echo "  Temps total   : ${TOTAL_MIN}min"
    echo "  Batches       : $ITERATION"
    echo "======================================================================"
    break
  fi

  sleep $SLEEP_BETWEEN
done
