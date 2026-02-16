#!/bin/bash
# Script: Installation cron cleanup jobs orphelins
# Usage: bash scripts/setup-cleanup-jobs-cron.sh
# Exécution: Sur VPS en tant que root

set -euo pipefail

echo "═══════════════════════════════════════════════════════════════"
echo "🔧 Installation cron cleanup jobs orphelins"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Vérifier si root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Ce script doit être exécuté en tant que root"
  echo "   Usage: sudo bash scripts/setup-cleanup-jobs-cron.sh"
  exit 1
fi

# Configuration
PROJECT_DIR="/opt/qadhya"
CRON_FILE="/etc/cron.d/qadhya-cleanup-jobs"
LOG_DIR="/var/log/qadhya"

# Vérifier que le projet existe
if [ ! -d "$PROJECT_DIR" ]; then
  echo "❌ Répertoire projet introuvable: $PROJECT_DIR"
  exit 1
fi

# Vérifier que le script existe
if [ ! -f "$PROJECT_DIR/scripts/cron-cleanup-orphaned-jobs.sh" ]; then
  echo "❌ Script cleanup introuvable: $PROJECT_DIR/scripts/cron-cleanup-orphaned-jobs.sh"
  exit 1
fi

# Créer répertoire logs si nécessaire
mkdir -p "$LOG_DIR"
chmod 755 "$LOG_DIR"

echo "📋 Configuration:"
echo "  Projet: $PROJECT_DIR"
echo "  Cron: $CRON_FILE"
echo "  Logs: $LOG_DIR/cleanup-jobs.log"
echo ""

# Créer fichier cron
cat > "$CRON_FILE" << 'EOF'
# Qadhya - Cleanup jobs orphelins toutes les 15 minutes
# Nettoyage automatique des indexing_jobs et web_crawl_jobs stuck après restart

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Cleanup jobs orphelins (timeout 10min indexing, 20min crawls)
*/15 * * * * root bash /opt/qadhya/scripts/cron-cleanup-orphaned-jobs.sh >> /var/log/qadhya/cleanup-jobs.log 2>&1
EOF

# Permissions
chmod 644 "$CRON_FILE"

echo "✅ Fichier cron créé: $CRON_FILE"
echo ""

# Afficher contenu
echo "📄 Contenu du cron:"
cat "$CRON_FILE"
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
echo "  crontab -l                              # Vérifier crons installés"
echo "  tail -f /var/log/qadhya/cleanup-jobs.log  # Suivre logs"
echo ""
echo "🔧 Test manuel:"
echo "  bash /opt/qadhya/scripts/cron-cleanup-orphaned-jobs.sh"
echo ""
