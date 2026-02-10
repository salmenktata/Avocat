#!/bin/bash

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VPS_HOST="root@84.247.165.187"

echo -e "${BLUE}=========================================="
echo "Vérification Page de Maintenance"
echo -e "==========================================${NC}\n"

# 1. Vérifier le fichier maintenance.html
echo -e "${BLUE}[1] Fichier de maintenance${NC}"
if ssh "$VPS_HOST" "[ -f /var/www/html/maintenance.html ]" 2>/dev/null; then
    SIZE=$(ssh "$VPS_HOST" "stat -c%s /var/www/html/maintenance.html" 2>/dev/null)
    echo -e "  ${GREEN}✓${NC} Fichier présent : /var/www/html/maintenance.html (${SIZE} bytes)"
else
    echo -e "  ${RED}✗${NC} Fichier ABSENT : /var/www/html/maintenance.html"
fi
echo

# 2. Vérifier la config Nginx
echo -e "${BLUE}[2] Configuration Nginx${NC}"
if ssh "$VPS_HOST" "grep -q 'error_page 502 503 504 /maintenance.html' /etc/nginx/sites-available/moncabinet" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Directive error_page configurée"

    if ssh "$VPS_HOST" "grep -q 'proxy_intercept_errors on' /etc/nginx/sites-available/moncabinet" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Interception des erreurs activée"
    else
        echo -e "  ${RED}✗${NC} proxy_intercept_errors manquant"
    fi

    if ssh "$VPS_HOST" "grep -q 'location /maintenance.html' /etc/nginx/sites-available/moncabinet" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Location /maintenance.html configurée"
    else
        echo -e "  ${RED}✗${NC} Location /maintenance.html manquante"
    fi
else
    echo -e "  ${RED}✗${NC} Configuration de maintenance NON trouvée"
fi
echo

# 3. Test de configuration Nginx
echo -e "${BLUE}[3] Validation Nginx${NC}"
if ssh "$VPS_HOST" "nginx -t" 2>&1 | grep -q "successful"; then
    echo -e "  ${GREEN}✓${NC} Configuration Nginx valide"
else
    echo -e "  ${RED}✗${NC} Configuration Nginx INVALIDE"
fi
echo

# 4. État du service Nginx
echo -e "${BLUE}[4] Service Nginx${NC}"
if ssh "$VPS_HOST" "systemctl is-active nginx" 2>&1 | grep -q "active"; then
    echo -e "  ${GREEN}✓${NC} Nginx actif"
else
    echo -e "  ${RED}✗${NC} Nginx inactif"
fi
echo

# 5. État du container Next.js
echo -e "${BLUE}[5] Container Next.js${NC}"
if ssh "$VPS_HOST" "docker ps --format '{{.Names}}' | grep -q moncabinet-nextjs" 2>/dev/null; then
    STATUS=$(ssh "$VPS_HOST" "docker inspect -f '{{.State.Status}}' moncabinet-nextjs" 2>/dev/null)
    HEALTH=$(ssh "$VPS_HOST" "docker inspect -f '{{.State.Health.Status}}' moncabinet-nextjs" 2>/dev/null || echo "none")

    if [ "$STATUS" = "running" ]; then
        echo -e "  ${GREEN}✓${NC} Container running (health: $HEALTH)"
        echo -e "  ${YELLOW}→${NC} La page de maintenance ${YELLOW}ne s'affichera PAS${NC}"
    else
        echo -e "  ${RED}✗${NC} Container arrêté"
        echo -e "  ${YELLOW}→${NC} La page de maintenance ${GREEN}s'affichera${NC}"
    fi
else
    echo -e "  ${RED}✗${NC} Container introuvable"
fi
echo

# 6. Logs récents (erreurs 502/503/504)
echo -e "${BLUE}[6] Erreurs récentes (dernières 24h)${NC}"
ERROR_COUNT=$(ssh "$VPS_HOST" "grep -E '502|503|504' /var/log/nginx/access.log 2>/dev/null | tail -1000 | wc -l" 2>/dev/null || echo "0")
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠${NC}  ${ERROR_COUNT} erreurs 5xx trouvées (dernières 1000 lignes)"
    echo -e "  ${BLUE}→${NC} Dernières erreurs :"
    ssh "$VPS_HOST" "grep -E '502|503|504' /var/log/nginx/access.log 2>/dev/null | tail -5 | sed 's/^/    /'" 2>/dev/null
else
    echo -e "  ${GREEN}✓${NC} Aucune erreur 5xx récente"
fi
echo

# 7. Sauvegardes disponibles
echo -e "${BLUE}[7] Sauvegardes de configuration${NC}"
BACKUPS=$(ssh "$VPS_HOST" "ls -1 /etc/nginx/sites-available/moncabinet.backup-maintenance-* 2>/dev/null | wc -l" 2>/dev/null || echo "0")
if [ "$BACKUPS" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} ${BACKUPS} sauvegarde(s) disponible(s)"
    echo -e "  ${BLUE}→${NC} Dernière sauvegarde :"
    ssh "$VPS_HOST" "ls -lh /etc/nginx/sites-available/moncabinet.backup-maintenance-* 2>/dev/null | tail -1 | awk '{print \"    \" \$9 \" (\" \$6 \" \" \$7 \" \" \$8 \")\"}'" 2>/dev/null
else
    echo -e "  ${YELLOW}⚠${NC}  Aucune sauvegarde trouvée"
fi
echo

# Résumé
echo -e "${BLUE}=========================================="
echo "Résumé"
echo -e "==========================================${NC}"

FILE_OK=$(ssh "$VPS_HOST" "[ -f /var/www/html/maintenance.html ] && echo 1 || echo 0" 2>/dev/null)
CONFIG_OK=$(ssh "$VPS_HOST" "grep -q 'error_page 502 503 504 /maintenance.html' /etc/nginx/sites-available/moncabinet && echo 1 || echo 0" 2>/dev/null)
NGINX_OK=$(ssh "$VPS_HOST" "nginx -t 2>&1 | grep -q 'successful' && echo 1 || echo 0" 2>/dev/null)

if [ "$FILE_OK" = "1" ] && [ "$CONFIG_OK" = "1" ] && [ "$NGINX_OK" = "1" ]; then
    echo -e "${GREEN}✓ Page de maintenance correctement configurée${NC}"
    echo -e "\nPour tester, exécutez :"
    echo -e "  ${BLUE}ssh $VPS_HOST 'docker stop moncabinet-nextjs'${NC}"
    echo -e "  ${BLUE}# Visiter https://qadhya.tn${NC}"
    echo -e "  ${BLUE}ssh $VPS_HOST 'docker start moncabinet-nextjs'${NC}"
else
    echo -e "${RED}✗ Configuration incomplète ou invalide${NC}"
    echo -e "\nPour configurer, exécutez :"
    echo -e "  ${BLUE}npm run maintenance:setup${NC}"
fi
echo
