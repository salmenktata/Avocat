#!/bin/bash

###############################################################################
# Setup - Installation cron notifications quotidiennes
# Remplace pg_cron Supabase par cron bash VPS
#
# Phase 4.3 - Notification API (remplacer Supabase)
# Usage: bash scripts/setup-notifications-cron.sh
###############################################################################

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         INSTALLATION CRON NOTIFICATIONS QUOTIDIENNES         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Vérifier si root
if [ "$EUID" -ne 0 ]; then
  echo "⚠️  Ce script doit être exécuté en tant que root"
  echo "Usage: sudo bash scripts/setup-notifications-cron.sh"
  exit 1
fi

# Variables
CRON_USER="root"
CRON_SCRIPT="/opt/qadhya/scripts/cron-send-notifications.sh"
LOG_FILE="/var/log/qadhya/send-notifications.log"

# S'assurer que le script existe
if [ ! -f "$CRON_SCRIPT" ]; then
  echo "❌ Script non trouvé: $CRON_SCRIPT"
  exit 1
fi

# Rendre le script exécutable
chmod +x "$CRON_SCRIPT"
echo "✅ Script rendu exécutable"

# S'assurer que le dossier de logs existe
mkdir -p "$(dirname "$LOG_FILE")"
echo "✅ Dossier de logs créé"

# Vérifier si le cron existe déjà
if crontab -u "$CRON_USER" -l 2>/dev/null | grep -q "cron-send-notifications.sh"; then
  echo "⚠️  Cron déjà installé"
  echo ""
  echo "Voulez-vous réinstaller? (y/N)"
  read -r CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "❌ Installation annulée"
    exit 0
  fi

  # Supprimer l'ancien cron
  crontab -u "$CRON_USER" -l | grep -v "cron-send-notifications.sh" | crontab -u "$CRON_USER" -
  echo "✅ Ancien cron supprimé"
fi

# Ajouter le nouveau cron
# Toutes les heures de 06:00 à 10:00 pour gérer différents fuseaux horaires
# Seuls les utilisateurs avec send_time correspondant recevront des emails
(crontab -u "$CRON_USER" -l 2>/dev/null || true; cat <<EOF

# Qadhya - Notifications quotidiennes (Phase 4.3)
# Toutes les heures de 06:00 à 10:00 (heure serveur)
# L'API filtre automatiquement par send_time des utilisateurs
0 6-10 * * * bash $CRON_SCRIPT >> $LOG_FILE 2>&1

EOF
) | crontab -u "$CRON_USER" -

echo "✅ Cron installé avec succès"
echo ""

# Afficher le crontab configuré
echo "▓▓▓ CRONTAB CONFIGURÉ ▓▓▓"
crontab -u "$CRON_USER" -l | grep -A 3 "Notifications quotidiennes"
echo ""

# Instructions
echo "▓▓▓ INSTRUCTIONS ▓▓▓"
echo ""
echo "✓ Cron configuré: Toutes les heures de 06:00 à 10:00"
echo "✓ Script: $CRON_SCRIPT"
echo "✓ Logs: $LOG_FILE"
echo ""
echo "Commandes utiles:"
echo ""
echo "  # Voir les logs"
echo "  tail -f $LOG_FILE"
echo ""
echo "  # Tester manuellement"
echo "  bash $CRON_SCRIPT"
echo ""
echo "  # Lister les crons"
echo "  crontab -u $CRON_USER -l"
echo ""
echo "  # Supprimer le cron"
echo "  crontab -u $CRON_USER -l | grep -v 'cron-send-notifications.sh' | crontab -u $CRON_USER -"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ INSTALLATION TERMINÉE"
echo "════════════════════════════════════════════════════════════════"
