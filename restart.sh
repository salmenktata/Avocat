#!/bin/bash

# Script de redémarrage propre du serveur Next.js
# Usage: ./restart.sh [--no-clean]
# Par défaut: nettoie toujours le cache .next

PORT=7002
NO_CLEAN_FLAG="$1"

echo "🛑 Arrêt du serveur sur le port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || echo "Aucun processus actif sur le port $PORT"

# Nettoyer le cache par défaut (sauf si --no-clean)
if [ "$NO_CLEAN_FLAG" != "--no-clean" ]; then
    echo "🧹 Nettoyage du cache .next..."
    rm -rf .next
    echo "✓ Cache nettoyé"
else
    echo "⏩ Redémarrage rapide (cache conservé)"
fi

echo "🚀 Démarrage du serveur..."
npm run dev
