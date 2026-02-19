#!/bin/bash
# =============================================================================
# Validate Cron Registration
# Vérifie que tous les scripts cron sont enregistrés dans cron_schedules
# et dans CRON_SCRIPTS du trigger route
# =============================================================================
# Usage:
#   bash scripts/validate-cron-registration.sh
#   bash scripts/validate-cron-registration.sh --ci  (exit 1 si manquant)
# =============================================================================

CI_MODE=false
if [ "$1" = "--ci" ]; then
  CI_MODE=true
fi

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPTS_DIR")"

MISSING_IN_TRIGGER=()
MISSING_IN_MIGRATION=()

echo "============================================="
echo " Validation Cron Registration"
echo "============================================="
echo ""

# 1. Collecter les cron_name depuis les scripts bash
echo "--- Scripts bash avec cron_start ---"
SCRIPT_CRON_NAMES=()

for script_file in "$SCRIPTS_DIR"/cron-*.sh "$SCRIPTS_DIR"/watchdog-vps.sh "$SCRIPTS_DIR"/index-kb-progressive.sh; do
  [ -f "$script_file" ] || continue

  # Extraire le cron_name du cron_start "xxx" ou cron_wrap "xxx" (compatible macOS + Linux)
  # Cas 1: cron_start "literal-name"
  cron_name=$(grep -o 'cron_start "[a-z0-9-]*"' "$script_file" 2>/dev/null | head -1 | sed 's/cron_start "//;s/".*//')

  # Cas 2: cron_wrap "literal-name"
  if [ -z "$cron_name" ]; then
    cron_name=$(grep -o 'cron_wrap "[a-z0-9-]*"' "$script_file" 2>/dev/null | head -1 | sed 's/cron_wrap "//;s/".*//')
  fi

  # Cas 3: cron_start "$CRON_NAME" avec CRON_NAME="xxx" défini plus haut
  if [ -z "$cron_name" ]; then
    if grep -q 'cron_start "$CRON_NAME"' "$script_file" 2>/dev/null; then
      cron_name=$(grep -o 'CRON_NAME="[a-z0-9-]*"' "$script_file" 2>/dev/null | head -1 | sed 's/CRON_NAME="//;s/".*//')
    fi
  fi

  # Cas 4: CRON_NAME="xxx" sans cron_start explicite (script utilise cron-logger indirectement)
  if [ -z "$cron_name" ]; then
    cron_name=$(grep -o 'CRON_NAME="[a-z0-9-]*"' "$script_file" 2>/dev/null | head -1 | sed 's/CRON_NAME="//;s/".*//')
  fi

  basename_file=$(basename "$script_file")

  if [ -n "$cron_name" ]; then
    echo "  $basename_file -> $cron_name"
    SCRIPT_CRON_NAMES+=("$cron_name")
  else
    echo "  $basename_file -> (pas de tracking)"
  fi
done

echo ""

# 2. Vérifier la présence dans le trigger route.ts
echo "--- Vérification trigger route.ts ---"
TRIGGER_FILE="$PROJECT_DIR/app/api/admin/cron-executions/trigger/route.ts"

for cron_name in "${SCRIPT_CRON_NAMES[@]}"; do
  if grep -q "'$cron_name'" "$TRIGGER_FILE" 2>/dev/null; then
    echo "  [OK] $cron_name -> trigger route.ts"
  else
    echo "  [MANQUANT] $cron_name -> PAS dans trigger route.ts"
    MISSING_IN_TRIGGER+=("$cron_name")
  fi
done

echo ""

# 3. Vérifier la présence dans les migrations SQL (cron_schedules)
echo "--- Vérification migrations SQL ---"
MIGRATION_DIR="$PROJECT_DIR/db/migrations"

for cron_name in "${SCRIPT_CRON_NAMES[@]}"; do
  if grep -rq "'$cron_name'" "$MIGRATION_DIR"/*.sql 2>/dev/null; then
    echo "  [OK] $cron_name -> migration SQL"
  else
    echo "  [MANQUANT] $cron_name -> PAS dans migrations SQL"
    MISSING_IN_MIGRATION+=("$cron_name")
  fi
done

echo ""

# 4. Vérifier le trigger Python aussi
echo "--- Vérification trigger Python ---"
PYTHON_FILE="$SCRIPTS_DIR/cron-trigger-server.py"

for cron_name in "${SCRIPT_CRON_NAMES[@]}"; do
  if grep -q "\"$cron_name\"" "$PYTHON_FILE" 2>/dev/null; then
    echo "  [OK] $cron_name -> cron-trigger-server.py"
  else
    echo "  [MANQUANT] $cron_name -> PAS dans cron-trigger-server.py"
    MISSING_IN_TRIGGER+=("$cron_name (python)")
  fi
done

echo ""
echo "============================================="

# 5. Résumé
TOTAL_MISSING=$((${#MISSING_IN_TRIGGER[@]} + ${#MISSING_IN_MIGRATION[@]}))

if [ $TOTAL_MISSING -eq 0 ]; then
  echo " Tous les ${#SCRIPT_CRON_NAMES[@]} crons sont enregistrés"
  echo "============================================="
  exit 0
else
  echo " ${#MISSING_IN_TRIGGER[@]} manquant(s) dans trigger"
  echo " ${#MISSING_IN_MIGRATION[@]} manquant(s) dans migrations"
  echo "============================================="

  if [ "$CI_MODE" = true ]; then
    echo ""
    echo "ERREUR CI: Des crons ne sont pas enregistrés!"
    echo "Ajoutez-les dans:"
    echo "  - app/api/admin/cron-executions/trigger/route.ts (CRON_SCRIPTS)"
    echo "  - scripts/cron-trigger-server.py (CRON_SCRIPTS)"
    echo "  - db/migrations/ (INSERT INTO cron_schedules)"
    exit 1
  fi

  exit 0
fi
