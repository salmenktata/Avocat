#!/bin/bash

# Script : cron-check-impersonations.sh
# Description : Vérifie les impersonnalisations actives et alerte si durée excessive (>1h)
# Usage : Cron horaire ou manuel
# Date : 2026-02-16

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/qadhya/impersonation-checks.log"

# Sourcer la library cron-logger si disponible
if [ -f "$SCRIPT_DIR/lib/cron-logger.sh" ]; then
  source "$SCRIPT_DIR/lib/cron-logger.sh"

  # Utiliser le wrapper cron si disponible
  cron_wrap "check-impersonations" "curl -X POST http://localhost:3000/api/admin/alerts/check-impersonations \
    -H 'Content-Type: application/json' \
    -H 'X-Cron-Secret: ${CRON_SECRET}' \
    --max-time 30 \
    --silent \
    --show-error"
else
  # Fallback : exécution simple sans tracking
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Check impersonations démarré" | tee -a "$LOG_FILE"

  response=$(curl -X POST http://localhost:3000/api/admin/alerts/check-impersonations \
    -H "Content-Type: application/json" \
    -H "X-Cron-Secret: ${CRON_SECRET}" \
    --max-time 30 \
    --silent \
    --show-error)

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Réponse: $response" | tee -a "$LOG_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Check impersonations terminé" | tee -a "$LOG_FILE"
fi
