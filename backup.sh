#!/bin/bash
#
# Script de backup automatique MonCabinet
#
# Usage: ./backup.sh
#
# Fonctionnalités:
# - Backup PostgreSQL (dump SQL)
# - Backup MinIO (documents)
# - Backup code source
# - Rotation automatique (garder 14 derniers)
# - Alerte si disque > 80%
#
# À planifier dans crontab:
# 0 3 * * * /opt/moncabinet/backup.sh >> /var/log/moncabinet-backup.log 2>&1
#

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKUP_DIR="/opt/backups/moncabinet"
DATE=$(date +%Y%m%d_%H%M%S)

# Créer dossier backups
mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}🔄 Backup MonCabinet - $DATE${NC}"

# ============================================================================
# ÉTAPE 1: Backup PostgreSQL
# ============================================================================

echo -e "${YELLOW}💾 Backup PostgreSQL...${NC}"

# Vérifier que container tourne
if ! docker ps | grep -q moncabinet-postgres; then
  echo -e "${RED}❌ Container PostgreSQL non démarré!${NC}"
  exit 1
fi

# Dump SQL compressé
docker exec moncabinet-postgres pg_dump -U moncabinet moncabinet | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_DIR/db_$DATE.sql.gz" | cut -f1)
  echo -e "${GREEN}✅ PostgreSQL backup: db_$DATE.sql.gz ($SIZE)${NC}"
else
  echo -e "${RED}❌ Échec backup PostgreSQL${NC}"
  exit 1
fi

# ============================================================================
# ÉTAPE 2: Backup MinIO (Documents)
# ============================================================================

echo -e "${YELLOW}💾 Backup MinIO...${NC}"

# Créer dossier pour ce backup
MINIO_BACKUP_DIR="$BACKUP_DIR/minio_$DATE"
mkdir -p "$MINIO_BACKUP_DIR"

# Vérifier que container MinIO tourne
if ! docker ps | grep -q moncabinet-minio; then
  echo -e "${RED}❌ Container MinIO non démarré!${NC}"
  exit 1
fi

# Mirror bucket documents via MinIO client
docker run --rm \
  --network moncabinet_moncabinet-network \
  -v "$MINIO_BACKUP_DIR:/backup" \
  -e MC_HOST_myminio="http://\${MINIO_ROOT_USER}:\${MINIO_ROOT_PASSWORD}@minio:9000" \
  minio/mc:latest \
  mirror myminio/documents /backup/documents > /dev/null 2>&1

if [ $? -eq 0 ]; then
  # Compter fichiers et taille totale
  FILE_COUNT=$(find "$MINIO_BACKUP_DIR" -type f | wc -l)
  TOTAL_SIZE=$(du -sh "$MINIO_BACKUP_DIR" | cut -f1)
  echo -e "${GREEN}✅ MinIO backup: minio_$DATE ($FILE_COUNT fichiers, $TOTAL_SIZE)${NC}"
else
  echo -e "${RED}❌ Échec backup MinIO${NC}"
  # Ne pas exit, continuer avec backup code
fi

# ============================================================================
# ÉTAPE 3: Backup Code Source
# ============================================================================

echo -e "${YELLOW}💾 Backup code source...${NC}"

# Backup tar.gz (exclure node_modules, .next, .git)
tar -czf "$BACKUP_DIR/code_$DATE.tar.gz" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='logs' \
  --exclude='*.log' \
  -C /opt moncabinet > /dev/null 2>&1

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_DIR/code_$DATE.tar.gz" | cut -f1)
  echo -e "${GREEN}✅ Code backup: code_$DATE.tar.gz ($SIZE)${NC}"
else
  echo -e "${RED}❌ Échec backup code${NC}"
fi

# ============================================================================
# ÉTAPE 4: Nettoyage Anciens Backups (garder 14 derniers)
# ============================================================================

echo -e "${YELLOW}🧹 Nettoyage anciens backups...${NC}"

# Supprimer backups PostgreSQL > 14 jours
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +14 -delete 2>/dev/null || true

# Supprimer backups code > 14 jours
find "$BACKUP_DIR" -name "code_*.tar.gz" -mtime +14 -delete 2>/dev/null || true

# Supprimer dossiers MinIO > 14 jours
find "$BACKUP_DIR" -type d -name "minio_*" -mtime +14 -exec rm -rf {} + 2>/dev/null || true

# Compter backups restants
DB_BACKUPS=$(find "$BACKUP_DIR" -name "db_*.sql.gz" | wc -l)
CODE_BACKUPS=$(find "$BACKUP_DIR" -name "code_*.tar.gz" | wc -l)
MINIO_BACKUPS=$(find "$BACKUP_DIR" -type d -name "minio_*" | wc -l)

echo -e "${GREEN}✅ Backups actuels: ${DB_BACKUPS} DB, ${CODE_BACKUPS} code, ${MINIO_BACKUPS} MinIO${NC}"

# ============================================================================
# ÉTAPE 5: Vérifier Espace Disque
# ============================================================================

echo -e "${YELLOW}💾 Vérification espace disque...${NC}"

DISK_USAGE=$(df -h /opt | tail -1 | awk '{print $5}' | sed 's/%//')
DISK_AVAILABLE=$(df -h /opt | tail -1 | awk '{print $4}')

echo "Disque utilisé: ${DISK_USAGE}% (disponible: ${DISK_AVAILABLE})"

if [ "$DISK_USAGE" -gt 80 ]; then
  echo -e "${RED}⚠️  ALERTE: Disque utilisé à ${DISK_USAGE}%!${NC}"
  echo "Espace disponible: $DISK_AVAILABLE"
  echo "Nettoyer anciens backups ou augmenter capacité disque"

  # Optionnel: Envoyer alerte email
  # echo "Disque VPS à ${DISK_USAGE}%" | mail -s "Alerte Disque MonCabinet" admin@moncabinet.tn
else
  echo -e "${GREEN}✅ Espace disque OK (${DISK_USAGE}%)${NC}"
fi

# ============================================================================
# ÉTAPE 6: Résumé Backup
# ============================================================================

echo ""
echo -e "${GREEN}✅ ============================================${NC}"
echo -e "${GREEN}✅ BACKUP TERMINÉ: $DATE${NC}"
echo -e "${GREEN}✅ ============================================${NC}"
echo ""
echo "Backup directory: $BACKUP_DIR"
echo "Backups database: $DB_BACKUPS fichiers"
echo "Backups code: $CODE_BACKUPS fichiers"
echo "Backups MinIO: $MINIO_BACKUPS dossiers"
echo "Espace disque: ${DISK_USAGE}% utilisé, ${DISK_AVAILABLE} disponible"
echo ""

# ============================================================================
# ÉTAPE 7: Statistiques Backup
# ============================================================================

BACKUP_DIR_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "Taille totale backups: $BACKUP_DIR_SIZE"

# Dernier backup de chaque type
LAST_DB=$(ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | head -1)
LAST_CODE=$(ls -t "$BACKUP_DIR"/code_*.tar.gz 2>/dev/null | head -1)
LAST_MINIO=$(ls -td "$BACKUP_DIR"/minio_* 2>/dev/null | head -1)

if [ -n "$LAST_DB" ]; then
  DB_SIZE=$(du -h "$LAST_DB" | cut -f1)
  echo "Dernier backup DB: $(basename "$LAST_DB") ($DB_SIZE)"
fi

if [ -n "$LAST_CODE" ]; then
  CODE_SIZE=$(du -h "$LAST_CODE" | cut -f1)
  echo "Dernier backup code: $(basename "$LAST_CODE") ($CODE_SIZE)"
fi

if [ -n "$LAST_MINIO" ]; then
  MINIO_SIZE=$(du -sh "$LAST_MINIO" | cut -f1)
  echo "Dernier backup MinIO: $(basename "$LAST_MINIO") ($MINIO_SIZE)"
fi

echo ""
echo -e "${GREEN}✅ Backup réussi${NC}"
