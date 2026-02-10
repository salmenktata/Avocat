# 🛠️ Script de Configuration Page de Maintenance

## 🚀 Utilisation rapide

```bash
# Via npm
npm run maintenance:setup

# Ou directement
./scripts/setup-maintenance-page.sh
```

## 📋 Ce que fait le script

1. ✅ Vérifie les prérequis (fichier local, connexion SSH)
2. ✅ Copie `public/maintenance.html` vers `/var/www/html/` sur le VPS
3. ✅ Sauvegarde la config Nginx actuelle
4. ✅ Ajoute les directives de maintenance dans Nginx
5. ✅ Teste la configuration (`nginx -t`)
6. ✅ Recharge Nginx
7. ✅ (Optionnel) Test en arrêtant temporairement Next.js

## 📝 Configuration ajoutée

```nginx
# Dans /etc/nginx/sites-available/moncabinet
proxy_intercept_errors on;
error_page 502 503 504 /maintenance.html;

location /maintenance.html {
    root /var/www/html;
    internal;
}
```

## 🧪 Test manuel

```bash
# 1. Arrêter Next.js
ssh root@84.247.165.187 'docker stop moncabinet-nextjs'

# 2. Visiter https://qadhya.tn
# → Doit afficher la page de maintenance

# 3. Redémarrer Next.js
ssh root@84.247.165.187 'docker start moncabinet-nextjs'
```

## 🎯 Quand la page s'affiche

La page de maintenance apparaît automatiquement quand :

- 🔴 Container Next.js arrêté
- 🔴 Serveur Next.js crashé
- 🔴 Timeout (>30s sans réponse)
- 🔴 Port 3000 inaccessible
- 🔴 Redémarrage en cours

## 📚 Documentation complète

Voir `docs/MAINTENANCE_PAGE_SETUP.md` pour :

- Configuration détaillée
- Personnalisation de la page
- Dépannage
- Monitoring

## 🔄 Mettre à jour la page

1. Modifier `public/maintenance.html`
2. Relancer le script :
   ```bash
   npm run maintenance:setup
   ```

## 🆘 Rollback

En cas de problème :

```bash
ssh root@84.247.165.187

# Voir les sauvegardes
ls -lh /etc/nginx/sites-available/moncabinet.backup-*

# Restaurer
cp /etc/nginx/sites-available/moncabinet.backup-20260210_HHMMSS \
   /etc/nginx/sites-available/moncabinet

# Recharger
nginx -t && systemctl reload nginx
```

## 📊 Vérifier l'état

```bash
# Fichier de maintenance présent ?
ssh root@84.247.165.187 'ls -lh /var/www/html/maintenance.html'

# Config Nginx active ?
ssh root@84.247.165.187 'grep -A5 "error_page 502" /etc/nginx/sites-available/moncabinet'

# Logs récents
ssh root@84.247.165.187 'tail -50 /var/log/nginx/access.log | grep -E "502|503|504"'
```

---

**Note** : Le script est idempotent - vous pouvez le relancer plusieurs fois sans danger.
