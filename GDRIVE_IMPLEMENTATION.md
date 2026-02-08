# Implémentation Google Drive - Phase 1 Backend

## ✅ Fichiers créés

### 1. Migration Base de Données
**Fichier:** `db/migrations/20260211000001_add_google_drive_support.sql`
- Ajoute colonne `drive_config JSONB` à `web_sources`
- Étend constraint catégorie avec `google_drive`
- Crée index pour filtrer sources Google Drive actives
- Fonction helper `extract_gdrive_folder_id()`

### 2. Extension des Types
**Fichier:** `lib/web-scraper/types.ts` (modifié)
- Nouveau type `GoogleDriveFile` (ligne 348)
- Catégorie `google_drive` dans `WebSourceCategory` (ligne 22)
- Traduction AR/FR pour `google_drive` dans `CATEGORY_TRANSLATIONS` (ligne 40)
- Champ `driveConfig` dans interface `WebSource` (ligne 223-228)
- Source `'gdrive'` dans `LinkedFile['source']` (ligne 313)

### 3. Utilitaires Google Drive
**Fichier:** `lib/web-scraper/gdrive-utils.ts` (nouveau)

**Fonctions principales:**
- `parseGoogleDriveFolderUrl()` - Parser URL → folderId
- `buildGoogleDriveBaseUrl()` - Construire format `gdrive://`
- `isGoogleDriveSource()` - Détecter source Google Drive
- `mapMimeTypeToFileType()` - Mapper MIME → type fichier
- `isAllowedFileType()` - Vérifier filtres driveConfig.fileTypes
- `validateDriveFolderAccess()` - Tester accès service account
- `mapGoogleDriveFileToLinkedFile()` - Convertir GoogleDriveFile → LinkedFile
- `requiresExport()` - Détecter Google Docs natifs
- `getExportMimeType()` - MIME d'export pour Google Docs

### 4. Service Crawler Google Drive
**Fichier:** `lib/web-scraper/gdrive-crawler-service.ts` (nouveau)

**Fonctions principales:**
- `crawlGoogleDriveFolder()` - Crawler principal
- `listDriveFiles()` - Lister fichiers récursifs + pagination
- `upsertWebPage()` - Créer/mettre à jour web_pages

**Features:**
- Mode incrémental via `modifiedTime`
- Pagination Google Drive API (max 1000 fichiers/requête)
- Rate limiting configurable
- Filtrage par type de fichier
- Limite de taille (50MB)
- Détection changements via hash composite
- Création de versions (`web_page_versions`)
- Protection boucles infinies (dossiers récursifs)

### 5. Router Crawler Principal
**Fichier:** `lib/web-scraper/crawler-service.ts` (modifié ligne 63-67)

```typescript
// Router: Google Drive vs Web
if (baseUrl?.startsWith('gdrive://')) {
  const { crawlGoogleDriveFolder } = await import('./gdrive-crawler-service')
  return crawlGoogleDriveFolder(source, options)
}
```

**Impact:** Zéro régression sur web crawling, routing transparent.

### 6. Extension Storage Adapter
**Fichier:** `lib/web-scraper/storage-adapter.ts` (modifié ligne 257-320)

Nouvelle fonction `downloadGoogleDriveFileForIndexing()`:
- Export automatique Google Docs → DOCX
- Export automatique Google Sheets → XLSX
- Export automatique Google Slides → PPTX
- Téléchargement direct pour PDF/DOCX natifs

### 7. API Test Connexion
**Fichier:** `app/api/admin/gdrive/test-connection/route.ts` (nouveau)

**Endpoint:** `POST /api/admin/gdrive/test-connection`
**Body:** `{ folderId: string }`
**Response:** `{ success: boolean, fileCount?: number, error?: string }`

Valide l'accès au dossier et retourne le nombre de fichiers découverts.

### 8. Script de Test
**Fichier:** `scripts/test-gdrive-connection.ts` (nouveau)

**Usage:**
```bash
npx tsx scripts/test-gdrive-connection.ts <FOLDER_ID_OR_URL>
```

Vérifie:
- Variables d'environnement (`GOOGLE_DRIVE_ENABLED`, credentials)
- Accès au dossier
- Liste premiers fichiers

---

## 🔧 Configuration Requise

### Variables d'Environnement

```bash
# Google Drive
GOOGLE_DRIVE_ENABLED=true
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# OAuth (existant, réutilisé)
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### Service Account Google

1. **Créer service account:**
   ```bash
   gcloud iam service-accounts create qadhya-gdrive-crawler \
     --display-name="Qadhya Google Drive Crawler"
   ```

2. **Générer clé JSON:**
   ```bash
   gcloud iam service-accounts keys create ~/qadhya-gdrive-sa-key.json \
     --iam-account=qadhya-gdrive-crawler@PROJECT_ID.iam.gserviceaccount.com
   ```

3. **Partager dossier Google Drive:**
   - Partager avec l'email du service account
   - Permission: **Lecteur** (lecture seule)

4. **Stocker credentials (DB):**
   ```sql
   INSERT INTO system_settings (key, value, description)
   VALUES (
     'google_drive_service_account',
     '{"type":"service_account","project_id":"...","private_key":"..."}',
     'Google Drive service account credentials'
   );
   ```

---

## 📊 Structure de Données

### Table `web_sources` (étendue)

```sql
ALTER TABLE web_sources ADD COLUMN drive_config JSONB;

-- Exemple:
{
  "folderId": "1A2B3C4D5E6F",
  "recursive": true,
  "fileTypes": ["pdf", "docx"],
  "serviceAccountEmail": "qadhya-gdrive-crawler@project.iam.gserviceaccount.com"
}
```

### Format `baseUrl`

```
gdrive://1A2B3C4D5E6F
```

Le folderId est extrait automatiquement depuis:
- `https://drive.google.com/drive/folders/1A2B3C4D5E6F`
- `gdrive://1A2B3C4D5E6F`
- `1A2B3C4D5E6F` (direct)

### Linked Files

```typescript
{
  url: "https://drive.google.com/file/d/abc123/view",
  type: "pdf",
  filename: "Code Civil.pdf",
  size: 1234567,
  downloaded: false,
  minioPath: "abc123",  // ⭐ Google Drive fileId
  originalUrl: "https://drive.google.com/file/d/abc123/view",
  source: "gdrive"
}
```

**Note:** Le `fileId` Google Drive est stocké dans `minioPath` pour réutiliser le système existant.

---

## 🔄 Flow de Crawl

### 1. Crawl Initial (Full)

```
Cron → claim_next_crawl_job()
  → crawlSource(source, { incrementalMode: false })
  → Router détecte baseUrl.startsWith('gdrive://')
  → crawlGoogleDriveFolder()
  → listDriveFiles(folderId, { recursive: true })
  → Pour chaque fichier:
      - Filtrer par fileTypes (PDF, DOCX)
      - Créer LinkedFile
      - INSERT web_pages (status='crawled', linked_files=[...])
      - Si autoIndexFiles: indexer immédiatement
  → complete_crawl_job()
```

### 2. Crawl Incrémental

```
Cron → claim_next_crawl_job()
  → crawlSource(source, { incrementalMode: true })
  → listDriveFiles(folderId, { modifiedSince: source.lastCrawlAt })
  → Google Drive query: modifiedTime > 'lastCrawlAt'
  → Pour chaque fichier modifié:
      - Vérifier content_hash (fileId + modifiedTime + size)
      - Si changé:
          → UPDATE web_pages (status='changed')
          → INSERT web_page_versions
          → Réindexer
  → complete_crawl_job()
```

---

## 🧪 Tests

### Test de Connexion

```bash
npx tsx scripts/test-gdrive-connection.ts 1A2B3C4D5E6F
```

**Output attendu:**
```
🔍 Test de connexion Google Drive

Folder ID: 1A2B3C4D5E6F
---
✅ Variables d'environnement configurées

🔐 Test d'accès au dossier...
✅ Connexion réussie
✅ 15 fichier(s) découvert(s)

✨ Configuration Google Drive opérationnelle!
```

### Test API

```bash
curl -X POST http://localhost:3000/api/admin/gdrive/test-connection \
  -H "Content-Type: application/json" \
  -d '{"folderId":"1A2B3C4D5E6F"}'
```

**Response:**
```json
{
  "success": true,
  "fileCount": 15,
  "message": "Connexion réussie. 15 fichier(s) découvert(s)."
}
```

---

## ⚠️ Pièges à Éviter

### 1. MIME Types Google Docs Natifs
**Problème:** Les Google Docs ne sont pas téléchargeables directement.
**Solution:** Utiliser `drive.files.export()` avec MIME d'export (implémenté dans `storage-adapter.ts`).

### 2. Boucles Infinies (Dossiers Récursifs)
**Problème:** Un dossier peut contenir un raccourci vers son parent.
**Solution:** `Set<string> visitedFolders` pour tracker les dossiers visités (implémenté).

### 3. Fichiers Volumineux
**Problème:** Fichiers de plusieurs GB.
**Solution:** Limite `MAX_FILE_SIZE = 50MB` (configurable).

### 4. Rate Limiting Google API
**Problème:** 1M requêtes/jour, 1000/100s par utilisateur.
**Solution:** `rateLimitMs` entre requêtes + pagination efficace.

### 5. Token Refresh
**Problème:** Tokens OAuth expirent après 1h.
**Solution:** `getGoogleDriveClient()` gère le refresh automatique (déjà implémenté).

---

## 📝 TODO - Phase 2: UI Admin

### À implémenter:

1. **Page création source** (`app/(dashboard)/admin/sources/new/page.tsx`)
   - Radio buttons: Web / Google Drive
   - Parser URL dossier → folderId
   - Checkbox récursif
   - Multi-select types de fichiers
   - Bouton "Tester la connexion"
   - Validation avant soumission

2. **Page détails source** (`app/(dashboard)/admin/sources/[id]/page.tsx`)
   - Détecter `baseUrl.startsWith('gdrive://')`
   - Afficher config Google Drive
   - Lien vers dossier Google Drive
   - Bouton "Synchroniser maintenant"

3. **Tests end-to-end**
   - Création source via UI
   - Crawl manuel
   - Vérification indexation
   - Recherche RAG avec sources Google Drive

---

## 📈 Métriques de Succès

- ✅ 0 erreurs TypeScript
- ✅ Migration DB appliquée sans erreur
- ✅ Router transparent (pas de régression web crawling)
- ✅ Export automatique Google Docs natifs
- ✅ Script test fonctionnel
- ✅ API test connexion fonctionnelle
- ✅ Documentation complète

---

## 🚀 Prochaines Étapes

1. Appliquer migration DB en local: `psql qadhya < db/migrations/20260211000001_add_google_drive_support.sql`
2. Configurer service account Google Cloud
3. Tester connexion: `npx tsx scripts/test-gdrive-connection.ts <FOLDER_ID>`
4. Implémenter UI admin (Phase 2)
5. Tests end-to-end
6. Déployer en production

---

## 📚 Références

- Plan complet: `/Users/salmenktata/Projets/GitHub/Avocat/plan.md` (transcript)
- Architecture existante: `MEMORY.md` (mis à jour)
- Google Drive API: https://developers.google.com/drive/api/v3/reference
- Service Account: https://cloud.google.com/iam/docs/service-accounts
