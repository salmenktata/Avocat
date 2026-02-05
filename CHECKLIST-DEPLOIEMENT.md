# ✅ Checklist de Déploiement MonCabinet

Utilisez cette checklist pour vous assurer que toutes les étapes sont complétées.

---

## 📋 AVANT LE DÉPLOIEMENT

### Préparation

- [ ] VPS Contabo commandé et provisionné
- [ ] IP publique du VPS notée : `________________`
- [ ] Accès SSH au VPS testé : `ssh root@[IP-VPS]`
- [ ] Domaine moncabinet.tn configuré dans Cloudflare
- [ ] Compte Supabase créé
- [ ] Compte Resend créé
- [ ] Clés API Supabase récupérées
- [ ] Clé API Resend récupérée
- [ ] URL du repository Git notée : `________________`

---

## 🚀 INSTALLATION SUR LE VPS

### Étape 1 : Connexion

- [ ] Connexion SSH : `ssh root@[IP-VPS]`
- [ ] Connexion réussie

### Étape 2 : Téléchargement du script

- [ ] Script téléchargé : `curl -o setup-vps.sh https://...`
- [ ] Permissions définies : `chmod +x setup-vps.sh`

### Étape 3 : Exécution du script

- [ ] Script lancé : `sudo bash setup-vps.sh`
- [ ] Questions répondues :
  - Domaine : `moncabinet.tn`
  - Email SSL : `________________`
  - Port : `7002`
  - Repository Git : `________________`
  - Créer utilisateur : `oui`
  - Nom utilisateur : `moncabinet`

### Étape 4 : Attendre l'installation

- [ ] Installation terminée (15-20 min)
- [ ] Message "✅ INSTALLATION TERMINÉE !" affiché
- [ ] IP du VPS notée pour Cloudflare

---

## 🔧 CONFIGURATION POST-INSTALLATION

### Variables d'environnement

- [ ] Fichier .env.production ouvert : `nano /home/moncabinet/moncabinet/.env.production`
- [ ] Variables Supabase ajoutées :
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Variables Resend ajoutées :
  - [ ] `RESEND_API_KEY`
  - [ ] `RESEND_FROM_EMAIL`
- [ ] Variables Google Drive ajoutées (optionnel) :
  - [ ] `GOOGLE_CLIENT_ID`
  - [ ] `GOOGLE_CLIENT_SECRET`
  - [ ] `GOOGLE_REDIRECT_URI`
- [ ] Fichier sauvegardé (Ctrl+X, Y, Entrée)

### Redémarrage

- [ ] Application redémarrée : `pm2 restart moncabinet`
- [ ] Logs vérifiés : `pm2 logs moncabinet`
- [ ] Message "✓ Ready" visible dans les logs

### Test local

- [ ] Test sur le VPS : `curl http://localhost:7002`
- [ ] Réponse HTTP 200 reçue

---

## 🌐 CONFIGURATION CLOUDFLARE

### DNS

- [ ] Tableau de bord Cloudflare ouvert
- [ ] Domaine moncabinet.tn sélectionné
- [ ] Menu DNS → Records ouvert
- [ ] Enregistrement A modifié :
  - Type : `A`
  - Nom : `@`
  - Contenu : `[IP-VPS]` ← Remplacé
  - Proxy : ☁️ `Activé` (orange)
  - TTL : `Auto`
  - Enregistré ✓
- [ ] Enregistrement CNAME www vérifié :
  - Type : `CNAME`
  - Nom : `www`
  - Contenu : `moncabinet.tn`
  - Proxy : ☁️ `Activé`

### SSL/TLS

- [ ] Menu SSL/TLS → Overview ouvert
- [ ] Mode sélectionné : `Full (strict)`
- [ ] Menu Edge Certificates ouvert
- [ ] Options activées :
  - [ ] Always Use HTTPS
  - [ ] Automatic HTTPS Rewrites
  - [ ] Minimum TLS Version : 1.2

### Page Rules (Optionnel mais recommandé)

- [ ] Menu Rules → Page Rules ouvert
- [ ] Règle 1 créée (API bypass) :
  - URL : `*moncabinet.tn/api/*`
  - Setting : Cache Level = Bypass
- [ ] Règle 2 créée (Static cache) :
  - URL : `*moncabinet.tn/_next/static/*`
  - Settings : Cache Level = Cache Everything, Edge TTL = 1 month

### Firewall (Optionnel)

- [ ] Menu Security → WAF ouvert
- [ ] WAF activé

---

## ✅ TESTS FINAUX

### Propagation DNS (Attendre 2-5 minutes)

- [ ] Test DNS : `dig moncabinet.tn`
- [ ] IP du VPS visible dans la réponse

### Test HTTPS

- [ ] Ouverture dans le navigateur : `https://moncabinet.tn`
- [ ] Site accessible ✓
- [ ] Certificat SSL valide (cadenas vert) ✓
- [ ] Redirection HTTP → HTTPS fonctionne ✓

### Test de l'application

- [ ] Page d'accueil s'affiche correctement
- [ ] Connexion / Inscription fonctionne
- [ ] Pas d'erreurs dans la console navigateur (F12)

### Test des fonctionnalités

- [ ] Authentification Supabase fonctionne
- [ ] Envoi d'emails Resend fonctionne
- [ ] Upload de documents fonctionne (si applicable)
- [ ] API répond correctement

---

## 🔒 SÉCURITÉ

### Firewall VPS

- [ ] UFW activé et configuré
- [ ] Ports autorisés : 22 (SSH), 80 (HTTP), 443 (HTTPS)

### SSL

- [ ] Certificat Let's Encrypt installé
- [ ] Auto-renouvellement configuré
- [ ] Test de renouvellement : `sudo certbot renew --dry-run`

### Sauvegardes

- [ ] Script de backup testé : `./backup.sh`
- [ ] Backup créé dans `/var/backups/moncabinet/`
- [ ] Cron configuré pour backups automatiques (optionnel)

---

## 📊 MONITORING

### PM2

- [ ] PM2 startup configuré : `pm2 startup` exécuté
- [ ] Configuration sauvegardée : `pm2 save` exécuté
- [ ] Application démarre automatiquement au reboot

### Logs

- [ ] Logs PM2 accessibles : `pm2 logs moncabinet`
- [ ] Logs Nginx accessibles : `/var/log/nginx/moncabinet.tn.error.log`

---

## 📝 DOCUMENTATION

### Accès sauvegardés

- [ ] IP VPS sauvegardée dans gestionnaire de mots de passe
- [ ] Identifiants SSH sauvegardés
- [ ] Commandes fréquentes notées

### Informations importantes

```
IP VPS : ____________________
Domaine : moncabinet.tn
Port app : 7002
Utilisateur : moncabinet
Répertoire app : /home/moncabinet/moncabinet
```

---

## 🎯 COMMANDES DE GESTION QUOTIDIENNES

### Maintenance courante

```bash
# Se connecter au VPS
ssh root@[IP-VPS]

# Voir les logs
pm2 logs moncabinet

# Redémarrer l'application
pm2 restart moncabinet

# Mettre à jour l'application
cd /home/moncabinet/moncabinet
./deploy.sh

# Créer un backup
./backup.sh

# Voir l'utilisation des ressources
pm2 monit
```

---

## 🆘 EN CAS DE PROBLÈME

### Application ne répond pas

- [ ] Vérifier PM2 : `pm2 status`
- [ ] Vérifier les logs : `pm2 logs moncabinet --lines 50`
- [ ] Redémarrer : `pm2 restart moncabinet`

### Erreur 502

- [ ] Vérifier Nginx : `sudo systemctl status nginx`
- [ ] Vérifier logs Nginx : `sudo tail -f /var/log/nginx/moncabinet.tn.error.log`
- [ ] Redémarrer Nginx : `sudo systemctl restart nginx`

### Problème SSL

- [ ] Vérifier certificat : `sudo certbot certificates`
- [ ] Renouveler : `sudo certbot renew --force-renewal`
- [ ] Redémarrer Nginx : `sudo systemctl restart nginx`

---

## ✨ OPTIMISATIONS POST-DÉPLOIEMENT

### Performance

- [ ] Cloudflare Page Rules configurées
- [ ] Images optimisées
- [ ] Cache configuré

### Monitoring avancé (Optionnel)

- [ ] Uptime monitoring configuré (UptimeRobot, etc.)
- [ ] Analytics configurés
- [ ] Error tracking configuré (Sentry, etc.)

### SEO (Optionnel)

- [ ] Sitemap généré
- [ ] robots.txt configuré
- [ ] Meta tags vérifiés
- [ ] Google Search Console configuré

---

## 🎉 DÉPLOIEMENT TERMINÉ

Date de déploiement : `____________________`

**Félicitations ! MonCabinet est maintenant en production ! 🚀**

---

## 📚 RESSOURCES

- Guide complet : [README-DEPLOYMENT.md](./README-DEPLOYMENT.md)
- Guide rapide : [QUICK-START-VPS.md](./QUICK-START-VPS.md)
- Template env : [.env.production.template](./.env.production.template)

---

**💡 Conseil :** Gardez cette checklist et cochez les éléments au fur et à mesure. Vous pouvez l'imprimer ou la garder ouverte dans un éditeur pendant le déploiement.
