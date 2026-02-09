#!/bin/bash
# ============================================================================
# Script: Ajouter IORT en production via API
# ============================================================================
#
# Usage:
#   ./scripts/add-iort-source-prod.sh
#
# Prérequis:
#   - Tunnel SSH actif vers le VPS
#   - jq installé (pour formater JSON)
#
# ============================================================================

set -euo pipefail

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Configuration de la source IORT en production${NC}\n"

# Configuration
API_URL="https://moncabinet.tn/api/admin/web-sources"
# Vous devrez vous authentifier avec votre session browser ou via un token

# Payload JSON
read -r -d '' PAYLOAD << 'EOF' || true
{
  "name": "IORT - Imprimerie Officielle de la République Tunisienne",
  "baseUrl": "https://www.iort.tn",
  "description": "Site officiel de l'Imprimerie Officielle (IORT) - Journal Officiel de la République Tunisienne (JORT)",
  "category": "jort",
  "language": "mixed",
  "priority": 9,
  "crawlFrequency": "7 days",
  "maxDepth": 5,
  "maxPages": 5000,
  "requiresJavascript": true,
  "respectRobotsTxt": false,
  "ignoreSSLErrors": false,
  "downloadFiles": true,
  "autoIndexFiles": true,
  "rateLimitMs": 2000,
  "urlPatterns": [
    "https://www.iort.tn/**",
    "https://iort.tn/**"
  ],
  "excludedPatterns": [
    "**/logout**",
    "**/admin/**",
    "**/login**"
  ],
  "cssSelectors": {
    "content": ["main", "article", ".content", "body"],
    "title": ["h1", "h2", "title"],
    "exclude": ["script", "style", "nav", "header", "footer", ".navigation", ".menu"]
  },
  "seedUrls": [
    "https://www.iort.tn"
  ],
  "customHeaders": {
    "Accept-Language": "fr-TN,fr;q=0.9,ar-TN;q=0.8,ar;q=0.7"
  },
  "dynamicConfig": {
    "waitUntil": "networkidle",
    "postLoadDelayMs": 2000,
    "waitForLoadingToDisappear": true,
    "loadingIndicators": [
      "<!--loading-->",
      ".loading",
      "[data-loading]",
      ".spinner"
    ],
    "dynamicTimeoutMs": 15000
  }
}
EOF

echo -e "${YELLOW}⚠️  IMPORTANT: Vous devez être authentifié comme admin${NC}"
echo -e "   Méthode 1: Utiliser un cookie de session (recommandé)"
echo -e "   Méthode 2: Utiliser le script SQL directement sur le VPS\n"

echo -e "📋 Configuration à envoyer:"
echo "$PAYLOAD" | jq '.' 2>/dev/null || echo "$PAYLOAD"

echo ""
read -p "Continuer avec l'API? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${YELLOW}→ Utilisez plutôt le script SQL:${NC}"
    echo -e "   scp scripts/add-iort-source-prod.sql root@84.247.165.187:/tmp/"
    echo -e "   ssh root@84.247.165.187"
    echo -e "   psql -U moncabinet -d moncabinet -f /tmp/add-iort-source-prod.sql"
    exit 0
fi

echo -e "\n${BLUE}📡 Envoi de la requête...${NC}"

# Note: Vous devrez ajouter votre cookie de session ici
# Récupérez-le depuis votre navigateur (DevTools > Application > Cookies)
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie-here" \
  -d "$PAYLOAD")

# Vérifier la réponse
if echo "$RESPONSE" | jq -e '.source' > /dev/null 2>&1; then
  echo -e "\n${GREEN}✅ Source IORT créée avec succès!${NC}\n"

  SOURCE_ID=$(echo "$RESPONSE" | jq -r '.source.id')

  echo -e "${GREEN}📋 Détails:${NC}"
  echo "$RESPONSE" | jq '.source | {
    id: .id,
    name: .name,
    baseUrl: .baseUrl,
    category: .category,
    priority: .priority,
    requiresJavascript: .requiresJavascript,
    crawlFrequency: .crawlFrequency
  }'

  echo -e "\n${BLUE}🎯 Prochaines étapes:${NC}"
  echo -e "   1. Tester le crawl:"
  echo -e "      ${YELLOW}curl -X POST https://moncabinet.tn/api/admin/web-sources/$SOURCE_ID/crawl \\${NC}"
  echo -e "      ${YELLOW}  -H 'Content-Type: application/json' \\${NC}"
  echo -e "      ${YELLOW}  -d '{\"type\":\"single_page\",\"targetUrl\":\"https://www.iort.tn\"}'${NC}"

else
  echo -e "\n${RED}❌ Erreur lors de la création:${NC}"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 1
fi
