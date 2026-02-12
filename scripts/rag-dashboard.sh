#!/bin/bash
# Dashboard Monitoring RAG - Temps Réel
# Usage: bash scripts/rag-dashboard.sh

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

function draw_header() {
  clear
  echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║          Dashboard Monitoring RAG - Qadhya Production       ║${NC}"
  echo -e "${BLUE}║                 $(date '+%Y-%m-%d %H:%M:%S')                          ║${NC}"
  echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}\n"
}

function get_migration_stats() {
  docker exec qadhya-postgres psql -U moncabinet -d qadhya -t -c \
    "SELECT
       total_chunks,
       chunks_openai,
       ROUND(pct_openai_complete::numeric, 1)
     FROM vw_kb_embedding_migration_stats;" 2>/dev/null | tr -d ' '
}

function get_search_coverage() {
  docker exec qadhya-postgres psql -U moncabinet -d qadhya -t -c \
    "SELECT
       chunks_with_embedding,
       chunks_with_tsvector,
       chunks_with_both
     FROM vw_kb_search_coverage;" 2>/dev/null | tr -d ' '
}

function get_recent_searches() {
  docker exec qadhya-postgres psql -U moncabinet -d qadhya -t -c \
    "SELECT COUNT(*)
     FROM chat_messages
     WHERE created_at >= NOW() - INTERVAL '1 hour'
       AND kb_results IS NOT NULL;" 2>/dev/null | tr -d ' '
}

function get_avg_similarity() {
  docker exec qadhya-postgres psql -U moncabinet -d qadhya -t -c \
    "WITH search_results AS (
       SELECT jsonb_array_elements(kb_results) AS result
       FROM chat_messages
       WHERE created_at >= NOW() - INTERVAL '24 hours'
         AND kb_results IS NOT NULL
     )
     SELECT ROUND(AVG((result->>'similarity')::float) * 100, 1)
     FROM search_results;" 2>/dev/null | tr -d ' '
}

function get_container_stats() {
  docker stats --no-stream --format "{{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep qadhya
}

function draw_progress_bar() {
  local value=$1
  local max=$2
  local width=40
  local filled=$((value * width / max))
  local empty=$((width - filled))

  printf "["
  printf "%${filled}s" | tr ' ' '█'
  printf "%${empty}s" | tr ' ' '░'
  printf "] %s/%s" "$value" "$max"
}

function main_loop() {
  while true; do
    draw_header

    # ═════════════════════════════════════════════════════════════════════
    # MIGRATION OPENAI
    # ═════════════════════════════════════════════════════════════════════

    echo -e "${CYAN}📦 MIGRATION OPENAI EMBEDDINGS${NC}\n"

    migration_stats=$(get_migration_stats)
    if [ -n "$migration_stats" ]; then
      total=$(echo "$migration_stats" | cut -d'|' -f1)
      openai=$(echo "$migration_stats" | cut -d'|' -f2)
      pct=$(echo "$migration_stats" | cut -d'|' -f3)

      echo -n "  "
      draw_progress_bar "$openai" "$total"
      echo -e " (${pct}%)"
      echo ""

      if (( $(echo "$pct >= 80" | bc -l) )); then
        echo -e "  Status: ${GREEN}✓ Migration quasi-complète${NC}"
      elif (( $(echo "$pct >= 50" | bc -l) )); then
        echo -e "  Status: ${YELLOW}◐ Migration en cours (>50%)${NC}"
      elif (( $(echo "$pct >= 20" | bc -l) )); then
        echo -e "  Status: ${YELLOW}◑ Migration démarrée${NC}"
      else
        echo -e "  Status: ${RED}◯ Migration à lancer${NC}"
      fi
    else
      echo -e "  ${RED}✗ Impossible de récupérer stats${NC}"
    fi

    echo ""

    # ═════════════════════════════════════════════════════════════════════
    # COUVERTURE INDEXATION
    # ═════════════════════════════════════════════════════════════════════

    echo -e "${CYAN}🔍 COUVERTURE INDEXATION${NC}\n"

    coverage=$(get_search_coverage)
    if [ -n "$coverage" ]; then
      embedding=$(echo "$coverage" | cut -d'|' -f1)
      tsvector=$(echo "$coverage" | cut -d'|' -f2)
      both=$(echo "$coverage" | cut -d'|' -f3)

      echo "  Embeddings (vectoriel):    ${embedding}"
      echo "  TS Vector (BM25):          ${tsvector}"
      echo "  Les deux:                  ${both} ${GREEN}✓${NC}"
    fi

    echo ""

    # ═════════════════════════════════════════════════════════════════════
    # ACTIVITÉ RÉCENTE
    # ═════════════════════════════════════════════════════════════════════

    echo -e "${CYAN}⚡ ACTIVITÉ RÉCENTE (1h)${NC}\n"

    searches=$(get_recent_searches)
    if [ -n "$searches" ] && [ "$searches" -gt 0 ]; then
      echo "  Recherches KB:             ${searches}"
    else
      echo "  Recherches KB:             0 ${YELLOW}(pas d'activité)${NC}"
    fi

    echo ""

    # ═════════════════════════════════════════════════════════════════════
    # QUALITÉ RAG (24h)
    # ═════════════════════════════════════════════════════════════════════

    echo -e "${CYAN}📊 QUALITÉ RAG (24h)${NC}\n"

    avg_sim=$(get_avg_similarity)
    if [ -n "$avg_sim" ] && [ "$avg_sim" != "" ]; then
      echo -n "  Score moyen similarité:    ${avg_sim}%"

      if (( $(echo "$avg_sim >= 75" | bc -l) )); then
        echo -e " ${GREEN}✓ Excellent${NC}"
      elif (( $(echo "$avg_sim >= 65" | bc -l) )); then
        echo -e " ${YELLOW}◐ Bon${NC}"
      else
        echo -e " ${RED}◯ À améliorer${NC}"
      fi
    else
      echo "  Score moyen similarité:    ${YELLOW}N/A (pas assez de données)${NC}"
    fi

    echo ""

    # ═════════════════════════════════════════════════════════════════════
    # RESSOURCES CONTAINERS
    # ═════════════════════════════════════════════════════════════════════

    echo -e "${CYAN}💻 RESSOURCES CONTAINERS${NC}\n"

    container_stats=$(get_container_stats)
    if [ -n "$container_stats" ]; then
      echo "$container_stats" | while IFS=$'\t' read -r container cpu mem; do
        container_short=$(echo "$container" | cut -d'-' -f2)
        printf "  %-12s CPU: %6s   RAM: %s\n" "$container_short" "$cpu" "$mem"
      done
    fi

    echo ""

    # ═════════════════════════════════════════════════════════════════════
    # ACTIONS RAPIDES
    # ═════════════════════════════════════════════════════════════════════

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}🎯 ACTIONS RAPIDES${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    echo "  [R] Lancer réindexation"
    echo "  [T] Tests E2E"
    echo "  [M] Monitoring détaillé"
    echo "  [V] Validation déploiement"
    echo "  [Q] Quitter"
    echo ""
    echo -e "${YELLOW}Rafraîchissement automatique dans 30s... (ou appuyez sur une touche)${NC}"

    # Attendre 30s ou input utilisateur
    read -t 30 -n 1 action
    case $action in
      r|R)
        clear
        echo -e "${BLUE}Lancement réindexation...${NC}\n"
        docker exec qadhya-nextjs npx tsx scripts/reindex-kb-openai.ts \
          --categories jurisprudence,codes,legislation --batch-size 50
        echo -e "\n${GREEN}Appuyez sur une touche pour revenir au dashboard${NC}"
        read -n 1
        ;;
      t|T)
        clear
        echo -e "${BLUE}Lancement tests E2E...${NC}\n"
        docker exec qadhya-nextjs npx tsx scripts/test-rag-complete-e2e.ts
        echo -e "\n${GREEN}Appuyez sur une touche pour revenir au dashboard${NC}"
        read -n 1
        ;;
      m|M)
        clear
        echo -e "${BLUE}Monitoring détaillé...${NC}\n"
        docker exec qadhya-nextjs npx tsx scripts/monitor-rag-quality.ts
        echo -e "\n${GREEN}Appuyez sur une touche pour revenir au dashboard${NC}"
        read -n 1
        ;;
      v|V)
        clear
        echo -e "${BLUE}Validation déploiement...${NC}\n"
        bash scripts/validate-rag-deployment.sh
        echo -e "\n${GREEN}Appuyez sur une touche pour revenir au dashboard${NC}"
        read -n 1
        ;;
      q|Q)
        clear
        echo -e "${GREEN}Au revoir !${NC}\n"
        exit 0
        ;;
    esac
  done
}

# Vérifier qu'on est sur le VPS
if [ ! -f /opt/qadhya/.env.production.local ]; then
  echo -e "${RED}❌ Ce script doit être exécuté sur le VPS${NC}"
  exit 1
fi

# Lancer le dashboard
main_loop
