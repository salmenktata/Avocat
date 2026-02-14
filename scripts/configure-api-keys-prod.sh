#!/bin/bash
# Script interactif de configuration des clés API production
# Configure GOOGLE_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY

set -eo pipefail

ENV_FILE="/opt/qadhya/.env.production.local"
BACKUP_FILE="/opt/qadhya/.env.production.local.backup.$(date +%s)"

echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃ Configuration Clés API Production         ┃"
echo "┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫"
echo ""

# Vérifier qu'on est sur le VPS
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Erreur: Ce script doit être exécuté sur le VPS"
  echo "   Fichier introuvable: $ENV_FILE"
  exit 1
fi

# Backup automatique
echo "📦 Backup .env actuel..."
cp "$ENV_FILE" "$BACKUP_FILE"
echo "   Sauvegardé: $BACKUP_FILE"
echo ""

# Fonction pour ajouter/mettre à jour une clé
update_env_key() {
  local key=$1
  local value=$2

  if grep -q "^${key}=" "$ENV_FILE"; then
    # Clé existe, mettre à jour
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    echo "   ✅ $key mise à jour"
  else
    # Clé n'existe pas, ajouter
    echo "${key}=${value}" >> "$ENV_FILE"
    echo "   ✅ $key ajoutée"
  fi
}

# Configuration Google Gemini
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1/4 - Google Gemini (Gratuit, Prioritaire)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Obtenir clé: https://makersuite.google.com/app/apikey"
echo "   Format attendu: AIza..."
echo ""

if grep -q "^GOOGLE_API_KEY=" "$ENV_FILE"; then
  CURRENT_KEY=$(grep "^GOOGLE_API_KEY=" "$ENV_FILE" | cut -d= -f2)
  if [ -n "$CURRENT_KEY" ]; then
    echo "⚠️  Clé existante trouvée: ${CURRENT_KEY:0:10}***"
    read -p "Voulez-vous la remplacer ? (o/N) " -n 1 -r REPLACE_GEMINI
    echo ""
    if [[ ! $REPLACE_GEMINI =~ ^[Oo]$ ]]; then
      echo "   ⏭️  Clé Gemini conservée"
      echo ""
    else
      read -p "Nouvelle clé Google Gemini (ou Entrée pour skip): " GOOGLE_KEY
      if [ -n "$GOOGLE_KEY" ]; then
        update_env_key "GOOGLE_API_KEY" "$GOOGLE_KEY"
      fi
      echo ""
    fi
  else
    read -p "Clé Google Gemini (ou Entrée pour skip): " GOOGLE_KEY
    if [ -n "$GOOGLE_KEY" ]; then
      update_env_key "GOOGLE_API_KEY" "$GOOGLE_KEY"
    fi
    echo ""
  fi
else
  read -p "Clé Google Gemini (ou Entrée pour skip): " GOOGLE_KEY
  if [ -n "$GOOGLE_KEY" ]; then
    update_env_key "GOOGLE_API_KEY" "$GOOGLE_KEY"
  fi
  echo ""
fi

# Configuration Groq
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2/4 - Groq (Rapide, Gratuit)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Obtenir clé: https://console.groq.com/keys"
echo "   Format attendu: gsk_..."
echo "   ⚠️  Clé actuelle invalide (HTTP 401) - Renouvellement requis"
echo ""

read -p "Nouvelle clé Groq (ou Entrée pour skip): " GROQ_KEY
if [ -n "$GROQ_KEY" ]; then
  update_env_key "GROQ_API_KEY" "$GROQ_KEY"
fi
echo ""

# Configuration DeepSeek
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3/4 - DeepSeek (Économique, \$0.14/M tokens)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Obtenir clé: https://platform.deepseek.com/api_keys"
echo "   Format attendu: sk-..."
echo ""

if grep -q "^DEEPSEEK_API_KEY=" "$ENV_FILE"; then
  CURRENT_KEY=$(grep "^DEEPSEEK_API_KEY=" "$ENV_FILE" | cut -d= -f2)
  if [ -n "$CURRENT_KEY" ]; then
    echo "✅ Clé existante trouvée: ${CURRENT_KEY:0:10}***"
    echo "   ⏭️  Clé DeepSeek conservée (présente mais container nécessite restart)"
    echo ""
  else
    read -p "Clé DeepSeek (ou Entrée pour skip): " DEEPSEEK_KEY
    if [ -n "$DEEPSEEK_KEY" ]; then
      update_env_key "DEEPSEEK_API_KEY" "$DEEPSEEK_KEY"
    fi
    echo ""
  fi
else
  read -p "Clé DeepSeek (ou Entrée pour skip): " DEEPSEEK_KEY
  if [ -n "$DEEPSEEK_KEY" ]; then
    update_env_key "DEEPSEEK_API_KEY" "$DEEPSEEK_KEY"
  fi
  echo ""
fi

# Configuration Anthropic (optionnel)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4/4 - Anthropic Claude (Optionnel, Puissant)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Obtenir clé: https://console.anthropic.com/settings/keys"
echo "   Format attendu: sk-ant-..."
echo "   ℹ️  Optionnel: Fallback ultime si tous les autres échouent"
echo ""

read -p "Clé Anthropic (ou Entrée pour skip): " ANTHROPIC_KEY
if [ -n "$ANTHROPIC_KEY" ]; then
  update_env_key "ANTHROPIC_API_KEY" "$ANTHROPIC_KEY"
fi
echo ""

# Résumé
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃ Résumé Configuration                      ┃"
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""

# Vérifier clés configurées
CONFIGURED=0
[ -n "$(grep '^GOOGLE_API_KEY=.\+' $ENV_FILE 2>/dev/null)" ] && echo "✅ Google Gemini configurée" && ((CONFIGURED++))
[ -n "$(grep '^GROQ_API_KEY=.\+' $ENV_FILE 2>/dev/null)" ] && echo "✅ Groq configurée" && ((CONFIGURED++))
[ -n "$(grep '^DEEPSEEK_API_KEY=.\+' $ENV_FILE 2>/dev/null)" ] && echo "✅ DeepSeek configurée" && ((CONFIGURED++))
[ -n "$(grep '^OPENAI_API_KEY=.\+' $ENV_FILE 2>/dev/null)" ] && echo "✅ OpenAI configurée (déjà présente)" && ((CONFIGURED++))
[ -n "$(grep '^ANTHROPIC_API_KEY=.\+' $ENV_FILE 2>/dev/null)" ] && echo "✅ Anthropic configurée" && ((CONFIGURED++))

echo ""
echo "📊 Total: $CONFIGURED/5 providers configurés"
echo ""

# Proposer restart
if [ $CONFIGURED -ge 2 ]; then
  echo "🔄 Restart du container requis pour appliquer les changements"
  echo ""
  read -p "Voulez-vous redémarrer maintenant ? (O/n) " -n 1 -r RESTART
  echo ""

  if [[ ! $RESTART =~ ^[Nn]$ ]]; then
    echo ""
    echo "⏳ Restart du container en cours..."
    cd /opt/qadhya
    docker compose restart nextjs
    echo ""
    echo "✅ Container redémarré"
    echo ""

    # Proposer test
    read -p "Voulez-vous tester les clés maintenant ? (O/n) " -n 1 -r TEST
    echo ""

    if [[ ! $TEST =~ ^[Nn]$ ]]; then
      echo ""
      bash /opt/qadhya/scripts/test-api-keys-prod-simple.sh
    fi
  else
    echo ""
    echo "ℹ️  N'oubliez pas de redémarrer plus tard:"
    echo "   cd /opt/qadhya && docker compose restart nextjs"
  fi
else
  echo "⚠️  Configurez au moins 2 providers avant de redémarrer"
fi

echo ""
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""
echo "📄 Backup disponible: $BACKUP_FILE"
echo "   Restaurer: cp $BACKUP_FILE $ENV_FILE"
echo ""
