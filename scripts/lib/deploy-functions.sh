#!/bin/bash
# ============================================================================
# LIBRARY FONCTIONS DÉPLOIEMENT - CONSOLIDÉE
# ============================================================================
# Fonctions réutilisables pour tous les scripts de déploiement
# Consolidation depuis: deploy-with-lock.sh, pre-deploy-check.sh,
# validate-rag-config.sh, rollback-deploy.sh, workflow GHA
#
# Usage:
#   source scripts/lib/deploy-functions.sh
#   acquire_deployment_lock
#   validate_environment_config
#   # ... autres fonctions
#
# Pattern: Export toutes les fonctions (comme cron-logger.sh)
# ============================================================================

set -euo pipefail

# Source configuration centralisée
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/deploy-config.sh"

# ----------------------------------------------------------------------------
# Couleurs & Logging
# ----------------------------------------------------------------------------

# Couleurs (désactivées si non-TTY)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    MAGENTA='\033[0;35m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
    MAGENTA=''
    NC=''
fi

# Fonctions logging
log_section() {
    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  $1${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

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

log_debug() {
    if [ "${DEBUG:-false}" = "true" ]; then
        echo -e "${CYAN}🔍 [DEBUG] $1${NC}"
    fi
}

# ----------------------------------------------------------------------------
# Lock Management (consolidé depuis deploy-with-lock.sh)
# ----------------------------------------------------------------------------

LOCK_ACQUIRED=false

acquire_deployment_lock() {
    local timeout="${1:-$LOCK_TIMEOUT}"
    local lock_file="$LOCK_FILE"
    local lock_info_file="$LOCK_INFO_FILE"

    log_info "Tentative d'acquisition du verrou déploiement..."
    log_debug "Lock file: $lock_file (timeout: ${timeout}s)"

    # Créer dossier lock si inexistant
    local lock_dir="$(dirname "$lock_file")"
    if [ ! -d "$lock_dir" ]; then
        mkdir -p "$lock_dir" 2>/dev/null || {
            log_warning "Impossible de créer $lock_dir (permissions?)"
            return 0  # Continue sans lock si impossible
        }
    fi

    # Acquérir lock avec flock (timeout)
    exec 200>"$lock_file"
    if flock -w "$timeout" 200; then
        LOCK_ACQUIRED=true

        # Écrire métadonnées lock
        cat > "$lock_info_file" <<EOF
PID=$$
USER=${USER:-unknown}
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
COMMAND=$0 $*
EOF

        log_success "Verrou acquis avec succès (PID: $$)"
        return 0
    else
        log_error "Impossible d'acquérir le verrou après ${timeout}s"
        log_info "Un autre déploiement est peut-être en cours"

        # Afficher info lock actuel si disponible
        if [ -f "$lock_info_file" ]; then
            log_warning "Informations verrou actuel:"
            cat "$lock_info_file" | while read line; do
                echo "  $line"
            done
        fi

        return 1
    fi
}

release_deployment_lock() {
    if [ "$LOCK_ACQUIRED" = true ]; then
        log_info "Libération du verrou déploiement..."

        # Supprimer info file
        rm -f "$LOCK_INFO_FILE" 2>/dev/null || true

        # Libérer lock (flock libère automatiquement à la fermeture du FD 200)
        exec 200>&-

        LOCK_ACQUIRED=false
        log_success "Verrou libéré"
    fi
}

# ----------------------------------------------------------------------------
# Validation Environment (consolidé depuis pre-deploy-check.sh)
# ----------------------------------------------------------------------------

validate_environment_config() {
    local env_file="${1:-.env}"

    log_info "Validation configuration environnement: $env_file"

    # Vérifier fichier existe
    if [ ! -f "$env_file" ]; then
        log_error "Fichier environnement introuvable: $env_file"
        return 1
    fi

    local missing_vars=()
    local warnings=()

    # Charger variables depuis fichier (sans export)
    set -a
    source "$env_file"
    set +a

    # Vérifier variables requises
    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing_vars+=("$var")
        fi
    done

    # Vérifier cohérence RAG
    if [ "${RAG_ENABLED:-false}" = "true" ]; then
        if [ "${OLLAMA_ENABLED:-false}" = "false" ] && [ -z "${OPENAI_API_KEY:-}" ]; then
            missing_vars+=("OLLAMA_ENABLED=true OU OPENAI_API_KEY")
            warnings+=("RAG activé mais aucun provider embeddings configuré")
        fi
    fi

    # Rapport
    if [ ${#warnings[@]} -gt 0 ]; then
        log_warning "Avertissements configuration:"
        for warning in "${warnings[@]}"; do
            echo "  ⚠️  $warning"
        done
    fi

    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Variables critiques manquantes:"
        for var in "${missing_vars[@]}"; do
            echo "  ❌ $var"
        done
        return 1
    fi

    log_success "Configuration environnement valide"
    return 0
}

# ----------------------------------------------------------------------------
# Validation RAG (consolidé depuis validate-rag-config.sh)
# ----------------------------------------------------------------------------

validate_rag_config() {
    local env_file="${1:-.env}"

    log_info "Validation configuration RAG..."

    # Charger variables
    set -a
    source "$env_file"
    set +a

    local errors=()

    # Vérifier RAG_ENABLED
    if [ "${RAG_ENABLED:-}" != "true" ]; then
        log_warning "RAG désactivé (RAG_ENABLED=$RAG_ENABLED)"
        return 0  # Pas d'erreur si RAG désactivé volontairement
    fi

    # Vérifier provider embeddings
    local has_provider=false

    if [ "${OLLAMA_ENABLED:-}" = "true" ]; then
        has_provider=true
        log_info "  ✓ Provider embeddings: Ollama (${OLLAMA_EMBEDDING_MODEL:-qwen3-embedding:0.6b})"
    fi

    if [ -n "${OPENAI_API_KEY:-}" ]; then
        has_provider=true
        log_info "  ✓ Provider embeddings: OpenAI (${OPENAI_EMBEDDING_MODEL:-text-embedding-3-small})"
    fi

    if [ "$has_provider" = false ]; then
        errors+=("RAG_ENABLED=true mais aucun provider embeddings configuré")
        errors+=("Configurer: OLLAMA_ENABLED=true OU OPENAI_API_KEY")
    fi

    # Vérifier seuils RAG optimisés
    local threshold_kb="${RAG_THRESHOLD_KB:-0.65}"
    if (( $(echo "$threshold_kb > 0.50" | bc -l) )); then
        log_warning "  ⚠️  RAG_THRESHOLD_KB=$threshold_kb (élevé, recommandé: 0.30 pour arabe)"
    else
        log_info "  ✓ RAG_THRESHOLD_KB=$threshold_kb (optimisé)"
    fi

    # Rapport
    if [ ${#errors[@]} -gt 0 ]; then
        log_error "Configuration RAG invalide:"
        for error in "${errors[@]}"; do
            echo "  ❌ $error"
        done
        return 1
    fi

    log_success "Configuration RAG valide"
    return 0
}

# ----------------------------------------------------------------------------
# Backup Container (avant déploiement)
# ----------------------------------------------------------------------------

backup_container_prod() {
    local container_name="${1:-$CONTAINER_NEXTJS}"
    local backup_dir="${2:-$ROLLBACK_BACKUP_DIR}"

    log_info "Backup container production: $container_name"

    # Créer dossier backup
    ssh $VPS_SSH_OPTS "$VPS_USER@$VPS_HOST" "mkdir -p $backup_dir"

    # Timestamp backup
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/${container_name}_${timestamp}.tar"

    # Vérifier container existe
    if ! ssh $VPS_SSH_OPTS "$VPS_USER@$VPS_HOST" "docker ps -a --filter name=$container_name --format '{{.Names}}' | grep -q $container_name"; then
        log_warning "Container $container_name introuvable, skip backup"
        return 0
    fi

    # Backup container (docker cp + tar)
    log_info "Création archive backup: $backup_file"

    ssh $VPS_SSH_OPTS "$VPS_USER@$VPS_HOST" "docker export $container_name | gzip > ${backup_file}.gz"

    if [ $? -eq 0 ]; then
        log_success "Backup créé: ${backup_file}.gz"

        # Nettoyer anciens backups (conserver les N derniers)
        log_info "Nettoyage anciens backups (conserver ${ROLLBACK_KEEP_BACKUPS} derniers)..."
        ssh $VPS_SSH_OPTS "$VPS_USER@$VPS_HOST" "cd $backup_dir && ls -t ${container_name}_*.tar.gz | tail -n +$((ROLLBACK_KEEP_BACKUPS + 1)) | xargs -r rm -f"

        return 0
    else
        log_error "Échec backup container"
        return 1
    fi
}

backup_container_local() {
    local container_name="${1:-$CONTAINER_NEXTJS}"
    local backup_dir="${2:-$BACKUP_DIR_DEV}"

    log_info "Backup container local: $container_name"

    mkdir -p "$backup_dir"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/${container_name}_${timestamp}.tar.gz"

    if ! docker ps -a --filter name=$container_name --format '{{.Names}}' | grep -q $container_name; then
        log_warning "Container $container_name introuvable, skip backup"
        return 0
    fi

    docker export $container_name | gzip > "$backup_file"

    if [ $? -eq 0 ]; then
        log_success "Backup créé: $backup_file"
        return 0
    else
        log_error "Échec backup container"
        return 1
    fi
}

# ----------------------------------------------------------------------------
# Health Check avec Retry (consolidé depuis workflow GHA)
# ----------------------------------------------------------------------------

health_check_with_retry() {
    local url="$1"
    local retries="${2:-$HEALTH_CHECK_RETRIES}"
    local delay="${3:-$HEALTH_CHECK_DELAY}"
    local initial_wait="${4:-$HEALTH_CHECK_INITIAL_WAIT}"

    log_info "Health check: $url"
    log_info "  Retries: $retries × ${delay}s (wait initial: ${initial_wait}s)"

    # Attente initiale (Docker start_period)
    if [ "$initial_wait" -gt 0 ]; then
        log_info "Attente initiale ${initial_wait}s (Docker start_period)..."
        sleep "$initial_wait"
    fi

    # Tentatives avec retry
    local attempt=1
    while [ $attempt -le $retries ]; do
        log_info "Tentative $attempt/$retries..."

        # Appel HTTP avec timeout
        local response
        local http_code

        response=$(curl -s -w "\n%{http_code}" --max-time "$HEALTH_CHECK_TIMEOUT" "$url" 2>&1)
        http_code=$(echo "$response" | tail -n1)
        local body=$(echo "$response" | head -n-1)

        # Vérifier HTTP 200
        if [ "$http_code" = "200" ]; then
            # Validation JSON stricte
            local status=$(echo "$body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

            if [ "$status" = "$HEALTH_CHECK_EXPECTED_STATUS" ]; then
                log_success "Health check réussi (status: $status)"
                log_debug "Response: $body"
                return 0
            else
                log_warning "HTTP 200 mais status=$status (attendu: $HEALTH_CHECK_EXPECTED_STATUS)"
            fi
        else
            log_warning "HTTP $http_code (attendu: 200)"
            log_debug "Response: $body"
        fi

        # Retry delay
        if [ $attempt -lt $retries ]; then
            log_info "Attente ${delay}s avant retry..."
            sleep "$delay"
        fi

        attempt=$((attempt + 1))
    done

    log_error "Health check échoué après $retries tentatives"
    return 1
}

# ----------------------------------------------------------------------------
# Rollback (restauration version précédente)
# ----------------------------------------------------------------------------

rollback_to_previous_version() {
    local env="${1:-prod}"
    local container_name="${2:-$CONTAINER_NEXTJS}"

    log_section "ROLLBACK VERSION PRÉCÉDENTE"
    log_warning "Restauration du backup le plus récent..."

    if [ "$env" = "prod" ]; then
        rollback_prod_container "$container_name"
    else
        rollback_local_container "$container_name"
    fi
}

rollback_prod_container() {
    local container_name="$1"
    local backup_dir="$ROLLBACK_BACKUP_DIR"

    # Trouver backup le plus récent
    local latest_backup
    latest_backup=$(ssh $VPS_SSH_OPTS "$VPS_USER@$VPS_HOST" "ls -t $backup_dir/${container_name}_*.tar.gz 2>/dev/null | head -1")

    if [ -z "$latest_backup" ]; then
        log_error "Aucun backup trouvé dans $backup_dir"
        return 1
    fi

    log_info "Backup trouvé: $latest_backup"

    # Arrêter container actuel
    log_info "Arrêt container: $container_name"
    ssh $VPS_SSH_OPTS "$VPS_USER@$VPS_HOST" "docker stop $container_name || true"
    ssh $VPS_SSH_OPTS "$VPS_USER@$VPS_HOST" "docker rm $container_name || true"

    # Restaurer depuis backup
    log_info "Restauration backup..."
    ssh $VPS_SSH_OPTS "$VPS_USER@$VPS_HOST" "zcat $latest_backup | docker import - ${container_name}:rollback"

    # Redémarrer avec docker compose
    log_info "Redémarrage via docker compose..."
    ssh $VPS_SSH_OPTS "$VPS_USER@$VPS_HOST" "cd $DEPLOY_DIR_PROD && docker compose up -d --no-deps $container_name"

    # Health check
    local health_url=$(get_health_check_url prod)
    if health_check_with_retry "$health_url"; then
        log_success "Rollback réussi - Application opérationnelle"
        return 0
    else
        log_error "Rollback échoué - Health check failed"
        return 1
    fi
}

rollback_local_container() {
    local container_name="$1"
    local backup_dir="$BACKUP_DIR_DEV"

    local latest_backup=$(ls -t "$backup_dir/${container_name}_"*.tar.gz 2>/dev/null | head -1)

    if [ -z "$latest_backup" ]; then
        log_error "Aucun backup trouvé dans $backup_dir"
        return 1
    fi

    log_info "Backup trouvé: $latest_backup"

    docker stop "$container_name" || true
    docker rm "$container_name" || true

    zcat "$latest_backup" | docker import - "${container_name}:rollback"

    cd "$DEPLOY_DIR_DEV"
    docker compose up -d --no-deps "$container_name"

    local health_url=$(get_health_check_url dev)
    health_check_with_retry "$health_url"
}

# ----------------------------------------------------------------------------
# Build Next.js
# ----------------------------------------------------------------------------

build_nextjs() {
    log_info "Build Next.js application..."

    # Nettoyer build précédent
    if [ -d "$BUILD_DIR" ]; then
        log_info "Nettoyage build précédent..."
        rm -rf "$BUILD_DIR"
    fi

    # Build production
    log_info "Exécution: npm run build"

    if npm run build; then
        log_success "Build Next.js réussi"

        # Vérifier répertoire standalone
        if [ ! -d "$BUILD_STANDALONE_DIR" ]; then
            log_error "Répertoire standalone introuvable: $BUILD_STANDALONE_DIR"
            return 1
        fi

        return 0
    else
        log_error "Échec build Next.js"
        return 1
    fi
}

# ----------------------------------------------------------------------------
# Cleanup (appelé à la fin ou en cas d'erreur)
# ----------------------------------------------------------------------------

cleanup_on_exit() {
    log_info "Nettoyage..."
    release_deployment_lock
}

cleanup_on_error() {
    log_error "Erreur détectée - Nettoyage et sortie"
    release_deployment_lock
    exit 1
}

# ----------------------------------------------------------------------------
# Export toutes les fonctions (pattern cron-logger.sh)
# ----------------------------------------------------------------------------

export -f log_section
export -f log_info
export -f log_success
export -f log_warning
export -f log_error
export -f log_debug

export -f acquire_deployment_lock
export -f release_deployment_lock

export -f validate_environment_config
export -f validate_rag_config

export -f backup_container_prod
export -f backup_container_local

export -f health_check_with_retry

export -f rollback_to_previous_version
export -f rollback_prod_container
export -f rollback_local_container

export -f build_nextjs

export -f cleanup_on_exit
export -f cleanup_on_error

# ----------------------------------------------------------------------------
# Info
# ----------------------------------------------------------------------------

log_debug "deploy-functions.sh loaded ($(grep -c '^export -f' "$BASH_SOURCE") functions exported)"
