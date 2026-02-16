#!/bin/bash
#═══════════════════════════════════════════════════════════════════════════════
# Cron: Vérification Configuration RAG
#═══════════════════════════════════════════════════════════════════════════════
# Vérifie quotidiennement la configuration RAG et envoie alerte si problème
#
# Usage: Exécuté automatiquement par cron (8h quotidien)
# Logs: /var/log/qadhya/check-rag-config.log (via cron-logger.sh)
#
# Exit Codes:
#   0 - Configuration OK
#   1 - Configuration invalide (alerte envoyée)
#
# Déploiement VPS:
#   1. Copier dans /opt/qadhya/scripts/
#   2. Permissions: chmod +x cron-check-rag-config.sh
#   3. Installer cron: bash scripts/setup-crontabs.sh
#═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Charger bibliothèque cron logger
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/cron-logger.sh" ]; then
  source "$SCRIPT_DIR/lib/cron-logger.sh"
else
  echo "❌ Erreur: cron-logger.sh introuvable"
  exit 1
fi

# Configuration
API_URL="https://qadhya.tn/api/health"
ALERT_API_URL="https://qadhya.tn/api/admin/alerts/check"

# Démarrer cron
cron_start "check-rag-config" "scheduled"

echo "🔍 Vérification configuration RAG..."

# Vérifier que curl et jq sont disponibles
if ! command -v curl &> /dev/null; then
    cron_fail "{\"error\": \"curl non trouvé\"}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    cron_fail "{\"error\": \"jq non trouvé\"}"
    exit 1
fi

# Récupérer health check
echo "  Récupération health check depuis $API_URL..."

HEALTH_RESPONSE=$(curl -s --max-time 10 "$API_URL" 2>&1)
CURL_EXIT_CODE=$?

if [ $CURL_EXIT_CODE -ne 0 ]; then
    cron_fail "{\"error\": \"Échec health check\", \"exitCode\": $CURL_EXIT_CODE}"
    exit 1
fi

# Vérifier que c'est du JSON valide
if ! echo "$HEALTH_RESPONSE" | jq empty 2>/dev/null; then
    cron_fail "{\"error\": \"Réponse health check invalide (pas JSON)\"}"
    exit 1
fi

# Extraire configuration RAG
RAG_ENABLED=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.enabled // "null"')
SEMANTIC_SEARCH_ENABLED=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.semanticSearchEnabled // "null"')
OLLAMA_ENABLED=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.ollamaEnabled // "null"')
OPENAI_CONFIGURED=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.openaiConfigured // "null"')
RAG_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.status // "null"')
KB_DOCS_INDEXED=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.kbDocsIndexed // "0"')
KB_CHUNKS_AVAILABLE=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.kbChunksAvailable // "0"')

echo ""
echo "Configuration détectée:"
echo "  RAG_ENABLED:             $RAG_ENABLED"
echo "  SEMANTIC_SEARCH_ENABLED: $SEMANTIC_SEARCH_ENABLED"
echo "  OLLAMA_ENABLED:          $OLLAMA_ENABLED"
echo "  OPENAI_CONFIGURED:       $OPENAI_CONFIGURED"
echo "  RAG_STATUS:              $RAG_STATUS"
echo "  KB_DOCS_INDEXED:         $KB_DOCS_INDEXED"
echo "  KB_CHUNKS_AVAILABLE:     $KB_CHUNKS_AVAILABLE"
echo ""

# Vérifier configuration
if [ "$RAG_STATUS" = "null" ]; then
    cron_fail "{\"error\": \"Section .rag absente du health check\"}"
    exit 1
fi

if [ "$RAG_STATUS" = "misconfigured" ]; then
    echo "❌ Configuration RAG INVALIDE détectée !"
    echo ""
    echo "Problème: RAG activé mais aucun provider embeddings disponible"
    echo "Impact: Assistant IA non-fonctionnel"
    echo ""
    echo "État détecté:"
    echo "  RAG_ENABLED:           $RAG_ENABLED"
    echo "  OLLAMA_ENABLED:        $OLLAMA_ENABLED"
    echo "  OPENAI_CONFIGURED:     $OPENAI_CONFIGURED"
    echo "  SEMANTIC_SEARCH:       $SEMANTIC_SEARCH_ENABLED"
    echo ""
    echo "Solutions:"
    echo "  1. Activer Ollama (gratuit): OLLAMA_ENABLED=true"
    echo "  2. Configurer OpenAI (payant): OPENAI_API_KEY=sk-proj-..."
    echo ""

    # Déclencher système d'alertes email
    if [ -n "${CRON_SECRET:-}" ]; then
        echo "Déclenchement système d'alertes email..."

        ALERT_RESPONSE=$(curl -s -w "\n%{http_code}" \
            -H "X-Cron-Secret: $CRON_SECRET" \
            --max-time 15 \
            "$ALERT_API_URL" 2>&1)

        HTTP_CODE=$(echo "$ALERT_RESPONSE" | tail -n1)
        ALERT_BODY=$(echo "$ALERT_RESPONSE" | head -n-1)

        if [ "$HTTP_CODE" = "200" ]; then
            ALERTS_SENT=$(echo "$ALERT_BODY" | jq -r '.alertsSent // 0')
            echo "✅ Alertes email envoyées: $ALERTS_SENT"
        else
            echo "⚠️ Échec envoi alertes email (HTTP $HTTP_CODE)"
        fi
    else
        echo "⚠️ CRON_SECRET non défini - alertes email désactivées"
    fi

    cron_fail "{\"error\": \"RAG misconfigured\", \"ragEnabled\": \"$RAG_ENABLED\", \"ollamaEnabled\": \"$OLLAMA_ENABLED\", \"semanticEnabled\": \"$SEMANTIC_SEARCH_ENABLED\"}"
    exit 1

elif [ "$RAG_ENABLED" != "true" ]; then
    echo "⚠️ RAG désactivé (RAG_ENABLED=$RAG_ENABLED)"
    echo "   Recommandation: Activer RAG pour utiliser la Knowledge Base"

    cron_complete "{\"status\": \"disabled\", \"message\": \"RAG désactivé volontairement\"}"
    exit 0

else
    echo "✅ Configuration RAG valide"
    echo "   RAG activé:           $RAG_ENABLED"
    echo "   Recherche sémantique: $SEMANTIC_SEARCH_ENABLED"
    echo "   Provider actif:       Ollama=$OLLAMA_ENABLED, OpenAI=$OPENAI_CONFIGURED"
    echo "   KB opérationnelle:    $KB_DOCS_INDEXED docs, $KB_CHUNKS_AVAILABLE chunks"

    cron_complete "{\"status\": \"ok\", \"kbDocs\": \"$KB_DOCS_INDEXED\", \"kbChunks\": \"$KB_CHUNKS_AVAILABLE\", \"ragEnabled\": \"$RAG_ENABLED\", \"semanticEnabled\": \"$SEMANTIC_SEARCH_ENABLED\"}"
    exit 0
fi
