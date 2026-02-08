# Guide de Déploiement Google Drive - Production

## 📋 Checklist de Déploiement

### 1. Appliquer les Migrations SQL (VPS)

Connectez-vous au VPS et exécutez:

```bash
# Se connecter au VPS
ssh user@your-vps-ip

# Appliquer les migrations
cd /path/to/app
psql -U moncabinet -d moncabinet -f db/migrations/20260211000001_add_google_drive_support.sql
psql -U moncabinet -d moncabinet -f db/migrations/20260211000002_create_system_settings.sql
```

**Vérification:**
```sql
-- Vérifier que drive_config a été ajouté
\d web_sources

-- Vérifier que system_settings existe
\d system_settings

-- Vérifier la fonction
SELECT extract_gdrive_folder_id('gdrive://1A2B3C4D5E6F');
-- Doit retourner: 1A2B3C4D5E6F
```

---

### 2. Configurer l'Authentification Google Drive

**Option A: Service Account (Recommandé pour Production)**

1. **Créer un Service Account Google Cloud:**

```bash
# Via gcloud CLI
gcloud iam service-accounts create qadhya-gdrive-reader \
  --display-name="Qadhya Google Drive Reader" \
  --project=YOUR_PROJECT_ID

# Générer clé JSON
gcloud iam service-accounts keys create ~/qadhya-sa-key.json \
  --iam-account=qadhya-gdrive-reader@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

2. **Activer Google Drive API:**
   - Console Google Cloud → APIs & Services → Enable APIs
   - Rechercher "Google Drive API"
   - Cliquer "Enable"

3. **Partager le dossier Google Drive:**
   - Ouvrir le dossier dans Google Drive
   - Clic droit → Partager
   - Ajouter l'email du service account: `qadhya-gdrive-reader@YOUR_PROJECT_ID.iam.gserviceaccount.com`
   - Permission: **Lecteur** (read-only)

4. **Stocker le Service Account dans la DB:**

```bash
# Lire le contenu de la clé JSON
cat ~/qadhya-sa-key.json

# Se connecter à PostgreSQL
psql -U moncabinet -d moncabinet

# Insérer le service account (remplacer {...} par le contenu du JSON)
INSERT INTO system_settings (key, value, description)
VALUES (
  'google_drive_service_account',
  '{
    "type": "service_account",
    "project_id": "your-project-id",
    "private_key_id": "...",
    "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    "client_email": "qadhya-gdrive-reader@your-project-id.iam.gserviceaccount.com",
    "client_id": "...",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "..."
  }',
  'Google Drive service account credentials for web crawling'
);
```

**Option B: OAuth Token Système (Alternative)**

Si vous préférez utiliser OAuth au lieu d'un service account:

1. **Obtenir un token OAuth:**
   - Connectez-vous à l'application web en tant qu'admin
   - Allez dans Paramètres → Cloud Storage → Google Drive
   - Autorisez l'accès Google Drive
   - Le token sera stocké automatiquement

2. **Copier le token vers system_settings:**

```sql
-- Copier le token d'un utilisateur admin vers system_settings
INSERT INTO system_settings (key, value, description)
SELECT
  'google_drive_system_token',
  credentials::text,
  'Google Drive OAuth token for system-wide access'
FROM user_cloud_storage
WHERE user_id = (SELECT id FROM users WHERE email = 'admin@example.com')
  AND provider = 'google_drive'
LIMIT 1;
```

---

### 3. Configurer les Variables d'Environnement

Ajoutez à votre `.env` de production:

```bash
# Google Drive
GOOGLE_DRIVE_ENABLED=true
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
```

**Note:** Ces variables sont déjà utilisées pour l'upload de documents utilisateurs, elles devraient déjà être configurées.

---

### 4. Redémarrer l'Application

```bash
# Sur le VPS
cd /path/to/app
docker-compose -f docker-compose.prod.yml restart moncabinet-nextjs

# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs -f moncabinet-nextjs | grep GoogleDrive
```

---

### 5. Tester la Configuration

**Via Script CLI:**

```bash
# Sur le VPS, dans le container
docker exec -it moncabinet-nextjs npx tsx scripts/test-gdrive-connection.ts "https://drive.google.com/drive/folders/1-7j08Uivjn5XSNckuSwSxQcBkvZJvCtl"
```

**Output attendu:**
```
🔍 Test de connexion Google Drive

Folder ID: 1-7j08Uivjn5XSNckuSwSxQcBkvZJvCtl
---
✅ Variables d'environnement configurées

🔐 Test d'accès au dossier...
✅ Connexion réussie
✅ X fichier(s) découvert(s)

✨ Configuration Google Drive opérationnelle!
```

**Via Interface Web:**

1. Accéder à `https://yourdomain.com/super-admin/web-sources/new`
2. Sélectionner "Google Drive"
3. Coller l'URL du dossier: `https://drive.google.com/drive/folders/1-7j08Uivjn5XSNckuSwSxQcBkvZJvCtl`
4. Cliquer "Tester la connexion"
5. Vérifier le message de succès

---

### 6. Créer la Première Source Google Drive

**Via Interface:**

1. Aller à `/super-admin/web-sources/new`
2. Type: Google Drive
3. Nom: "Documents Juridiques Cabinet"
4. URL dossier: `https://drive.google.com/drive/folders/1-7j08Uivjn5XSNckuSwSxQcBkvZJvCtl`
5. Récursif: Oui
6. Types de fichiers: PDF, DOCX
7. Catégorie: Codes juridiques (ou selon votre besoin)
8. Fréquence: 24 heures
9. Auto-indexation: Oui
10. Créer

**Via SQL (alternative):**

```sql
INSERT INTO web_sources (
  name,
  base_url,
  description,
  category,
  language,
  crawl_frequency,
  max_pages,
  download_files,
  auto_index_files,
  rate_limit_ms,
  drive_config,
  is_active
)
VALUES (
  'Documents Juridiques Cabinet',
  'gdrive://1-7j08Uivjn5XSNckuSwSxQcBkvZJvCtl',
  'Dossier partagé contenant codes et lois',
  'google_drive',
  'fr',
  '24 hours',
  1000,
  true,
  true,
  1000,
  '{"folderId":"1-7j08Uivjn5XSNckuSwSxQcBkvZJvCtl","recursive":true,"fileTypes":["pdf","docx"]}',
  true
)
RETURNING id;
```

---

### 7. Lancer le Premier Crawl

**Option 1: Via UI**
- Aller sur la page de détails de la source
- Cliquer "Lancer crawl maintenant"

**Option 2: Via API**
```bash
curl -X POST https://yourdomain.com/api/admin/web-sources/{SOURCE_ID}/crawl \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Option 3: Attendre le cron automatique**
Le cron `/api/cron/web-crawler` s'exécute toutes les heures et va détecter la nouvelle source.

---

### 8. Vérifier l'Indexation

```sql
-- Nombre de pages crawlées depuis Google Drive
SELECT COUNT(*)
FROM web_pages wp
JOIN web_sources ws ON wp.web_source_id = ws.id
WHERE ws.category = 'google_drive';

-- Nombre de documents indexés dans la KB
SELECT COUNT(*)
FROM knowledge_base kb
WHERE kb.metadata->>'source' = 'google_drive';

-- Détails des fichiers indexés
SELECT
  wp.title,
  wp.linked_files->0->>'filename' as filename,
  wp.linked_files->0->>'size' as size,
  wp.is_indexed,
  wp.chunks_count
FROM web_pages wp
JOIN web_sources ws ON wp.web_source_id = ws.id
WHERE ws.category = 'google_drive'
ORDER BY wp.created_at DESC
LIMIT 10;
```

---

## 🔧 Troubleshooting

### Erreur: "relation system_settings does not exist"

**Solution:** Appliquer la migration
```bash
psql -U moncabinet -d moncabinet -f db/migrations/20260211000002_create_system_settings.sql
```

### Erreur: "Google Drive non configuré"

**Vérifier la configuration:**
```sql
SELECT key, description, created_at
FROM system_settings
WHERE key LIKE 'google_drive%';
```

Si vide, revoir l'étape 2.

### Erreur: "403 Forbidden" ou "404 Not Found"

**Causes possibles:**
1. Dossier pas partagé avec le service account
2. FolderId incorrect
3. Service account n'a pas les permissions

**Vérification:**
- Vérifier l'email du service account dans le JSON
- Vérifier que le dossier est bien partagé (lecteur)
- Tester manuellement dans Google Drive web

### Crawl 0 fichiers découverts

**Causes possibles:**
1. Dossier vide
2. Filtres `fileTypes` trop restrictifs
3. Permissions insuffisantes

**Debug:**
```bash
docker exec -it moncabinet-nextjs node -e "
const { validateDriveFolderAccess } = require('./lib/web-scraper/gdrive-utils');
validateDriveFolderAccess('1-7j08Uivjn5XSNckuSwSxQcBkvZJvCtl').then(console.log);
"
```

---

## 📊 Monitoring

**Surveiller les logs du crawler:**
```bash
docker-compose -f docker-compose.prod.yml logs -f moncabinet-nextjs | grep -E "(GDriveCrawler|GoogleDrive)"
```

**Logs attendus lors d'un crawl réussi:**
```
[GoogleDrive] Service account configuré
[GDriveCrawler] Source: Documents Juridiques Cabinet (gdrive://1-7j...)
[GDriveCrawler] Listing files (recursive: true, modifiedSince: none)
[GDriveCrawler] Discovered 15 files
[GDriveCrawler] Processing: Code Civil.pdf
[GDriveCrawler] Created page: uuid-abc123
[GDriveCrawler] Completed: 15 processed, 15 new, 0 changed, 0 failed
```

---

## ✅ Checklist de Validation Finale

- [ ] Migrations SQL appliquées (vérifier avec `\d web_sources`, `\d system_settings`)
- [ ] Service account configuré dans `system_settings`
- [ ] Dossier Google Drive partagé avec le service account
- [ ] Variables d'environnement `GOOGLE_DRIVE_ENABLED=true`
- [ ] Test de connexion réussi (script ou UI)
- [ ] Première source Google Drive créée
- [ ] Premier crawl lancé et complété
- [ ] Documents indexés dans `knowledge_base`
- [ ] Recherche RAG fonctionne avec les documents Google Drive

---

## 📚 Documentation Complète

- Architecture: `GDRIVE_IMPLEMENTATION.md`
- Mémoire projet: `MEMORY.md` (section Sources de données)
- Code: `lib/web-scraper/gdrive-*`
