#!/bin/bash

################################################################################
# Script d'installation automatique MonCabinet sur VPS Contabo
#
# Ce script installe et configure automatiquement :
# - Node.js 18+ & npm
# - Nginx (reverse proxy)
# - PM2 (process manager)
# - Certbot (SSL Let's Encrypt)
# - Configuration firewall
# - Déploiement de l'application Next.js
#
# Usage: sudo bash setup-vps.sh
################################################################################

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
print_message() {
    echo -e "${BLUE}[MonCabinet]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Vérifier que le script est exécuté en tant que root
if [ "$EUID" -ne 0 ]; then
    print_error "Ce script doit être exécuté en tant que root (sudo)"
    exit 1
fi

clear
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║     Installation MonCabinet sur VPS Contabo               ║"
echo "║     Plateforme de gestion de cabinet juridique            ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# ÉTAPE 1 : COLLECTE DES INFORMATIONS
# ============================================================================

print_message "Configuration initiale - Veuillez répondre aux questions suivantes :"
echo ""

read -p "Nom de domaine (ex: moncabinet.tn) : " DOMAIN_NAME
read -p "Email pour les certificats SSL (ex: admin@moncabinet.tn) : " SSL_EMAIL
read -p "Port de l'application Next.js (défaut: 7002) : " APP_PORT
APP_PORT=${APP_PORT:-7002}

read -p "URL du repository Git (ex: https://github.com/user/Avocat.git) : " GIT_REPO

# Créer un utilisateur non-root
read -p "Créer un utilisateur non-root ? (o/n, défaut: o) : " CREATE_USER
CREATE_USER=${CREATE_USER:-o}

if [ "$CREATE_USER" = "o" ]; then
    read -p "Nom d'utilisateur (défaut: moncabinet) : " USERNAME
    USERNAME=${USERNAME:-moncabinet}
fi

echo ""
print_message "Récapitulatif de la configuration :"
echo "  - Domaine : $DOMAIN_NAME"
echo "  - Email SSL : $SSL_EMAIL"
echo "  - Port application : $APP_PORT"
echo "  - Repository : $GIT_REPO"
if [ "$CREATE_USER" = "o" ]; then
    echo "  - Utilisateur : $USERNAME"
fi
echo ""

read -p "Confirmer et continuer ? (o/n) : " CONFIRM
if [ "$CONFIRM" != "o" ]; then
    print_error "Installation annulée"
    exit 1
fi

# ============================================================================
# ÉTAPE 2 : MISE À JOUR DU SYSTÈME
# ============================================================================

print_message "Étape 1/8 : Mise à jour du système..."

apt update && apt upgrade -y
apt install -y curl wget git ufw build-essential

print_success "Système mis à jour"

# ============================================================================
# ÉTAPE 3 : CRÉATION UTILISATEUR NON-ROOT
# ============================================================================

if [ "$CREATE_USER" = "o" ]; then
    print_message "Étape 2/8 : Création de l'utilisateur $USERNAME..."

    if id "$USERNAME" &>/dev/null; then
        print_warning "L'utilisateur $USERNAME existe déjà"
    else
        useradd -m -s /bin/bash "$USERNAME"
        usermod -aG sudo "$USERNAME"
        print_success "Utilisateur $USERNAME créé"
    fi
fi

# ============================================================================
# ÉTAPE 4 : CONFIGURATION FIREWALL
# ============================================================================

print_message "Étape 3/8 : Configuration du firewall..."

ufw --force disable
ufw --force reset

# Autoriser SSH
ufw allow 22/tcp

# Autoriser HTTP et HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Autoriser le port de l'application (en local seulement)
# ufw allow from 127.0.0.1 to any port $APP_PORT

# Activer le firewall
ufw --force enable

print_success "Firewall configuré (SSH:22, HTTP:80, HTTPS:443)"

# ============================================================================
# ÉTAPE 5 : INSTALLATION NODE.JS
# ============================================================================

print_message "Étape 4/8 : Installation de Node.js 18.x..."

# Supprimer les anciennes versions
apt remove -y nodejs npm || true

# Installer Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Vérifier l'installation
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)

print_success "Node.js $NODE_VERSION installé"
print_success "npm $NPM_VERSION installé"

# ============================================================================
# ÉTAPE 6 : INSTALLATION PM2
# ============================================================================

print_message "Étape 5/8 : Installation de PM2..."

npm install -g pm2

print_success "PM2 installé"

# ============================================================================
# ÉTAPE 7 : INSTALLATION ET CONFIGURATION NGINX
# ============================================================================

print_message "Étape 6/8 : Installation et configuration de Nginx..."

apt install -y nginx

# Créer la configuration Nginx
cat > /etc/nginx/sites-available/$DOMAIN_NAME <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN_NAME www.$DOMAIN_NAME;

    # Limite de taille pour les uploads
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Optimisation pour les assets statiques Next.js
    location /_next/static/ {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_cache_bypass \$http_upgrade;

        # Cache côté navigateur pour 1 an
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Logs
    access_log /var/log/nginx/$DOMAIN_NAME.access.log;
    error_log /var/log/nginx/$DOMAIN_NAME.error.log;
}
EOF

# Activer le site
ln -sf /etc/nginx/sites-available/$DOMAIN_NAME /etc/nginx/sites-enabled/

# Désactiver le site par défaut
rm -f /etc/nginx/sites-enabled/default

# Tester la configuration
nginx -t

# Redémarrer Nginx
systemctl restart nginx
systemctl enable nginx

print_success "Nginx configuré pour $DOMAIN_NAME"

# ============================================================================
# ÉTAPE 8 : INSTALLATION CERTBOT
# ============================================================================

print_message "Étape 7/8 : Installation de Certbot..."

apt install -y certbot python3-certbot-nginx

print_success "Certbot installé"

# ============================================================================
# ÉTAPE 9 : DÉPLOIEMENT DE L'APPLICATION
# ============================================================================

print_message "Étape 8/8 : Déploiement de l'application..."

# Déterminer l'utilisateur et le répertoire
if [ "$CREATE_USER" = "o" ]; then
    APP_USER=$USERNAME
    APP_DIR="/home/$USERNAME/moncabinet"
else
    APP_USER="root"
    APP_DIR="/var/www/moncabinet"
fi

# Créer le répertoire
mkdir -p $APP_DIR
cd $APP_DIR

# Cloner le repository
print_message "Clonage du repository..."
if [ -d "$APP_DIR/.git" ]; then
    print_warning "Le repository existe déjà, mise à jour..."
    git pull origin main || git pull origin master
else
    git clone $GIT_REPO .
fi

# Créer le fichier .env.production
print_message "Configuration des variables d'environnement..."

cat > $APP_DIR/.env.production <<EOF
# Application
NEXT_PUBLIC_APP_URL=https://$DOMAIN_NAME
NEXT_PUBLIC_APP_NAME=MonCabinet
NEXT_PUBLIC_APP_DOMAIN=$DOMAIN_NAME
NODE_ENV=production

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Resend (Email Service)
RESEND_API_KEY=
RESEND_FROM_EMAIL=notifications@$DOMAIN_NAME

# Google Drive OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://$DOMAIN_NAME/api/integrations/google-drive/callback
GOOGLE_DRIVE_WEBHOOK_VERIFY_TOKEN=

# WhatsApp Business API
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
EOF

print_warning "IMPORTANT : Éditez le fichier $APP_DIR/.env.production pour ajouter vos clés API"

# Installer les dépendances
print_message "Installation des dépendances npm..."
npm install

# Build production
print_message "Build de l'application en mode production..."
npm run build

# Changer les permissions
if [ "$CREATE_USER" = "o" ]; then
    chown -R $APP_USER:$APP_USER $APP_DIR
fi

# Démarrer l'application avec PM2
print_message "Démarrage de l'application avec PM2..."

if [ "$CREATE_USER" = "o" ]; then
    su - $APP_USER -c "cd $APP_DIR && pm2 start npm --name 'moncabinet' -- start"
    su - $APP_USER -c "pm2 save"
    su - $APP_USER -c "pm2 startup"
else
    cd $APP_DIR
    pm2 start npm --name "moncabinet" -- start
    pm2 save
    pm2 startup
fi

print_success "Application démarrée avec PM2"

# ============================================================================
# ÉTAPE 10 : CONFIGURATION SSL (optionnel)
# ============================================================================

echo ""
print_message "Configuration SSL Let's Encrypt"
print_warning "Avant de continuer, assurez-vous que :"
print_warning "  1. Votre domaine $DOMAIN_NAME pointe vers ce serveur"
print_warning "  2. Les enregistrements DNS sont propagés (peut prendre jusqu'à 48h)"
echo ""

read -p "Voulez-vous configurer SSL maintenant ? (o/n) : " CONFIGURE_SSL

if [ "$CONFIGURE_SSL" = "o" ]; then
    print_message "Génération du certificat SSL..."

    certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME \
        --non-interactive \
        --agree-tos \
        --email $SSL_EMAIL \
        --redirect

    if [ $? -eq 0 ]; then
        print_success "Certificat SSL configuré avec succès"
        print_success "Votre site est accessible sur https://$DOMAIN_NAME"
    else
        print_error "Erreur lors de la configuration SSL"
        print_warning "Vous pouvez réessayer plus tard avec :"
        print_warning "  sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME"
    fi
else
    print_warning "SSL non configuré. Pour le configurer plus tard :"
    print_warning "  sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME"
fi

# ============================================================================
# CRÉATION DES SCRIPTS UTILES
# ============================================================================

print_message "Création des scripts de gestion..."

# Script de mise à jour
cat > $APP_DIR/deploy.sh <<'DEPLOY_EOF'
#!/bin/bash

echo "🚀 Déploiement MonCabinet..."

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

echo "✅ Déploiement terminé !"
echo "📊 Logs : pm2 logs moncabinet"
DEPLOY_EOF

chmod +x $APP_DIR/deploy.sh

# Script de backup
cat > $APP_DIR/backup.sh <<'BACKUP_EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/moncabinet"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "💾 Backup de MonCabinet..."

# Backup de l'application
tar -czf $BACKUP_DIR/app_$DATE.tar.gz .

echo "✅ Backup créé : $BACKUP_DIR/app_$DATE.tar.gz"

# Garder seulement les 7 derniers backups
ls -t $BACKUP_DIR/app_*.tar.gz | tail -n +8 | xargs -r rm

echo "🧹 Anciens backups supprimés"
BACKUP_EOF

chmod +x $APP_DIR/backup.sh

print_success "Scripts créés dans $APP_DIR/"

# ============================================================================
# RÉCAPITULATIF FINAL
# ============================================================================

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║              ✅ INSTALLATION TERMINÉE !                    ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
print_success "MonCabinet est maintenant installé sur votre VPS"
echo ""
echo "📋 INFORMATIONS IMPORTANTES :"
echo ""
echo "  🌐 Domaine : $DOMAIN_NAME"
echo "  📁 Répertoire : $APP_DIR"
echo "  🔧 Port application : $APP_PORT"
if [ "$CREATE_USER" = "o" ]; then
    echo "  👤 Utilisateur : $APP_USER"
fi
echo ""
echo "📝 PROCHAINES ÉTAPES :"
echo ""
echo "  1️⃣  Éditez les variables d'environnement :"
echo "      nano $APP_DIR/.env.production"
echo ""
echo "  2️⃣  Redémarrez l'application après modification :"
echo "      pm2 restart moncabinet"
echo ""
echo "  3️⃣  Dans Cloudflare, mettez à jour l'enregistrement A :"
echo "      Type: A"
echo "      Nom: @"
echo "      Contenu: $(curl -s ifconfig.me)"
echo "      Proxy: Activé (☁️)"
echo ""
echo "  4️⃣  Configurez SSL/TLS dans Cloudflare :"
echo "      Mode: Full (strict)"
echo ""
echo "🔧 COMMANDES UTILES :"
echo ""
echo "  • Voir les logs : pm2 logs moncabinet"
echo "  • Redémarrer : pm2 restart moncabinet"
echo "  • Statut : pm2 status"
echo "  • Déployer : cd $APP_DIR && ./deploy.sh"
echo "  • Backup : cd $APP_DIR && ./backup.sh"
echo "  • Logs Nginx : tail -f /var/log/nginx/$DOMAIN_NAME.error.log"
echo ""
echo "📚 DOCUMENTATION :"
echo "  • Voir : $APP_DIR/README-DEPLOYMENT.md"
echo ""
echo "🔒 SÉCURITÉ :"
echo "  • Firewall UFW actif (SSH:22, HTTP:80, HTTPS:443)"
echo "  • SSL Let's Encrypt : $([ "$CONFIGURE_SSL" = "o" ] && echo "✅ Configuré" || echo "⚠️  À configurer")"
echo ""
print_warning "N'oubliez pas de configurer vos clés API dans .env.production !"
echo ""
