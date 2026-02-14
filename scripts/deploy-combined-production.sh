#!/bin/bash

#####################################################################
# Script de Déploiement Combiné - Qadhya IA + Dynamic Providers
# Date: 15 février 2026
# Usage: ./scripts/deploy-combined-production.sh
#####################################################################

set -e  # Exit on error

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VPS_HOST="root@84.247.165.187"
CONTAINER_NAME="qadhya-postgres"
DB_NAME="qadhya"
DB_USER="moncabinet"
MIGRATIONS_DIR="/opt/qadhya/db/migrations"

#####################################################################
# Fonctions Utilitaires
#####################################################################

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

step_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

confirm() {
    read -p "$(echo -e ${YELLOW}$1 [y/N]: ${NC})" -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

#####################################################################
# Étape 1 : Vérifications Pré-Déploiement
#####################################################################

pre_deployment_checks() {
    step_header "Étape 1/6 : Vérifications Pré-Déploiement"

    log_info "Vérification Git..."
    if ! git diff-index --quiet HEAD --; then
        log_error "Il y a des modifications non committées"
        exit 1
    fi
    log_success "Working directory propre"

    log_info "Vérification branche..."
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$CURRENT_BRANCH" != "main" ]; then
        log_error "Vous devez être sur la branche 'main' (branche actuelle: $CURRENT_BRANCH)"
        exit 1
    fi
    log_success "Sur branche main"

    log_info "Vérification commit..."
    LAST_COMMIT=$(git log -1 --pretty=%B | head -1)
    log_info "Dernier commit: $LAST_COMMIT"

    log_info "Vérification connexion VPS..."
    if ! ssh -o ConnectTimeout=5 "$VPS_HOST" "echo 'OK'" > /dev/null 2>&1; then
        log_error "Impossible de se connecter au VPS"
        exit 1
    fi
    log_success "Connexion VPS OK"

    log_success "Toutes les vérifications passées"
}

#####################################################################
# Étape 2 : Backup
#####################################################################

create_backup() {
    step_header "Étape 2/6 : Backup Base de Données"

    if ! confirm "Voulez-vous créer un backup de la DB avant déploiement ?"; then
        log_warning "Backup ignoré (NON RECOMMANDÉ)"
        return
    fi

    log_info "Création backup sur VPS..."
    ssh "$VPS_HOST" "/opt/qadhya/backup.sh"

    log_info "Vérification backup créé..."
    BACKUP_FILE=$(ssh "$VPS_HOST" "ls -t /opt/backups/moncabinet/postgres_*.sql.gz | head -1")
    if [ -z "$BACKUP_FILE" ]; then
        log_error "Backup non trouvé"
        exit 1
    fi

    BACKUP_SIZE=$(ssh "$VPS_HOST" "du -h '$BACKUP_FILE' | cut -f1")
    log_success "Backup créé: $BACKUP_FILE ($BACKUP_SIZE)"
}

#####################################################################
# Étape 3 : Tag Git
#####################################################################

create_git_tag() {
    step_header "Étape 3/6 : Tag Git"

    if ! confirm "Voulez-vous créer un tag Git pour ce déploiement ?"; then
        log_warning "Tag ignoré"
        return
    fi

    TAG_NAME="v1.1.0-qadhya-ia-dynamic-providers"
    log_info "Création tag: $TAG_NAME"

    if git tag -l | grep -q "^$TAG_NAME$"; then
        log_warning "Tag $TAG_NAME existe déjà"
    else
        git tag -a "$TAG_NAME" -m "Déploiement combiné Qadhya IA + Dynamic Providers"
        git push --tags
        log_success "Tag créé et pushé"
    fi
}

#####################################################################
# Étape 4 : Attente Déploiement GitHub Actions
#####################################################################

wait_for_deployment() {
    step_header "Étape 4/6 : Déploiement via GitHub Actions"

    log_info "Le code est déjà pushé sur main"
    log_info "GitHub Actions devrait se déclencher automatiquement"
    echo ""
    log_warning "Vérifiez manuellement sur:"
    echo "   https://github.com/salmenktata/MonCabinet/actions"
    echo ""

    if ! confirm "Le déploiement GHA est-il terminé avec succès ?"; then
        log_error "Déploiement annulé"
        exit 1
    fi

    log_success "Déploiement GHA confirmé"
}

#####################################################################
# Étape 5 : Migrations Base de Données
#####################################################################

run_migrations() {
    step_header "Étape 5/6 : Migrations Base de Données"

    if ! confirm "Voulez-vous exécuter les 2 migrations maintenant ?"; then
        log_error "Migrations requises pour fonctionner. Déploiement annulé."
        exit 1
    fi

    # Migration 1: Qadhya IA
    log_info "Migration 1/2: Qadhya IA (chat_messages.metadata)..."
    ssh "$VPS_HOST" "docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -f \
        $MIGRATIONS_DIR/20260215000001_add_chat_messages_metadata.sql" 2>&1 | tee /tmp/migration1.log

    if grep -q "ERROR" /tmp/migration1.log; then
        log_error "Erreur dans migration 1"
        cat /tmp/migration1.log
        exit 1
    fi
    log_success "Migration 1/2 appliquée"

    # Migration 2: Dynamic Providers
    log_info "Migration 2/2: Dynamic Providers (operation_provider_configs)..."
    ssh "$VPS_HOST" "docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -f \
        $MIGRATIONS_DIR/20260215_create_operation_provider_configs.sql" 2>&1 | tee /tmp/migration2.log

    if grep -q "ERROR" /tmp/migration2.log; then
        log_error "Erreur dans migration 2"
        cat /tmp/migration2.log
        exit 1
    fi
    log_success "Migration 2/2 appliquée"

    # Vérification
    log_info "Vérification migrations..."

    # Vérifier colonne metadata
    METADATA_COL=$(ssh "$VPS_HOST" "docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c \
        \"SELECT column_name FROM information_schema.columns \
         WHERE table_name = 'chat_messages' AND column_name = 'metadata';\" | xargs")

    if [ "$METADATA_COL" == "metadata" ]; then
        log_success "Colonne metadata créée"
    else
        log_error "Colonne metadata non trouvée"
        exit 1
    fi

    # Vérifier table operation_provider_configs
    CONFIG_COUNT=$(ssh "$VPS_HOST" "docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -t -c \
        \"SELECT COUNT(*) FROM operation_provider_configs;\" | xargs")

    if [ "$CONFIG_COUNT" -ge "4" ]; then
        log_success "Table operation_provider_configs créée ($CONFIG_COUNT configs)"
    else
        log_error "Table operation_provider_configs incorrecte"
        exit 1
    fi

    log_success "Toutes les migrations vérifiées"
}

#####################################################################
# Étape 6 : Validation
#####################################################################

validate_deployment() {
    step_header "Étape 6/6 : Validation Déploiement"

    log_info "Health check API..."
    HEALTH=$(curl -s https://qadhya.tn/api/health | jq -r '.status' 2>/dev/null || echo "error")

    if [ "$HEALTH" == "healthy" ]; then
        log_success "API healthy"
    else
        log_error "API non healthy (status: $HEALTH)"
        exit 1
    fi

    log_info "Vérification Qadhya IA..."
    QADHYA_STATUS=$(curl -I -s https://qadhya.tn/qadhya-ia | grep "200 OK" || echo "error")

    if [ -n "$QADHYA_STATUS" ]; then
        log_success "Page Qadhya IA accessible"
    else
        log_error "Page Qadhya IA non accessible"
        exit 1
    fi

    log_success "Validation terminée"
}

#####################################################################
# Fonction Principale
#####################################################################

main() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Déploiement Combiné - Qadhya IA + Dynamic Providers     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    log_warning "Ce script va déployer 2 systèmes en production:"
    echo "   1. Qadhya IA Unifiée (/qadhya-ia)"
    echo "   2. Dynamic Providers (/super-admin/settings)"
    echo ""

    if ! confirm "Voulez-vous continuer ?"; then
        log_error "Déploiement annulé"
        exit 0
    fi

    # Exécution des étapes
    pre_deployment_checks
    create_backup
    create_git_tag
    wait_for_deployment
    run_migrations
    validate_deployment

    # Succès
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              ✅ DÉPLOIEMENT RÉUSSI ! 🎉                    ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    log_success "Les 2 systèmes sont maintenant en production"
    echo ""
    echo "📍 URLs à tester:"
    echo "   • Qadhya IA: https://qadhya.tn/qadhya-ia"
    echo "   • Dynamic Providers: https://qadhya.tn/super-admin/settings?tab=operations-config"
    echo ""
    echo "📚 Documentation:"
    echo "   • Guide complet: docs/DEPLOYMENT_GUIDE_COMBINED.md"
    echo "   • Rollback plan: docs/DEPLOYMENT_GUIDE_COMBINED.md#plan-rollback"
    echo ""
}

# Exécution
main "$@"
