#!/bin/bash

# Script de vérification exhaustive du support dark/light mode
# Usage: npm run check:dark ou ./scripts/check-dark-mode.sh

echo "🔍 Vérification exhaustive du mode dark/light..."
echo "================================================"
echo ""

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
TOTAL_ISSUES=0
FILES_WITH_ISSUES=0

# Patterns problématiques (classes Tailwind en dur qui ne s'adaptent pas au dark mode)
declare -a PROBLEMATIC_PATTERNS=(
  "bg-white"
  "bg-gray-50"
  "bg-gray-100"
  "text-gray-900"
  "text-gray-800"
  "text-gray-700"
  "text-gray-600"
  "text-gray-500"
  "text-gray-400"
  "border-gray-200"
  "border-gray-300"
)

# Classes acceptables (celles qui utilisent dark:)
ACCEPTABLE_WITH_DARK='dark:'

echo "📋 Recherche des classes problématiques dans les composants..."
echo ""

# Chercher dans tous les fichiers .tsx et .ts (sauf node_modules et .next)
while IFS= read -r file; do
  HAS_ISSUES=false
  FILE_ISSUES=0

  # Vérifier chaque pattern problématique
  for pattern in "${PROBLEMATIC_PATTERNS[@]}"; do
    # Chercher le pattern
    matches=$(grep -n "$pattern" "$file" 2>/dev/null | grep -v "$ACCEPTABLE_WITH_DARK" | grep -v "// OK:" | grep -v "/* OK */")

    if [ ! -z "$matches" ]; then
      if [ "$HAS_ISSUES" = false ]; then
        echo -e "${RED}❌ $file${NC}"
        HAS_ISSUES=true
        ((FILES_WITH_ISSUES++))
      fi

      # Afficher les lignes problématiques
      while IFS= read -r line; do
        line_num=$(echo "$line" | cut -d: -f1)
        line_content=$(echo "$line" | cut -d: -f2-)
        echo -e "   ${YELLOW}L${line_num}:${NC} Classe '$pattern' sans 'dark:' → ${line_content}"
        ((TOTAL_ISSUES++))
        ((FILE_ISSUES++))
      done <<< "$matches"
    fi
  done

  if [ "$HAS_ISSUES" = true ]; then
    echo -e "   ${RED}Total issues: $FILE_ISSUES${NC}"
    echo ""
  fi

done < <(find app components -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .next)

echo "================================================"
echo ""

if [ $TOTAL_ISSUES -eq 0 ]; then
  echo -e "${GREEN}✅ Aucun problème détecté !${NC}"
  echo -e "${GREEN}Tous les composants sont compatibles dark/light mode.${NC}"
else
  echo -e "${RED}❌ $TOTAL_ISSUES problèmes détectés dans $FILES_WITH_ISSUES fichiers${NC}"
  echo ""
  echo "📝 Pour corriger :"
  echo "   1. Remplacez bg-white par bg-card"
  echo "   2. Remplacez text-gray-900 par text-foreground"
  echo "   3. Remplacez text-gray-500 par text-muted-foreground"
  echo "   4. Remplacez bg-gray-50 par bg-muted"
  echo "   5. Ou ajoutez dark: pour les couleurs spécifiques"
  echo ""
  echo "Exemple:"
  echo "   bg-blue-100 → bg-blue-100 dark:bg-blue-900/20"
  echo "   text-gray-700 → text-foreground"
fi

echo ""
echo "🎨 Classes recommandées du design system:"
echo "   Background: bg-background, bg-card, bg-muted"
echo "   Text: text-foreground, text-card-foreground, text-muted-foreground"
echo "   Borders: border (utilise --border automatiquement)"
echo ""

exit $FILES_WITH_ISSUES
