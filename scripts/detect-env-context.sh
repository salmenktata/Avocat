#!/bin/bash
# ============================================================================
# DÉTECTION AUTOMATIQUE CONTEXTE DOCKER VS LOCAL
# ============================================================================
# Détecte si l'application s'exécute dans un conteneur Docker ou en local
# et exporte les variables d'environnement adaptées pour les services
# (PostgreSQL, Redis, MinIO, Ollama).
#
# Usage:
#   source scripts/detect-env-context.sh
#   # OU dans package.json prestart: "bash scripts/detect-env-context.sh"
#
# Variables exportées:
#   - OLLAMA_CONTEXT: host.docker.internal (Docker) | localhost (Local)
#   - MINIO_CONTEXT: minio (Docker) | localhost (Local)
#   - REDIS_CONTEXT: redis (Docker) | localhost (Local)
#   - DB_CONTEXT: postgres (Docker) | localhost (Local)
#
# Détection basée sur:
#   1. Présence fichier /.dockerenv (conteneur Docker)
#   2. Variable CI=true (GitHub Actions, GitLab CI, etc.)
#   3. Variable DOCKER=true (forcé manuellement)
#   4. Hostname conteneur (qadhya-nextjs, etc.)
# ============================================================================

set -euo pipefail

# Couleurs pour logs (désactivées si non-TTY)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# ----------------------------------------------------------------------------
# Fonctions Helper
# ----------------------------------------------------------------------------

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ----------------------------------------------------------------------------
# Détection Contexte
# ----------------------------------------------------------------------------

detect_context() {
    local context="local"
    local reason=""

    # 1. Vérifier fichier /.dockerenv (méthode la plus fiable)
    if [ -f /.dockerenv ]; then
        context="docker"
        reason="Fichier /.dockerenv détecté"

    # 2. Vérifier variable CI (GitHub Actions, GitLab CI, etc.)
    elif [ "${CI:-}" = "true" ]; then
        context="docker"
        reason="Variable CI=true détectée"

    # 3. Vérifier variable DOCKER forcée manuellement
    elif [ "${DOCKER:-}" = "true" ]; then
        context="docker"
        reason="Variable DOCKER=true forcée"

    # 4. Vérifier hostname conteneur
    elif [[ "$(hostname)" =~ ^qadhya- ]]; then
        context="docker"
        reason="Hostname conteneur '$(hostname)' détecté"

    # 5. Vérifier cgroup (fallback Docker detection)
    elif [ -f /proc/1/cgroup ] && grep -q docker /proc/1/cgroup 2>/dev/null; then
        context="docker"
        reason="Cgroup Docker détecté"

    else
        reason="Aucun indicateur Docker détecté"
    fi

    echo "$context"
    log_info "Contexte détecté: ${context^^} ($reason)"
}

# ----------------------------------------------------------------------------
# Export Variables selon Contexte
# ----------------------------------------------------------------------------

export_context_variables() {
    local context="$1"

    if [ "$context" = "docker" ]; then
        # Contexte Docker (conteneur)
        export OLLAMA_CONTEXT="host.docker.internal"
        export MINIO_CONTEXT="minio"
        export REDIS_CONTEXT="redis"
        export DB_CONTEXT="postgres"

        log_success "Variables Docker exportées:"
        log_info "  OLLAMA_CONTEXT=host.docker.internal"
        log_info "  MINIO_CONTEXT=minio"
        log_info "  REDIS_CONTEXT=redis"
        log_info "  DB_CONTEXT=postgres"

    else
        # Contexte Local
        export OLLAMA_CONTEXT="localhost"
        export MINIO_CONTEXT="localhost"
        export REDIS_CONTEXT="localhost"
        export DB_CONTEXT="localhost"

        log_success "Variables Local exportées:"
        log_info "  OLLAMA_CONTEXT=localhost"
        log_info "  MINIO_CONTEXT=localhost"
        log_info "  REDIS_CONTEXT=localhost"
        log_info "  DB_CONTEXT=localhost"
    fi
}

# ----------------------------------------------------------------------------
# Validation (optionnel)
# ----------------------------------------------------------------------------

validate_context() {
    local context="$1"

    # Vérifier cohérence avec variables existantes
    if [ "$context" = "docker" ]; then
        if [ "${DATABASE_URL:-}" != "" ] && [[ "${DATABASE_URL}" =~ localhost ]]; then
            log_warning "DATABASE_URL contient 'localhost' mais contexte Docker détecté"
            log_warning "Assurez-vous que .env utilise \${DB_CONTEXT} au lieu de localhost hardcodé"
        fi

        if [ "${OLLAMA_BASE_URL:-}" != "" ] && [[ "${OLLAMA_BASE_URL}" =~ localhost ]]; then
            log_warning "OLLAMA_BASE_URL contient 'localhost' mais contexte Docker détecté"
            log_warning "Assurez-vous que .env utilise \${OLLAMA_CONTEXT} au lieu de localhost hardcodé"
        fi
    fi
}

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

main() {
    log_info "Détection contexte environnement..."

    local context
    context=$(detect_context)

    export_context_variables "$context"

    # Validation (warnings uniquement, pas d'exit)
    validate_context "$context"

    log_success "Détection contexte terminée avec succès"
}

# Exécuter si sourcé ou exécuté directement
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main
else
    main
fi
