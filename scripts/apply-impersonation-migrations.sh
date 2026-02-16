#!/bin/bash

# Script : apply-impersonation-migrations.sh
# Description : Applique les migrations DB pour les améliorations d'impersonnalisation
# Usage : bash scripts/apply-impersonation-migrations.sh
# Date : 2026-02-16

set -euo pipefail

echo "========================================"
echo "Migrations Impersonnalisation - Qadhya"
echo "========================================"
echo ""

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-qadhya}"
DB_USER="${DB_USER:-moncabinet}"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Configuration:${NC}"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Vérifier connexion PostgreSQL
echo -e "${YELLOW}Vérification connexion PostgreSQL...${NC}"
if PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Connexion PostgreSQL OK${NC}"
else
  echo -e "${RED}✗ Erreur connexion PostgreSQL${NC}"
  echo "Vérifiez les variables d'environnement DB_HOST, DB_PORT, DB_USER, PGPASSWORD"
  exit 1
fi
echo ""

# Migration 1 : Impersonation Audit
echo -e "${YELLOW}[1/2] Migration impersonation_audit...${NC}"
if PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "db/migrations/20260216_impersonation_audit.sql" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Migration impersonation_audit appliquée${NC}"
else
  echo -e "${RED}✗ Erreur migration impersonation_audit${NC}"
  exit 1
fi

# Migration 2 : Active Impersonations
echo -e "${YELLOW}[2/2] Migration active_impersonations...${NC}"
if PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "db/migrations/20260216_active_impersonations.sql" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Migration active_impersonations appliquée${NC}"
else
  echo -e "${RED}✗ Erreur migration active_impersonations${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}========================================"
echo "✓ Toutes les migrations appliquées"
echo "========================================${NC}"
echo ""

# Vérification finale
echo -e "${YELLOW}Vérification finale...${NC}"

# Vérifier colonnes admin_audit_logs
echo -n "  Colonnes admin_audit_logs... "
if PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\d admin_audit_logs" | grep -q "is_impersonation"; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ Colonne is_impersonation manquante${NC}"
fi

# Vérifier table active_impersonations
echo -n "  Table active_impersonations... "
if PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt active_impersonations" | grep -q "active_impersonations"; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ Table active_impersonations manquante${NC}"
fi

# Vérifier index
echo -n "  Index impersonation... "
INDEX_COUNT=$(PGPASSWORD="${PGPASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE '%impersonation%';")
if [ "$INDEX_COUNT" -ge 4 ]; then
  echo -e "${GREEN}✓ ($INDEX_COUNT index créés)${NC}"
else
  echo -e "${YELLOW}⚠ Seulement $INDEX_COUNT index créés (attendu: 4+)${NC}"
fi

echo ""
echo -e "${GREEN}Migrations terminées avec succès !${NC}"
echo ""
echo "Prochaines étapes :"
echo "  1. Redémarrer l'application Next.js"
echo "  2. Configurer le cron : crontab -e"
echo "  3. Tester le dashboard : /super-admin/monitoring?tab=impersonations"
echo ""
