# Configuration Page de Maintenance

## 📋 Vue d'ensemble

Ce document décrit la configuration de la page de maintenance automatique pour Qadhya.tn. Lorsque le serveur Next.js est down ou inaccessible, Nginx affiche automatiquement une page de maintenance élégante en français et arabe.

## 🎯 Fonctionnalités

- ✅ **Détection automatique** : Nginx détecte instantanément si Next.js est down
- ✅ **Page élégante** : Design moderne bilingue (FR/AR) avec dark mode
- ✅ **Auto-refresh** : La page se recharge toutes les 30 secondes
- ✅ **Codes d'erreur interceptés** : 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)
- ✅ **Aucune dépendance** : Page statique servie directement par Nginx

## 🚀 Déploiement automatique

### Script d'installation

Un script bash automatise tout le processus de déploiement :

```bash
./scripts/setup-maintenance-page.sh
```

### Ce que fait le script

1. **Vérifications préalables** :
   - Présence du fichier `public/maintenance.html`
   - Connectivité SSH vers le VPS

2. **Copie de la page de maintenance** :
   - Crée le dossier `/var/www/html` sur le VPS
   - Copie `maintenance.html` vers le VPS

3. **Sauvegarde de la config Nginx** :
   - Crée un backup horodaté : `/etc/nginx/sites-available/moncabinet.backup-maintenance-YYYYMMDD_HHMMSS`

4. **Mise à jour de la config Nginx** :
   - Ajoute les directives `proxy_intercept_errors`, `error_page` et `location /maintenance.html`
   - Rollback automatique en cas d'erreur

5. **Test et rechargement** :
   - Teste la configuration avec `nginx -t`
   - Recharge Nginx si tout est OK

6. **Test optionnel** :
   - Propose d'arrêter temporairement Next.js pour tester la page

## 📝 Configuration Nginx ajoutée

Le script ajoute ces directives dans le bloc `server` principal :

```nginx
# Configuration page de maintenance
proxy_intercept_errors on;
error_page 502 503 504 /maintenance.html;

location /maintenance.html {
    root /var/www/html;
    internal;
}
```

### Explication des directives

- **`proxy_intercept_errors on`** : Permet à Nginx d'intercepter les erreurs de l'upstream
- **`error_page 502 503 504 /maintenance.html`** : Redirige ces codes d'erreur vers la page de maintenance
- **`location /maintenance.html { internal; }`** : La page n'est accessible que via les redirections internes (pas directement par URL)

## 🧪 Tests

### Test manuel après installation

```bash
# Arrêter le container Next.js
ssh root@84.247.165.187 'docker stop moncabinet-nextjs'

# Visiter https://qadhya.tn dans un navigateur
# → Doit afficher la page de maintenance

# Redémarrer le container
ssh root@84.247.165.187 'docker start moncabinet-nextjs'
```

### Scénarios déclenchant la page de maintenance

1. **Container arrêté** : `docker stop moncabinet-nextjs`
2. **Container crashé** : Si Next.js plante
3. **Serveur surchargé** : Si Next.js ne répond pas dans le timeout (30s)
4. **Déploiement en cours** : Lors d'un redémarrage (`docker-compose up -d`)
5. **Port inaccessible** : Si le port 3000 est fermé ou bloqué

## 🔧 Maintenance

### Mettre à jour la page de maintenance

1. Modifier `public/maintenance.html` localement
2. Relancer le script :
   ```bash
   ./scripts/setup-maintenance-page.sh
   ```

### Vérifier que la config est active

```bash
ssh root@84.247.165.187 'grep -A5 "error_page 502" /etc/nginx/sites-available/moncabinet'
```

### Rollback en cas de problème

Si la configuration Nginx pose problème, restaurer une sauvegarde :

```bash
ssh root@84.247.165.187

# Lister les sauvegardes
ls -lh /etc/nginx/sites-available/moncabinet.backup-*

# Restaurer une sauvegarde
cp /etc/nginx/sites-available/moncabinet.backup-20260210_120000 \
   /etc/nginx/sites-available/moncabinet

# Tester et recharger
nginx -t && systemctl reload nginx
```

## 📊 Monitoring

### Vérifier les erreurs 502/503/504

```bash
# Logs Nginx (dernières 50 lignes avec codes 502/503/504)
ssh root@84.247.165.187 'tail -50 /var/log/nginx/access.log | grep -E "502|503|504"'

# Logs en temps réel
ssh root@84.247.165.187 'tail -f /var/log/nginx/access.log | grep --line-buffered -E "502|503|504"'
```

### Vérifier l'uptime du container

```bash
ssh root@84.247.165.187 'docker ps -a | grep moncabinet-nextjs'
```

## 🎨 Personnalisation de la page

### Fichier source

`public/maintenance.html` contient la page de maintenance.

### Structure

- **Bilingue** : Sections FR et AR avec séparateur visuel
- **Responsive** : S'adapte aux mobiles et tablettes
- **Dark mode** : Détection automatique via `prefers-color-scheme`
- **Auto-refresh** : Meta tag `<meta http-equiv="refresh" content="30">`
- **Animations** : Icône rotation, pulse du status dot, fade-in au chargement

### Personnaliser le message

Modifier les sections dans `maintenance.html` :

```html
<!-- Message français -->
<div class="section">
  <h1>Maintenance en cours</h1>
  <p>Votre message personnalisé...</p>
</div>

<!-- Message arabe -->
<div class="section section-ar">
  <h1>صيانة جارية</h1>
  <p>رسالتك المخصصة...</p>
</div>
```

### Changer l'intervalle d'auto-refresh

Modifier la ligne 6 :

```html
<!-- Refresh toutes les 60 secondes au lieu de 30 -->
<meta http-equiv="refresh" content="60">
```

## 🚨 Dépannage

### La page de maintenance ne s'affiche pas

1. **Vérifier que le fichier existe** :
   ```bash
   ssh root@84.247.165.187 'ls -lh /var/www/html/maintenance.html'
   ```

2. **Vérifier la config Nginx** :
   ```bash
   ssh root@84.247.165.187 'nginx -t'
   ```

3. **Vérifier les logs Nginx** :
   ```bash
   ssh root@84.247.165.187 'tail -50 /var/log/nginx/error.log'
   ```

### La page s'affiche même quand le serveur fonctionne

Cela signifie que Nginx ne peut pas joindre l'upstream. Vérifier :

1. **Container Next.js running** :
   ```bash
   ssh root@84.247.165.187 'docker ps | grep moncabinet-nextjs'
   ```

2. **Port 3000 accessible** :
   ```bash
   ssh root@84.247.165.187 'curl -I http://localhost:3000'
   ```

3. **Logs Next.js** :
   ```bash
   ssh root@84.247.165.187 'docker logs --tail 50 moncabinet-nextjs'
   ```

### Page blanche au lieu de la page de maintenance

Vérifier les permissions du fichier :

```bash
ssh root@84.247.165.187 'chmod 644 /var/www/html/maintenance.html'
ssh root@84.247.165.187 'chown www-data:www-data /var/www/html/maintenance.html'
```

## 📚 Références

- **Script de déploiement** : `scripts/setup-maintenance-page.sh`
- **Page de maintenance** : `public/maintenance.html`
- **Config Nginx prod** : `/etc/nginx/sites-available/moncabinet` sur le VPS
- **Directive Nginx `error_page`** : https://nginx.org/en/docs/http/ngx_http_core_module.html#error_page
- **Directive `proxy_intercept_errors`** : https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_intercept_errors

## 🔄 Changelog

### 2026-02-10 - Configuration initiale
- ✅ Création du script de déploiement automatique
- ✅ Page de maintenance bilingue FR/AR avec dark mode
- ✅ Documentation complète
- ✅ Test manuel validé en production

---

**Note** : Cette page de maintenance est purement statique et ne dépend d'aucun service externe. Elle sera toujours accessible même si PostgreSQL, Redis ou MinIO sont down, tant que Nginx fonctionne.
