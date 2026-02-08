#!/bin/bash
# Script de déploiement migrations Google Drive sur production

echo "📦 Déploiement migrations Google Drive vers VPS..."

# 1. Copier les migrations
scp db/migrations/20260211000001_add_google_drive_support.sql root@84.247.165.187:/root/moncabinet/db/migrations/
scp db/migrations/20260211000002_create_system_settings.sql root@84.247.165.187:/root/moncabinet/db/migrations/

# 2. Appliquer les migrations
ssh root@84.247.165.187 << 'ENDSSH'
cd /root/moncabinet
docker compose exec -T nextjs npx tsx scripts/apply-gdrive-migrations.ts
ENDSSH

echo "✅ Migrations déployées!"
