#!/bin/bash

echo "🔧 Application des modifications pour le suivi utilisateur..."

# Phase 1: Corriger le bug cost_usd → estimated_cost_usd
echo "Phase 1: Correction du bug cost_usd → estimated_cost_usd"

# API provider-usage-matrix
sed -i.bak 's/SUM(cost_usd)/SUM(estimated_cost_usd)/g' app/api/admin/provider-usage-matrix/route.ts
sed -i.bak 's/AND ($2::uuid IS NULL OR user_id = $2)/-- USER FILTER PLACEHOLDER/g' app/api/admin/provider-usage-matrix/route.ts
sed -i.bak 's/-- USER FILTER PLACEHOLDER/AND ($2::uuid IS NULL OR user_id = $2)/g' app/api/admin/provider-usage-matrix/route.ts

# API provider-usage-trends
sed -i.bak 's/SUM(cost_usd)/SUM(estimated_cost_usd)/g' app/api/admin/provider-usage-trends/route.ts

# Page ai-costs
sed -i.bak 's/SUM(cost_usd)/SUM(estimated_cost_usd)/g' app/super-admin/ai-costs/page.tsx
sed -i.bak 's/SUM(a.cost_usd)/SUM(a.estimated_cost_usd)/g' app/super-admin/ai-costs/page.tsx

echo "✅ Phase 1 terminée"
echo ""
echo "⚠️  IMPORTANT: Les fichiers suivants ont été modifiés:"
echo "  - app/api/admin/provider-usage-matrix/route.ts"
echo "  - app/api/admin/provider-usage-trends/route.ts"
echo "  - app/super-admin/ai-costs/page.tsx"
echo ""
echo "📝 Fichiers de sauvegarde créés avec extension .bak"
echo ""
echo "✨ Modifications appliquées avec succès!"
