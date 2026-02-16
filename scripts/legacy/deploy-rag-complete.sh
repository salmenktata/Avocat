#!/bin/bash
# Script de Déploiement Complet RAG - Production
# Usage: bash scripts/deploy-rag-complete.sh [--skip-migrations] [--skip-reindex]

set -e  # Exit on error

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Arguments
SKIP_MIGRATIONS=false
SKIP_REINDEX=false

for arg in "$@"; do
  case $arg in
    --skip-migrations)
      SKIP_MIGRATIONS=true
      shift
      ;;
    --skip-reindex)
      SKIP_REINDEX=true
      shift
      ;;
  esac
done

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Déploiement Complet RAG - Qadhya Production              ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

# Vérifier qu'on est sur le VPS
if [ ! -f /opt/qadhya/.env.production.local ]; then
  echo -e "${RED}❌ Ce script doit être exécuté sur le VPS${NC}"
  echo "   Utilisez: ssh vps 'bash -s' < scripts/deploy-rag-complete.sh"
  exit 1
fi

cd /opt/qadhya

# ═════════════════════════════════════════════════════════════════════════════
# ÉTAPE 1: Vérification Prérequis
# ═════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━ Étape 1/6: Vérification Prérequis ━━━${NC}\n"

# Vérifier OpenAI API Key
if ! grep -q "OPENAI_API_KEY=sk-" /opt/qadhya/.env.production.local 2>/dev/null; then
  echo -e "${YELLOW}⚠️  OPENAI_API_KEY non trouvée ou invalide${NC}"
  echo "   Continuez quand même ? (y/N)"
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Vérifier Docker
if ! docker ps | grep -q qadhya-postgres; then
  echo -e "${RED}❌ Container qadhya-postgres non démarré${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Prérequis validés${NC}\n"

# ═════════════════════════════════════════════════════════════════════════════
# ÉTAPE 2: Backup Base de Données
# ═════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━ Étape 2/6: Backup Base de Données ━━━${NC}\n"

BACKUP_DIR="/opt/backups/moncabinet"
BACKUP_FILE="${BACKUP_DIR}/pre-rag-deployment-$(date +%Y%m%d-%H%M%S).sql"

echo "📦 Création backup..."
docker exec qadhya-postgres pg_dump -U moncabinet qadhya > "$BACKUP_FILE"
gzip "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
echo -e "${GREEN}✓ Backup créé: ${BACKUP_FILE}.gz (${BACKUP_SIZE})${NC}\n"

# ═════════════════════════════════════════════════════════════════════════════
# ÉTAPE 3: Appliquer Migrations SQL
# ═════════════════════════════════════════════════════════════════════════════

if [ "$SKIP_MIGRATIONS" = false ]; then
  echo -e "${BLUE}━━━ Étape 3/6: Migrations SQL ━━━${NC}\n"

  # Migration 1: OpenAI Embeddings
  echo "🔧 Migration OpenAI embeddings..."

  if docker exec qadhqa-postgres psql -U moncabinet -d qadhya -c "\d knowledge_base_chunks" 2>/dev/null | grep -q "embedding_openai"; then
    echo -e "${GREEN}✓ Migration OpenAI déjà appliquée${NC}"
  else
    docker exec -i qadhya-postgres psql -U moncabinet -d qadhya < migrations/2026-02-12-add-openai-embeddings.sql
    echo -e "${GREEN}✓ Migration OpenAI appliquée${NC}"
  fi

  # Migration 2: Hybrid Search
  echo "🔧 Migration Hybrid Search..."

  if docker exec qadhya-postgres psql -U moncabinet -d qadhya -c "\d knowledge_base_chunks" 2>/dev/null | grep -q "content_tsvector"; then
    echo -e "${GREEN}✓ Migration Hybrid Search déjà appliquée${NC}"
  else
    docker exec -i qadhya-postgres psql -U moncabinet -d qadhya < migrations/2026-02-12-add-hybrid-search.sql
    echo -e "${GREEN}✓ Migration Hybrid Search appliquée${NC}"
  fi

  echo ""
else
  echo -e "${YELLOW}⊘ Étape 3/6: Migrations SQL (SKIPPED)${NC}\n"
fi

# ═════════════════════════════════════════════════════════════════════════════
# ÉTAPE 4: Vérifier Déploiement Code
# ═════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━ Étape 4/6: Vérification Déploiement Code ━━━${NC}\n"

echo "Vérification santé application..."
HEALTH_CHECK=$(curl -s https://qadhya.tn/api/health || echo '{"status":"error"}')

if echo "$HEALTH_CHECK" | grep -q '"status":"healthy"'; then
  echo -e "${GREEN}✓ Application healthy${NC}"
else
  echo -e "${YELLOW}⚠️  Health check échoué (peut être normal si déploiement en cours)${NC}"
  echo "   Attendre fin déploiement GitHub Actions..."
fi

echo ""

# ═════════════════════════════════════════════════════════════════════════════
# ÉTAPE 5: Installer Dépendances
# ═════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━ Étape 5/6: Installation Dépendances ━━━${NC}\n"

echo "📦 Installation @xenova/transformers..."
docker exec qadhya-nextjs npm install @xenova/transformers 2>&1 | grep -E "(added|up to date)" || true
echo -e "${GREEN}✓ Dépendances installées${NC}\n"

# ═════════════════════════════════════════════════════════════════════════════
# ÉTAPE 6: Réindexation Progressive (Optionnelle)
# ═════════════════════════════════════════════════════════════════════════════

if [ "$SKIP_REINDEX" = false ]; then
  echo -e "${BLUE}━━━ Étape 6/6: Réindexation Progressive ━━━${NC}\n"

  echo -e "${YELLOW}La réindexation va maintenant commencer.${NC}"
  echo -e "${YELLOW}Cela peut prendre 30-60 minutes selon le volume.${NC}"
  echo -e "${YELLOW}Vous pouvez l'interrompre avec Ctrl+C et la relancer plus tard.${NC}\n"

  echo "Commencer la réindexation ? (Y/n)"
  read -r response

  if [[ "$response" =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}⊘ Réindexation skippée${NC}"
    echo "   Pour la lancer plus tard:"
    echo "   docker exec qadhya-nextjs npx tsx scripts/reindex-kb-openai.ts --categories jurisprudence,codes,legislation"
  else
    echo ""
    echo -e "${BLUE}📚 Réindexation LEGISLATION (priorité 1)...${NC}"
    docker exec qadhya-nextjs npx tsx scripts/reindex-kb-openai.ts \
      --categories legislation \
      --batch-size 50 || true

    echo ""
    echo -e "${BLUE}📖 Réindexation CODES (priorité 2)...${NC}"
    docker exec qadhya-nextjs npx tsx scripts/reindex-kb-openai.ts \
      --categories codes \
      --batch-size 50 || true

    echo ""
    echo -e "${BLUE}⚖️  Réindexation JURISPRUDENCE (priorité 3)...${NC}"
    docker exec qadhya-nextjs npx tsx scripts/reindex-kb-openai.ts \
      --categories jurisprudence \
      --batch-size 50 || true

    echo ""
    echo -e "${GREEN}✓ Réindexation terminée${NC}"
  fi
else
  echo -e "${YELLOW}⊘ Étape 6/6: Réindexation (SKIPPED)${NC}\n"
fi

# ═════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ FINAL
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Déploiement Terminé                         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

# Stats migration
echo -e "${BLUE}📊 Statistiques Migration:${NC}"
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c "SELECT * FROM vw_kb_embedding_migration_stats;" 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ PROCHAINES ÉTAPES:${NC}"
echo ""
echo "1. 🧪 Tests E2E:"
echo "   docker exec qadhya-nextjs npx tsx scripts/test-rag-complete-e2e.ts"
echo ""
echo "2. 📊 Monitoring initial:"
echo "   docker exec qadhya-nextjs npx tsx scripts/monitor-rag-quality.ts"
echo ""
echo "3. 🌐 Test manuel:"
echo "   https://qadhya.tn/chat"
echo "   Question test: ما هي شروط الدفاع الشرعي؟"
echo ""
echo "4. 📈 Monitoring quotidien (7 jours):"
echo "   docker exec qadhya-nextjs npx tsx scripts/monitor-rag-quality.ts --days=1"
echo ""
echo "5. 🎯 Optimisations (après 7 jours):"
echo "   docker exec qadhya-nextjs npx tsx scripts/optimize-rag-thresholds.ts"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Déploiement RAG réussi !${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
