# Google Drive - Démarrage Rapide (Local)

## 🚀 Option 1: Mode Test avec OAuth (Le plus simple)

### Étape 1: Créer des credentials Google

1. **Aller sur Google Cloud Console:**
   - https://console.cloud.google.com

2. **Créer un projet** (ou utiliser un existant)
   - En haut: "Sélectionner un projet" → "Nouveau projet"
   - Nom: "Qadhya Test" (ou autre)

3. **Activer Google Drive API:**
   - Menu → "APIs & Services" → "Bibliothèque"
   - Rechercher "Google Drive API"
   - Cliquer "Activer"

4. **Créer credentials OAuth 2.0:**
   - "APIs & Services" → "Identifiants"
   - "Créer des identifiants" → "ID client OAuth"
   - Type d'application: **Application de bureau** (Desktop app)
   - Nom: "Qadhya Local"
   - Cliquer "Créer"

5. **Télécharger le JSON:**
   - Cliquer sur les credentials créés
   - Télécharger le JSON
   - Vous verrez `client_id` et `client_secret`

### Étape 2: Configurer le .env

Ouvrez `.env` et ajoutez:

```bash
GOOGLE_CLIENT_ID=votre_client_id_ici.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=votre_client_secret_ici
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### Étape 3: Lancer le script de configuration

```bash
npx tsx scripts/setup-google-drive.ts
```

Le script va:
1. Vous demander de choisir entre Service Account ou OAuth
2. Choisissez **2** (OAuth - plus simple)
3. Suivez les instructions à l'écran
4. Autorisez l'accès dans votre navigateur
5. Copiez le code et collez-le dans le terminal

### Étape 4: Tester

```bash
npx tsx scripts/test-gdrive-connection.ts "https://drive.google.com/drive/folders/1-7j08Uivjn5XSNckuSwSxQcBkvZJvCtl"
```

---

## 🔧 Option 2: Mode Service Account (Production)

Plus sécurisé mais un peu plus complexe. À utiliser pour la production.

### Étape 1: Créer un Service Account

1. **Google Cloud Console** → IAM & Admin → Service Accounts
2. "Create Service Account"
   - Name: "qadhya-gdrive-reader"
   - Cliquer "Create and Continue"
   - Pas besoin de rôles → "Continue"
   - "Done"

3. **Créer une clé:**
   - Cliquer sur le service account créé
   - Onglet "Keys"
   - "Add Key" → "Create new key"
   - Type: **JSON**
   - Télécharger le fichier

### Étape 2: Partager le dossier Google Drive

1. Ouvrir votre dossier dans Google Drive
2. Clic droit → "Partager"
3. Ajouter l'email du service account (ex: `qadhya-gdrive-reader@project-id.iam.gserviceaccount.com`)
4. Permission: **Lecteur** (read-only)

### Étape 3: Configurer

```bash
npx tsx scripts/setup-google-drive.ts
```

Choisissez **1** (Service Account) et suivez les instructions.

---

## ⚡ Option 3: Mode Test Ultra-Rapide (Temporaire)

Si vous voulez juste tester **une fois** sans configuration complète:

### 1. Obtenir un token temporaire

```bash
# Installer gcloud CLI si pas déjà fait
# brew install google-cloud-sdk  # macOS
# ou télécharger depuis https://cloud.google.com/sdk/docs/install

# S'authentifier
gcloud auth application-default login

# Obtenir un token
gcloud auth application-default print-access-token
```

### 2. Utiliser le token

Dans `.env`, ajoutez:
```bash
GOOGLE_DRIVE_TEST_ACCESS_TOKEN=ya29.a0...votre_token_ici
```

⚠️ **Ce token expire après 1h** - Uniquement pour test rapide!

### 3. Tester

```bash
npx tsx scripts/test-gdrive-connection.ts "https://drive.google.com/drive/folders/1-7j08Uivjn5XSNckuSwSxQcBkvZJvCtl"
```

---

## 🆘 Troubleshooting

### "GOOGLE_DRIVE_ENABLED n'est pas activé"

Ajoutez dans `.env`:
```bash
GOOGLE_DRIVE_ENABLED=true
```

### "relation system_settings does not exist"

Créer la table (base de données locale doit être démarrée):
```bash
# Démarrer PostgreSQL local
# brew services start postgresql  # macOS
# sudo systemctl start postgresql  # Linux

# Appliquer les migrations
npx tsx scripts/apply-gdrive-migrations.ts
```

### "ECONNREFUSED ::1:5432"

PostgreSQL n'est pas démarré. Deux options:

**Option A: Démarrer PostgreSQL local**
```bash
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux
```

**Option B: Utiliser la production (VPS)**
Connectez-vous au VPS et appliquez les migrations là-bas (voir `GDRIVE_DEPLOYMENT.md`).

### "403 Forbidden" ou "404 Not Found"

1. Vérifiez que le dossier est bien partagé
2. Vérifiez l'URL du dossier (doit être un dossier, pas un fichier)
3. Pour service account: vérifiez que l'email est correct

---

## ✅ Validation

Après configuration, vous devriez voir:

```
✅ Connexion réussie
✅ 15 fichier(s) découvert(s)
✨ Configuration Google Drive opérationnelle!
```

Vous pouvez ensuite créer votre première source Google Drive via:
- Interface: `http://localhost:3000/super-admin/web-sources/new`
- Ou attendre le déploiement en production

---

## 📚 Documentation Complète

- Configuration production: `GDRIVE_DEPLOYMENT.md`
- Architecture: `GDRIVE_IMPLEMENTATION.md`
- Résumé: `GDRIVE_SUMMARY.md`
