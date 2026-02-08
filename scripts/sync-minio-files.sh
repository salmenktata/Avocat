#!/bin/bash
# Sync MinIO files DEV → PROD via mc mirror

set -e

# Configuration
DEV_MINIO_ENDPOINT="localhost:9000"
DEV_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
DEV_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin123}"
PROD_TUNNEL_PORT="9100"
BUCKET="web-files"

# Vérifier mc
if ! command -v mc &> /dev/null; then
  echo "Installation mc..."
  brew install minio/stable/mc 2>/dev/null || {
    curl -O https://dl.min.io/client/mc/release/linux-amd64/mc
    chmod +x mc && sudo mv mc /usr/local/bin/
  }
fi

# Vérifier variables VPS
[ -z "$VPS_HOST" ] && { echo "❌ VPS_HOST manquant"; exit 1; }

# Récupérer credentials MinIO prod
PROD_CREDS=$(sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no \
  "$VPS_USER@$VPS_HOST" "grep MINIO /opt/moncabinet/.env.production 2>/dev/null || grep MINIO /opt/moncabinet/.env")
PROD_ACCESS=$(echo "$PROD_CREDS" | grep 'MINIO_ROOT_USER=' | sed 's/MINIO_ROOT_USER=//' | tr -d '\r')
PROD_SECRET=$(echo "$PROD_CREDS" | grep 'MINIO_ROOT_PASSWORD=' | sed 's/MINIO_ROOT_PASSWORD=//' | tr -d '\r')

# Tunnel SSH
pkill -f "ssh.*${PROD_TUNNEL_PORT}:localhost:9000" 2>/dev/null || true
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no -f -N \
  -L ${PROD_TUNNEL_PORT}:localhost:9000 "$VPS_USER@$VPS_HOST"
sleep 2
trap 'pkill -f "ssh.*${PROD_TUNNEL_PORT}:localhost:9000" 2>/dev/null' EXIT

# Configurer mc
mc alias set minio-dev http://${DEV_MINIO_ENDPOINT} "$DEV_ACCESS_KEY" "$DEV_SECRET_KEY" --quiet
mc alias set minio-prod http://localhost:${PROD_TUNNEL_PORT} "$PROD_ACCESS" "$PROD_SECRET" --quiet

# Créer bucket prod si nécessaire
mc mb minio-prod/${BUCKET} 2>/dev/null || true

# Stats avant
echo "=== Avant sync ==="
DEV_COUNT=$(mc ls -r minio-dev/${BUCKET} 2>/dev/null | wc -l)
PROD_COUNT=$(mc ls -r minio-prod/${BUCKET} 2>/dev/null | wc -l)
echo "DEV: $DEV_COUNT fichiers | PROD: $PROD_COUNT fichiers"

# Sync incrémentale
echo ""
echo "🚀 Synchronisation MinIO..."
mc mirror --overwrite --preserve minio-dev/${BUCKET} minio-prod/${BUCKET}

# Stats après
echo ""
echo "=== Après sync ==="
PROD_COUNT_AFTER=$(mc ls -r minio-prod/${BUCKET} 2>/dev/null | wc -l)
echo "PROD: $PROD_COUNT_AFTER fichiers (+$((PROD_COUNT_AFTER - PROD_COUNT)) nouveaux)"
echo "✅ Sync MinIO terminée"
