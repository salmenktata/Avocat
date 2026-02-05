#!/bin/bash

################################################################################
# Script de déploiement rapide MonCabinet
#
# Ce script met à jour l'application déjà installée sur le VPS
#
# Usage: ./deploy.sh
################################################################################

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Déploiement MonCabinet${NC}"
echo ""

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Erreur : package.json non trouvé"
    echo "Assurez-vous d'être dans le répertoire de l'application"
    exit 1
fi

# Pull dernières modifications
echo "📥 Récupération des dernières modifications..."
git pull origin main || git pull origin master

# Installer les nouvelles dépendances
echo "📦 Installation des dépendances..."
npm install

# Build production
echo "🔨 Build production..."
npm run build

# Redémarrer PM2
echo "♻️  Redémarrage de l'application..."
pm2 restart moncabinet

echo ""
echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo ""
echo "📊 Commandes utiles :"
echo "  • Voir les logs : pm2 logs moncabinet"
echo "  • Statut : pm2 status"
echo "  • Arrêter : pm2 stop moncabinet"
echo "  • Redémarrer : pm2 restart moncabinet"
echo ""
