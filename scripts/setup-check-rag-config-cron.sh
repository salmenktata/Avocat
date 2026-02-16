#!/bin/bash
#═══════════════════════════════════════════════════════════════════════════════
# Script: Installation cron vérification configuration RAG
# Usage: bash scripts/setup-check-rag-config-cron.sh
# Exécution: Sur VPS en tant que root
#═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

echo "═══════════════════════════════════════════════════════════════"
echo "🔧 Installation cron vérification configuration RAG"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Vérifier si root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Ce script doit être exécuté en tant que root"
  echo "   Usage: sudo bash scripts/setup-check-rag-config-cron.sh"
  exit 1
fi

# Configuration
PROJECT_DIR="/opt/qadhya"
CRON_FILE="/etc/cron.d/qadhya-check-rag-config"
LOG_DIR="/var/log/qadhya"

# Vérifier que le projet existe
if [ ! -d "$PROJECT_DIR" ]; then
  echo "❌ Répertoire projet introuvable: $PROJECT_DIR"
  exit 1
fi

# Vérifier que le script existe
if [ ! -f "$PROJECT_DIR/scripts/cron-check-rag-config.sh" ]; then
  echo "❌ Script check-rag-config introuvable: $PROJECT_DIR/scripts/cron-check-rag-config.sh"
  exit 1
fi

# Vérifier que cron-logger existe
if [ ! -f "$PROJECT_DIR/scripts/lib/cron-logger.sh" ]; then
  echo "❌ Bibliothèque cron-logger.sh introuvable: $PROJECT_DIR/scripts/lib/cron-logger.sh"
  exit 1
fi

# Créer répertoire logs si nécessaire
mkdir -p "$LOG_DIR"
chmod 755 "$LOG_DIR"

echo "📋 Configuration:"
echo "  Projet: $PROJECT_DIR"
echo "  Cron: $CRON_FILE"
echo "  Logs: $LOG_DIR/check-rag-config.log"
echo ""

# Récupérer CRON_SECRET du container
echo "🔑 Récupération CRON_SECRET du container..."
CRON_SECRET=$(docker exec qadhya-nextjs printenv CRON_SECRET 2>/dev/null || echo "")

if [ -z "$CRON_SECRET" ]; then
  echo "⚠️  CRON_SECRET non trouvé dans container"
  echo "   Alertes email seront désactivées"
  CRON_SECRET=""
fi

# Créer fichier cron
cat > "$CRON_FILE" << EOF
# Qadhya - Vérification configuration RAG quotidienne
# Détecte misconfigurations RAG (OLLAMA_ENABLED=false, etc.)

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
CRON_SECRET=$CRON_SECRET

# Vérification RAG tous les jours à 8h
0 8 * * * root bash $PROJECT_DIR/scripts/cron-check-rag-config.sh >> $LOG_DIR/check-rag-config.log 2>&1
EOF

# Permissions (600 car contient CRON_SECRET)
chmod 600 "$CRON_FILE"

echo "✅ Fichier cron créé: $CRON_FILE"
echo ""

# Afficher contenu (masquer secret)
echo "📄 Contenu du cron:"
cat "$CRON_FILE" | sed "s/CRON_SECRET=.*/CRON_SECRET=***masked***/"
echo ""

# Recharger cron
if command -v systemctl &> /dev/null; then
  systemctl reload cron || systemctl restart cron
  echo "✅ Service cron rechargé (systemctl)"
elif command -v service &> /dev/null; then
  service cron reload || service cron restart
  echo "✅ Service cron rechargé (service)"
else
  echo "⚠️  Impossible de recharger cron automatiquement"
  echo "   Exécutez manuellement: service cron reload"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Installation terminée"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📊 Vérification:"
echo "  grep -r 'check-rag-config' /etc/cron.d/  # Vérifier cron installé"
echo "  tail -f $LOG_DIR/check-rag-config.log      # Suivre logs"
echo ""
echo "🔧 Test manuel:"
echo "  export CRON_SECRET='...' && bash $PROJECT_DIR/scripts/cron-check-rag-config.sh"
echo ""
echo "💡 Note: Cron s'exécute quotidiennement à 8h"
echo "   Prochaine exécution: demain 8h00"
echo ""
