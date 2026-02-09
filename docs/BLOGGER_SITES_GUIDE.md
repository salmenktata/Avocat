# Guide de Configuration - Sites Blogger

Ce guide documente les bonnes pratiques pour configurer le crawl de sites Blogger (blogspot.com, domaines personnalisés).

## 📋 Table des Matières

- [Caractéristiques des Sites Blogger](#caractéristiques-des-sites-blogger)
- [Configuration Recommandée](#configuration-recommandée)
- [Cas d'Usage : da5ira.com](#cas-dusage--da5iracom)
- [Problèmes Courants](#problèmes-courants)
- [Checklist de Configuration](#checklist-de-configuration)

---

## Caractéristiques des Sites Blogger

Les sites hébergés sur Blogger ont des particularités techniques :

### ✅ Points Positifs
- **Sitemap XML automatique** : `https://example.com/sitemap.xml`
- **Flux RSS/Atom** : `https://example.com/feeds/posts/default`
- **Structure URLs prévisible** : `/YYYY/MM/slug.html`
- **Support multi-langues** : RTL pour l'arabe

### ⚠️ Points d'Attention
- **JavaScript lourd** : La page d'accueil charge beaucoup de JS (widgets, ads)
- **Timeout fréquents** : Crawl de la homepage souvent lent (>30s)
- **WebSocket actif** : Peut bloquer `waitUntil: 'networkidle'` avec Playwright
- **Liens dynamiques** : Certaines catégories chargées via AJAX

---

## Configuration Recommandée

### 🎯 Paramètres Optimaux

```typescript
{
  // URLs de découverte
  sitemap_url: "https://example.com/sitemap.xml",
  rss_feed_url: "https://example.com/feeds/posts/default",
  use_sitemap: true,

  // Crawl
  requires_javascript: false,  // ⚠️ Pas nécessaire si sitemap activé
  follow_links: true,
  max_depth: 3,                // Limiter car sitemap couvre tout
  max_pages: 1000,             // Ajuster selon taille du blog

  // Performance
  timeout_ms: 60000,           // 60s (Blogger est lent)
  rate_limit_ms: 2000,         // 2s entre requêtes (être gentil)

  // Patterns (optionnel)
  url_patterns: [
    "*/\\d{4}/\\d{2}/.+\\.html",  // Articles: /2024/01/article.html
    "*/search/label/*"             // Catégories
  ],
  excluded_patterns: [
    "*.html?m=1",                  // Version mobile
    "*/search?*",                  // Pages de recherche
    "*#comment-*"                  // Ancres de commentaires
  ]
}
```

### 🚀 Stratégie de Crawl

1. **Utiliser le sitemap** comme source principale
   - Plus fiable que crawler la homepage
   - Découvre 100% des articles publiés
   - Évite timeouts Playwright

2. **Désactiver JavaScript** si sitemap activé
   - Économise ressources (pas de Playwright)
   - Plus rapide (pas de rendu JS)
   - Plus stable (pas d'erreurs browser)

3. **Crawler les catégories** en complément
   - Activer `follow_links: true`
   - Patterns `*/search/label/*`
   - Découvre articles non indexés

---

## Cas d'Usage : da5ira.com

### 📊 Problème Initial

```
❌ Page d'accueil échoue avec Playwright
❌ Seulement 6 pages découvertes sur 100+
❌ Erreur: "browser.newContext: Target page has been closed"
```

### ✅ Solution Appliquée

```sql
-- Activer sitemap et RSS
UPDATE web_sources SET
  sitemap_url = 'https://www.da5ira.com/sitemap.xml',
  use_sitemap = true,
  rss_feed_url = 'https://www.da5ira.com/feeds/posts/default',

  -- Désactiver JavaScript
  requires_javascript = false,

  -- Augmenter timeout
  timeout_ms = 60000

WHERE id = 'a7fc89a8-8f4f-4aaa-ae5e-cc87c2547bbf';
```

### 🎉 Résultats

- **Avant** : 6 pages, status `degraded`
- **Après** : 94 pages, status `healthy`
- **Gain** : +1467% pages découvertes
- **Temps** : ~6 minutes pour full crawl

---

## Problèmes Courants

### 1. Bucket MinIO Manquant

**Symptôme** :
```
❌ Erreur upload MinIO: The specified bucket does not exist
bucketname: 'web-files'
```

**Cause** : Le crawler télécharge des fichiers (PDFs, images) mais les buckets MinIO ne sont pas initialisés.

**Solution** :
```bash
# Local
npm run init:minio

# Production
ssh root@VPS_IP "docker exec moncabinet-minio mc mb prod/documents"
ssh root@VPS_IP "docker exec moncabinet-minio mc mb prod/web-files"
```

**Prévention** : Utiliser le script `init-minio-buckets.ts` au démarrage.

---

### 2. Timeout Page d'Accueil

**Symptôme** :
```
TimeoutError: page.goto: Timeout 30000ms exceeded
```

**Cause** : Blogger charge beaucoup de JS, widgets, ads. La page peut prendre >30s à charger.

**Solution** :
```typescript
// Option 1 : Augmenter timeout
timeout_ms: 60000  // 60s

// Option 2 : Utiliser sitemap (recommandé)
use_sitemap: true
requires_javascript: false
```

---

### 3. WebSocket Bloquant

**Symptôme** :
```
waitUntil: 'networkidle' ne se termine jamais
```

**Cause** : Blogger utilise WebSocket pour analytics/comments qui reste connecté.

**Solution** :
```typescript
// Dans scraper-service.ts
await page.goto(url, {
  waitUntil: 'load',  // Pas 'networkidle'
  timeout: timeoutMs
})
```

---

### 4. Liens Duplicata

**Symptôme** : Même article crawlé plusieurs fois avec URLs différentes.

**Exemple** :
```
/2024/01/article.html
/2024/01/article.html?m=1        (mobile)
/2024/01/article.html?showComment=123
```

**Solution** :
```typescript
excluded_patterns: [
  "*.html?m=1",           // Mobile
  "*.html?showComment=*", // Commentaires
  "*.html#*"              // Ancres
]
```

---

## Checklist de Configuration

### ✅ Avant le Premier Crawl

- [ ] **Vérifier buckets MinIO** : `documents` + `web-files`
- [ ] **Tester sitemap** : `curl https://example.com/sitemap.xml`
- [ ] **Tester RSS** : `curl https://example.com/feeds/posts/default`
- [ ] **Configurer timeout** : Minimum 60s
- [ ] **Patterns d'exclusion** : Mobile, commentaires, ancres

### ✅ Configuration Source Web

```typescript
{
  name: "Blog Example",
  base_url: "https://example.com",
  category: "blog_juridique",
  language: "ar",  // ou "fr"

  // Découverte
  sitemap_url: "https://example.com/sitemap.xml",
  rss_feed_url: "https://example.com/feeds/posts/default",
  use_sitemap: true,

  // Crawl
  requires_javascript: false,
  follow_links: true,
  max_depth: 3,
  max_pages: 1000,

  // Performance
  timeout_ms: 60000,
  rate_limit_ms: 2000,

  // Patterns
  url_patterns: ["*/\\d{4}/\\d{2}/.+\\.html"],
  excluded_patterns: ["*.html?m=1", "*.html#*"]
}
```

### ✅ Après le Premier Crawl

- [ ] **Vérifier pages découvertes** : `SELECT COUNT(*) FROM web_pages WHERE web_source_id = ?`
- [ ] **Vérifier erreurs** : `SELECT * FROM web_pages WHERE status = 'failed'`
- [ ] **Vérifier health_status** : Doit être `healthy`
- [ ] **Lancer indexation** : Pipeline intelligent ou manuel

---

## 🔧 Scripts Utiles

### Vérifier Buckets MinIO

```bash
# Local
docker exec qadhya-minio mc alias set local http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
docker exec qadhya-minio mc ls local

# Production
ssh root@VPS_IP "docker exec moncabinet-minio mc ls prod"
```

### Statistiques Crawl

```sql
-- Pages découvertes par source
SELECT
  ws.name,
  COUNT(*) as total_pages,
  COUNT(CASE WHEN wp.is_indexed THEN 1 END) as indexed,
  COUNT(CASE WHEN wp.status = 'failed' THEN 1 END) as failed,
  ws.health_status
FROM web_sources ws
LEFT JOIN web_pages wp ON wp.web_source_id = ws.id
WHERE ws.base_url LIKE '%blogger%' OR ws.base_url LIKE '%blogspot%'
GROUP BY ws.id;
```

### Relancer Crawl

```bash
# Créer job de crawl prioritaire
curl -X POST https://qadhya.tn/api/admin/web-sources/{source_id}/crawl \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"priority": 10}'
```

---

## 📚 Références

- [Blogger Sitemap Format](https://support.google.com/blogger/answer/97996)
- [Blogger RSS/Atom Feeds](https://support.google.com/blogger/answer/97933)
- [MinIO S3 API](https://min.io/docs/minio/linux/developers/javascript/API.html)
- [Playwright Timeouts](https://playwright.dev/docs/api/class-page#page-goto)

---

## 📝 Notes

### Sites Blogger Tunisiens Connus

- **da5ira.com** : الذخيرة القانونية (94 pages, AR)
- *(Ajouter d'autres sites ici au fur et à mesure)*

### Leçons Apprises (Feb 2026)

1. **Sitemap > Homepage** : Toujours privilégier le sitemap pour Blogger
2. **Buckets auto-init** : Script `init-minio-buckets.ts` évite 90% des erreurs
3. **Timeout 60s** : Minimum pour sites Blogger avec widgets
4. **JavaScript optionnel** : Désactiver si sitemap activé = gain performance

---

**Dernière mise à jour** : 9 février 2026
**Auteur** : Système Qadhya (via da5ira.com incident)
