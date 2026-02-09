#!/bin/bash
#
# Script d'initialisation des buckets MinIO en production
#
# Usage: ./scripts/init-minio-prod.sh [VPS_IP]
# Exemple: ./scripts/init-minio-prod.sh 84.247.165.187
#

set -e

VPS_IP="${1:-84.247.165.187}"
CONTAINER="moncabinet-minio"
ALIAS="prod"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔧 Initialisation buckets MinIO en production"
echo "   VPS: $VPS_IP"
echo "   Container: $CONTAINER"
echo ""

# Buckets à créer
BUCKETS=("documents" "web-files" "avatars" "uploads")

# Configurer alias MinIO (si pas déjà fait)
echo "📡 Configuration alias MinIO..."
ssh root@$VPS_IP "docker exec $CONTAINER mc alias set $ALIAS http://localhost:9000 \$(grep MINIO_ROOT_USER /opt/moncabinet/.env | cut -d= -f2) \$(grep MINIO_ROOT_PASSWORD /opt/moncabinet/.env | cut -d= -f2)" || true

# Créer chaque bucket
CREATED=0
EXISTING=0
ERRORS=0

for bucket in "${BUCKETS[@]}"; do
  echo -n "Vérification bucket '$bucket'... "

  # Vérifier si le bucket existe
  if ssh root@$VPS_IP "docker exec $CONTAINER mc stat $ALIAS/$bucket >/dev/null 2>&1"; then
    echo -e "${GREEN}✅ Existant${NC}"
    ((EXISTING++))
  else
    # Créer le bucket
    if ssh root@$VPS_IP "docker exec $CONTAINER mc mb $ALIAS/$bucket 2>&1"; then
      echo -e "${GREEN}🆕 Créé${NC}"
      ((CREATED++))
    else
      echo -e "${RED}❌ Erreur${NC}"
      ((ERRORS++))
    fi
  fi
done

# Lister les buckets pour vérification
echo ""
echo "📋 Buckets disponibles:"
ssh root@$VPS_IP "docker exec $CONTAINER mc ls $ALIAS"

# Résumé
echo ""
echo "📊 Résumé:"
echo "   - Buckets existants: $EXISTING"
echo "   - Buckets créés: $CREATED"
echo "   - Erreurs: $ERRORS"

if [ $ERRORS -gt 0 ]; then
  echo -e "\n${RED}⚠️  Certains buckets n'ont pas pu être créés${NC}"
  exit 1
fi

echo -e "\n${GREEN}✅ Initialisation MinIO terminée avec succès${NC}"
