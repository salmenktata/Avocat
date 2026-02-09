#!/bin/bash
set -e

# Script de relance du full crawl après corrections parsing
# Corrige les erreurs PDF (DOMMatrix) et DOC (anciens formats)

VPS_HOST="${VPS_HOST:-84.247.165.187}"
VPS_USER="${VPS_USER:-root}"

echo "=========================================="
echo "🚀 RELANCE FULL CRAWL (avec corrections)"
echo "=========================================="
echo ""

# 1. Vérifier que les containers sont healthy
echo "=== 1. Vérification des containers ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'HEALTHCHECK'
UNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
if [ "$UNHEALTHY" -gt 0 ]; then
  echo "❌ Containers unhealthy détectés:"
  docker ps --filter "health=unhealthy" --format "{{.Names}}: {{.Status}}"
  exit 1
fi
echo "✅ Tous les containers sont healthy"
HEALTHCHECK

# 2. Nettoyer les anciens jobs
echo ""
echo "=== 2. Nettoyage des anciens jobs ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'CLEANUP'
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet << EOSQL
-- Supprimer les jobs cancelled/failed récents
DELETE FROM web_crawl_jobs
WHERE status IN ('cancelled', 'failed')
AND created_at > NOW() - INTERVAL '1 hour';

-- Compter les jobs restants
SELECT
  status,
  COUNT(*) as count
FROM web_crawl_jobs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
EOSQL
CLEANUP

# 3. Créer les nouveaux jobs full_crawl
echo ""
echo "=== 3. Création des jobs FULL CRAWL ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'CREATE_JOBS'
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet << EOSQL
-- Créer des jobs full_crawl pour toutes les sources actives
INSERT INTO web_crawl_jobs (web_source_id, job_type, status, priority)
SELECT
  id,
  'full_crawl' as job_type,
  'pending' as status,
  CASE
    WHEN name LIKE '%Drive%' THEN 8  -- Haute priorité pour Google Drive
    WHEN name LIKE '%9anoun%' THEN 7 -- Haute priorité pour 9anoun
    WHEN name LIKE '%Cassation%' THEN 6
    ELSE 5
  END as priority
FROM web_sources
WHERE is_active = true;

-- Afficher les jobs créés
SELECT
  ws.name,
  wcj.job_type,
  wcj.priority,
  wcj.created_at::timestamp(0) as created
FROM web_crawl_jobs wcj
JOIN web_sources ws ON wcj.web_source_id = ws.id
WHERE wcj.status = 'pending'
ORDER BY wcj.priority DESC, wcj.created_at;
EOSQL
CREATE_JOBS

# 4. Lancer le crawler
echo ""
echo "=== 4. Lancement du crawler ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'LAUNCH'
CRON_SECRET=$(docker exec moncabinet-nextjs printenv CRON_SECRET)

echo "🔄 Exécution 1/3 - Traitement des jobs pending..."
RESPONSE=$(curl -s -X GET "http://localhost:3000/api/cron/web-crawler" \
  -H "Authorization: Bearer $CRON_SECRET")

echo "$RESPONSE" | jq '{success, duration, pendingJobs, scheduled}' 2>/dev/null || echo "$RESPONSE"

sleep 3

echo ""
echo "🔄 Exécution 2/3 - Traitement des jobs suivants..."
RESPONSE=$(curl -s -X GET "http://localhost:3000/api/cron/web-crawler" \
  -H "Authorization: Bearer $CRON_SECRET")

echo "$RESPONSE" | jq '{success, duration, pendingJobs}' 2>/dev/null || echo "$RESPONSE"

LAUNCH

# 5. Afficher l'état initial
echo ""
echo "=== 5. État initial des jobs ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'STATUS'
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet << EOSQL
SELECT
  ws.name,
  wcj.status,
  wcj.pages_processed,
  wcj.started_at::timestamp(0) as started
FROM web_crawl_jobs wcj
JOIN web_sources ws ON wcj.web_source_id = ws.id
WHERE wcj.created_at > NOW() - INTERVAL '15 minutes'
ORDER BY wcj.priority DESC, wcj.created_at DESC;
EOSQL
STATUS

echo ""
echo "=========================================="
echo "✅ FULL CRAWL LANCÉ"
echo "=========================================="
echo ""
echo "📊 Pour surveiller la progression:"
echo "   ssh root@84.247.165.187 'docker logs -f moncabinet-nextjs | grep -E \"(Crawler|GDrive|Extracted|Failed)\"'"
echo ""
echo "📊 Pour voir l'état des jobs:"
echo "   /reindex-prod --status"
echo ""
