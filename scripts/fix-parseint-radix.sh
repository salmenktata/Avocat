#!/bin/bash
# Script: Corriger tous les parseInt sans radix dans le projet
# Usage: bash scripts/fix-parseint-radix.sh

set -euo pipefail

echo "🔧 Correction parseInt sans radix..."

# Fonction pour corriger un fichier
fix_file() {
  local file="$1"
  echo "  Corrige: $file"

  # Remplacer parseInt( par parseInt( avec radix 10
  # Pattern 1: parseInt(variable) → parseInt(variable, 10)
  # Pattern 2: parseInt(expression || 'default') → parseInt(expression || 'default', 10)

  # Backup original
  cp "$file" "$file.bak"

  # Correction avec sed (multi-pattern)
  sed -i.tmp \
    -e 's/parseInt(\([^)]*\))/parseInt(\1, 10)/g' \
    "$file"

  # Nettoyer backup temp
  rm -f "$file.tmp"

  # Si pas de changements, restaurer backup
  if diff -q "$file" "$file.bak" > /dev/null 2>&1; then
    mv "$file.bak" "$file"
  else
    rm "$file.bak"
    echo "    ✅ Modifié"
  fi
}

# Trouver tous les fichiers avec parseInt sans radix
FILES=$(grep -rl "parseInt(" app/ lib/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
  xargs grep -l "parseInt([^,)]*)" 2>/dev/null | \
  grep -v "parseInt([^,)]*,\s*10)" || true)

if [ -z "$FILES" ]; then
  echo "✅ Aucun fichier à corriger"
  exit 0
fi

# Compter
COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
echo "📊 Fichiers à corriger: $COUNT"
echo ""

# Corriger chaque fichier
echo "$FILES" | while read -r file; do
  fix_file "$file"
done

echo ""
echo "✅ Correction terminée"
echo ""
echo "⚠️  Vérifications manuelles recommandées:"
echo "  - git diff (vérifier changements)"
echo "  - npm run type-check (vérifier TypeScript)"
echo "  - npm run dev (tester application)"
