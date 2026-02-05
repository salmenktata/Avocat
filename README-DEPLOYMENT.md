# 🚀 Guide de Déploiement MonCabinet sur VPS Contabo

Ce guide vous accompagne dans le déploiement de MonCabinet sur un VPS Contabo avec Cloudflare.

## 📋 Prérequis

### VPS Contabo
- **CPU** : 4 vCores minimum
- **RAM** : 8 GB minimum
- **Stockage** : 200 GB SSD
- **OS** : Ubuntu 22.04 LTS

### Services externes
- [ ] Compte Cloudflare avec domaine configuré
- [ ] Compte Supabase (base de données)
- [ ] Compte Resend (emails)
- [ ] Google Cloud Console (optionnel, pour Google Drive)

### Informations nécessaires
- IP publique du VPS
- Nom de domaine (ex: moncabinet.tn)
- Email pour les certificats SSL
- URL du repository Git

---

## 🎯 Installation Automatique

### Étape 1 : Connexion au VPS

```bash
ssh root@[IP-VPS]
```

### Étape 2 : Télécharger le script d'installation

```bash
# Créer un répertoire temporaire
mkdir -p /tmp/moncabinet-install
cd /tmp/moncabinet-install

# Télécharger le script
wget https://raw.githubusercontent.com/VOTRE-USER/Avocat/main/scripts/setup-vps.sh

# Ou si vous avez déjà cloné le repo :
git clone https://github.com/VOTRE-USER/Avocat.git
cd Avocat/scripts
```

### Étape 3 : Rendre le script exécutable

```bash
chmod +x setup-vps.sh
```

### Étape 4 : Lancer l'installation

```bash
sudo bash setup-vps.sh
```

Le script vous demandera :
- Nom de domaine
- Email pour SSL
- Port de l'application (défaut: 7002)
- URL du repository Git
- Création d'un utilisateur non-root

**Durée estimée : 15-20 minutes**

---

## 🔧 Configuration Post-Installation

### 1. Configurer les variables d'environnement

```bash
nano /home/moncabinet/moncabinet/.env.production
# ou
nano /var/www/moncabinet/.env.production
```

Remplissez toutes les clés API :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Resend
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=notifications@moncabinet.tn

# Google Drive (optionnel)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=https://moncabinet.tn/api/integrations/google-drive/callback
```

### 2. Redémarrer l'application

```bash
pm2 restart moncabinet
```

### 3. Vérifier les logs

```bash
pm2 logs moncabinet
```

---

## 🌐 Configuration Cloudflare

### 1. Obtenir l'IP du VPS

```bash
curl ifconfig.me
```

### 2. Mettre à jour l'enregistrement DNS

Dans votre tableau de bord Cloudflare :

1. Allez dans **DNS** → **Records**
2. Modifiez l'enregistrement A :
   - **Type** : A
   - **Nom** : @
   - **Contenu** : [IP-VPS]
   - **Proxy** : ☁️ Activé (orange)
   - **TTL** : Auto

3. Vérifiez que www pointe vers @ :
   - **Type** : CNAME
   - **Nom** : www
   - **Contenu** : moncabinet.tn
   - **Proxy** : ☁️ Activé

### 3. Configurer SSL/TLS

1. **SSL/TLS** → **Overview** → Mode : **Full (strict)**
2. **Edge Certificates** :
   - ✅ Always Use HTTPS
   - ✅ Automatic HTTPS Rewrites
   - TLS Version : 1.2 minimum

### 4. Créer les Page Rules

**Règle 1 : Bypass cache pour API**
```
URL : *moncabinet.tn/api/*
Cache Level : Bypass
```

**Règle 2 : Cache assets statiques**
```
URL : *moncabinet.tn/_next/static/*
Cache Level : Cache Everything
Edge Cache TTL : 1 month
```

### 5. Activer le WAF (optionnel)

**Security** → **WAF** → Activé

---

## 📊 Commandes Utiles

### PM2 (Process Manager)

```bash
# Voir les logs en temps réel
pm2 logs moncabinet

# Voir le statut
pm2 status

# Redémarrer
pm2 restart moncabinet

# Arrêter
pm2 stop moncabinet

# Démarrer
pm2 start moncabinet

# Voir les métriques
pm2 monit
```

### Nginx

```bash
# Tester la configuration
sudo nginx -t

# Redémarrer Nginx
sudo systemctl restart nginx

# Voir les logs d'accès
sudo tail -f /var/log/nginx/moncabinet.tn.access.log

# Voir les logs d'erreur
sudo tail -f /var/log/nginx/moncabinet.tn.error.log

# Statut du service
sudo systemctl status nginx
```

### Certificat SSL

```bash
# Renouveler manuellement
sudo certbot renew

# Tester le renouvellement
sudo certbot renew --dry-run

# Voir les certificats installés
sudo certbot certificates
```

### Firewall

```bash
# Voir les règles actives
sudo ufw status

# Ajouter une règle
sudo ufw allow 8080/tcp

# Supprimer une règle
sudo ufw delete allow 8080/tcp
```

---

## 🔄 Mises à Jour de l'Application

### Déploiement automatique

Un script de déploiement a été créé automatiquement :

```bash
cd /home/moncabinet/moncabinet  # ou /var/www/moncabinet
./deploy.sh
```

Ce script :
1. Pull les dernières modifications Git
2. Installe les nouvelles dépendances
3. Build l'application
4. Redémarre PM2

### Déploiement manuel

```bash
cd /home/moncabinet/moncabinet

# 1. Pull les modifications
git pull origin main

# 2. Installer les dépendances
npm install

# 3. Build
npm run build

# 4. Redémarrer
pm2 restart moncabinet
```

---

## 💾 Sauvegardes

### Backup manuel

```bash
cd /home/moncabinet/moncabinet
./backup.sh
```

Les backups sont stockés dans `/var/backups/moncabinet/`

### Backup automatique (Cron)

Ajoutez une tâche cron pour des backups quotidiens :

```bash
crontab -e
```

Ajoutez :
```
0 2 * * * /home/moncabinet/moncabinet/backup.sh >> /var/log/backup-moncabinet.log 2>&1
```

Cela créera un backup tous les jours à 2h du matin.

---

## 🔍 Monitoring et Debug

### Vérifier que l'application répond

```bash
# Localement sur le VPS
curl http://localhost:7002

# Via le domaine
curl https://moncabinet.tn
```

### Vérifier le SSL

```bash
curl -I https://moncabinet.tn
```

### Tester la connexion Supabase

```bash
cd /home/moncabinet/moncabinet

# Créer un script de test
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.production' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('Testing Supabase connection...');
supabase.from('profiles').select('count').limit(1)
  .then(res => console.log('✅ Connection OK', res))
  .catch(err => console.error('❌ Error:', err));
"
```

### Voir l'utilisation des ressources

```bash
# CPU et RAM
htop

# Espace disque
df -h

# Processus Node.js
ps aux | grep node
```

---

## 🚨 Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs PM2
pm2 logs moncabinet --lines 100

# Vérifier les variables d'environnement
cat /home/moncabinet/moncabinet/.env.production

# Redémarrer complètement
pm2 delete moncabinet
cd /home/moncabinet/moncabinet
pm2 start npm --name "moncabinet" -- start
```

### Erreur 502 Bad Gateway

```bash
# Vérifier que l'application tourne
pm2 status

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/moncabinet.tn.error.log

# Vérifier que le port est ouvert
netstat -tlnp | grep 7002
```

### Problème de certificat SSL

```bash
# Regénérer le certificat
sudo certbot --nginx -d moncabinet.tn -d www.moncabinet.tn --force-renewal

# Vérifier la configuration Nginx
sudo nginx -t

# Redémarrer Nginx
sudo systemctl restart nginx
```

### L'application utilise trop de RAM

```bash
# Voir l'utilisation mémoire
pm2 monit

# Ajuster les limites Node.js
pm2 delete moncabinet
pm2 start npm --name "moncabinet" -- start --node-args="--max-old-space-size=4096"
pm2 save
```

---

## 📞 Support

### Logs importants

- Application : `pm2 logs moncabinet`
- Nginx Access : `/var/log/nginx/moncabinet.tn.access.log`
- Nginx Error : `/var/log/nginx/moncabinet.tn.error.log`
- Système : `/var/log/syslog`

### Informations système

```bash
# Version Node.js
node -v

# Version npm
npm -v

# Version PM2
pm2 -v

# Version Nginx
nginx -v

# Informations système
uname -a
```

---

## ✅ Checklist de Production

Avant de mettre en production, vérifiez :

- [ ] Variables d'environnement configurées
- [ ] Base de données Supabase opérationnelle
- [ ] Emails Resend fonctionnels
- [ ] DNS Cloudflare configuré
- [ ] SSL/TLS activé (Full strict)
- [ ] Firewall UFW activé
- [ ] PM2 startup configuré
- [ ] Backups automatiques configurés
- [ ] Monitoring en place
- [ ] Tests de charge effectués
- [ ] Page d'erreur personnalisée
- [ ] Analytics configurés (optionnel)

---

## 📚 Ressources

- [Next.js Production Deployment](https://nextjs.org/docs/deployment)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Cloudflare Documentation](https://developers.cloudflare.com/)
- [Let's Encrypt](https://letsencrypt.org/)

---

**🎉 Votre application MonCabinet est maintenant en production !**
