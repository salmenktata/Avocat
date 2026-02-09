#!/bin/bash
# =============================================================================
# Test des Clés API en Production (VPS)
# =============================================================================
# Teste directement les clés API depuis le container Docker en production
# pour valider qu'elles fonctionnent correctement
# =============================================================================

set -e

# Couleurs
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
VPS_HOST="root@84.247.165.187"
CONTAINER="moncabinet-nextjs"

echo -e "${BLUE}=================================================================="
echo "🔍 Test des Clés API en Production - $(date)"
echo "==================================================================${NC}\n"

# =============================================================================
# Fonction de test d'une clé API
# =============================================================================
test_api_key() {
  local provider="$1"
  local env_var="$2"
  local test_command="$3"

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}📝 Testing: $provider${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # Vérifier que la clé existe
  local key_exists=$(ssh $VPS_HOST "docker exec $CONTAINER printenv $env_var 2>/dev/null" || echo "")

  if [ -z "$key_exists" ]; then
    echo -e "${RED}❌ MANQUANT: $env_var non configuré${NC}\n"
    return 1
  fi

  local key_preview=$(echo "$key_exists" | cut -c1-20)
  echo -e "${GREEN}✓ Clé trouvée: ${key_preview}...${NC}"

  # Tester la clé via commande
  echo -e "${YELLOW}Testing API call...${NC}"
  local result=$(ssh $VPS_HOST "$test_command" 2>&1)
  local exit_code=$?

  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ SUCCÈS: API répond correctement${NC}"
    echo -e "${GREEN}Réponse: $result${NC}\n"
    return 0
  else
    echo -e "${RED}❌ ÉCHEC: $result${NC}\n"
    return 1
  fi
}

# =============================================================================
# Test Gemini API
# =============================================================================
echo -e "\n${YELLOW}1. Test Gemini API (Google)${NC}"

GEMINI_TEST='
GOOGLE_API_KEY=$(docker exec moncabinet-nextjs printenv GOOGLE_API_KEY)
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=$GOOGLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '"'"'{"contents":[{"parts":[{"text":"Test"}]}]}'"'"' | jq -r ".candidates[0].content.parts[0].text // .error.message"
'

test_api_key "Gemini" "GOOGLE_API_KEY" "$GEMINI_TEST"
GEMINI_STATUS=$?

# =============================================================================
# Test Groq API
# =============================================================================
echo -e "\n${YELLOW}2. Test Groq API${NC}"

GROQ_TEST='
GROQ_API_KEY=$(docker exec moncabinet-nextjs printenv GROQ_API_KEY)
curl -s -X POST "https://api.groq.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '"'"'{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"Test"}],"max_tokens":10}'"'"' | jq -r ".choices[0].message.content // .error.message"
'

test_api_key "Groq" "GROQ_API_KEY" "$GROQ_TEST"
GROQ_STATUS=$?

# =============================================================================
# Test DeepSeek API
# =============================================================================
echo -e "\n${YELLOW}3. Test DeepSeek API${NC}"

DEEPSEEK_TEST='
DEEPSEEK_API_KEY=$(docker exec moncabinet-nextjs printenv DEEPSEEK_API_KEY)
curl -s -X POST "https://api.deepseek.com/chat/completions" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '"'"'{"model":"deepseek-chat","messages":[{"role":"user","content":"Test"}],"max_tokens":10}'"'"' | jq -r ".choices[0].message.content // .error.message"
'

test_api_key "DeepSeek" "DEEPSEEK_API_KEY" "$DEEPSEEK_TEST"
DEEPSEEK_STATUS=$?

# =============================================================================
# Test Ollama Local
# =============================================================================
echo -e "\n${YELLOW}4. Test Ollama (Local VPS)${NC}"

OLLAMA_TEST='
OLLAMA_BASE_URL=$(docker exec moncabinet-nextjs printenv OLLAMA_BASE_URL)
curl -s "${OLLAMA_BASE_URL}/api/tags" | jq -r ".models[0].name // \"Error\""
'

test_api_key "Ollama" "OLLAMA_BASE_URL" "$OLLAMA_TEST"
OLLAMA_STATUS=$?

# =============================================================================
# Test Anthropic API (optionnel)
# =============================================================================
echo -e "\n${YELLOW}5. Test Anthropic API (Optionnel)${NC}"

ANTHROPIC_TEST='
ANTHROPIC_API_KEY=$(docker exec moncabinet-nextjs printenv ANTHROPIC_API_KEY 2>/dev/null || echo "")
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Non configuré (optionnel)"
  exit 0
fi
curl -s -X POST "https://api.anthropic.com/v1/messages" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '"'"'{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Test"}]}'"'"' | jq -r ".content[0].text // .error.message"
'

test_api_key "Anthropic" "ANTHROPIC_API_KEY" "$ANTHROPIC_TEST"
ANTHROPIC_STATUS=$?

# =============================================================================
# Résumé Final
# =============================================================================
echo -e "\n${BLUE}=================================================================="
echo "📊 RÉSUMÉ DES TESTS"
echo "==================================================================${NC}\n"

TOTAL_TESTS=5
PASSED=0

[ $GEMINI_STATUS -eq 0 ] && ((PASSED++))
[ $GROQ_STATUS -eq 0 ] && ((PASSED++))
[ $DEEPSEEK_STATUS -eq 0 ] && ((PASSED++))
[ $OLLAMA_STATUS -eq 0 ] && ((PASSED++))
[ $ANTHROPIC_STATUS -eq 0 ] && ((PASSED++))

echo -e "Provider          | Status"
echo -e "------------------|----------"
echo -e "Gemini (Google)   | $([ $GEMINI_STATUS -eq 0 ] && echo -e "${GREEN}✅ OK${NC}" || echo -e "${RED}❌ FAIL${NC}")"
echo -e "Groq              | $([ $GROQ_STATUS -eq 0 ] && echo -e "${GREEN}✅ OK${NC}" || echo -e "${RED}❌ FAIL${NC}")"
echo -e "DeepSeek          | $([ $DEEPSEEK_STATUS -eq 0 ] && echo -e "${GREEN}✅ OK${NC}" || echo -e "${RED}❌ FAIL${NC}")"
echo -e "Ollama (Local)    | $([ $OLLAMA_STATUS -eq 0 ] && echo -e "${GREEN}✅ OK${NC}" || echo -e "${RED}❌ FAIL${NC}")"
echo -e "Anthropic         | $([ $ANTHROPIC_STATUS -eq 0 ] && echo -e "${GREEN}✅ OK${NC}" || echo -e "${YELLOW}⚠️  SKIP${NC}")"

echo -e "\n${BLUE}Résultat: ${PASSED}/${TOTAL_TESTS} tests réussis${NC}"

if [ $PASSED -ge 3 ]; then
  echo -e "\n${GREEN}✅ Production opérationnelle (au moins 3 providers fonctionnels)${NC}\n"
  exit 0
elif [ $PASSED -ge 1 ]; then
  echo -e "\n${YELLOW}⚠️  Production dégradée (seulement $PASSED provider(s) fonctionnel(s))${NC}\n"
  exit 1
else
  echo -e "\n${RED}❌ Production en erreur (aucun provider fonctionnel)${NC}\n"
  exit 2
fi
