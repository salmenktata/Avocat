#!/bin/bash
# =============================================================================
# Script de correction des clés API en production
# =============================================================================
set -e

VPS_HOST="root@84.247.165.187"
ENV_FILE="/opt/moncabinet/.env"

echo "==================================================================="
echo "🔧 Correction clés API Production - $(date)"
echo "==================================================================="
echo ""

# Charger les clés depuis .env.local
if [ ! -f ".env.local" ]; then
  echo "❌ Erreur : Fichier .env.local introuvable"
  exit 1
fi

source .env.local

echo "📝 Clés API locales (valides) :"
echo "   - GOOGLE_API_KEY : ${GOOGLE_API_KEY:0:20}..."
echo "   - GROQ_API_KEY : ${GROQ_API_KEY:0:20}..."
echo "   - DEEPSEEK_API_KEY : ${DEEPSEEK_API_KEY:0:20}..."
echo "   - ENCRYPTION_KEY : ${ENCRYPTION_KEY:0:20}..."
echo ""

read -p "⚠️  Confirmer mise à jour production ? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Annulé"
  exit 1
fi

echo "🚀 Mise à jour clés API sur VPS..."
echo ""

# Créer backup du fichier actuel
ssh $VPS_HOST "cp $ENV_FILE ${ENV_FILE}.backup-\$(date +%Y%m%d-%H%M%S)"
echo "✅ Backup créé"

# Mettre à jour les clés dans le fichier .env
echo "🔑 Mise à jour des clés API..."
ssh $VPS_HOST << EOF
set -e

# Fonction pour mettre à jour ou ajouter une variable
update_env() {
  local key=\$1
  local value=\$2

  if grep -q "^\${key}=" "$ENV_FILE" 2>/dev/null; then
    # Remplacer valeur existante
    sed -i "s|^\${key}=.*|\${key}=\${value}|" "$ENV_FILE"
  else
    # Ajouter nouvelle ligne
    echo "\${key}=\${value}" >> "$ENV_FILE"
  fi
  echo "  ✓ \${key} mise à jour"
}

# Mettre à jour les clés API
update_env 'GOOGLE_API_KEY' '$GOOGLE_API_KEY'
update_env 'GROQ_API_KEY' '$GROQ_API_KEY'
update_env 'DEEPSEEK_API_KEY' '$DEEPSEEK_API_KEY'
update_env 'ENCRYPTION_KEY' '$ENCRYPTION_KEY'
update_env 'GEMINI_MODEL' '${GEMINI_MODEL:-gemini-2.0-flash-exp}'
update_env 'DEEPSEEK_MODEL' '${DEEPSEEK_MODEL:-deepseek-chat}'
update_env 'GROQ_MODEL' '${GROQ_MODEL:-llama-3.3-70b-versatile}'

echo ""
echo "✅ Fichier .env mis à jour"
EOF

echo ""
echo "🔄 Redémarrage container Next.js..."
ssh $VPS_HOST "cd /opt/moncabinet && docker compose -f docker-compose.prod.yml restart nextjs"

echo ""
echo "⏳ Attente démarrage (15 secondes)..."
sleep 15

echo ""
echo "✅ Vérification santé..."
ssh $VPS_HOST "docker exec moncabinet-nextjs node -e \"require('http').get('http://localhost:3000/api/health', (r) => {console.log('Status:', r.statusCode); process.exit(r.statusCode === 200 ? 0 : 1)})\" 2>&1 || echo '⚠️  Container en cours de démarrage...'"

echo ""
echo "📊 Vérification variables dans container..."
ssh $VPS_HOST "docker exec moncabinet-nextjs sh -c 'echo GOOGLE_API_KEY=\${GOOGLE_API_KEY:0:20}...; echo GROQ_API_KEY=\${GROQ_API_KEY:0:20}...; echo DEEPSEEK_API_KEY=\${DEEPSEEK_API_KEY:0:20}...'"

echo ""
echo "==================================================================="
echo "✅ Clés API mises à jour en production"
echo "==================================================================="
echo ""
echo "📝 Prochaines étapes :"
echo "   1. Tester : https://qadhya.tn/dossiers/consultation"
echo "   2. Surveiller logs : ssh $VPS_HOST 'docker logs -f moncabinet-nextjs | grep -i error'"
echo "   3. Mettre à jour GitHub Secrets pour futurs déploiements :"
echo "      - Settings → Secrets → Actions"
echo "      - Ajouter/Mettre à jour GOOGLE_API_KEY, DEEPSEEK_API_KEY"
echo ""
