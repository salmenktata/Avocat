#!/bin/bash
# Script: Recovery jobs orphelins au démarrage container
# Exécuté automatiquement par Docker CMD avant start application
# Usage: bash scripts/recover-orphaned-jobs-startup.sh

set -euo pipefail

echo "════════════════════════════════════════════════════════════════"
echo "🔄 [Startup] Recovery jobs orphelins..."
echo "════════════════════════════════════════════════════════════════"
echo ""

# Attendre que PostgreSQL soit prêt
echo "[Startup] Attente PostgreSQL..."
MAX_WAIT=30
WAITED=0

while ! pg_isready -h postgres -U moncabinet -d qadhya > /dev/null 2>&1; do
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "[Startup] ⚠️  PostgreSQL timeout après ${MAX_WAIT}s, skip recovery"
    exit 0
  fi
  sleep 1
  ((WAITED++))
done

echo "[Startup] ✅ PostgreSQL prêt (${WAITED}s)"
echo ""

# Exécuter cleanup jobs orphelins
if [ -f "/app/scripts/cron-cleanup-orphaned-jobs.sh" ]; then
  echo "[Startup] Exécution cleanup jobs orphelins..."
  bash /app/scripts/cron-cleanup-orphaned-jobs.sh || {
    echo "[Startup] ⚠️  Cleanup échoué, continue démarrage"
  }
else
  echo "[Startup] ⚠️  Script cleanup introuvable, skip"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ [Startup] Recovery terminé"
echo "════════════════════════════════════════════════════════════════"
echo ""
