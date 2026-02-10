# Page de Maintenance - Déploiement et Configuration

## 📅 Date de déploiement
**10 février 2026** - Configuration vérifiée et opérationnelle

## ✅ État actuel

### Fichiers
- **Page de maintenance** : `/opt/moncabinet/public/maintenance.html` (5.1 KB)
  - Bilingue FR/AR
  - Design moderne avec dark mode
  - Auto-refresh toutes les 30 secondes
  - Responsive (mobile/tablet/desktop)

### Configuration Nginx

**Fichier** : `/etc/nginx/sites-available/moncabinet`

```nginx
# Configuration page de maintenance
error_page 502 503 504 /maintenance.html;

location = /maintenance.html {
  root /opt/moncabinet/public;
  internal;
}
```

**Note** : La directive `proxy_intercept_errors on` doit être présente dans le bloc `server`.

### Services
- ✅ Nginx : Actif et configuration valide
- ✅ Next.js : Container `qadhya-nextjs` running
- ✅ Site : https://qadhya.tn accessible

## 🎯 Déclenchement automatique

La page de maintenance s'affiche automatiquement dans ces cas :

1. **Container arrêté** : `docker stop qadhya-nextjs`
2. **Serveur crashé** : Si Next.js plante
3. **Timeout** : Si Next.js ne répond pas dans les 30 secondes
4. **Erreurs HTTP** : Codes 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)
5. **Déploiement** : Lors d'un redémarrage du container

## 🛠️ Scripts NPM

### Vérifier l'état
```bash
npm run maintenance:check
```

Vérifie :
- Présence du fichier maintenance.html
- Configuration Nginx
- État des services
- Erreurs récentes dans les logs

### Mettre à jour la page
```bash
npm run maintenance:setup
```

Actions :
1. Copie `public/maintenance.html` vers le VPS
2. Sauvegarde la config Nginx
3. Ajoute/vérifie les directives de maintenance
4. Teste et recharge Nginx

## 🧪 Tests

### Test manuel complet

```bash
# 1. Arrêter le container Next.js
ssh root@84.247.165.187 'docker stop qadhya-nextjs'

# 2. Vérifier que la page de maintenance s'affiche
curl -I https://qadhya.tn
# Ou visiter https://qadhya.tn dans un navigateur

# 3. Redémarrer le container
ssh root@84.247.165.187 'docker start qadhya-nextjs'

# 4. Vérifier que le site fonctionne normalement
curl -I https://qadhya.tn
```

### Vérifications automatiques

```bash
# État complet de la configuration
npm run maintenance:check

# Logs des erreurs 5xx récentes
ssh root@84.247.165.187 'grep -E "502|503|504" /var/log/nginx/access.log | tail -20'

# État des containers
ssh root@84.247.165.187 'docker ps -a | grep qadhya'
```

## 📝 Personnalisation

### Modifier la page de maintenance

1. **Éditer le fichier local**
   ```bash
   nano public/maintenance.html
   ```

2. **Déployer les modifications**
   ```bash
   npm run maintenance:setup
   ```

3. **Vérifier le déploiement**
   ```bash
   ssh root@84.247.165.187 'cat /opt/moncabinet/public/maintenance.html | grep -A2 "<h1>"'
   ```

### Options de personnalisation courantes

#### Changer l'intervalle d'auto-refresh
```html
<!-- Dans public/maintenance.html, ligne 6 -->
<meta http-equiv="refresh" content="60"> <!-- 60 secondes au lieu de 30 -->
```

#### Modifier le message
```html
<!-- Section française -->
<div class="section">
  <h1>Maintenance planifiée</h1>
  <p>Notre plateforme sera de retour à 14h00. Merci de votre patience.</p>
</div>

<!-- Section arabe -->
<div class="section section-ar">
  <h1>صيانة مجدولة</h1>
  <p>ستعود منصتنا في الساعة 14:00. شكراً لصبركم.</p>
</div>
```

## 🔧 Architecture

### Flux de requêtes en mode normal

```
Client → Nginx → Next.js (port 3000) → Réponse
```

### Flux de requêtes en mode maintenance

```
Client → Nginx → Next.js (ERREUR 502/503/504)
              ↓
         Intercepte l'erreur
              ↓
         Sert /maintenance.html
              ↓
         Client reçoit la page HTML
```

### Avantages de cette architecture

- ✅ **Automatique** : Aucune intervention manuelle requise
- ✅ **Instantané** : Détection immédiate de l'indisponibilité
- ✅ **Statique** : Pas de dépendance Node.js, PostgreSQL, Redis
- ✅ **Léger** : 5 KB seulement
- ✅ **Transparent** : Les utilisateurs voient une page élégante au lieu d'une erreur

## 🚨 Dépannage

### La page de maintenance ne s'affiche pas

**Symptôme** : Code 502 brut au lieu de la page de maintenance

**Vérifications** :

1. **Fichier présent ?**
   ```bash
   ssh root@84.247.165.187 'ls -lh /opt/moncabinet/public/maintenance.html'
   ```

2. **Configuration Nginx correcte ?**
   ```bash
   ssh root@84.247.165.187 'grep -A5 "error_page 502" /etc/nginx/sites-available/moncabinet'
   ```

3. **Nginx valide ?**
   ```bash
   ssh root@84.247.165.187 'nginx -t'
   ```

4. **Recharger Nginx**
   ```bash
   ssh root@84.247.165.187 'systemctl reload nginx'
   ```

### La page s'affiche alors que le serveur fonctionne

**Symptôme** : Page de maintenance affichée même quand Next.js est up

**Causes possibles** :

1. **Container running mais non healthy**
   ```bash
   ssh root@84.247.165.187 'docker ps | grep qadhya-nextjs'
   # Vérifier la colonne STATUS pour "(healthy)"
   ```

2. **Port 3000 inaccessible**
   ```bash
   ssh root@84.247.165.187 'curl -I http://localhost:3000'
   ```

3. **Timeout trop court**
   ```bash
   # Vérifier les directives proxy_timeout dans Nginx
   ssh root@84.247.165.187 'grep timeout /etc/nginx/sites-available/moncabinet'
   ```

### Rollback de la configuration

Si la configuration Nginx pose problème :

```bash
# Lister les sauvegardes
ssh root@84.247.165.187 'ls -lh /etc/nginx/sites-available/moncabinet.backup-*'

# Restaurer une sauvegarde
ssh root@84.247.165.187 'cp /etc/nginx/sites-available/moncabinet.backup-YYYYMMDD_HHMMSS /etc/nginx/sites-available/moncabinet'

# Tester et recharger
ssh root@84.247.165.187 'nginx -t && systemctl reload nginx'
```

## 📊 Monitoring

### Métriques à surveiller

1. **Fréquence d'affichage de la page de maintenance**
   ```bash
   ssh root@84.247.165.187 'grep -c "GET /maintenance.html" /var/log/nginx/access.log'
   ```

2. **Durée moyenne des maintenances**
   ```bash
   # Analyser les timestamps dans les logs
   ssh root@84.247.165.187 'grep "GET /maintenance.html" /var/log/nginx/access.log | tail -20'
   ```

3. **Erreurs 5xx avant maintenance**
   ```bash
   ssh root@84.247.165.187 'grep -E " 502 | 503 | 504 " /var/log/nginx/access.log | tail -20'
   ```

### Alertes recommandées

- **Alert si > 5 affichages/heure** : Problème récurrent avec Next.js
- **Alert si durée > 10 minutes** : Maintenance prolongée inhabituelle
- **Alert si > 100 erreurs 5xx/jour** : Instabilité du serveur

## 🔄 Mise à jour lors des déploiements

### Via GitHub Actions

Le fichier `public/maintenance.html` est automatiquement copié lors de la création de l'image Docker :

```dockerfile
# Dans Dockerfile
COPY public ./public
```

**Workflow** :
1. Modification de `public/maintenance.html` en local
2. Commit et push vers `main`
3. GitHub Actions build l'image Docker
4. Déploiement via `docker-compose up -d`
5. Le fichier est mis à jour dans `/opt/moncabinet/public/`

### Mise à jour manuelle urgente

Si vous devez mettre à jour la page sans redéployer :

```bash
# Copier directement sur le VPS
scp public/maintenance.html root@84.247.165.187:/opt/moncabinet/public/

# Vérifier
ssh root@84.247.165.187 'cat /opt/moncabinet/public/maintenance.html | head -10'
```

## 📚 Références

- **Script de déploiement** : `scripts/setup-maintenance-page.sh`
- **Script de vérification** : `scripts/check-maintenance-status.sh`
- **Guide d'utilisation** : `scripts/README-MAINTENANCE.md`
- **Documentation technique** : `docs/MAINTENANCE_PAGE_SETUP.md`
- **Fichier source** : `public/maintenance.html`

## 🎓 Leçons apprises

### Préfixes des containers

Les containers utilisent le préfixe `qadhya-` défini dans `docker-compose.prod.yml` :
- `qadhya-nextjs`
- `qadhya-postgres`
- `qadhya-redis`
- `qadhya-minio`

**Important** : Les scripts doivent vérifier ce préfixe et non `moncabinet-`.

### Localisation du fichier

Le fichier dans `/opt/moncabinet/public/` est la source de vérité car :
- Géré par le processus de déploiement
- Mis à jour automatiquement lors des builds
- Cohérent avec l'architecture existante

Le fichier dans `/var/www/html/` (copié par notre script) est un backup mais non utilisé.

### Configuration Nginx existante

La configuration utilisait déjà :
```nginx
location = /maintenance.html {  # Avec le modificateur "="
  root /opt/moncabinet/public;
}
```

Le modificateur `=` signifie "exact match", ce qui est optimal pour cette route spécifique.

---

**Document créé le** : 10 février 2026
**Dernière vérification** : 10 février 2026
**Statut** : ✅ Opérationnel en production
