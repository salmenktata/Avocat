#!/bin/bash
set -e

# Script de relance du crawl après installation Tesseract OCR
# Teste l'OCR puis lance un full crawl

VPS_HOST="${VPS_HOST:-84.247.165.187}"
VPS_USER="${VPS_USER:-root}"

echo "=========================================="
echo "🚀 RELANCE CRAWL AVEC OCR TESSERACT"
echo "=========================================="
echo ""

# 1. Vérifier Tesseract
echo "=== 1. Vérification Tesseract OCR ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'VERIFY_OCR'
echo "--- Version Tesseract ---"
docker exec moncabinet-nextjs tesseract --version 2>&1 | head -3

echo ""
echo "--- Langues disponibles ---"
docker exec moncabinet-nextjs tesseract --list-langs 2>&1 | grep -E "(ara|fra|List)" || echo "Erreur liste langues"

echo ""
if docker exec moncabinet-nextjs tesseract --list-langs 2>&1 | grep -q "ara"; then
  echo "✅ Langue arabe (ara) disponible"
else
  echo "❌ Langue arabe (ara) MANQUANTE"
  exit 1
fi

if docker exec moncabinet-nextjs tesseract --list-langs 2>&1 | grep -q "fra"; then
  echo "✅ Langue française (fra) disponible"
else
  echo "❌ Langue française (fra) MANQUANTE"
  exit 1
fi
VERIFY_OCR

# 2. Nettoyer les anciens jobs
echo ""
echo "=== 2. Nettoyage des jobs précédents ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  "docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c \"DELETE FROM web_crawl_jobs WHERE created_at < NOW() - INTERVAL '1 hour'; SELECT COUNT(*) as jobs_nettoyés FROM web_crawl_jobs WHERE created_at < NOW() - INTERVAL '1 hour';\""

# 3. Créer nouveaux jobs full_crawl
echo ""
echo "=== 3. Création jobs FULL CRAWL ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  "docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c \"INSERT INTO web_crawl_jobs (web_source_id, job_type, status, priority) SELECT id, 'full_crawl', 'pending', CASE WHEN name LIKE '%Drive%' THEN 8 WHEN name LIKE '%9anoun%' THEN 7 WHEN name LIKE '%Cassation%' THEN 6 ELSE 5 END FROM web_sources WHERE is_active = true; SELECT ws.name, wcj.priority FROM web_crawl_jobs wcj JOIN web_sources ws ON wcj.web_source_id = ws.id WHERE wcj.status = 'pending' ORDER BY wcj.priority DESC;\""

# 4. Lancer le crawler (3 exécutions)
echo ""
echo "=== 4. Lancement du crawler ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'LAUNCH'
CRON_SECRET=$(docker exec moncabinet-nextjs printenv CRON_SECRET)

for i in 1 2 3; do
  echo ""
  echo "--- Exécution $i/3 ---"
  curl -s -X GET "http://localhost:3000/api/cron/web-crawler" \
    -H "Authorization: Bearer $CRON_SECRET" | \
    jq '{success, duration, pendingJobs, scheduled}' 2>/dev/null || echo "Erreur API"
  sleep 2
done
LAUNCH

# 5. Afficher l'état initial
echo ""
echo "=== 5. État initial des jobs ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" \
  "docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c \"SELECT ws.name, wcj.status, wcj.pages_processed, wcj.started_at::timestamp(0) FROM web_crawl_jobs wcj JOIN web_sources ws ON wcj.web_source_id = ws.id WHERE wcj.created_at > NOW() - INTERVAL '10 minutes' ORDER BY wcj.priority DESC;\""

echo ""
echo "=========================================="
echo "✅ CRAWL AVEC OCR LANCÉ"
echo "=========================================="
echo ""
echo "📊 Commandes de surveillance:"
echo "   docker logs -f moncabinet-nextjs | grep -E '(OCR|Tesseract|Extracted)'"
echo "   /reindex-prod --status"
echo ""
