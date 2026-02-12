#!/bin/bash
#
# Script d'extraction bulk des métadonnées pour 9anoun.tn en production
#
# Usage:
#   ./scripts/extract-metadata-9anoun-prod.sh [options]
#
# Options:
#   --batch-size <n>      Nombre de pages par batch (défaut: 10)
#   --concurrency <n>     Nombre de requêtes parallèles (défaut: 5)
#   --max-batches <n>     Nombre maximum de batches (défaut: illimité)
#   --delay <seconds>     Délai entre batches en secondes (défaut: 2)
#   --category <cat>      Filtrer par catégorie (défaut: toutes)
#
# Exemple:
#   ./scripts/extract-metadata-9anoun-prod.sh
#   ./scripts/extract-metadata-9anoun-prod.sh --batch-size 20 --concurrency 10
#   ./scripts/extract-metadata-9anoun-prod.sh --max-batches 50
#

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SOURCE_ID="4319d2d1-569c-4107-8f52-d71e2a2e9fe9"  # 9anoun.tn
API_URL="https://qadhya.tn/api/cron/extract-metadata"
BATCH_SIZE=10
CONCURRENCY=5
MAX_BATCHES=0  # 0 = illimité
DELAY=2
CATEGORY=""

# Charger CRON_SECRET
if [ -f "/opt/moncabinet/.env" ]; then
  source /opt/moncabinet/.env
elif [ -f ".env.production" ]; then
  source .env.production
elif [ -f ".env.local" ]; then
  source .env.local
else
  echo -e "${RED}❌ Fichier .env introuvable${NC}"
  exit 1
fi

if [ -z "$CRON_SECRET" ]; then
  echo -e "${RED}❌ CRON_SECRET non défini${NC}"
  exit 1
fi

# Parser les arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --batch-size)
      BATCH_SIZE="$2"
      shift 2
      ;;
    --concurrency)
      CONCURRENCY="$2"
      shift 2
      ;;
    --max-batches)
      MAX_BATCHES="$2"
      shift 2
      ;;
    --delay)
      DELAY="$2"
      shift 2
      ;;
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    *)
      echo "Option inconnue: $1"
      exit 1
      ;;
  esac
done

# Fonction pour formater la durée
format_duration() {
  local seconds=$1
  if [ $seconds -lt 60 ]; then
    echo "${seconds}s"
  elif [ $seconds -lt 3600 ]; then
    echo "$((seconds / 60))m $((seconds % 60))s"
  else
    echo "$((seconds / 3600))h $(((seconds % 3600) / 60))m"
  fi
}

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     EXTRACTION BULK MÉTADONNÉES - 9ANOUN.TN (PRODUCTION)      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}📊 Configuration :${NC}"
echo "   - Source ID         : $SOURCE_ID"
echo "   - Batch size        : $BATCH_SIZE"
echo "   - Concurrency       : $CONCURRENCY"
echo "   - Max batches       : $([ $MAX_BATCHES -eq 0 ] && echo '∞' || echo $MAX_BATCHES)"
echo "   - Délai inter-batch : ${DELAY}s"
[ -n "$CATEGORY" ] && echo "   - Catégorie filtrée : $CATEGORY"
echo ""

# Préparer le payload JSON
PAYLOAD="{\"sourceId\":\"$SOURCE_ID\",\"batchSize\":$BATCH_SIZE,\"concurrency\":$CONCURRENCY,\"skipExisting\":true"
[ -n "$CATEGORY" ] && PAYLOAD="$PAYLOAD,\"onlyCategory\":\"$CATEGORY\""
PAYLOAD="$PAYLOAD}"

# Compteurs
BATCH_NUMBER=0
TOTAL_PROCESSED=0
TOTAL_FAILED=0
START_TIME=$(date +%s)
HAS_MORE=true

echo -e "${GREEN}🚀 Lancement de l'extraction...${NC}"
echo ""

while [ "$HAS_MORE" = "true" ]; do
  BATCH_NUMBER=$((BATCH_NUMBER + 1))

  # Vérifier la limite de batches
  if [ $MAX_BATCHES -gt 0 ] && [ $BATCH_NUMBER -gt $MAX_BATCHES ]; then
    echo -e "${YELLOW}⏸️  Limite de batches atteinte ($MAX_BATCHES)${NC}"
    break
  fi

  BATCH_START_TIME=$(date +%s)

  echo -e "${BLUE}📦 Batch $BATCH_NUMBER$([ $MAX_BATCHES -gt 0 ] && echo " / $MAX_BATCHES" || echo "")${NC}"
  echo "─────────────────────────────────────────────────────────────────"

  # Appeler l'API
  RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

  # Vérifier si la réponse est valide
  if ! echo "$RESPONSE" | jq -e . >/dev/null 2>&1; then
    echo -e "${RED}❌ Erreur: Réponse API invalide${NC}"
    echo "$RESPONSE"
    exit 1
  fi

  # Parser la réponse
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
  PROCESSED=$(echo "$RESPONSE" | jq -r '.processed // 0')
  FAILED=$(echo "$RESPONSE" | jq -r '.failed // 0')
  HAS_MORE=$(echo "$RESPONSE" | jq -r '.hasMore // false')
  DURATION=$(echo "$RESPONSE" | jq -r '.duration // "0s"')

  # Stats globales
  TOTAL_PAGES=$(echo "$RESPONSE" | jq -r '.stats.totalPages // 0')
  PAGES_WITH_METADATA=$(echo "$RESPONSE" | jq -r '.stats.pagesWithMetadata // 0')
  PAGES_WITHOUT_METADATA=$(echo "$RESPONSE" | jq -r '.stats.pagesWithoutMetadata // 0')
  COVERAGE_PCT=$(echo "$RESPONSE" | jq -r '.stats.coveragePercent // 0')

  if [ "$SUCCESS" != "true" ]; then
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // "Erreur inconnue"')
    echo -e "${RED}❌ Erreur API: $ERROR_MSG${NC}"
    exit 1
  fi

  # Mettre à jour les compteurs
  TOTAL_PROCESSED=$((TOTAL_PROCESSED + PROCESSED))
  TOTAL_FAILED=$((TOTAL_FAILED + FAILED))

  BATCH_DURATION=$(($(date +%s) - BATCH_START_TIME))
  TOTAL_DURATION=$(($(date +%s) - START_TIME))

  echo -e "${GREEN}✅ Réussies : $PROCESSED${NC}"
  [ $FAILED -gt 0 ] && echo -e "${RED}❌ Échecs   : $FAILED${NC}"
  echo -e "${BLUE}⏱️  Durée    : ${DURATION}${NC}"

  # Afficher les erreurs si présentes
  ERROR_COUNT=$(echo "$RESPONSE" | jq -r '.errors | length')
  if [ "$ERROR_COUNT" -gt 0 ]; then
    echo -e "\n${YELLOW}⚠️  Erreurs dans ce batch :${NC}"
    echo "$RESPONSE" | jq -r '.errors[] | "   - \(.url[0:60])...\n     \(.error)"' | head -n 10
  fi

  # Progression globale
  echo ""
  echo -e "${BLUE}📊 Progression globale :${NC}"
  echo "   Métadonnées : $PAGES_WITH_METADATA / $TOTAL_PAGES ($COVERAGE_PCT%)"
  echo "   Restantes   : $PAGES_WITHOUT_METADATA"
  echo "   Temps écoulé : $(format_duration $TOTAL_DURATION)"
  [ $TOTAL_PROCESSED -gt 0 ] && echo "   Vitesse moy. : $(echo "scale=2; $TOTAL_PROCESSED / $TOTAL_DURATION" | bc) pages/s"

  # Vérifier s'il y a encore des pages à traiter
  if [ "$HAS_MORE" != "true" ] || [ $PROCESSED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Tous les batches ont été traités !${NC}"
    break
  fi

  # Pause entre batches
  if [ $DELAY -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⏳ Pause de ${DELAY}s avant le prochain batch...${NC}"
    sleep $DELAY
  fi

  echo ""
done

# Rapport final
TOTAL_DURATION=$(($(date +%s) - START_TIME))

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    RAPPORT FINAL                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}📊 Statistiques finales :${NC}"
echo "   Total pages             : $TOTAL_PAGES"
echo "   Avec métadonnées        : $PAGES_WITH_METADATA"
echo "   Sans métadonnées        : $PAGES_WITHOUT_METADATA"
echo "   Couverture              : $COVERAGE_PCT%"
echo ""
echo -e "${BLUE}🔧 Cette session :${NC}"
echo "   Pages traitées          : $TOTAL_PROCESSED"
echo "   Pages échouées          : $TOTAL_FAILED"
echo "   Batches exécutés        : $BATCH_NUMBER"
echo "   Durée totale            : $(format_duration $TOTAL_DURATION)"
[ $TOTAL_PROCESSED -gt 0 ] && echo "   Vitesse moyenne         : $(echo "scale=2; $TOTAL_PROCESSED / $TOTAL_DURATION" | bc) pages/s"
echo ""

if [ $PAGES_WITHOUT_METADATA -eq 0 ]; then
  echo -e "${GREEN}✨ Extraction complète terminée !${NC}"
else
  echo -e "${YELLOW}⚠️  Il reste $PAGES_WITHOUT_METADATA pages à traiter${NC}"
  echo -e "${BLUE}💡 Relancer le script pour continuer l'extraction${NC}"
fi

echo ""
