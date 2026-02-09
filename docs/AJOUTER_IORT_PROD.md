# 🚀 Ajouter IORT en Production (VPS)

Guide complet pour ajouter le site **IORT** (Imprimerie Officielle de la République Tunisienne) comme source web en production.

---

## 📋 Informations sur la source

| Propriété | Valeur |
|-----------|--------|
| **Nom** | IORT - Imprimerie Officielle de la République Tunisienne |
| **URL** | https://www.iort.tn |
| **Catégorie** | `jort` (Journal Officiel) |
| **Type** | Site dynamique WebDev |
| **JavaScript** | ✅ Requis (Playwright) |
| **Priorité** | 9/10 (Source officielle) |
| **Fréquence** | Hebdomadaire (7 jours) |

---

## 🎯 Méthode 1: SQL Direct (Recommandée)

### Étape 1: Copier le script SQL sur le VPS

```bash
scp scripts/add-iort-source-prod.sql root@84.247.165.187:/tmp/
```

### Étape 2: Se connecter au VPS

```bash
ssh root@84.247.165.187
```

### Étape 3: Exécuter le script SQL

```bash
psql -U moncabinet -d moncabinet -f /tmp/add-iort-source-prod.sql
```

### Résultat attendu

```
NOTICE:  ✓ Admin trouvé: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTICE:
NOTICE:  ✅ Source IORT créée avec succès!
NOTICE:     ID: yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
NOTICE:     Nom: IORT - Imprimerie Officielle
NOTICE:     URL: https://www.iort.tn
NOTICE:     Catégorie: jort
NOTICE:     Priorité: 9
NOTICE:     JavaScript requis: Oui ✓
NOTICE:     Fréquence crawl: 7 days
```

---

## 🎯 Méthode 2: Via API REST

### Option A: Depuis votre machine locale

```bash
./scripts/add-iort-source-prod.sh
```

⚠️ **Attention**: Cette méthode nécessite un cookie de session admin valide.

### Option B: cURL manuel

1. **Récupérer votre cookie de session** :
   - Connectez-vous à https://moncabinet.tn en tant qu'admin
   - Ouvrez DevTools (F12) → Application → Cookies
   - Copiez le cookie `next-auth.session-token`

2. **Envoyer la requête** :

```bash
curl -X POST https://moncabinet.tn/api/admin/web-sources \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=VOTRE_TOKEN_ICI" \
  -d '{
    "name": "IORT - Imprimerie Officielle de la République Tunisienne",
    "baseUrl": "https://www.iort.tn",
    "description": "Site officiel de l'\''Imprimerie Officielle (IORT) - Journal Officiel de la République Tunisienne (JORT)",
    "category": "jort",
    "language": "mixed",
    "priority": 9,
    "crawlFrequency": "7 days",
    "maxDepth": 5,
    "maxPages": 5000,
    "requiresJavascript": true,
    "respectRobotsTxt": false,
    "downloadFiles": true,
    "autoIndexFiles": true,
    "rateLimitMs": 2000,
    "urlPatterns": ["https://www.iort.tn/**", "https://iort.tn/**"],
    "excludedPatterns": ["**/logout**", "**/admin/**", "**/login**"],
    "cssSelectors": {
      "content": ["main", "article", ".content", "body"],
      "title": ["h1", "h2", "title"],
      "exclude": ["script", "style", "nav", "header", "footer"]
    },
    "seedUrls": ["https://www.iort.tn"],
    "customHeaders": {
      "Accept-Language": "fr-TN,fr;q=0.9,ar-TN;q=0.8,ar;q=0.7"
    },
    "dynamicConfig": {
      "waitUntil": "networkidle",
      "postLoadDelayMs": 2000,
      "waitForLoadingToDisappear": true,
      "loadingIndicators": ["<!--loading-->", ".loading", "[data-loading]", ".spinner"],
      "dynamicTimeoutMs": 15000
    }
  }' | jq
```

---

## ✅ Vérification

### 1. Vérifier que la source est créée

```bash
# Sur le VPS
psql -U moncabinet -d moncabinet -c \
  "SELECT id, name, base_url, category, is_active FROM web_sources WHERE base_url = 'https://www.iort.tn';"
```

### 2. Tester le crawl

Récupérez l'ID de la source depuis la commande ci-dessus, puis :

```bash
# Remplacez SOURCE_ID par l'ID réel
curl -X POST "https://moncabinet.tn/api/admin/web-sources/SOURCE_ID/crawl" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=VOTRE_TOKEN" \
  -d '{
    "type": "single_page",
    "targetUrl": "https://www.iort.tn"
  }' | jq
```

### 3. Surveiller les pages crawlées

```bash
curl "https://moncabinet.tn/api/admin/web-sources/SOURCE_ID/pages" \
  -H "Cookie: next-auth.session-token=VOTRE_TOKEN" | jq
```

### 4. Indexer dans la Knowledge Base

```bash
curl -X POST "https://moncabinet.tn/api/admin/web-sources/SOURCE_ID/index" \
  -H "Cookie: next-auth.session-token=VOTRE_TOKEN" | jq
```

---

## 📊 Monitoring

### Vérifier l'état de santé

```sql
-- Sur le VPS
psql -U moncabinet -d moncabinet -c "
  SELECT
    name,
    health_status,
    last_crawl_at,
    last_successful_crawl_at,
    total_pages_discovered,
    total_pages_indexed,
    consecutive_failures
  FROM web_sources
  WHERE base_url = 'https://www.iort.tn';
"
```

### Logs du crawler

```bash
# Logs du cron crawler
tail -f /var/log/web-crawler.log | grep -i iort
```

---

## 🐛 Troubleshooting

### Erreur: "Une source existe déjà"

La source a déjà été créée. Pour la mettre à jour :

```bash
# Récupérer l'ID
SOURCE_ID=$(psql -U moncabinet -d moncabinet -t -c \
  "SELECT id FROM web_sources WHERE base_url = 'https://www.iort.tn';")

# Mettre à jour via API
curl -X PUT "https://moncabinet.tn/api/admin/web-sources/$SOURCE_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=VOTRE_TOKEN" \
  -d '{ ... }' | jq
```

### Erreur: "Aucun utilisateur admin trouvé"

Créez un utilisateur admin :

```sql
UPDATE users SET role = 'admin' WHERE email = 'votre@email.tn';
```

### Crawl échoue avec timeout

Le site WebDev peut être lent. Augmentez les timeouts :

```sql
UPDATE web_sources
SET timeout_ms = 45000,
    dynamic_config = jsonb_set(
      dynamic_config,
      '{dynamicTimeoutMs}',
      '20000'
    )
WHERE base_url = 'https://www.iort.tn';
```

---

## 📚 Ressources

- [Documentation WebDev](https://www.windev.com/pcsoft/webdev.htm)
- [Script SQL](../scripts/add-iort-source-prod.sql)
- [Script Shell](../scripts/add-iort-source-prod.sh)
- [Configuration exemple](../config-iort-example.json)

---

## 🔗 Liens utiles

- **Interface Admin**: https://moncabinet.tn/dashboard/admin/sources
- **API Documentation**: https://moncabinet.tn/api/docs
- **Logs Production**: `/var/log/web-crawler.log`
