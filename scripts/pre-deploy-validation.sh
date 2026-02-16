#!/bin/bash
# ============================================================================
# PRE-DEPLOY VALIDATION CONSOLIDÉE
# ============================================================================
# Script helper pour validation pre-déploiement dans workflow GHA
# Consolide 3 validations : schema, RAG, TypeScript
#
# Usage:
#   bash scripts/pre-deploy-validation.sh [--skip-typescript]
#
# Validations effectuées:
#   1. Validation schema .env.template
#   2. Validation configuration RAG
#   3. TypeScript type check (optionnel)
#
# Exit codes:
#   0 = Validations réussies
#   1 = Validation échouée
# ============================================================================

set -euo pipefail

# ----------------------------------------------------------------------------
# Arguments
# ----------------------------------------------------------------------------

SKIP_TYPESCRIPT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-typescript)
            SKIP_TYPESCRIPT=true
            shift
            ;;
        *)
            echo "❌ Argument inconnu: $1"
            echo "Usage: $0 [--skip-typescript]"
            exit 1
            ;;
    esac
done

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------

ENV_TEMPLATE=".env.template"
VALIDATION_FAILED=false

# ----------------------------------------------------------------------------
# Fonctions
# ----------------------------------------------------------------------------

log_section() {
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
}

log_info() {
    echo "ℹ️  $1"
}

log_success() {
    echo "✅ $1"
}

log_error() {
    echo "❌ $1"
}

# ----------------------------------------------------------------------------
# Validation 1: Schema .env.template
# ----------------------------------------------------------------------------

validate_env_schema() {
    log_section "VALIDATION 1: SCHEMA .env.template"

    if [ ! -f "$ENV_TEMPLATE" ]; then
        log_error "Fichier template introuvable: $ENV_TEMPLATE"
        return 1
    fi

    log_info "Vérification template: $ENV_TEMPLATE"

    # Variables critiques requises
    local required_vars=(
        "DATABASE_URL"
        "NEXTAUTH_SECRET"
        "MINIO_ACCESS_KEY"
        "MINIO_SECRET_KEY"
        "REDIS_URL"
        "RAG_ENABLED"
        "OLLAMA_ENABLED"
        "RAG_THRESHOLD_KB"
    )

    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$ENV_TEMPLATE"; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Variables manquantes dans template:"
        for var in "${missing_vars[@]}"; do
            echo "  ❌ $var"
        done
        return 1
    fi

    # Vérifier seuils RAG optimisés
    local threshold_kb=$(grep "^RAG_THRESHOLD_KB=" "$ENV_TEMPLATE" | cut -d'=' -f2)

    if [ -n "$threshold_kb" ]; then
        log_info "RAG_THRESHOLD_KB=$threshold_kb"

        # Warning si seuil > 0.50 (non optimisé pour arabe)
        if (( $(echo "$threshold_kb > 0.50" | bc -l 2>/dev/null || echo 0) )); then
            log_error "RAG_THRESHOLD_KB=$threshold_kb trop élevé (recommandé: 0.30 pour embeddings arabes)"
            return 1
        fi
    fi

    log_success "Schema .env.template valide"
    return 0
}

# ----------------------------------------------------------------------------
# Validation 2: Configuration RAG
# ----------------------------------------------------------------------------

validate_rag_config() {
    log_section "VALIDATION 2: CONFIGURATION RAG"

    if [ ! -f "$ENV_TEMPLATE" ]; then
        log_error "Fichier template introuvable: $ENV_TEMPLATE"
        return 1
    fi

    # Charger variables depuis template
    local rag_enabled=$(grep "^RAG_ENABLED=" "$ENV_TEMPLATE" | cut -d'=' -f2)
    local ollama_enabled=$(grep "^OLLAMA_ENABLED=" "$ENV_TEMPLATE" | cut -d'=' -f2)

    log_info "RAG_ENABLED=$rag_enabled"
    log_info "OLLAMA_ENABLED=$ollama_enabled"

    # Vérifier cohérence
    if [ "$rag_enabled" = "true" ]; then
        if [ "$ollama_enabled" != "true" ]; then
            # Vérifier si OPENAI_API_KEY présent (commentaire ou placeholder)
            if ! grep -q "OPENAI_API_KEY=" "$ENV_TEMPLATE"; then
                log_error "RAG activé mais aucun provider embeddings configuré"
                log_error "Configurer: OLLAMA_ENABLED=true OU OPENAI_API_KEY"
                return 1
            fi
        fi

        log_success "Configuration RAG cohérente"
    else
        log_info "RAG désactivé (skip validation)"
    fi

    return 0
}

# ----------------------------------------------------------------------------
# Validation 3: TypeScript Type Check
# ----------------------------------------------------------------------------

validate_typescript() {
    log_section "VALIDATION 3: TYPESCRIPT TYPE CHECK"

    if [ "$SKIP_TYPESCRIPT" = true ]; then
        log_info "Skip TypeScript (--skip-typescript activé)"
        return 0
    fi

    log_info "Exécution: npx tsc --noEmit"

    if npx tsc --noEmit; then
        log_success "TypeScript type check réussi"
        return 0
    else
        log_error "TypeScript type check échoué"
        return 1
    fi
}

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

main() {
    log_section "PRE-DEPLOY VALIDATION CONSOLIDÉE"
    log_info "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

    # Validation 1: Schema
    if ! validate_env_schema; then
        log_error "Validation schema échouée"
        VALIDATION_FAILED=true
    fi

    # Validation 2: RAG Config
    if ! validate_rag_config; then
        log_error "Validation RAG échouée"
        VALIDATION_FAILED=true
    fi

    # Validation 3: TypeScript
    if ! validate_typescript; then
        log_error "Validation TypeScript échouée"
        VALIDATION_FAILED=true
    fi

    # Rapport final
    echo ""
    log_section "RÉSULTAT VALIDATION"

    if [ "$VALIDATION_FAILED" = true ]; then
        log_error "Validation pré-déploiement ÉCHOUÉE"
        log_error "Corriger les erreurs ci-dessus avant déploiement"
        exit 1
    else
        log_success "Toutes les validations réussies ✅"
        log_success "Prêt pour déploiement"
        exit 0
    fi
}

main
