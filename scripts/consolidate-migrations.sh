#!/bin/bash
# Script: Consolidation migrations critiques /migrations/ → /db/migrations/
# Usage: bash scripts/consolidate-migrations.sh [--dry-run]

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "🔍 MODE DRY-RUN (simulation)"
  echo ""
fi

echo "🔧 Consolidation migrations critiques..."
echo ""

# Compteur
CONSOLIDATED=0

# Fonction consolidation
consolidate_migration() {
  local source_file="$1"
  local target_timestamp="$2"
  local target_name="$3"

  local source_path="migrations/$source_file"
  local target_filename="${target_timestamp}_${target_name}.sql"
  local target_path="db/migrations/$target_filename"

  echo "📋 Migration: $source_file"
  echo "   → Cible: $target_filename"

  if [ ! -f "$source_path" ]; then
    echo "   ⚠️  Source introuvable, skip"
    echo ""
    return
  fi

  if [ -f "$target_path" ]; then
    echo "   ⚠️  Cible existe déjà, skip"
    echo ""
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "   [DRY-RUN] Copierait: $source_path → $target_path"
    echo ""
    return
  fi

  # Copier le fichier (garder l'original pour backup)
  cp "$source_path" "$target_path"

  # Ajouter header avec contexte
  local temp_file=$(mktemp)
  cat > "$temp_file" << EOF
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration consolidée depuis /migrations/ vers /db/migrations/
-- Source originale: $source_file
-- Consolidé le: $(date +%Y-%m-%d)
-- Phase 2 - Stabilisation DB & RAG
-- ═══════════════════════════════════════════════════════════════════════════

$(cat "$target_path")
EOF

  mv "$temp_file" "$target_path"

  echo "   ✅ Consolidé"
  echo ""

  ((CONSOLIDATED++))
}

# ═══════════════════════════════════════════════════════════════════════════
# MIGRATIONS CRITIQUES (ordre d'application)
# ═══════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════════════"
echo "🔴 MIGRATIONS CRITIQUES"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# 1. API Keys (infrastructure)
consolidate_migration \
  "20260209_create_api_keys_table.sql" \
  "20260217000010" \
  "create_api_keys_table"

# 2. OpenAI Embeddings (nouveau provider)
consolidate_migration \
  "2026-02-12-add-openai-embeddings.sql" \
  "20260217000020" \
  "add_openai_embeddings"

# 3. Hybrid Search BM25 (dépend de #2)
consolidate_migration \
  "2026-02-12-add-hybrid-search.sql" \
  "20260217000030" \
  "add_hybrid_search"

# 4. Type Casting Fix (dépend de #2-3)
consolidate_migration \
  "20260216_fix_subcategory_type_casting.sql" \
  "20260217000040" \
  "fix_subcategory_type_casting"

# 5. CHECK Constraint Jobs (dépend de #4)
consolidate_migration \
  "20260213_add_classify_pages_to_job_type_check.sql" \
  "20260217000050" \
  "add_classify_pages_job_type"

# 6. BM25 Search Function (dépend de #3)
consolidate_migration \
  "20260214_bm25_search.sql" \
  "20260217000060" \
  "bm25_search_function"

# 7. KB Approval System (optionnel, indépendant)
consolidate_migration \
  "20260215_kb_approval.sql" \
  "20260217000070" \
  "kb_approval_system"

# ═══════════════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ═══════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════════════"
echo "✅ CONSOLIDATION TERMINÉE"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "Mode simulation - Aucun fichier modifié"
else
  echo "Migrations consolidées: $CONSOLIDATED"
  echo ""
  echo "📂 Emplacement: db/migrations/202602170000*.sql"
  echo ""
  echo "⚠️  IMPORTANT:"
  echo "   1. Vérifier: git diff db/migrations/"
  echo "   2. Tester: npm run build"
  echo "   3. Appliquer en dev: psql < db/migrations/20260217*.sql"
  echo "   4. Commit: git add db/migrations/ && git commit"
fi

echo ""
