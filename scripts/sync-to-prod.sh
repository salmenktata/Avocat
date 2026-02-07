#!/bin/bash

# ============================================================================
# Script de synchronisation DEV → PROD
# Exporte les données critiques de dev et les prépare pour la prod
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXPORT_DIR="$PROJECT_ROOT/exports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Synchronisation DEV → PROD${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Créer le dossier d'export
mkdir -p "$EXPORT_DIR"

# Configuration base de données DEV
DEV_DB_CONTAINER=$(docker ps -qf "name=postgres" | head -1)

if [ -z "$DEV_DB_CONTAINER" ]; then
  echo -e "${RED}❌ Container PostgreSQL non trouvé${NC}"
  exit 1
fi

echo -e "${YELLOW}📦 Export des données...${NC}"
echo ""

# 1. Export platform_config (clés API)
echo "  → platform_config (clés API)..."
docker exec -i $DEV_DB_CONTAINER psql -U moncabinet -d moncabinet -c \
  "COPY (SELECT * FROM platform_config) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/platform_config_$TIMESTAMP.csv"

# 2. Export knowledge_base
echo "  → knowledge_base (documents de connaissance)..."
docker exec -i $DEV_DB_CONTAINER psql -U moncabinet -d moncabinet -c \
  "COPY (SELECT * FROM knowledge_base) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/knowledge_base_$TIMESTAMP.csv"

# 3. Export knowledge_base_chunks (embeddings)
echo "  → knowledge_base_chunks (embeddings indexés)..."
docker exec -i $DEV_DB_CONTAINER psql -U moncabinet -d moncabinet -c \
  "COPY (SELECT * FROM knowledge_base_chunks) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/knowledge_base_chunks_$TIMESTAMP.csv"

# 4. Export knowledge_categories
echo "  → knowledge_categories..."
docker exec -i $DEV_DB_CONTAINER psql -U moncabinet -d moncabinet -c \
  "COPY (SELECT * FROM knowledge_categories) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/knowledge_categories_$TIMESTAMP.csv"

# 5. Export templates
echo "  → templates..."
docker exec -i $DEV_DB_CONTAINER psql -U moncabinet -d moncabinet -c \
  "COPY (SELECT * FROM templates) TO STDOUT WITH CSV HEADER" \
  > "$EXPORT_DIR/templates_$TIMESTAMP.csv"

echo ""
echo -e "${GREEN}✅ Export terminé!${NC}"
echo ""
echo "Fichiers créés dans $EXPORT_DIR:"
ls -la "$EXPORT_DIR"/*_$TIMESTAMP.csv

# Créer un fichier SQL d'import pour la prod
echo ""
echo -e "${YELLOW}📝 Génération du script SQL d'import...${NC}"

cat > "$EXPORT_DIR/import_to_prod_$TIMESTAMP.sql" << 'EOSQL'
-- ============================================================================
-- Script d'import DEV → PROD
-- Généré automatiquement
-- ============================================================================

-- Désactiver les triggers temporairement
SET session_replication_role = replica;

-- 1. Import platform_config
TRUNCATE platform_config CASCADE;
\copy platform_config FROM 'platform_config.csv' WITH CSV HEADER;

-- 2. Import knowledge_categories
TRUNCATE knowledge_categories CASCADE;
\copy knowledge_categories FROM 'knowledge_categories.csv' WITH CSV HEADER;

-- 3. Import knowledge_base
TRUNCATE knowledge_base CASCADE;
\copy knowledge_base FROM 'knowledge_base.csv' WITH CSV HEADER;

-- 4. Import knowledge_base_chunks
TRUNCATE knowledge_base_chunks CASCADE;
\copy knowledge_base_chunks FROM 'knowledge_base_chunks.csv' WITH CSV HEADER;

-- 5. Import templates
TRUNCATE templates CASCADE;
\copy templates FROM 'templates.csv' WITH CSV HEADER;

-- Réactiver les triggers
SET session_replication_role = DEFAULT;

-- Vérification
SELECT 'platform_config' as table_name, COUNT(*) as count FROM platform_config
UNION ALL
SELECT 'knowledge_base', COUNT(*) FROM knowledge_base
UNION ALL
SELECT 'knowledge_base_chunks', COUNT(*) FROM knowledge_base_chunks
UNION ALL
SELECT 'knowledge_categories', COUNT(*) FROM knowledge_categories
UNION ALL
SELECT 'templates', COUNT(*) FROM templates;

EOSQL

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Export terminé avec succès!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Pour importer en production:"
echo "  1. Copier le dossier exports/ vers le serveur prod"
echo "  2. Exécuter: psql -U moncabinet -d moncabinet -f import_to_prod_$TIMESTAMP.sql"
echo ""
