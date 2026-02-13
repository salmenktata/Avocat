#!/bin/bash

# Test Phase 3.4 - Alertes Abrogations en Production

echo "🧪 Test Phase 3.4 : Alertes Abrogations dans Assistant IA"
echo "=========================================================="
echo ""

# Test 1: API Détection
echo "1️⃣ Test API /api/legal/abrogations/detect"
echo "-----------------------------------------"

RESPONSE=$(curl -s -X POST https://qadhya.tn/api/legal/abrogations/detect \
  -H "Content-Type: application/json" \
  -d '{"message":"Mon client a été condamné selon article 97 du Code pénal tunisien"}')

if echo "$RESPONSE" | grep -q "success"; then
  echo "✅ API répond"
  ALERTS_COUNT=$(echo "$RESPONSE" | jq -r '.alerts | length' 2>/dev/null || echo "0")
  echo "   Alertes détectées: $ALERTS_COUNT"

  if [ "$ALERTS_COUNT" -gt 0 ]; then
    echo "   ✅ Alerte générée avec succès"
    echo "$RESPONSE" | jq '.alerts[0] | {severity, reference: .abrogation.abrogatedReference, replacement: .abrogation.abrogatingReference}' 2>/dev/null
  else
    echo "   ⚠️ Aucune alerte détectée (normal si aucune correspondance)"
  fi
else
  echo "❌ API ne répond pas correctement"
  echo "$RESPONSE" | head -5
fi

echo ""

# Test 2: Page Assistant IA
echo "2️⃣ Test Page Assistant IA"
echo "------------------------"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://qadhya.tn/assistant-ia)

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Page accessible (HTTP $HTTP_STATUS)"
else
  echo "❌ Page inaccessible (HTTP $HTTP_STATUS)"
fi

echo ""

# Test 3: Composant AbrogationAlert dans build
echo "3️⃣ Vérification Build Phase 3.4"
echo "-------------------------------"

# Cette partie nécessite accès SSH au VPS
echo "Pour vérifier le build sur le VPS:"
echo "  docker exec qadhya-nextjs find /app/.next/server/app/api/legal/abrogations -name 'detect'"
echo "  docker exec qadhya-nextjs find /app/.next/server/components -name 'abrogation-alert*'"

echo ""
echo "✅ Tests Phase 3.4 terminés !"
