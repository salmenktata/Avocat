#!/bin/bash
set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VPS_HOST="root@84.247.165.187"
VPS_MAINTENANCE_DIR="/var/www/html"
VPS_NGINX_CONFIG="/etc/nginx/sites-available/moncabinet"
LOCAL_MAINTENANCE_FILE="public/maintenance.html"

# Fonction de log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."

    # Vérifier que le fichier maintenance.html existe
    if [ ! -f "$LOCAL_MAINTENANCE_FILE" ]; then
        log_error "Le fichier $LOCAL_MAINTENANCE_FILE n'existe pas"
        exit 1
    fi

    # Vérifier la connexion SSH
    if ! ssh -o ConnectTimeout=5 "$VPS_HOST" "echo 'Connection OK'" > /dev/null 2>&1; then
        log_error "Impossible de se connecter au VPS ($VPS_HOST)"
        exit 1
    fi

    log_success "Prérequis OK"
}

# Fonction pour copier le fichier de maintenance
copy_maintenance_file() {
    log_info "Copie du fichier maintenance.html sur le VPS..."

    # Créer le dossier si nécessaire
    ssh "$VPS_HOST" "mkdir -p $VPS_MAINTENANCE_DIR"

    # Copier le fichier
    scp "$LOCAL_MAINTENANCE_FILE" "$VPS_HOST:$VPS_MAINTENANCE_DIR/"

    # Vérifier que le fichier a été copié
    if ssh "$VPS_HOST" "[ -f $VPS_MAINTENANCE_DIR/maintenance.html ]"; then
        log_success "Fichier copié avec succès"
    else
        log_error "Échec de la copie du fichier"
        exit 1
    fi
}

# Fonction pour sauvegarder la config Nginx actuelle
backup_nginx_config() {
    log_info "Sauvegarde de la configuration Nginx actuelle..."

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="${VPS_NGINX_CONFIG}.backup-maintenance-${TIMESTAMP}"

    ssh "$VPS_HOST" "cp $VPS_NGINX_CONFIG $BACKUP_FILE"

    log_success "Sauvegarde créée : $BACKUP_FILE"
    echo "$BACKUP_FILE"
}

# Fonction pour mettre à jour la config Nginx
update_nginx_config() {
    local backup_file=$1
    log_info "Mise à jour de la configuration Nginx..."

    # Script pour modifier la config Nginx sur le VPS
    ssh "$VPS_HOST" bash <<'ENDSSH'
set -e

NGINX_CONFIG="/etc/nginx/sites-available/moncabinet"

# Vérifier si la configuration existe déjà
if grep -q "error_page 502 503 504 /maintenance.html" "$NGINX_CONFIG"; then
    echo "Configuration de maintenance déjà présente"
    exit 0
fi

# Créer un fichier temporaire avec les modifications
TMP_FILE=$(mktemp)

# Lire le fichier ligne par ligne et ajouter la config
in_server_block=0
config_added=0

while IFS= read -r line; do
    echo "$line" >> "$TMP_FILE"

    # Détecter l'entrée dans le bloc server principal (port 443)
    if [[ "$line" =~ ^[[:space:]]*server[[:space:]]*\{ ]] && [ $in_server_block -eq 0 ]; then
        in_server_block=1
    fi

    # Détecter la ligne avec listen 443
    if [ $in_server_block -eq 1 ] && [[ "$line" =~ listen[[:space:]]+443 ]] && [ $config_added -eq 0 ]; then
        # Chercher la fin des directives SSL (après ssl_protocols, ssl_ciphers, etc.)
        continue
    fi

    # Ajouter la config après ssl_verify_client ou après la première location si ssl_verify_client n'existe pas
    if [ $in_server_block -eq 1 ] && [ $config_added -eq 0 ]; then
        if [[ "$line" =~ ssl_verify_client ]] || [[ "$line" =~ ^[[:space:]]*location ]]; then
            if [[ "$line" =~ ^[[:space:]]*location ]]; then
                # Insérer avant la première location
                cat >> "$TMP_FILE" <<'EOF'

    # Configuration page de maintenance
    proxy_intercept_errors on;
    error_page 502 503 504 /maintenance.html;

    location /maintenance.html {
        root /var/www/html;
        internal;
    }

EOF
            else
                # Attendre la prochaine ligne vide ou location
                continue
            fi
            config_added=1
        fi
    fi
done < "$NGINX_CONFIG"

# Si la config n'a pas été ajoutée (cas où il n'y a pas de location), l'ajouter avant le dernier }
if [ $config_added -eq 0 ]; then
    # Supprimer la dernière ligne (}) et ajouter la config
    sed -i '$ d' "$TMP_FILE"
    cat >> "$TMP_FILE" <<'EOF'

    # Configuration page de maintenance
    proxy_intercept_errors on;
    error_page 502 503 504 /maintenance.html;

    location /maintenance.html {
        root /var/www/html;
        internal;
    }
}
EOF
fi

# Remplacer le fichier original
cp "$TMP_FILE" "$NGINX_CONFIG"
rm "$TMP_FILE"

echo "Configuration Nginx mise à jour avec succès"
ENDSSH

    if [ $? -eq 0 ]; then
        log_success "Configuration Nginx mise à jour"
    else
        log_error "Échec de la mise à jour de la configuration"
        log_warning "Restauration de la sauvegarde..."
        ssh "$VPS_HOST" "cp $backup_file $VPS_NGINX_CONFIG"
        exit 1
    fi
}

# Fonction pour tester la configuration Nginx
test_nginx_config() {
    log_info "Test de la configuration Nginx..."

    if ssh "$VPS_HOST" "nginx -t" 2>&1 | grep -q "successful"; then
        log_success "Configuration Nginx valide"
        return 0
    else
        log_error "Configuration Nginx invalide"
        return 1
    fi
}

# Fonction pour recharger Nginx
reload_nginx() {
    log_info "Rechargement de Nginx..."

    if ssh "$VPS_HOST" "systemctl reload nginx"; then
        log_success "Nginx rechargé avec succès"
    else
        log_error "Échec du rechargement de Nginx"
        exit 1
    fi
}

# Fonction pour tester la page de maintenance
test_maintenance_page() {
    log_info ""
    log_info "=========================================="
    log_info "Test de la page de maintenance"
    log_info "=========================================="
    log_info ""

    read -p "Voulez-vous tester la page de maintenance en arrêtant temporairement le serveur Next.js ? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_warning "Arrêt du container Next.js..."
        ssh "$VPS_HOST" "docker stop moncabinet-nextjs"

        log_info "Visitez maintenant https://qadhya.tn dans votre navigateur"
        log_info "Vous devriez voir la page de maintenance"
        log_info ""

        read -p "Appuyez sur Entrée pour redémarrer le serveur..." -r

        log_info "Redémarrage du container Next.js..."
        ssh "$VPS_HOST" "docker start moncabinet-nextjs"

        log_success "Container redémarré"
        log_info "La page de maintenance ne devrait plus apparaître"
    else
        log_info "Test de la page de maintenance ignoré"
    fi
}

# Fonction pour afficher le résumé
show_summary() {
    log_info ""
    log_info "=========================================="
    log_success "Configuration de la page de maintenance terminée !"
    log_info "=========================================="
    log_info ""
    log_info "Résumé des modifications :"
    log_info "  • Page de maintenance : $VPS_MAINTENANCE_DIR/maintenance.html"
    log_info "  • Configuration Nginx : $VPS_NGINX_CONFIG"
    log_info "  • Codes d'erreur interceptés : 502, 503, 504"
    log_info ""
    log_info "La page de maintenance s'affichera automatiquement si :"
    log_info "  • Le container Next.js est arrêté"
    log_info "  • Le serveur Next.js ne répond pas"
    log_info "  • Nginx ne peut pas joindre l'upstream"
    log_info ""
    log_info "Pour tester manuellement :"
    log_info "  ssh $VPS_HOST 'docker stop moncabinet-nextjs'"
    log_info "  # Visiter https://qadhya.tn"
    log_info "  ssh $VPS_HOST 'docker start moncabinet-nextjs'"
    log_info ""
}

# Script principal
main() {
    log_info "=========================================="
    log_info "Déploiement de la page de maintenance"
    log_info "=========================================="
    log_info ""

    # Vérifier les prérequis
    check_prerequisites

    # Copier le fichier de maintenance
    copy_maintenance_file

    # Sauvegarder la config Nginx
    backup_file=$(backup_nginx_config)

    # Mettre à jour la config Nginx
    update_nginx_config "$backup_file"

    # Tester la config Nginx
    if ! test_nginx_config; then
        log_error "Configuration Nginx invalide, restauration de la sauvegarde..."
        ssh "$VPS_HOST" "cp $backup_file $VPS_NGINX_CONFIG"
        exit 1
    fi

    # Recharger Nginx
    reload_nginx

    # Test optionnel
    test_maintenance_page

    # Afficher le résumé
    show_summary
}

# Exécuter le script principal
main
