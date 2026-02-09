# Guide Démarrage Rapide - Nouvelles Sources Web

Guide pratique pour ajouter une nouvelle source web au système de crawl Qadhya.

## 🚀 Checklist 5 Minutes

### Avant de Commencer

- [ ] **Identifier le type de site**
  - Blog (WordPress, Blogger, Ghost)
  - Site institutionnel (Custom CMS)
  - SPA moderne (React, Vue, Livewire)
  - Autre

- [ ] **Vérifier ressources disponibles**
  - [ ] Sitemap XML : `curl https://example.com/sitemap.xml`
  - [ ] Flux RSS : `curl https://example.com/feed` ou `/feeds/posts/default`
  - [ ] Robots.txt : `curl https://example.com/robots.txt`

- [ ] **Vérifier buckets MinIO**
  ```bash
  # Local
  npm run check:minio

  # Production
  ./scripts/init-minio-prod.sh
  ```

### Configuration Rapide par Type

#### 🟦 Blog Blogger (ex: da5ira.com)

📚 **Guide complet** : [`docs/BLOGGER_SITES_GUIDE.md`](./BLOGGER_SITES_GUIDE.md)

```typescript
{
  name: "Nom du Blog",
  base_url: "https://example.com",
  category: "blog_juridique",

  // ✅ TOUJOURS utiliser sitemap pour Blogger
  sitemap_url: "https://example.com/sitemap.xml",
  rss_feed_url: "https://example.com/feeds/posts/default",
  use_sitemap: true,

  // ❌ PAS de JavaScript si sitemap activé
  requires_javascript: false,

  // ⏱️ Timeout élevé pour Blogger
  timeout_ms: 60000,

  // Patterns
  url_patterns: ["*/\\d{4}/\\d{2}/.+\\.html"],
  excluded_patterns: ["*.html?m=1", "*.html#*"]
}
```

**Résultat attendu** : 80-100+ pages en 5-10 minutes.

#### 🟩 WordPress

```typescript
{
  name: "Site WordPress",
  base_url: "https://example.com",
  category: "blog_juridique",

  // WordPress a toujours un sitemap
  sitemap_url: "https://example.com/wp-sitemap.xml",
  rss_feed_url: "https://example.com/feed",
  use_sitemap: true,

  requires_javascript: false,
  timeout_ms: 30000,

  url_patterns: ["*/\\d{4}/\\d{2}/\\d{2}/.+"],
  excluded_patterns: ["*/feed", "*/comment-*", "*/trackback"]
}
```

#### 🟧 Site Institutionnel / Custom CMS

```typescript
{
  name: "Site Institutionnel",
  base_url: "https://example.gov.tn",
  category: "officiel",

  // Tester si sitemap existe
  sitemap_url: "https://example.gov.tn/sitemap.xml",
  use_sitemap: true,  // Si sitemap valide

  // Peut nécessiter JavaScript
  requires_javascript: false,  // Tester d'abord sans
  timeout_ms: 30000,

  // Adapter selon structure
  url_patterns: [],
  excluded_patterns: ["*/print", "*/pdf-export"]
}
```

#### 🟥 SPA / Livewire (ex: 9anoun.tn)

```typescript
{
  name: "SPA Livewire",
  base_url: "https://example.com",
  category: "jurisprudence",

  // SPA = PAS de sitemap utile
  use_sitemap: false,

  // JavaScript REQUIS
  requires_javascript: true,
  timeout_ms: 60000,

  // Patterns spécifiques
  url_patterns: ["*/decision/*", "*/arret/*"],
  excluded_patterns: []
}
```

---

## 📋 Workflow Complet

### 1. Préparation (Local)

```bash
# Vérifier buckets MinIO
npm run check:minio

# Si manquants
npm run init:minio

# Tester sitemap
curl -I https://example.com/sitemap.xml

# Tester RSS
curl -I https://example.com/feed
```

### 2. Création Source Web

Via UI (`/super-admin/web-sources`) ou SQL :

```sql
INSERT INTO web_sources (
  name,
  base_url,
  description,
  category,
  language,

  -- Découverte
  sitemap_url,
  rss_feed_url,
  use_sitemap,

  -- Crawl
  requires_javascript,
  follow_links,
  max_depth,
  max_pages,

  -- Performance
  timeout_ms,
  rate_limit_ms,

  -- Patterns
  url_patterns,
  excluded_patterns
) VALUES (
  'Nom Site',
  'https://example.com',
  'Description courte',
  'blog_juridique',
  'ar',  -- ou 'fr'

  'https://example.com/sitemap.xml',
  'https://example.com/feed',
  true,

  false,
  true,
  3,
  1000,

  60000,
  2000,

  ARRAY['*/article/*'],
  ARRAY['*.html?m=1']
);
```

### 3. Premier Crawl (Test)

```bash
# Local: Créer job de test
npm run db:query "
  INSERT INTO web_crawl_jobs (web_source_id, job_type, priority)
  SELECT id, 'full_crawl', 10
  FROM web_sources
  WHERE name = 'Nom Site'
"

# Déclencher crawler local
npm run dev

# Ouvrir /super-admin/web-sources
# Cliquer "Crawl Now" sur la source
```

**Surveiller** :
```bash
# Logs temps réel
docker logs -f qadhya-nextjs | grep "Nom Site"

# Statistiques après 2-3 minutes
npm run db:query "
  SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN is_indexed THEN 1 END) as indexed,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
  FROM web_pages
  WHERE web_source_id = (
    SELECT id FROM web_sources WHERE name = 'Nom Site'
  )
"
```

### 4. Validation Résultats

**Critères de succès** :

- ✅ Health status = `healthy`
- ✅ Pages découvertes > 0
- ✅ Erreurs < 10%
- ✅ Durée crawl raisonnable (<10 min pour 100 pages)

**Si échec** :

| Symptôme | Cause Probable | Solution |
|----------|----------------|----------|
| 0 pages découvertes | Sitemap invalide | Vérifier URL sitemap, désactiver `use_sitemap` |
| Timeout homepage | JavaScript lourd | Activer sitemap, augmenter `timeout_ms` |
| Erreur bucket MinIO | Buckets manquants | `npm run init:minio` |
| 100% pages failed | Patterns incorrects | Ajuster `url_patterns` |

### 5. Déploiement Production

```bash
# 1. Vérifier buckets MinIO prod
./scripts/init-minio-prod.sh 84.247.165.187

# 2. Créer source en prod (via UI ou SQL)

# 3. Lancer premier crawl prod
ssh root@84.247.165.187 "docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c \"
  INSERT INTO web_crawl_jobs (web_source_id, job_type, priority)
  SELECT id, 'full_crawl', 10
  FROM web_sources
  WHERE name = 'Nom Site'
\""

# 4. Déclencher cron worker
CRON_SECRET=$(ssh root@84.247.165.187 "grep CRON_SECRET /opt/moncabinet/.env | cut -d= -f2")
curl -X GET "https://qadhya.tn/api/cron/web-crawler" \
  -H "Authorization: Bearer $CRON_SECRET"

# 5. Surveiller
ssh root@84.247.165.187 "docker logs -f moncabinet-nextjs | grep 'Nom Site'"
```

---

## 🐛 Dépannage Commun

### Erreur: "NoSuchBucket: web-files"

**Cause** : Bucket MinIO manquant.

**Solution** :
```bash
# Production
ssh root@84.247.165.187 "docker exec moncabinet-minio mc mb prod/web-files"

# Local
npm run init:minio
```

### Timeout Playwright

**Cause** : Site trop lent ou JavaScript lourd.

**Solutions** :
1. Augmenter `timeout_ms` (30000 → 60000)
2. Activer sitemap si disponible
3. Désactiver `requires_javascript` si possible

### 0 Pages Découvertes

**Causes** :
- Sitemap invalide/vide
- Patterns trop restrictifs
- Robots.txt bloque crawler

**Solutions** :
1. Vérifier `curl https://example.com/sitemap.xml`
2. Tester sans `url_patterns` d'abord
3. Vérifier `robots.txt` pour `QadhyaBot`

### Pages Duplicata

**Cause** : Variantes d'URLs (mobile, ancres, paramètres).

**Solution** :
```typescript
excluded_patterns: [
  "*.html?m=1",           // Mobile
  "*.html#*",             // Ancres
  "*?utm_*",              // Tracking
  "*/print",              // Version imprimable
  "*/comment-page-*"      // Pagination commentaires
]
```

---

## 📚 Guides Détaillés

- **Sites Blogger** : [`docs/BLOGGER_SITES_GUIDE.md`](./BLOGGER_SITES_GUIDE.md)
- **Incident da5ira.com** : [`docs/LESSONS_LEARNED_DA5IRA.md`](./LESSONS_LEARNED_DA5IRA.md)
- **Scripts MinIO** :
  - [`scripts/init-minio-buckets.ts`](../scripts/init-minio-buckets.ts)
  - [`scripts/check-minio-health.ts`](../scripts/check-minio-health.ts)
  - [`scripts/init-minio-prod.sh`](../scripts/init-minio-prod.sh)

---

## 🎯 Templates Prêts à l'Emploi

### Blog Juridique Tunisien (AR)

```typescript
{
  name: "Blog Juridique AR",
  base_url: "https://example.tn",
  description: "Blog juridique tunisien",
  category: "blog_juridique",
  language: "ar",
  sitemap_url: "https://example.tn/sitemap.xml",
  use_sitemap: true,
  requires_javascript: false,
  timeout_ms: 60000,
  rate_limit_ms: 2000,
  max_depth: 3,
  max_pages: 1000
}
```

### Site Officiel Tunisien

```typescript
{
  name: "Ministère XX",
  base_url: "https://example.gov.tn",
  description: "Site officiel ministère XX",
  category: "officiel",
  language: "fr",
  requires_javascript: false,
  timeout_ms: 30000,
  rate_limit_ms: 1000,
  max_depth: 4,
  max_pages: 500
}
```

### Plateforme Jurisprudence

```typescript
{
  name: "Jurisprudence XX",
  base_url: "https://example.tn",
  description: "Plateforme jurisprudence",
  category: "jurisprudence",
  language: "fr",
  requires_javascript: true,  // SPA
  timeout_ms: 60000,
  rate_limit_ms: 3000,  // Respecter serveur
  max_depth: 2,
  max_pages: 5000,
  url_patterns: ["*/decision/*", "*/arret/*"]
}
```

---

**Dernière mise à jour** : 9 février 2026
**Auteur** : Qadhya Engineering Team
