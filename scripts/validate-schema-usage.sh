#!/bin/bash
#
# Script de validation schema - Détecte usages incorrects colonnes content
#
# Usage: ./scripts/validate-schema-usage.sh
#
# Exit codes:
#   0 = Aucune erreur
#   1 = Erreurs détectées
#

set -e

echo "🔍 Validation Schéma Base de Données - Colonnes Content"
echo ""

ERRORS=0

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# CHECK 1: kbc.content_chunk (incorrect)
# ============================================================================

echo "📋 CHECK 1: Recherche usages incorrects 'kbc.content_chunk'..."

INCORRECT_KB=$(grep -rn "kbc\.content_chunk" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.sql" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist \
  --exclude="validate-schema-usage.sh" \
  --exclude="SCHEMA_COLUMNS_REFERENCE.md" \
  . 2>/dev/null | grep -v "kbc.content AS chunk_content" || true)

if [ -n "$INCORRECT_KB" ]; then
  echo -e "${RED}❌ Erreurs détectées${NC}: kbc.content_chunk utilisé au lieu de kbc.content\n"
  echo "$INCORRECT_KB"
  echo ""
  echo -e "${YELLOW}💡 Solution${NC}: Remplacer par 'kbc.content' ou 'kbc.content AS chunk_content'"
  echo ""
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ Aucun usage incorrect de kbc.content_chunk${NC}"
fi

echo ""

# ============================================================================
# CHECK 2: de.content[^_] (incorrect - doit être de.content_chunk)
# ============================================================================

echo "📋 CHECK 2: Recherche usages incorrects 'de.content' (sans _chunk)..."

INCORRECT_DE=$(grep -rn "de\.content[^_]" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.sql" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist \
  --exclude="validate-schema-usage.sh" \
  --exclude="SCHEMA_COLUMNS_REFERENCE.md" \
  . 2>/dev/null | grep "document_embeddings" | grep -v "de.content_chunk" || true)

if [ -n "$INCORRECT_DE" ]; then
  echo -e "${RED}❌ Erreurs détectées${NC}: de.content utilisé au lieu de de.content_chunk\n"
  echo "$INCORRECT_DE"
  echo ""
  echo -e "${YELLOW}💡 Solution${NC}: Remplacer par 'de.content_chunk'"
  echo ""
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ Aucun usage incorrect de de.content${NC}"
fi

echo ""

# ============================================================================
# CHECK 3: Migrations SQL non testées
# ============================================================================

echo "📋 CHECK 3: Vérification migrations récentes..."

# Chercher migrations créées/modifiées dans les derniers commits
RECENT_MIGRATIONS=$(git diff --name-only HEAD~5 2>/dev/null | grep "migrations/.*\.sql" || true)

if [ -n "$RECENT_MIGRATIONS" ]; then
  echo -e "${YELLOW}⚠️  Migrations SQL récentes détectées${NC}:"
  echo "$RECENT_MIGRATIONS"
  echo ""
  echo "💡 Rappel: Tester localement avant commit :"
  echo "   psql -U user -d dbname -f migrations/votre-migration.sql"
  echo ""
else
  echo -e "${GREEN}✅ Aucune migration récente${NC}"
fi

echo ""

# ============================================================================
# RÉSUMÉ
# ============================================================================

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}❌ VALIDATION ÉCHOUÉE${NC}: $ERRORS erreur(s) détectée(s)"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "📚 Documentation: docs/SCHEMA_COLUMNS_REFERENCE.md"
  echo ""
  echo "Règles:"
  echo "  • knowledge_base_chunks → kbc.content"
  echo "  • document_embeddings   → de.content_chunk"
  echo ""
  exit 1
else
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✅ VALIDATION RÉUSSIE${NC}: Aucune erreur détectée"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  exit 0
fi
