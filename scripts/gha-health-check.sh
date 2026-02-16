#!/bin/bash
# ============================================================================
# HEALTH CHECK POUR GITHUB ACTIONS
# ============================================================================
# Script helper pour health check post-déploiement dans workflow GHA
# Remplace 70 lignes dupliquées dans deploy-vps.yml
#
# Usage:
#   bash scripts/gha-health-check.sh <URL> [SSH_HOST]
#
# Exemples:
#   # Health check direct
#   bash scripts/gha-health-check.sh https://qadhya.tn/api/health
#
#   # Health check via SSH (diagnostic supplémentaire)
#   bash scripts/gha-health-check.sh https://qadhya.tn/api/health root@84.247.165.187
#
# Exit codes:
#   0 = Health check réussi
#   1 = Health check échoué
# ============================================================================

set -euo pipefail

# ----------------------------------------------------------------------------
# Arguments
# ----------------------------------------------------------------------------

HEALTH_URL="${1:-}"
SSH_HOST="${2:-}"

if [ -z "$HEALTH_URL" ]; then
    echo "❌ Usage: $0 <HEALTH_URL> [SSH_HOST]"
    exit 1
fi

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------

RETRIES=3
DELAY=15
INITIAL_WAIT=30
TIMEOUT=10
EXPECTED_STATUS="healthy"

# ----------------------------------------------------------------------------
# Fonctions
# ----------------------------------------------------------------------------

log_info() {
    echo "ℹ️  $1"
}

log_success() {
    echo "✅ $1"
}

log_error() {
    echo "❌ $1"
}

# Diagnostic SSH (optionnel)
diagnostic_ssh() {
    local ssh_host="$1"

    if [ -z "$ssh_host" ]; then
        return 0
    fi

    log_info "Diagnostic SSH: $ssh_host"

    # Docker containers status
    echo "📦 Docker containers:"
    ssh -o StrictHostKeyChecking=no "$ssh_host" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" || true

    # Logs récents Next.js
    echo ""
    echo "📝 Logs Next.js (20 dernières lignes):"
    ssh -o StrictHostKeyChecking=no "$ssh_host" "docker logs qadhya-nextjs --tail 20 2>&1" || true
}

# Health check avec retry
health_check() {
    local url="$1"

    log_info "Health check: $url"
    log_info "Configuration: $RETRIES tentatives × ${DELAY}s (wait initial: ${INITIAL_WAIT}s)"

    # Attente initiale (Docker start_period)
    if [ "$INITIAL_WAIT" -gt 0 ]; then
        log_info "Attente initiale ${INITIAL_WAIT}s (Docker start_period)..."
        sleep "$INITIAL_WAIT"
    fi

    # Tentatives avec retry
    local attempt=1
    while [ $attempt -le $RETRIES ]; do
        log_info "Tentative $attempt/$RETRIES..."

        # Appel HTTP avec timeout
        local response
        local http_code

        response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" "$url" 2>&1 || echo "")
        http_code=$(echo "$response" | tail -n1)
        local body=$(echo "$response" | head -n-1)

        # Vérifier HTTP 200
        if [ "$http_code" = "200" ]; then
            # Validation JSON stricte
            local status=$(echo "$body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "")

            if [ "$status" = "$EXPECTED_STATUS" ]; then
                log_success "Health check réussi (status: $status)"

                # Afficher infos RAG si disponible
                local rag_status=$(echo "$body" | grep -o '"rag":{[^}]*}' || echo "")
                if [ -n "$rag_status" ]; then
                    log_info "RAG: $rag_status"
                fi

                return 0
            else
                log_error "HTTP 200 mais status='$status' (attendu: '$EXPECTED_STATUS')"
                echo "Response: $body"
            fi
        else
            log_error "HTTP $http_code (attendu: 200)"
            echo "Response: $body"
        fi

        # Retry delay
        if [ $attempt -lt $RETRIES ]; then
            log_info "Attente ${DELAY}s avant retry..."
            sleep "$DELAY"
        fi

        attempt=$((attempt + 1))
    done

    log_error "Health check échoué après $RETRIES tentatives"
    return 1
}

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

main() {
    echo "════════════════════════════════════════════════════════════════"
    echo "  HEALTH CHECK POST-DÉPLOIEMENT"
    echo "════════════════════════════════════════════════════════════════"
    echo ""

    # Health check
    if health_check "$HEALTH_URL"; then
        echo ""
        log_success "Application opérationnelle"
        echo ""

        # Diagnostic SSH si fourni
        if [ -n "$SSH_HOST" ]; then
            echo "════════════════════════════════════════════════════════════════"
            echo "  DIAGNOSTIC SSH"
            echo "════════════════════════════════════════════════════════════════"
            echo ""
            diagnostic_ssh "$SSH_HOST"
        fi

        exit 0
    else
        echo ""
        log_error "Health check échoué - Rollback recommandé"
        echo ""

        # Diagnostic SSH en cas d'échec
        if [ -n "$SSH_HOST" ]; then
            echo "════════════════════════════════════════════════════════════════"
            echo "  DIAGNOSTIC ÉCHEC"
            echo "════════════════════════════════════════════════════════════════"
            echo ""
            diagnostic_ssh "$SSH_HOST"
        fi

        exit 1
    fi
}

main
