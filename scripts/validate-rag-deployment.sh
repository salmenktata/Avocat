#!/bin/bash
# Script de Validation Déploiement RAG
# Usage: bash scripts/validate-rag-deployment.sh

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

function test_item() {
  local name="$1"
  local command="$2"

  echo -n "Testing: $name... "

  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}✗${NC}"
    ((TESTS_FAILED++))
    return 1
  fi
}

function test_item_output() {
  local name="$1"
  local command="$2"
  local expected="$3"

  echo -n "Testing: $name... "

  output=$(eval "$command" 2>&1)

  if echo "$output" | grep -q "$expected"; then
    echo -e "${GREEN}✓${NC}"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}✗${NC}"
    echo "   Expected: $expected"
    echo "   Got: $output"
    ((TESTS_FAILED++))
    return 1
  fi
}

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Validation Déploiement RAG - Qadhya Production       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

# ═════════════════════════════════════════════════════════════════════════════
# 1. INFRASTRUCTURE
# ═════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━ 1. Infrastructure ━━━${NC}\n"

test_item "PostgreSQL running" "docker ps | grep -q qadhya-postgres"
test_item "Next.js running" "docker ps | grep -q qadhya-nextjs"
test_item "Health endpoint" "curl -s https://qadhya.tn/api/health | grep -q healthy"

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# 2. MIGRATIONS SQL
# ═════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━ 2. Migrations SQL ━━━${NC}\n"

test_item_output "Column embedding_openai" \
  "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c '\d knowledge_base_chunks'" \
  "embedding_openai"

test_item_output "Column content_tsvector" \
  "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c '\d knowledge_base_chunks'" \
  "content_tsvector"

test_item_output "Function search_knowledge_base_flexible" \
  "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c '\df search_knowledge_base_flexible'" \
  "search_knowledge_base_flexible"

test_item_output "Function search_knowledge_base_hybrid" \
  "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c '\df search_knowledge_base_hybrid'" \
  "search_knowledge_base_hybrid"

test_item_output "View vw_kb_embedding_migration_stats" \
  "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c '\dv vw_kb_embedding_migration_stats'" \
  "vw_kb_embedding_migration_stats"

test_item_output "View vw_kb_search_coverage" \
  "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c '\dv vw_kb_search_coverage'" \
  "vw_kb_search_coverage"

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# 3. CODE DÉPLOYÉ
# ═════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━ 3. Code Déployé ━━━${NC}\n"

test_item "query-classifier-service.ts" \
  "docker exec qadhya-nextjs test -f lib/ai/query-classifier-service.ts"

test_item "query-expansion-service.ts" \
  "docker exec qadhya-nextjs test -f lib/ai/query-expansion-service.ts"

test_item "cross-encoder-service.ts" \
  "docker exec qadhya-nextjs test -f lib/ai/cross-encoder-service.ts"

test_item "reindex-kb-openai.ts" \
  "docker exec qadhya-nextjs test -f scripts/reindex-kb-openai.ts"

test_item "monitor-rag-quality.ts" \
  "docker exec qadhya-nextjs test -f scripts/monitor-rag-quality.ts"

test_item "test-rag-complete-e2e.ts" \
  "docker exec qadhya-nextjs test -f scripts/test-rag-complete-e2e.ts"

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# 4. DÉPENDANCES
# ═════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━ 4. Dépendances ━━━${NC}\n"

test_item "@xenova/transformers installed" \
  "docker exec qadhya-nextjs npm list @xenova/transformers"

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# 5. CONFIGURATION
# ═════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━ 5. Configuration ━━━${NC}\n"

test_item_output "OLLAMA_ENABLED=true" \
  "docker exec qadhya-nextjs env | grep OLLAMA_ENABLED" \
  "true"

test_item_output "OPENAI_API_KEY configured" \
  "docker exec qadhya-nextjs env | grep OPENAI_API_KEY" \
  "sk-"

test_item_output "RAG_MAX_RESULTS=15" \
  "docker exec qadhya-nextjs env | grep RAG_MAX_RESULTS" \
  "15"

test_item_output "RAG_THRESHOLD_KB=0.50" \
  "docker exec qadhya-nextjs env | grep RAG_THRESHOLD_KB" \
  "0.5"

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# 6. INDEXATION
# ═════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━ 6. État Indexation ━━━${NC}\n"

echo "📊 Statistiques migration OpenAI:"
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \
  "SELECT
    total_chunks,
    chunks_openai,
    pct_openai_complete
   FROM vw_kb_embedding_migration_stats;" 2>/dev/null || true

echo ""
echo "📊 Couverture recherche:"
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \
  "SELECT * FROM vw_kb_search_coverage;" 2>/dev/null || true

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}RÉSUMÉ VALIDATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
PASS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo -e "Tests réussis:  ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests échoués:  ${RED}${TESTS_FAILED}${NC}"
echo -e "Taux réussite:  ${PASS_RATE}%\n"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ VALIDATION RÉUSSIE - Déploiement RAG OK !${NC}\n"
  exit 0
else
  echo -e "${YELLOW}⚠️  VALIDATION PARTIELLE - ${TESTS_FAILED} test(s) échoué(s)${NC}"
  echo -e "   Voir détails ci-dessus\n"
  exit 1
fi
