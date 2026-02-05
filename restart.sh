#!/bin/bash

# Script de redémarrage propre du serveur Next.js
# Usage: ./restart.sh [--clean]

PORT=7002
CLEAN_FLAG="$1"

echo "🛑 Arrêt du serveur sur le port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || echo "Aucun processus actif sur le port $PORT"

if [ "$CLEAN_FLAG" = "--clean" ]; then
    echo "🧹 Nettoyage du cache .next..."
    rm -rf .next
    echo "✓ Cache nettoyé"
fi

echo "🚀 Démarrage du serveur..."
npm run dev
