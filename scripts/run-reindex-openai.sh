#!/bin/bash

# Script de réindexation complète OpenAI
# Lance l'API en boucle jusqu'à ce que tous les chunks soient indexés

set -e

# Configuration
API_URL="${API_URL:-https://qadhya.tn/api/admin/reindex-kb-openai}"
CRON_SECRET="${CRON_SECRET:-}"
BATCH_SIZE="${BATCH_SIZE:-50}"
SLEEP_BETWEEN_BATCHES="${SLEEP_BETWEEN_BATCHES:-2}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Réindexation OpenAI - Knowledge Base"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier CRON_SECRET
if [ -z "$CRON_SECRET" ]; then
  echo -e "${RED}❌ ERREUR: CRON_SECRET non défini${NC}"
  echo "Définissez la variable d'environnement:"
  echo "  export CRON_SECRET='votre_secret'"
  exit 1
fi

# Afficher la configuration
echo -e "${BLUE}Configuration:${NC}"
echo "  API URL: $API_URL"
echo "  Batch size: $BATCH_SIZE"
echo "  Sleep: ${SLEEP_BETWEEN_BATCHES}s"
echo ""

# Récupérer le statut initial
echo -e "${BLUE}📊 Statut initial...${NC}"
INITIAL_STATUS=$(curl -sf "$API_URL" \
  -H "Authorization: Bearer $CRON_SECRET" \
  2>/dev/null)

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Impossible de contacter l'API${NC}"
  exit 1
fi

TOTAL=$(echo "$INITIAL_STATUS" | jq -r '.total')
OPENAI_INDEXED=$(echo "$INITIAL_STATUS" | jq -r '.embeddings.openai.indexed')
REMAINING=$(echo "$INITIAL_STATUS" | jq -r '.embeddings.openai.remaining')

echo "  Total chunks: $TOTAL"
echo "  Déjà indexés: $OPENAI_INDEXED"
echo "  Restants: $REMAINING"
echo ""

if [ "$REMAINING" -eq 0 ]; then
  echo -e "${GREEN}✅ Tous les chunks sont déjà indexés !${NC}"
  exit 0
fi

# Calculer le nombre de batches
BATCHES=$(( (REMAINING + BATCH_SIZE - 1) / BATCH_SIZE ))
echo -e "${YELLOW}⏳ Estimation: $BATCHES batches à traiter${NC}"
echo -e "${YELLOW}⏱️  Durée estimée: $(( BATCHES * (SLEEP_BETWEEN_BATCHES + 2) / 60 )) minutes${NC}"
echo ""

read -p "Voulez-vous continuer ? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Annulé."
  exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Démarrage de la réindexation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BATCH_NUM=0
TOTAL_INDEXED=0
TOTAL_ERRORS=0

while true; do
  BATCH_NUM=$((BATCH_NUM + 1))

  echo -e "${BLUE}[Batch $BATCH_NUM/$BATCHES]${NC} Traitement..."

  # Appeler l'API
  RESPONSE=$(curl -sf -X POST "$API_URL?batch_size=$BATCH_SIZE" \
    -H "Authorization: Bearer $CRON_SECRET" \
    2>/dev/null)

  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erreur appel API${NC}"
    exit 1
  fi

  # Parser la réponse
  INDEXED=$(echo "$RESPONSE" | jq -r '.batch.indexed')
  ERRORS=$(echo "$RESPONSE" | jq -r '.batch.errors')
  REMAINING_NOW=$(echo "$RESPONSE" | jq -r '.progress.remaining')
  PERCENTAGE=$(echo "$RESPONSE" | jq -r '.progress.percentage')

  TOTAL_INDEXED=$((TOTAL_INDEXED + INDEXED))
  TOTAL_ERRORS=$((TOTAL_ERRORS + ERRORS))

  # Afficher la progression
  echo -e "  ✓ Indexés: ${GREEN}$INDEXED${NC}"
  echo -e "  ✗ Erreurs: ${RED}$ERRORS${NC}"
  echo -e "  📊 Progression: ${YELLOW}$PERCENTAGE%${NC} ($REMAINING_NOW restants)"

  # Afficher les erreurs si présentes
  if [ "$ERRORS" -gt 0 ]; then
    echo "$RESPONSE" | jq -r '.batch.errorDetails[]? | "     - " + .id + ": " + .error' 2>/dev/null
  fi

  echo ""

  # Vérifier s'il reste des chunks
  if [ "$REMAINING_NOW" -eq 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}✅ RÉINDEXATION TERMINÉE !${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 Résumé:"
    echo "  Total indexés: $TOTAL_INDEXED"
    echo "  Total erreurs: $TOTAL_ERRORS"
    echo "  Batches traités: $BATCH_NUM"
    echo ""

    # Récupérer le statut final
    FINAL_STATUS=$(curl -sf "$API_URL" \
      -H "Authorization: Bearer $CRON_SECRET" \
      2>/dev/null)

    echo "📈 Statut final:"
    echo "$FINAL_STATUS" | jq '.'

    exit 0
  fi

  # Attendre avant le prochain batch
  sleep $SLEEP_BETWEEN_BATCHES
done
