#!/bin/bash
# =============================================================================
# Fix Production Config - Modification sécurisée variable production
# =============================================================================
# Fix variable production via SSH + restart container + health check
#
# Usage:
#   bash scripts/fix-prod-config.sh OLLAMA_ENABLED true
#   bash scripts/fix-prod-config.sh OPENAI_API_KEY sk-proj-...
#   bash scripts/fix-prod-config.sh RAG_MAX_RESULTS 10
#
# Features:
# - Backup automatique avant modification
# - Modification via sed sécurisée (préserve formatage)
# - Restart container Next.js uniquement (pas toute la stack)
# - Health check post-restart (60s timeout)
# - Rollback automatique si health check échoue
# =============================================================================

set -e  # Exit on error

# Configuration
VPS_HOST="84.247.165.187"
VPS_USER="root"
ENV_FILE="/opt/qadhya/.env.production.local"
HEALTH_CHECK_URL="https://qadhya.tn/api/health"
HEALTH_CHECK_TIMEOUT=60
CONTAINER_NAME="qadhya-nextjs"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Fonctions utilitaires
# =============================================================================

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

# =============================================================================
# Validation arguments
# =============================================================================

if [ $# -lt 2 ]; then
  log_error "Arguments manquants"
  echo ""
  echo "Usage: $0 VARIABLE_NAME NEW_VALUE"
  echo ""
  echo "Exemples:"
  echo "  $0 OLLAMA_ENABLED true"
  echo "  $0 OLLAMA_BASE_URL http://host.docker.internal:11434"
  echo "  $0 RAG_MAX_RESULTS 10"
  echo ""
  exit 1
fi

VAR_NAME=$1
NEW_VALUE=$2

log_info "Fix production config: ${VAR_NAME}=${NEW_VALUE}"

# =============================================================================
# Backup automatique
# =============================================================================

log_info "Création backup..."

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${ENV_FILE}.backup.${TIMESTAMP}"

ssh ${VPS_USER}@${VPS_HOST} "cp ${ENV_FILE} ${BACKUP_PATH}" 2>/dev/null

if [ $? -eq 0 ]; then
  log_success "Backup créé: ${BACKUP_PATH}"
else
  log_error "Échec création backup"
  exit 1
fi

# =============================================================================
# Récupérer valeur actuelle
# =============================================================================

log_info "Récupération valeur actuelle..."

CURRENT_VALUE=$(ssh ${VPS_USER}@${VPS_HOST} "grep '^${VAR_NAME}=' ${ENV_FILE} | cut -d'=' -f2-" 2>/dev/null)

if [ -z "$CURRENT_VALUE" ]; then
  log_warning "Variable ${VAR_NAME} non trouvée dans ${ENV_FILE}"
  log_info "Ajout nouvelle variable..."
  ADD_MODE=true
else
  log_info "Valeur actuelle: ${VAR_NAME}=${CURRENT_VALUE}"
  ADD_MODE=false
fi

# =============================================================================
# Modification sécurisée
# =============================================================================

log_info "Modification variable..."

if [ "$ADD_MODE" = true ]; then
  # Ajouter variable (chercher section appropriée)
  # Sections connues: RAG Configuration, Database, IA / LLM Configuration

  SECTION=""
  case "$VAR_NAME" in
    RAG_*|OLLAMA_*)
      SECTION="# RAG Configuration"
      ;;
    DATABASE_*|DB_*)
      SECTION="# Database PostgreSQL"
      ;;
    GROQ_*|OPENAI_*|ANTHROPIC_*|DEEPSEEK_*)
      SECTION="# IA / LLM Configuration"
      ;;
  esac

  if [ -n "$SECTION" ]; then
    # Ajouter après section header
    ssh ${VPS_USER}@${VPS_HOST} "sed -i '/${SECTION}/a ${VAR_NAME}=${NEW_VALUE}' ${ENV_FILE}"
  else
    # Ajouter à la fin
    ssh ${VPS_USER}@${VPS_HOST} "echo '${VAR_NAME}=${NEW_VALUE}' >> ${ENV_FILE}"
  fi
else
  # Remplacer valeur existante (sed sécurisé)
  # Échapper caractères spéciaux dans NEW_VALUE
  ESCAPED_VALUE=$(echo "$NEW_VALUE" | sed 's/[\/&]/\\&/g')

  ssh ${VPS_USER}@${VPS_HOST} "sed -i 's|^${VAR_NAME}=.*$|${VAR_NAME}=${ESCAPED_VALUE}|' ${ENV_FILE}"
fi

if [ $? -eq 0 ]; then
  log_success "Variable modifiée avec succès"
else
  log_error "Échec modification variable"
  log_warning "Rollback backup..."
  ssh ${VPS_USER}@${VPS_HOST} "cp ${BACKUP_PATH} ${ENV_FILE}"
  exit 1
fi

# Vérifier modification appliquée
NEW_ACTUAL=$(ssh ${VPS_USER}@${VPS_HOST} "grep '^${VAR_NAME}=' ${ENV_FILE} | cut -d'=' -f2-" 2>/dev/null)

if [ "$NEW_ACTUAL" = "$NEW_VALUE" ]; then
  log_success "Vérification: ${VAR_NAME}=${NEW_ACTUAL}"
else
  log_error "Vérification échouée: attendu '${NEW_VALUE}', obtenu '${NEW_ACTUAL}'"
  log_warning "Rollback backup..."
  ssh ${VPS_USER}@${VPS_HOST} "cp ${BACKUP_PATH} ${ENV_FILE}"
  exit 1
fi

# =============================================================================
# Restart container Next.js
# =============================================================================

log_info "Restart container Next.js..."

ssh ${VPS_USER}@${VPS_HOST} "cd /opt/qadhya && docker compose restart ${CONTAINER_NAME}" 2>/dev/null

if [ $? -eq 0 ]; then
  log_success "Container redémarré"
else
  log_error "Échec restart container"
  log_warning "Rollback backup..."
  ssh ${VPS_USER}@${VPS_HOST} "cp ${BACKUP_PATH} ${ENV_FILE}"
  ssh ${VPS_USER}@${VPS_HOST} "cd /opt/qadhya && docker compose restart ${CONTAINER_NAME}"
  exit 1
fi

# =============================================================================
# Health check avec retry
# =============================================================================

log_info "Health check post-restart (timeout ${HEALTH_CHECK_TIMEOUT}s)..."

ELAPSED=0
INTERVAL=5
HEALTHY=false

while [ $ELAPSED -lt $HEALTH_CHECK_TIMEOUT ]; do
  log_info "Tentative health check ($((ELAPSED))s / ${HEALTH_CHECK_TIMEOUT}s)..."

  HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" ${HEALTH_CHECK_URL} 2>/dev/null || echo "000")

  if [ "$HEALTH_RESPONSE" = "200" ]; then
    # Vérifier JSON status
    HEALTH_JSON=$(curl -s ${HEALTH_CHECK_URL} 2>/dev/null || echo "{}")
    HEALTH_STATUS=$(echo "$HEALTH_JSON" | jq -r '.status' 2>/dev/null || echo "unknown")

    if [ "$HEALTH_STATUS" = "healthy" ]; then
      HEALTHY=true
      break
    else
      log_warning "API répond 200 mais status=${HEALTH_STATUS} (attendu: healthy)"
    fi
  else
    log_warning "Health check HTTP ${HEALTH_RESPONSE} (attendu: 200)"
  fi

  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

# =============================================================================
# Validation finale ou Rollback
# =============================================================================

if [ "$HEALTHY" = true ]; then
  log_success "Health check passed ✅"
  log_success "Configuration production mise à jour avec succès!"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Résumé:"
  echo "  Variable: ${VAR_NAME}"
  echo "  Ancienne valeur: ${CURRENT_VALUE:-"(non défini)"}"
  echo "  Nouvelle valeur: ${NEW_VALUE}"
  echo "  Backup: ${BACKUP_PATH}"
  echo "  Container: ${CONTAINER_NAME} (redémarré)"
  echo "  Health check: ✅ Passed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  log_info "Rollback possible avec:"
  echo "  ssh ${VPS_USER}@${VPS_HOST} \"cp ${BACKUP_PATH} ${ENV_FILE} && cd /opt/qadhya && docker compose restart ${CONTAINER_NAME}\""
  echo ""

  exit 0
else
  log_error "Health check failed après ${HEALTH_CHECK_TIMEOUT}s"
  log_warning "Rollback automatique..."

  # Restaurer backup
  ssh ${VPS_USER}@${VPS_HOST} "cp ${BACKUP_PATH} ${ENV_FILE}"

  # Restart container
  ssh ${VPS_USER}@${VPS_HOST} "cd /opt/qadhya && docker compose restart ${CONTAINER_NAME}"

  log_error "Rollback terminé - Configuration restaurée"

  echo ""
  log_error "Diagnostic requis:"
  echo "  1. Vérifier logs: ssh ${VPS_USER}@${VPS_HOST} 'docker logs ${CONTAINER_NAME} --tail 50'"
  echo "  2. Vérifier valeur: ${VAR_NAME}=${NEW_VALUE}"
  echo "  3. Tester localement d'abord"
  echo ""

  exit 1
fi
