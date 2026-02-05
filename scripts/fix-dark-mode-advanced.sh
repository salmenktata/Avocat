#!/bin/bash

# Script de correction avancée pour les problèmes dark/light restants
# Usage: npm run fix:dark:advanced

echo "🔧 Correction avancée du mode dark/light (66 problèmes restants)..."
echo "===================================================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL_FIXES=0

# Fonction de remplacement avancé
fix_file() {
  local file=$1
  local pattern=$2
  local replacement=$3
  local desc=$4

  if grep -q "$pattern" "$file" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "$pattern|$replacement|g" "$file"
    else
      sed -i "$pattern|$replacement|g" "$file"
    fi
    echo -e "   ${GREEN}✓${NC} $desc"
    ((TOTAL_FIXES++))
  fi
}

echo "Correction des fichiers..."
echo ""

# Corrections spécifiques pour chaque fichier problématique

# 1. bg-gray-100 → bg-muted (général)
echo -e "${BLUE}📄 Correction de bg-gray-100 → bg-muted${NC}"
for file in $(find app components -name "*.tsx" | grep -v node_modules | grep -v .next); do
  if grep -q 'bg-gray-100' "$file" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' 's/bg-gray-100/bg-muted/g' "$file"
    else
      sed -i 's/bg-gray-100/bg-muted/g' "$file"
    fi
    echo -e "   ${GREEN}✓${NC} $file"
    ((TOTAL_FIXES++))
  fi
done
echo ""

# 2. bg-gray-50 → bg-accent (pour hover)
echo -e "${BLUE}📄 Correction de hover:bg-gray-50 → hover:bg-accent${NC}"
for file in $(find app components -name "*.tsx" | grep -v node_modules | grep -v .next); do
  if grep -q 'hover:bg-gray-50' "$file" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' 's/hover:bg-gray-50/hover:bg-accent/g' "$file"
    else
      sed -i 's/hover:bg-gray-50/hover:bg-accent/g' "$file"
    fi
    echo -e "   ${GREEN}✓${NC} $file"
    ((TOTAL_FIXES++))
  fi
done
echo ""

# 3. bg-gray-50 → bg-muted (général)
echo -e "${BLUE}📄 Correction de bg-gray-50 → bg-muted${NC}"
for file in $(find app components -name "*.tsx" | grep -v node_modules | grep -v .next); do
  if grep -q 'bg-gray-50[^"]' "$file" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' 's/\([^:]\)bg-gray-50/\1bg-muted/g' "$file"
    else
      sed -i 's/\([^:]\)bg-gray-50/\1bg-muted/g' "$file"
    fi
    echo -e "   ${GREEN}✓${NC} $file"
    ((TOTAL_FIXES++))
  fi
done
echo ""

# 4. Textes restants
echo -e "${BLUE}📄 Correction des text-gray-* restants${NC}"
for file in $(find app components -name "*.tsx" | grep -v node_modules | grep -v .next); do
  changed=false

  if grep -q 'text-gray-700' "$file" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' 's/text-gray-700/text-foreground/g' "$file"
    else
      sed -i 's/text-gray-700/text-foreground/g' "$file"
    fi
    changed=true
  fi

  if grep -q 'text-gray-500' "$file" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' 's/text-gray-500/text-muted-foreground/g' "$file"
    else
      sed -i 's/text-gray-500/text-muted-foreground/g' "$file"
    fi
    changed=true
  fi

  if grep -q 'text-gray-900' "$file" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' 's/text-gray-900/text-foreground/g' "$file"
    else
      sed -i 's/text-gray-900/text-foreground/g' "$file"
    fi
    changed=true
  fi

  if [ "$changed" = true ]; then
    echo -e "   ${GREEN}✓${NC} $file"
    ((TOTAL_FIXES++))
  fi
done
echo ""

# 5. Bordures restantes
echo -e "${BLUE}📄 Correction des border-gray-* restants${NC}"
for file in $(find app components -name "*.tsx" | grep -v node_modules | grep -v .next); do
  changed=false

  if grep -q 'border-gray-200' "$file" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' 's/border-gray-200/border/g' "$file"
    else
      sed -i 's/border-gray-200/border/g' "$file"
    fi
    changed=true
  fi

  if grep -q 'border-gray-300' "$file" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' 's/border-gray-300/border/g' "$file"
    else
      sed -i 's/border-gray-300/border/g' "$file"
    fi
    changed=true
  fi

  if grep -q 'hover:border-gray-300' "$file" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' 's/hover:border-gray-300/hover:border-accent/g' "$file"
    else
      sed -i 's/hover:border-gray-300/hover:border-accent/g' "$file"
    fi
    changed=true
  fi

  if [ "$changed" = true ]; then
    echo -e "   ${GREEN}✓${NC} $file"
    ((TOTAL_FIXES++))
  fi
done
echo ""

# 6. bg-white restants
echo -e "${BLUE}📄 Correction des bg-white restants${NC}"
for file in $(find app components -name "*.tsx" | grep -v node_modules | grep -v .next); do
  if grep -q 'bg-white' "$file" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' 's/bg-white/bg-card/g' "$file"
    else
      sed -i 's/bg-white/bg-card/g' "$file"
    fi
    echo -e "   ${GREEN}✓${NC} $file"
    ((TOTAL_FIXES++))
  fi
done
echo ""

echo "===================================================================="
echo -e "${GREEN}✅ Corrections avancées terminées !${NC}"
echo -e "${YELLOW}Fichiers modifiés: ~$TOTAL_FIXES${NC}"
echo ""
echo "🔍 Vérifiez maintenant avec: npm run check:dark"
echo ""

exit 0
