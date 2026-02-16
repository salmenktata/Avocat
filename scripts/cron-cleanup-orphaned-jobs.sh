#!/bin/bash
# Script: Cleanup jobs orphelins (stuck après restart container)
# Usage: bash scripts/cron-cleanup-orphaned-jobs.sh
# Cron: */15 * * * * (toutes les 15 minutes)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/cron-logger.sh"

# Démarrer tracking cron
cron_start "cleanup-orphaned-jobs" "scheduled"

# Configuration
POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)
INDEXING_TIMEOUT_MINUTES=10
CRAWL_TIMEOUT_MINUTES=20

if [ -z "$POSTGRES_CONTAINER" ]; then
  cron_fail '{"error": "Container PostgreSQL introuvable"}'
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# CLEANUP INDEXING JOBS
# ═══════════════════════════════════════════════════════════════════════════

echo "[Cleanup] Recherche indexing_jobs orphelins (>${INDEXING_TIMEOUT_MINUTES}min)..."

INDEXING_RESULT=$(docker exec "$POSTGRES_CONTAINER" psql -U moncabinet -d qadhya -t -c "
  UPDATE indexing_jobs
  SET status = 'failed',
      error_message = 'Job orphelin détecté - Container restart ou timeout',
      completed_at = NOW()
  WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '${INDEXING_TIMEOUT_MINUTES} minutes'
  RETURNING id, job_type, started_at;
")

CLEANED_INDEXING=$(echo "$INDEXING_RESULT" | grep -v "^$" | wc -l | tr -d ' ')

if [ "$CLEANED_INDEXING" -gt 0 ]; then
  echo "[Cleanup] ✅ $CLEANED_INDEXING indexing_jobs orphelins nettoyés"
  echo "$INDEXING_RESULT" | while read -r line; do
    [ -n "$line" ] && echo "  → $line"
  done
else
  echo "[Cleanup] ✓ Aucun indexing_job orphelin"
fi

# ═══════════════════════════════════════════════════════════════════════════
# CLEANUP CRAWL JOBS
# ═══════════════════════════════════════════════════════════════════════════

echo "[Cleanup] Recherche web_crawl_jobs orphelins (>${CRAWL_TIMEOUT_MINUTES}min)..."

CRAWL_RESULT=$(docker exec "$POSTGRES_CONTAINER" psql -U moncabinet -d qadhya -t -c "
  UPDATE web_crawl_jobs
  SET status = 'failed',
      error_message = 'Job orphelin détecté - Container restart ou timeout',
      completed_at = NOW()
  WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '${CRAWL_TIMEOUT_MINUTES} minutes'
  RETURNING id, web_source_id, started_at;
")

CLEANED_CRAWL=$(echo "$CRAWL_RESULT" | grep -v "^$" | wc -l | tr -d ' ')

if [ "$CLEANED_CRAWL" -gt 0 ]; then
  echo "[Cleanup] ✅ $CLEANED_CRAWL web_crawl_jobs orphelins nettoyés"
  echo "$CRAWL_RESULT" | while read -r line; do
    [ -n "$line" ] && echo "  → $line"
  done
else
  echo "[Cleanup] ✓ Aucun web_crawl_job orphelin"
fi

# ═══════════════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ═══════════════════════════════════════════════════════════════════════════

TOTAL_CLEANED=$((CLEANED_INDEXING + CLEANED_CRAWL))

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Cleanup terminé"
echo "═══════════════════════════════════════════════════════════════"
echo "  Indexing jobs:    $CLEANED_INDEXING"
echo "  Crawl jobs:       $CLEANED_CRAWL"
echo "  Total nettoyé:    $TOTAL_CLEANED"
echo ""

# Compléter tracking cron
trap - EXIT
cron_complete "{\"cleanedIndexing\": $CLEANED_INDEXING, \"cleanedCrawls\": $CLEANED_CRAWL, \"total\": $TOTAL_CLEANED}"

exit 0
