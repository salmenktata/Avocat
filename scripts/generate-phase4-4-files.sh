#!/bin/bash

# Script pour générer tous les fichiers de la Phase 4.4
# Sprint 3 - Classification Juridique

set -e

echo "🚀 Génération des fichiers Phase 4.4 - Classification UI"
echo ""

# Créer les répertoires
echo "📁 Création des répertoires..."
mkdir -p app/api/super-admin/classification/queue
mkdir -p app/api/super-admin/classification/corrections
mkdir -p app/api/super-admin/classification/analytics/top-errors
mkdir -p app/api/admin/web-pages/[id]/classification
mkdir -p components/super-admin/classification
mkdir -p app/super-admin/classification
mkdir -p migrations

echo "✅ Répertoires créés"
echo ""
echo "⚠️  IMPORTANT: Les fichiers de code doivent être créés manuellement"
echo "   ou copiés depuis la documentation PHASE_4_4_IMPLEMENTATION_COMPLETE.md"
echo ""
echo "📝 Fichiers à créer:"
echo "   1. migrations/20260210_review_prioritization.sql"
echo "   2. app/api/super-admin/classification/queue/route.ts"
echo "   3. app/api/super-admin/classification/corrections/route.ts"
echo "   4. app/api/super-admin/classification/analytics/top-errors/route.ts"
echo "   5. app/api/admin/web-pages/[id]/classification/route.ts"
echo "   6. components/super-admin/classification/ReviewQueue.tsx"
echo "   7. components/super-admin/classification/ReviewModal.tsx"
echo "   8. components/super-admin/classification/CorrectionsHistory.tsx"
echo "   9. components/super-admin/classification/ClassificationAnalytics.tsx"
echo "  10. components/super-admin/classification/GeneratedRules.tsx"
echo "  11. app/super-admin/classification/page.tsx"
echo ""
echo "✅ Structure de répertoires prête pour Phase 4.4"
