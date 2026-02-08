# Configuration Google Drive pour Production

## 🎯 Objectif

Configurer un Service Account Google pour l'accès automatique et permanent aux dossiers Google Drive en production.

---

## 📋 Prérequis

- Projet Google Cloud : `qadhya` (déjà créé ✅)
- Google Drive API activée ✅
- Accès SSH au serveur VPS

---

## 🔐 Méthode Recommandée : Service Account

### Avantages

✅ **Pas d'expiration de token** (contrairement à OAuth)
✅ **Authentification automatique** (pas de flow interactif)
✅ **Isolation sécurité** (permissions minimales)
✅ **Idéal pour production**

---

## 📝 Étapes de Configuration

### 1. Créer un Service Account

**Via Google Cloud Console :**

1. Aller sur : https://console.cloud.google.com/iam-admin/serviceaccounts?project=qadhya
2. Cliquer sur **"Créer un compte de service"**
3. Remplir les informations :
   - **Nom** : `qadhya-gdrive-crawler`
   - **Description** : `Service account pour le crawl automatique des dossiers Google Drive`
4. Cliquer sur **"Créer et continuer"**
5. **Rôle** : Aucun rôle nécessaire (accès limité aux dossiers partagés)
6. Cliquer sur **"Continuer"** puis **"OK"**

---

### 2. Générer une Clé JSON

1. Dans la liste des service accounts, cliquer sur `qadhya-gdrive-crawler`
2. Aller dans l'onglet **"Clés"** (Keys)
3. Cliquer sur **"Ajouter une clé"** → **"Créer une clé"**
4. Format : **JSON**
5. Cliquer sur **"Créer"**
6. **Télécharger le fichier JSON** (conservez-le en sécurité !)

Le fichier ressemble à :
```json
{
  "type": "service_account",
  "project_id": "qadhya",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "qadhya-gdrive-crawler@qadhya.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/..."
}
```

---

### 3. Partager le Dossier Google Drive

**IMPORTANT** : Le service account n'a accès qu'aux dossiers explicitement partagés avec lui.

1. Ouvrir le dossier Google Drive : https://drive.google.com/drive/folders/1-7j08Uivjn5XSNckuSwSxQcBkvZJvCtl
2. Clic droit → **"Partager"**
3. Ajouter l'email du service account :
   ```
   qadhya-gdrive-crawler@qadhya.iam.gserviceaccount.com
   ```
4. Permission : **Lecteur** (read-only)
5. Cliquer sur **"Partager"**

---

### 4. Configurer le Serveur Production

#### Option A : Via Script Interactif (Recommandé)

```bash
# 1. Copier le fichier JSON sur le serveur
scp ~/Downloads/qadhya-*.json root@84.247.165.187:/tmp/service-account.json

# 2. Se connecter au serveur
ssh root@84.247.165.187

# 3. Lancer le script de configuration
cd /root/moncabinet
docker compose exec nextjs npx tsx scripts/setup-google-drive.ts

# Suivre les instructions :
# - Choisir "1" (Service Account)
# - Chemin : /tmp/service-account.json
# - Tester avec l'URL du dossier
```

#### Option B : Configuration Manuelle

```bash
# 1. Se connecter au serveur
ssh root@84.247.165.187

# 2. Insérer le service account dans la DB
docker compose exec -T postgres psql -U moncabinet -d moncabinet << 'EOF'
INSERT INTO system_settings (key, value, description)
VALUES (
  'google_drive_service_account',
  '{"type":"service_account","project_id":"qadhya",...}',
  'Google Drive service account credentials for web crawling'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();
EOF

# 3. Vérifier
docker compose exec -T postgres psql -U moncabinet -d moncabinet -c \
  "SELECT key, description, created_at FROM system_settings WHERE key = 'google_drive_service_account';"
```

---

### 5. Tester la Configuration

```bash
# Sur le serveur de production
docker compose exec nextjs npx tsx scripts/test-gdrive-connection.ts \
  "https://drive.google.com/drive/folders/1-7j08Uivjn5XSNckuSwSxQcBkvZJvCtl"
```

**Résultat attendu :**
```
✅ Connexion réussie
✅ 10 fichier(s) découvert(s)
```

---

## 🔒 Sécurité

### Bonnes Pratiques

1. ✅ **Permissions minimales** : Le service account n'a accès qu'aux dossiers partagés
2. ✅ **Lecture seule** : Toujours utiliser la permission "Lecteur"
3. ✅ **Stockage sécurisé** : Le fichier JSON est stocké dans PostgreSQL (pas dans le code)
4. ✅ **Rotation des clés** : Possibilité de créer/révoquer des clés à tout moment
5. ✅ **Audit logs** : Google Cloud permet de tracer tous les accès

### Révocation d'Accès

Si le service account est compromis :

1. Supprimer la clé JSON dans Google Cloud Console
2. Créer une nouvelle clé
3. Mettre à jour `system_settings` dans la DB
4. Optionnel : Révoquer le partage du dossier Google Drive

---

## 📊 Monitoring

### Vérifier les Logs de Crawl

```bash
# Logs du crawler
docker compose logs -f --tail=100 nextjs | grep "GDrive"

# Vérifier le statut des sources Google Drive
docker compose exec -T postgres psql -U moncabinet -d moncabinet -c \
  "SELECT name, category, last_crawl_at, total_pages_indexed
   FROM web_sources
   WHERE category = 'google_drive' AND is_active = true;"
```

### Vérifier les Quotas Google Drive API

- Dashboard : https://console.cloud.google.com/apis/api/drive.googleapis.com/quotas?project=qadhya
- Limite par défaut : **1M requêtes/jour**

---

## 🚀 Prochaines Étapes

1. **Créer la première source** via l'UI admin
2. **Lancer un crawl manuel** pour tester
3. **Vérifier l'indexation** dans la base de connaissances
4. **Tester une recherche RAG** incluant des documents Google Drive

---

## 🆘 Troubleshooting

### Erreur : "Access denied" (403)

**Cause** : Le dossier n'est pas partagé avec le service account

**Solution** :
1. Vérifier que l'email du service account est bien dans les partages
2. Vérifier que le partage a été accepté (pas en attente)

### Erreur : "Token expired" (401)

**Cause** : Credentials invalides ou révoquées

**Solution** :
1. Vérifier que la clé JSON n'a pas été supprimée dans Google Cloud Console
2. Re-générer une nouvelle clé si nécessaire
3. Mettre à jour `system_settings`

### Erreur : "Quota exceeded" (429)

**Cause** : Limite de 1M requêtes/jour atteinte

**Solution** :
1. Augmenter `rateLimitMs` dans la config de la source
2. Réduire la fréquence de crawl
3. Demander une augmentation de quota à Google

---

## 📚 Références

- [Google Drive API - Service Accounts](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts?project=qadhya)
- [Documentation Google Drive API](https://developers.google.com/drive/api/guides/about-sdk)
