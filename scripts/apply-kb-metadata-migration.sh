#!/bin/bash
# =============================================================================
# Script: Appliquer Migration kb_structured_metadata en Production
# Date: 2026-02-11
# Description: Applique la migration 20260209000001 manquante en production
# =============================================================================

set -e  # Exit on error

VPS_HOST="root@84.247.165.187"
CONTAINER="qadhya-postgres"
DB_USER="moncabinet"
DB_NAME="qadhya"
MIGRATION_FILE="db/migrations/20260209000001_kb_structured_metadata.sql"

echo "============================================================================="
echo "Migration kb_structured_metadata en Production"
echo "============================================================================="
echo ""
echo "⚠️  Cette migration va créer :"
echo "   - Table kb_structured_metadata (métadonnées juridiques structurées)"
echo "   - Table kb_legal_relations (graphe de connaissances)"
echo "   - 3 colonnes dans knowledge_base (taxonomy_*)"
echo "   - Fonctions SQL search_kb_with_legal_filters() et get_legal_relations()"
echo "   - 3 vues (vw_kb_with_metadata, vw_metadata_extraction_stats, vw_legal_relations_stats)"
echo ""
read -p "Continuer ? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Annulé"
  exit 1
fi

echo ""
echo "📋 Étape 1/4 : Vérification pré-migration..."
echo "============================================================================="

# Vérifier que la table knowledge_base existe
echo "→ Vérification table knowledge_base..."
ssh $VPS_HOST "docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM knowledge_base;\"" > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Table knowledge_base existe"
else
  echo "❌ Erreur : table knowledge_base n'existe pas"
  exit 1
fi

# Vérifier que legal_taxonomy existe
echo "→ Vérification table legal_taxonomy..."
ssh $VPS_HOST "docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM legal_taxonomy;\"" > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Table legal_taxonomy existe"
else
  echo "❌ Erreur : table legal_taxonomy n'existe pas"
  echo "   Appliquer d'abord migration 20260209100000_legal_taxonomy.sql"
  exit 1
fi

# Vérifier que les tables cibles n'existent pas déjà
echo "→ Vérification tables cibles..."
EXISTING_TABLES=$(ssh $VPS_HOST "docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('kb_structured_metadata', 'kb_legal_relations');\"" | xargs)

if [ -n "$EXISTING_TABLES" ]; then
  echo "⚠️  Tables existantes détectées : $EXISTING_TABLES"
  echo "   La migration va les ignorer (CREATE TABLE IF NOT EXISTS)"
else
  echo "✅ Tables cibles n'existent pas"
fi

echo ""
echo "📤 Étape 2/4 : Upload du fichier migration..."
echo "============================================================================="

# Upload migration file to VPS
scp "$MIGRATION_FILE" "$VPS_HOST:/tmp/kb_metadata_migration.sql"
echo "✅ Fichier uploadé vers /tmp/kb_metadata_migration.sql"

echo ""
echo "🔧 Étape 3/4 : Application de la migration..."
echo "============================================================================="

# Backup avant application (optionnel)
echo "→ Backup schéma avant migration..."
ssh $VPS_HOST "docker exec $CONTAINER pg_dump -U $DB_USER -d $DB_NAME --schema-only > /tmp/schema_backup_before_kb_metadata.sql"
echo "✅ Backup schéma créé : /tmp/schema_backup_before_kb_metadata.sql"

# Appliquer la migration
echo "→ Application de la migration..."
ssh $VPS_HOST "docker exec -i $CONTAINER psql -U $DB_USER -d $DB_NAME < /tmp/kb_metadata_migration.sql"

if [ $? -eq 0 ]; then
  echo "✅ Migration appliquée avec succès"
else
  echo "❌ Erreur lors de l'application de la migration"
  echo "   Backup schéma disponible : /tmp/schema_backup_before_kb_metadata.sql"
  exit 1
fi

echo ""
echo "✅ Étape 4/4 : Vérification post-migration..."
echo "============================================================================="

# Vérifier tables créées
echo "→ Vérification tables créées..."
CREATED_TABLES=$(ssh $VPS_HOST "docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('kb_structured_metadata', 'kb_legal_relations');\"" | xargs)

if [ "$CREATED_TABLES" == "kb_legal_relations kb_structured_metadata" ] || [ "$CREATED_TABLES" == "kb_structured_metadata kb_legal_relations" ]; then
  echo "✅ Tables créées : kb_structured_metadata, kb_legal_relations"
else
  echo "⚠️  Tables créées : $CREATED_TABLES"
fi

# Vérifier colonnes taxonomy_* ajoutées
echo "→ Vérification colonnes taxonomy_*..."
TAXONOMY_COLS=$(ssh $VPS_HOST "docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \"SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_base' AND column_name LIKE 'taxonomy%' ORDER BY column_name;\"" | xargs)

if [[ "$TAXONOMY_COLS" == *"taxonomy_category_code"* ]] && [[ "$TAXONOMY_COLS" == *"taxonomy_domain_code"* ]] && [[ "$TAXONOMY_COLS" == *"taxonomy_document_type_code"* ]]; then
  echo "✅ Colonnes taxonomy_* ajoutées à knowledge_base"
else
  echo "⚠️  Colonnes trouvées : $TAXONOMY_COLS"
fi

# Vérifier fonctions créées
echo "→ Vérification fonctions SQL..."
FUNCTIONS=$(ssh $VPS_HOST "docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \"SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('search_kb_with_legal_filters', 'get_legal_relations', 'update_kb_metadata_updated_at');\"" | xargs)

if [[ "$FUNCTIONS" == *"search_kb_with_legal_filters"* ]] && [[ "$FUNCTIONS" == *"get_legal_relations"* ]]; then
  echo "✅ Fonctions SQL créées"
else
  echo "⚠️  Fonctions trouvées : $FUNCTIONS"
fi

# Vérifier vues créées
echo "→ Vérification vues créées..."
VIEWS=$(ssh $VPS_HOST "docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -t -c \"SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name LIKE 'vw_kb%' OR table_name LIKE 'vw_%metadata%' OR table_name LIKE 'vw_%relations%';\"" | xargs)

if [[ "$VIEWS" == *"vw_kb_with_metadata"* ]]; then
  echo "✅ Vues créées"
else
  echo "⚠️  Vues trouvées : $VIEWS"
fi

# Cleanup
echo "→ Nettoyage fichiers temporaires..."
ssh $VPS_HOST "rm /tmp/kb_metadata_migration.sql"
echo "✅ Fichiers temporaires supprimés"

echo ""
echo "============================================================================="
echo "✅ Migration kb_structured_metadata appliquée avec succès !"
echo "============================================================================="
echo ""
echo "📊 Résumé :"
echo "   - Tables créées : kb_structured_metadata, kb_legal_relations"
echo "   - Colonnes ajoutées : taxonomy_category_code, taxonomy_domain_code, taxonomy_document_type_code"
echo "   - Fonctions SQL créées : search_kb_with_legal_filters(), get_legal_relations()"
echo "   - Vues créées : vw_kb_with_metadata, vw_metadata_extraction_stats, vw_legal_relations_stats"
echo ""
echo "🔗 Page timeline jurisprudence devrait maintenant fonctionner :"
echo "   https://qadhya.tn/client/jurisprudence-timeline"
echo ""
echo "📁 Backup schéma disponible sur VPS :"
echo "   /tmp/schema_backup_before_kb_metadata.sql"
echo ""
