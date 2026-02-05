#!/bin/bash

# Script de correction automatique pour le support dark/light mode
# Usage: npm run fix:dark ou ./scripts/fix-dark-mode.sh

echo "🔧 Correction automatique du mode dark/light..."
echo "================================================"
echo ""

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Compteurs
TOTAL_FILES=0
TOTAL_REPLACEMENTS=0

# Créer une sauvegarde
BACKUP_DIR=".dark-mode-backup-$(date +%Y%m%d-%H%M%S)"
echo -e "${BLUE}📦 Création d'une sauvegarde dans $BACKUP_DIR${NC}"
mkdir -p "$BACKUP_DIR"
cp -r app components "$BACKUP_DIR/"
echo -e "${GREEN}✓ Sauvegarde créée${NC}"
echo ""

echo "🔄 Application des corrections..."
echo ""

# Fonction pour remplacer dans un fichier
replace_in_file() {
  local file=$1
  local pattern=$2
  local replacement=$3
  local description=$4

  if grep -q "$pattern" "$file" 2>/dev/null; then
    # Compter les occurrences avant remplacement
    local count=$(grep -o "$pattern" "$file" | wc -l | tr -d ' ')

    # Effectuer le remplacement
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' "s/$pattern/$replacement/g" "$file"
    else
      # Linux
      sed -i "s/$pattern/$replacement/g" "$file"
    fi

    echo -e "   ${GREEN}✓${NC} $description: ${YELLOW}$count${NC} remplacement(s)"
    return $count
  fi
  return 0
}

# Trouver tous les fichiers .tsx et .ts
files=$(find app components -name "*.tsx" -o -name "*.ts" | grep -v node_modules | grep -v .next)

for file in $files; do
  FILE_CHANGES=0
  SHOWED_HEADER=false

  # Backgrounds
  replace_in_file "$file" 'className="\([^"]*\)bg-white\([^"]*\)"' 'className="\1bg-card\2"' "bg-white → bg-card"
  result=$?
  if [ $result -gt 0 ]; then
    if [ "$SHOWED_HEADER" = false ]; then
      echo -e "${BLUE}📄 $file${NC}"
      SHOWED_HEADER=true
      ((TOTAL_FILES++))
    fi
    ((FILE_CHANGES+=result))
    ((TOTAL_REPLACEMENTS+=result))
  fi

  replace_in_file "$file" 'className="\([^"]*\)bg-gray-50\([^"]*\)"' 'className="\1bg-muted\2"' "bg-gray-50 → bg-muted"
  result=$?
  if [ $result -gt 0 ]; then
    if [ "$SHOWED_HEADER" = false ]; then
      echo -e "${BLUE}📄 $file${NC}"
      SHOWED_HEADER=true
      ((TOTAL_FILES++))
    fi
    ((FILE_CHANGES+=result))
    ((TOTAL_REPLACEMENTS+=result))
  fi

  # Textes - foreground principal
  for pattern in "text-gray-900" "text-gray-800" "text-gray-700"; do
    replace_in_file "$file" "className=\"\([^\"]*\)$pattern\([^\"]*\)\"" 'className="\1text-foreground\2"' "$pattern → text-foreground"
    result=$?
    if [ $result -gt 0 ]; then
      if [ "$SHOWED_HEADER" = false ]; then
        echo -e "${BLUE}📄 $file${NC}"
        SHOWED_HEADER=true
        ((TOTAL_FILES++))
      fi
      ((FILE_CHANGES+=result))
      ((TOTAL_REPLACEMENTS+=result))
    fi
  done

  # Textes - muted foreground
  for pattern in "text-gray-600" "text-gray-500" "text-gray-400"; do
    replace_in_file "$file" "className=\"\([^\"]*\)$pattern\([^\"]*\)\"" 'className="\1text-muted-foreground\2"' "$pattern → text-muted-foreground"
    result=$?
    if [ $result -gt 0 ]; then
      if [ "$SHOWED_HEADER" = false ]; then
        echo -e "${BLUE}📄 $file${NC}"
        SHOWED_HEADER=true
        ((TOTAL_FILES++))
      fi
      ((FILE_CHANGES+=result))
      ((TOTAL_REPLACEMENTS+=result))
    fi
  done

  # Bordures
  for pattern in "border-gray-200" "border-gray-300"; do
    replace_in_file "$file" "className=\"\([^\"]*\)$pattern\([^\"]*\)\"" 'className="\1border\2"' "$pattern → border"
    result=$?
    if [ $result -gt 0 ]; then
      if [ "$SHOWED_HEADER" = false ]; then
        echo -e "${BLUE}📄 $file${NC}"
        SHOWED_HEADER=true
        ((TOTAL_FILES++))
      fi
      ((FILE_CHANGES+=result))
      ((TOTAL_REPLACEMENTS+=result))
    fi
  done

  if [ $FILE_CHANGES -gt 0 ]; then
    echo ""
  fi
done

echo "================================================"
echo ""

if [ $TOTAL_REPLACEMENTS -eq 0 ]; then
  echo -e "${GREEN}✅ Aucun remplacement nécessaire !${NC}"
  echo -e "${GREEN}Tous les fichiers sont déjà compatibles dark/light mode.${NC}"
  # Supprimer la sauvegarde si aucun changement
  rm -rf "$BACKUP_DIR"
else
  echo -e "${GREEN}✅ $TOTAL_REPLACEMENTS remplacements effectués dans $TOTAL_FILES fichiers${NC}"
  echo ""
  echo -e "${YELLOW}⚠️  IMPORTANT :${NC}"
  echo "   1. Vérifiez les changements avec: git diff"
  echo "   2. Testez l'application en mode dark ET light"
  echo "   3. Sauvegarde disponible dans: $BACKUP_DIR"
  echo ""
  echo "   Pour restaurer la sauvegarde :"
  echo "   cp -r $BACKUP_DIR/app $BACKUP_DIR/components ."
  echo ""
  echo -e "${BLUE}🔍 Lancez 'npm run check:dark' pour vérifier les problèmes restants${NC}"
fi

echo ""
exit 0
