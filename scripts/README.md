# 📂 Scripts de Déploiement MonCabinet

Ce dossier contient les scripts d'installation et de gestion pour déployer MonCabinet sur un VPS.

## 📄 Fichiers

### `setup-vps.sh`
**Script d'installation automatique complet**

Installe et configure automatiquement tout l'environnement nécessaire sur un VPS Ubuntu 22.04 :
- Node.js 18+
- Nginx (reverse proxy)
- PM2 (process manager)
- Certbot (SSL Let's Encrypt)
- Firewall UFW
- Application Next.js

**Usage :**
```bash
# Sur le VPS, en tant que root
curl -o setup-vps.sh https://raw.githubusercontent.com/VOTRE-USER/Avocat/main/scripts/setup-vps.sh
chmod +x setup-vps.sh
sudo bash setup-vps.sh
```

**Durée :** ~15-20 minutes

---

### `deploy.sh`
**Script de déploiement rapide pour mises à jour**

Met à jour l'application déjà installée sur le VPS :
- Pull des dernières modifications Git
- Installation des nouvelles dépendances
- Build production
- Redémarrage de l'application

**Usage :**
```bash
# Sur le VPS, dans le répertoire de l'application
cd /home/moncabinet/moncabinet
./deploy.sh
```

**Durée :** ~2-5 minutes

---

## 📚 Documentation Associée

### Guides principaux
- **[README-DEPLOYMENT.md](../README-DEPLOYMENT.md)** : Guide complet de déploiement avec toutes les commandes et explications
- **[QUICK-START-VPS.md](../QUICK-START-VPS.md)** : Guide ultra-rapide pour déployer en 5 minutes
- **[CHECKLIST-DEPLOIEMENT.md](../CHECKLIST-DEPLOIEMENT.md)** : Checklist complète à suivre étape par étape

### Fichiers de configuration
- **[.env.production.template](../.env.production.template)** : Template des variables d'environnement

---

## 🚀 Workflow de Déploiement

### Déploiement Initial

```
1. Commander VPS Contabo (Ubuntu 22.04)
2. Configurer DNS dans Cloudflare
3. Exécuter setup-vps.sh sur le VPS
4. Configurer .env.production
5. Redémarrer l'application
6. Mettre à jour l'IP dans Cloudflare
7. Configurer SSL/TLS
8. Tester l'application
```

### Mises à Jour Ultérieures

```
1. Pousser les modifications sur Git
2. Se connecter au VPS
3. Exécuter deploy.sh
4. Vérifier les logs
```

---

## 🔧 Scripts Créés Automatiquement

Lors de l'exécution de `setup-vps.sh`, ces scripts sont créés automatiquement sur le VPS :

### `/home/moncabinet/moncabinet/deploy.sh`
Script de déploiement (identique à celui-ci)

### `/home/moncabinet/moncabinet/backup.sh`
Script de sauvegarde automatique :
- Crée une archive tar.gz de l'application
- Stocke dans `/var/backups/moncabinet/`
- Garde les 7 derniers backups

**Usage :**
```bash
cd /home/moncabinet/moncabinet
./backup.sh
```

---

## ⚙️ Configuration

### Variables requises pour setup-vps.sh

Le script vous demandera interactivement :
- Nom de domaine (ex: moncabinet.tn)
- Email pour SSL (ex: admin@moncabinet.tn)
- Port de l'application (défaut: 7002)
- URL du repository Git
- Créer un utilisateur non-root (recommandé)
- Nom d'utilisateur (défaut: moncabinet)

### Prérequis système

- **OS** : Ubuntu 22.04 LTS (recommandé)
- **RAM** : 8 GB minimum
- **CPU** : 4 vCores minimum
- **Stockage** : 200 GB SSD
- **Accès** : Root ou sudo

---

## 🔒 Sécurité

### Ce que fait setup-vps.sh pour la sécurité :

1. **Firewall UFW**
   - Autorise SSH (port 22)
   - Autorise HTTP (port 80)
   - Autorise HTTPS (port 443)
   - Bloque tout le reste

2. **SSL/TLS**
   - Installe Certbot
   - Configure Let's Encrypt
   - Auto-renouvellement activé

3. **Utilisateur non-root**
   - Crée un utilisateur dédié
   - Limite les permissions

4. **Variables d'environnement**
   - Fichier .env.production avec permissions restreintes
   - Jamais commité dans Git

---

## 🆘 Dépannage

### Le script setup-vps.sh échoue

```bash
# Vérifier les logs
cat /var/log/syslog | tail -50

# Réessayer depuis le début
sudo bash setup-vps.sh
```

### L'application ne démarre pas après deploy.sh

```bash
# Vérifier les logs
pm2 logs moncabinet --lines 50

# Vérifier les variables d'environnement
cat .env.production

# Redémarrer manuellement
pm2 restart moncabinet
```

### Erreur de permissions

```bash
# Si vous êtes l'utilisateur moncabinet
sudo chown -R moncabinet:moncabinet /home/moncabinet/moncabinet

# Si vous êtes root
chown -R moncabinet:moncabinet /home/moncabinet/moncabinet
```

---

## 📊 Logs

### Localisation des logs

- **Application** : `pm2 logs moncabinet`
- **Nginx Access** : `/var/log/nginx/moncabinet.tn.access.log`
- **Nginx Error** : `/var/log/nginx/moncabinet.tn.error.log`
- **Système** : `/var/log/syslog`
- **Certbot** : `/var/log/letsencrypt/letsencrypt.log`

### Commandes utiles

```bash
# Logs en temps réel
pm2 logs moncabinet --lines 100

# Logs Nginx en temps réel
sudo tail -f /var/log/nginx/moncabinet.tn.error.log

# Derniers logs système
sudo journalctl -xe
```

---

## 🔄 Maintenance

### Tâches régulières

#### Quotidiennes
- Vérifier les logs : `pm2 logs moncabinet`
- Vérifier le statut : `pm2 status`

#### Hebdomadaires
- Vérifier l'espace disque : `df -h`
- Vérifier les backups : `ls -lh /var/backups/moncabinet/`

#### Mensuelles
- Mettre à jour le système : `sudo apt update && sudo apt upgrade`
- Vérifier les certificats SSL : `sudo certbot certificates`
- Nettoyer les logs : `pm2 flush`

---

## 💡 Astuces

### Alias utiles

Ajoutez ces alias dans `~/.bashrc` pour gagner du temps :

```bash
# Ajouter à ~/.bashrc
alias mcapp='cd /home/moncabinet/moncabinet'
alias mclogs='pm2 logs moncabinet'
alias mcrestart='pm2 restart moncabinet'
alias mcdeploy='cd /home/moncabinet/moncabinet && ./deploy.sh'
alias mcbackup='cd /home/moncabinet/moncabinet && ./backup.sh'

# Recharger
source ~/.bashrc
```

### Cron pour backups automatiques

```bash
# Éditer crontab
crontab -e

# Ajouter (backup quotidien à 2h du matin)
0 2 * * * /home/moncabinet/moncabinet/backup.sh >> /var/log/backup-moncabinet.log 2>&1
```

---

## 🌐 URLs Utiles

- **Application** : https://moncabinet.tn
- **Cloudflare Dashboard** : https://dash.cloudflare.com
- **Supabase Dashboard** : https://app.supabase.com
- **Resend Dashboard** : https://resend.com
- **Contabo Panel** : https://my.contabo.com

---

## 📞 Support

En cas de problème avec les scripts :

1. Consultez la [documentation complète](../README-DEPLOYMENT.md)
2. Vérifiez les logs système et application
3. Assurez-vous que les prérequis sont remplis
4. Réessayez le script depuis le début si nécessaire

---

**🎉 Bonne installation !**
