# ⚡ Quick Start - Déploiement VPS en 5 minutes

Guide ultra-rapide pour déployer MonCabinet sur VPS Contabo.

## 🎯 Prérequis

- ✅ VPS Contabo provisionné (Ubuntu 22.04)
- ✅ Domaine configuré dans Cloudflare
- ✅ Clés API Supabase et Resend prêtes

## 🚀 Installation en 3 commandes

### 1. Connexion au VPS

```bash
ssh root@[IP-VPS]
```

### 2. Télécharger et lancer le script

```bash
curl -o setup-vps.sh https://raw.githubusercontent.com/VOTRE-USER/Avocat/main/scripts/setup-vps.sh
chmod +x setup-vps.sh
sudo bash setup-vps.sh
```

### 3. Répondre aux questions

Le script vous demandera :
- **Domaine** : `moncabinet.tn`
- **Email SSL** : `admin@moncabinet.tn`
- **Port app** : `7002` (ou appuyez sur Entrée)
- **Git repo** : URL de votre repository
- **Créer user** : `o` (oui)
- **Username** : `moncabinet` (ou appuyez sur Entrée)

⏱️ **Attendez 15-20 minutes** pendant l'installation automatique.

---

## 🔧 Configuration Post-Installation

### 1. Éditer les variables d'environnement

```bash
nano /home/moncabinet/moncabinet/.env.production
```

**Remplissez au minimum :**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
RESEND_API_KEY=re_xxxxx
```

Sauvegardez : `Ctrl+X`, `Y`, `Entrée`

### 2. Redémarrer l'application

```bash
pm2 restart moncabinet
```

### 3. Vérifier les logs

```bash
pm2 logs moncabinet
```

Vous devriez voir : `✓ Ready in XXXms`

---

## 🌐 Configuration Cloudflare (2 minutes)

### 1. Obtenir l'IP du VPS

Sur le VPS :
```bash
curl ifconfig.me
```

Notez l'IP affichée.

### 2. Mettre à jour le DNS

Dans Cloudflare :
1. **DNS** → **Records**
2. Modifier l'enregistrement **A** :
   - Nom : `@`
   - Contenu : `[IP-VPS]`
   - Proxy : ☁️ **Activé**
   - Clic sur **Enregistrer**

### 3. Configurer SSL

1. **SSL/TLS** → **Overview** → **Full (strict)**
2. **Edge Certificates** → Activer :
   - ✅ Always Use HTTPS
   - ✅ Automatic HTTPS Rewrites

---

## ✅ Test Final

Attendez 2-3 minutes pour la propagation DNS, puis testez :

```bash
curl -I https://moncabinet.tn
```

Vous devriez voir : `HTTP/2 200`

Ouvrez dans le navigateur : **https://moncabinet.tn**

---

## 🎉 C'est fait !

Votre application est maintenant en ligne !

### Commandes essentielles

```bash
# Voir les logs
pm2 logs moncabinet

# Redémarrer
pm2 restart moncabinet

# Déployer une mise à jour
cd /home/moncabinet/moncabinet && ./deploy.sh
```

### En cas de problème

Consultez le guide complet : [README-DEPLOYMENT.md](./README-DEPLOYMENT.md)

---

**💡 Astuce :** Sauvegardez vos commandes SSH dans votre gestionnaire de mots de passe pour un accès rapide au VPS.
