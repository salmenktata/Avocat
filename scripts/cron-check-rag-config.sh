#!/bin/bash

#======================================================================
# Cron de Vérification Configuration RAG
#======================================================================
# Vérifie quotidiennement la configuration RAG et envoie alerte si problème
#
# Déploiement VPS :
#   1. Copier dans /opt/moncabinet/scripts/
#   2. Permissions : chmod +x cron-check-rag-config.sh
#   3. Crontab : 0 8 * * * /opt/moncabinet/scripts/cron-check-rag-config.sh
#
# Logs : /var/log/qadhya/rag-config-check.log
#
# Exit Codes:
#   0 - Configuration OK
#   1 - Configuration invalide (alerte envoyée)
#======================================================================

set -euo pipefail

# Configuration
LOG_FILE="/var/log/qadhya/rag-config-check.log"
API_URL="https://qadhya.tn/api/health"
ALERT_API_URL="https://qadhya.tn/api/admin/alerts/check"
CRON_SECRET="${CRON_SECRET:-}"

# Couleurs (désactivées dans cron)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

# Fonction logging
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Créer répertoire logs si nécessaire
mkdir -p "$(dirname "$LOG_FILE")"

log "INFO" "=========================================="
log "INFO" "Démarrage vérification configuration RAG"
log "INFO" "=========================================="

# Vérifier que curl est disponible
if ! command -v curl &> /dev/null; then
    log "ERROR" "curl non trouvé - impossible de continuer"
    exit 1
fi

# Vérifier que jq est disponible
if ! command -v jq &> /dev/null; then
    log "ERROR" "jq non trouvé - impossible de continuer"
    exit 1
fi

# ========================================
# 1. Récupérer health check
# ========================================

log "INFO" "Récupération health check depuis $API_URL"

HEALTH_RESPONSE=$(curl -s --max-time 10 "$API_URL" 2>&1)
CURL_EXIT_CODE=$?

if [ $CURL_EXIT_CODE -ne 0 ]; then
    log "ERROR" "Échec récupération health check (exit code: $CURL_EXIT_CODE)"
    log "ERROR" "Impossible de vérifier configuration RAG"
    exit 1
fi

# Vérifier que c'est du JSON valide
if ! echo "$HEALTH_RESPONSE" | jq empty 2>/dev/null; then
    log "ERROR" "Réponse health check invalide (pas du JSON)"
    log "DEBUG" "Réponse: $HEALTH_RESPONSE"
    exit 1
fi

# ========================================
# 2. Extraire configuration RAG
# ========================================

RAG_ENABLED=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.enabled // "null"')
SEMANTIC_SEARCH_ENABLED=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.semanticSearchEnabled // "null"')
OLLAMA_ENABLED=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.ollamaEnabled // "null"')
OPENAI_CONFIGURED=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.openaiConfigured // "null"')
RAG_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.status // "null"')
KB_DOCS_INDEXED=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.kbDocsIndexed // 0')
KB_CHUNKS_AVAILABLE=$(echo "$HEALTH_RESPONSE" | jq -r '.rag.kbChunksAvailable // 0')

log "INFO" "Configuration RAG détectée :"
log "INFO" "  - RAG_ENABLED: $RAG_ENABLED"
log "INFO" "  - SEMANTIC_SEARCH_ENABLED: $SEMANTIC_SEARCH_ENABLED"
log "INFO" "  - OLLAMA_ENABLED: $OLLAMA_ENABLED"
log "INFO" "  - OPENAI_CONFIGURED: $OPENAI_CONFIGURED"
log "INFO" "  - RAG_STATUS: $RAG_STATUS"
log "INFO" "  - KB_DOCS_INDEXED: $KB_DOCS_INDEXED"
log "INFO" "  - KB_CHUNKS_AVAILABLE: $KB_CHUNKS_AVAILABLE"

# ========================================
# 3. Vérifier configuration
# ========================================

if [ "$RAG_STATUS" = "null" ]; then
    log "ERROR" "Section .rag absente du health check"
    log "ERROR" "Health check API peut-être pas à jour"
    exit 1
fi

if [ "$RAG_STATUS" = "misconfigured" ]; then
    log "ERROR" "❌ Configuration RAG INVALIDE détectée !"
    log "ERROR" ""
    log "ERROR" "Problème : RAG activé mais aucun provider embeddings disponible"
    log "ERROR" "Impact : Assistant IA non-fonctionnel"
    log "ERROR" ""
    log "ERROR" "État détecté :"
    log "ERROR" "  - RAG_ENABLED: $RAG_ENABLED"
    log "ERROR" "  - OLLAMA_ENABLED: $OLLAMA_ENABLED"
    log "ERROR" "  - OPENAI_CONFIGURED: $OPENAI_CONFIGURED"
    log "ERROR" "  - SEMANTIC_SEARCH_ENABLED: $SEMANTIC_SEARCH_ENABLED"
    log "ERROR" ""
    log "ERROR" "Solutions :"
    log "ERROR" "  1. Activer Ollama (gratuit) : OLLAMA_ENABLED=true"
    log "ERROR" "  2. Configurer OpenAI (payant) : OPENAI_API_KEY=sk-proj-..."
    log "ERROR" ""

    # ========================================
    # 4. Déclencher système d'alertes email
    # ========================================

    if [ -n "$CRON_SECRET" ]; then
        log "INFO" "Déclenchement système d'alertes email..."

        ALERT_RESPONSE=$(curl -s -w "\n%{http_code}" \
            -H "X-Cron-Secret: $CRON_SECRET" \
            --max-time 15 \
            "$ALERT_API_URL" 2>&1)

        HTTP_CODE=$(echo "$ALERT_RESPONSE" | tail -n1)
        ALERT_BODY=$(echo "$ALERT_RESPONSE" | head -n-1)

        if [ "$HTTP_CODE" = "200" ]; then
            ALERTS_SENT=$(echo "$ALERT_BODY" | jq -r '.alertsSent // 0')
            log "INFO" "✅ Alertes email envoyées : $ALERTS_SENT"
        else
            log "WARN" "⚠️ Échec envoi alertes email (HTTP $HTTP_CODE)"
            log "DEBUG" "Réponse: $ALERT_BODY"
        fi
    else
        log "WARN" "⚠️ CRON_SECRET non défini - alertes email désactivées"
    fi

    log "ERROR" "=========================================="
    log "ERROR" "Vérification ÉCHOUÉE - Configuration invalide"
    log "ERROR" "=========================================="

    exit 1

elif [ "$RAG_ENABLED" != "true" ]; then
    log "WARN" "⚠️ RAG désactivé (RAG_ENABLED=$RAG_ENABLED)"
    log "WARN" "Recommandation : Activer RAG pour utiliser la Knowledge Base"

    log "INFO" "=========================================="
    log "INFO" "Vérification OK (RAG désactivé volontairement)"
    log "INFO" "=========================================="

    exit 0

else
    log "INFO" "✅ Configuration RAG valide"
    log "INFO" "  - RAG activé : $RAG_ENABLED"
    log "INFO" "  - Recherche sémantique : $SEMANTIC_SEARCH_ENABLED"
    log "INFO" "  - Provider actif : Ollama=$OLLAMA_ENABLED, OpenAI=$OPENAI_CONFIGURED"
    log "INFO" "  - KB opérationnelle : $KB_DOCS_INDEXED docs, $KB_CHUNKS_AVAILABLE chunks"

    log "INFO" "=========================================="
    log "INFO" "Vérification RÉUSSIE"
    log "INFO" "=========================================="

    exit 0
fi
