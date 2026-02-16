#!/bin/bash
# Synchronisation Base de Données Production → Développement
# Usage: ./sync-db-prod-to-dev.sh [--skip-backup] [--tables "table1,table2"]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$HOME/.claude/backups/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROD_HOST="${VPS_HOST:-84.247.165.187}"
PROD_USER="${VPS_USER:-root}"
PROD_DB="qadhya"
PROD_DB_USER="moncabinet"

LOCAL_DB="qadhya"
LOCAL_DB_USER="postgres"
LOCAL_PORT="5433"

SKIP_BACKUP=false
TABLES_FILTER=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --tables)
      TABLES_FILTER="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Option inconnue: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     SYNCHRONISATION DB PRODUCTION → DÉVELOPPEMENT             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Vérifier que PostgreSQL local tourne
if ! docker exec qadhya-postgres pg_isready -U postgres > /dev/null 2>&1; then
  echo -e "${RED}❌ PostgreSQL local non accessible (container qadhya-postgres)${NC}"
  echo -e "${YELLOW}💡 Démarrez Docker : docker-compose up -d postgres${NC}"
  exit 1
fi

# Créer répertoire backup
mkdir -p "$BACKUP_DIR"

# 1. BACKUP BASE LOCALE (sauf si --skip-backup)
if [ "$SKIP_BACKUP" = false ]; then
  echo -e "${YELLOW}▓▓▓ 1. BACKUP BASE LOCALE ▓▓▓${NC}"
  BACKUP_FILE="$BACKUP_DIR/local_backup_${TIMESTAMP}.sql.gz"

  echo "Sauvegarde de la base locale..."
  PGPASSWORD=postgres pg_dump -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB \
    --no-owner --no-acl | gzip > "$BACKUP_FILE"

  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo -e "${GREEN}✅ Backup local sauvegardé: $BACKUP_FILE ($BACKUP_SIZE)${NC}"
  echo ""
else
  echo -e "${YELLOW}⚠️  Backup local ignoré (--skip-backup)${NC}"
  echo ""
fi

# 2. DUMP BASE PRODUCTION
echo -e "${YELLOW}▓▓▓ 2. DUMP BASE PRODUCTION ▓▓▓${NC}"
DUMP_FILE="$BACKUP_DIR/prod_dump_${TIMESTAMP}.sql"

echo "Connexion à la production via SSH..."

if [ -n "$TABLES_FILTER" ]; then
  echo "Dump de tables spécifiques: $TABLES_FILTER"
  TABLES_ARG=$(echo "$TABLES_FILTER" | tr ',' ' ' | xargs -n1 echo "-t" | tr '\n' ' ')

  ssh "$PROD_USER@$PROD_HOST" "docker exec -i qadhya-postgres pg_dump -U $PROD_DB_USER -d $PROD_DB --no-owner --no-acl $TABLES_ARG" > "$DUMP_FILE"
else
  echo "Dump de toute la base..."

  ssh "$PROD_USER@$PROD_HOST" "docker exec -i qadhya-postgres pg_dump -U $PROD_DB_USER -d $PROD_DB --no-owner --no-acl" > "$DUMP_FILE"
fi

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo -e "${GREEN}✅ Dump production récupéré: $DUMP_FILE ($DUMP_SIZE)${NC}"
echo ""

# 3. RESTAURATION EN LOCAL
echo -e "${YELLOW}▓▓▓ 3. RESTAURATION EN LOCAL ▓▓▓${NC}"

# Terminer les connexions actives
echo "Fermeture des connexions actives..."
PGPASSWORD=postgres psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$LOCAL_DB' AND pid <> pg_backend_pid();
" > /dev/null 2>&1 || true

# Drop et recréer la base
echo "Recréation de la base locale..."
PGPASSWORD=postgres dropdb -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER --if-exists $LOCAL_DB 2>/dev/null || true
PGPASSWORD=postgres createdb -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER $LOCAL_DB

# Restaurer le dump
echo "Restauration du dump..."
PGPASSWORD=postgres psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB -f "$DUMP_FILE" > /dev/null 2>&1

echo -e "${GREEN}✅ Base restaurée avec succès${NC}"
echo ""

# 4. VÉRIFICATIONS
echo -e "${YELLOW}▓▓▓ 4. VÉRIFICATIONS ▓▓▓${NC}"

# Compter les tables
TABLES_COUNT=$(PGPASSWORD=postgres psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB -t -c "
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
")

echo "Tables dans la base locale: $(echo $TABLES_COUNT | xargs)"

# Quelques stats
echo ""
echo "Statistiques:"
PGPASSWORD=postgres psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB -t << 'SQL'
SELECT
  'Users' as table_name,
  COUNT(*)::text as count
FROM users
UNION ALL
SELECT
  'Knowledge Base',
  COUNT(*)::text
FROM knowledge_base
UNION ALL
SELECT
  'KB Chunks',
  COUNT(*)::text
FROM knowledge_base_chunks;
SQL

echo ""
echo -e "${GREEN}✅ SYNCHRONISATION TERMINÉE${NC}"
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                      FICHIERS SAUVEGARDÉS                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
if [ "$SKIP_BACKUP" = false ]; then
  echo "📦 Backup local:      $BACKUP_FILE"
fi
echo "📦 Dump production:   $DUMP_FILE"
echo ""
echo -e "${YELLOW}💡 Pour restaurer le backup local en cas de problème:${NC}"
echo "   gunzip -c $BACKUP_FILE | PGPASSWORD=postgres psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB"
