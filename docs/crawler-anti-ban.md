# Protection Anti-Bannissement du Crawler Web

## 📋 Vue d'ensemble

Le système de protection anti-bannissement protège le crawler web contre les blocages par les sites sources en production. Il combine plusieurs stratégies:

- ✅ **Retry automatique** avec exponential backoff (429, 503, timeout)
- ✅ **Détection intelligente de bannissement** (captcha, messages de blocage)
- ✅ **Rate limiting randomisé** pour éviter les patterns de bot
- ✅ **Mode stealth optionnel** avec User-Agents réalistes
- ✅ **Monitoring complet** avec métriques et alertes

## 🚀 Configuration

### 1. Migration de la base de données

Exécutez la migration pour ajouter les nouveaux champs:

```bash
psql -U qadhya -d qadhya_db -f db/migrations/20260208_add_anti_ban_fields.sql
```

### 2. Configuration par source

Dans l'interface super-admin, configurez chaque source web:

#### Mode Stealth
- **Par défaut:** Bot déclaré `QadhyaBot/1.0` (recommandé)
- **Mode stealth:** User-Agents réalistes (Chrome, Firefox, Safari)
- **Quand l'activer:** Uniquement si le site bloque le bot de manière injuste

```sql
UPDATE web_sources
SET stealth_mode = TRUE
WHERE id = 'uuid-de-la-source';
```

#### Quotas de crawl
Limitez le nombre de pages crawlées par période:

```sql
UPDATE web_sources
SET
  max_pages_per_hour = 150,  -- Max 150 pages/heure
  max_pages_per_day = 1500    -- Max 1500 pages/jour
WHERE id = 'uuid-de-la-source';
```

### 3. Configuration globale

Les valeurs par défaut dans le code:

```typescript
const DEFAULT_ANTI_BAN_CONFIG = {
  // Rate limiting
  baseRateLimitMs: 1500,      // 1.5s entre requêtes
  rateLimitVariance: 0.2,      // ±20% randomisation
  longPauseProbability: 0.05,  // 5% de pauses longues
  longPauseMs: 5000,           // 5 secondes

  // Retry
  maxRetries: 3,
  initialRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,

  // Détection bannissement
  autoPauseOnBan: true,
  banRetryDelayMs: 3600000,    // 1 heure
}
```

## 📊 Monitoring

### Dashboard de santé

Consultez le dashboard super-admin pour voir:

- **Taux de succès** par source (%)
- **Erreurs HTTP** (429, 403, 503, 5xx)
- **Bannissements détectés**
- **Temps de réponse** (moyenne, médiane, p95)
- **Quotas** (pages crawlées vs limites)

### Métriques disponibles

```typescript
import { getCrawlerHealthStats } from '@/lib/web-scraper/monitoring-service'

const stats = await getCrawlerHealthStats('source-id', 24) // dernières 24h

console.log(`Taux de succès: ${stats.successRate}%`)
console.log(`Erreurs 429: ${stats.errors429}`)
console.log(`Bannissements: ${stats.banDetections}`)
```

### Vérifier le statut de bannissement

```typescript
import { getSourceBanStatus } from '@/lib/web-scraper/monitoring-service'

const banStatus = await getSourceBanStatus('source-id')

if (banStatus?.isBanned) {
  console.log(`Source bannie: ${banStatus.reason}`)
  console.log(`Retry après: ${banStatus.retryAfter}`)
}
```

## 🔧 Utilisation

### Crawl automatique

Le système s'active automatiquement lors du crawl:

```typescript
import { crawlSource } from '@/lib/web-scraper/crawler-service'

const result = await crawlSource(source, {
  maxPages: 100,
  downloadFiles: true,
})

if (result.success) {
  console.log(`Crawl terminé: ${result.pagesProcessed} pages`)
} else {
  console.error(`Échec: ${result.errors.length} erreurs`)
}
```

### Débannir manuellement une source

Si une source a été bannie par erreur:

```typescript
import { unbanSource } from '@/lib/web-scraper/monitoring-service'

await unbanSource('source-id')
```

Ou via SQL:

```sql
SELECT unban_source('uuid-de-la-source');
```

## 🎯 Détection de bannissement

Le système détecte automatiquement:

### 1. Status codes HTTP
- **403 Forbidden** → Confiance haute
- **429 Too Many Requests** → Retry automatique

### 2. Captchas
- Cloudflare (`cf-captcha-container`)
- Google reCAPTCHA (`g-recaptcha`)
- hCaptcha (`h-captcha`)

### 3. Messages de blocage
- "Access Denied"
- "You have been blocked"
- "Rate limit exceeded"
- "Suspicious activity"

### 4. Redirections suspectes
- `/blocked`
- `/captcha`
- `/access-denied`

## 🔄 Retry avec Exponential Backoff

Tentatives automatiques sur erreurs temporaires:

| Tentative | Délai      | Status codes retryables |
|-----------|------------|-------------------------|
| 1         | 1s         | 429, 503, 504, 408      |
| 2         | 2s ± 20%   | + timeout, ECONNRESET   |
| 3         | 4s ± 20%   |                         |
| 4         | 8s ± 20%   |                         |
| Max       | 30s        |                         |

Le jitter (±20%) évite le "thundering herd" (toutes les requêtes en même temps).

## 📈 Métriques trackées

Pour chaque source, par heure:

- `total_requests` - Nombre total de requêtes
- `successful_requests` - Requêtes réussies
- `failed_requests` - Requêtes échouées
- `success_rate` - Taux de succès (%)
- `errors_429` - Erreurs "Too Many Requests"
- `errors_403` - Erreurs "Forbidden"
- `errors_503` - Erreurs "Service Unavailable"
- `errors_5xx` - Autres erreurs serveur
- `ban_detections` - Bannissements détectés
- `avg_response_time_ms` - Temps de réponse moyen
- `pages_this_hour` - Pages crawlées cette heure
- `pages_this_day` - Pages crawlées aujourd'hui

## 🛡️ Bonnes pratiques

### 1. Commencer conservateur

Pour une nouvelle source:

```sql
UPDATE web_sources
SET
  rate_limit_ms = 2000,        -- 2 secondes
  max_pages_per_hour = 100,
  max_pages_per_day = 1000,
  stealth_mode = FALSE         -- Bot déclaré
WHERE id = 'nouvelle-source';
```

### 2. Monitorer pendant 24-48h

- Vérifier le taux de succès (>95% = bon)
- Surveiller les erreurs 429/403
- Ajuster si nécessaire

### 3. Augmenter progressivement

Si aucun problème après 48h:

```sql
UPDATE web_sources
SET
  rate_limit_ms = 1500,        -- Réduire à 1.5s
  max_pages_per_hour = 150
WHERE id = 'source-stable';
```

### 4. Activer stealth en dernier recours

Uniquement si le site bloque le bot de manière injuste:

```sql
UPDATE web_sources
SET stealth_mode = TRUE
WHERE id = 'source-problematique';
```

## 🚨 Alertes

### Email/Slack (à configurer)

Le système peut envoyer des alertes automatiques:

- Bannissement détecté (confiance haute)
- Taux d'erreur > 10% sur 1h
- Quota dépassé
- Source inactive depuis 24h

Configuration dans `lib/web-scraper/monitoring-service.ts` (TODO Phase 3).

## 📝 Logs

Les logs incluent maintenant:

```
[Crawler] Démarrage crawl 9anoun.tn
[Crawler] Rate limit: 1500ms, Max pages: 100, Max depth: 3
[Crawler] Pause longue: 5234ms
[Crawler] Retry 1/3 pour https://9anoun.tn/page dans 1023ms (erreur: timeout)
[Crawler] 🚨 BANNISSEMENT DÉTECTÉ pour 9anoun.tn: Captcha détecté
[Crawler] INTERROMPU (bannissement détecté)
```

## 🧪 Tests

Exécutez les tests unitaires:

```bash
npm test lib/web-scraper/__tests__/retry-utils.test.ts
npm test lib/web-scraper/__tests__/anti-ban-utils.test.ts
```

## 📊 Exemple de requêtes SQL utiles

### Sources avec taux d'erreur élevé

```sql
SELECT
  ws.name,
  chm.success_rate,
  chm.errors_429 + chm.errors_403 + chm.errors_503 as total_errors,
  chm.ban_detections
FROM web_sources ws
JOIN crawler_health_metrics chm ON ws.id = chm.web_source_id
WHERE chm.period_start >= NOW() - INTERVAL '24 hours'
  AND chm.success_rate < 90
ORDER BY chm.success_rate ASC;
```

### Sources bannies

```sql
SELECT
  ws.name,
  bs.reason,
  bs.banned_at,
  bs.retry_after,
  bs.detection_confidence
FROM web_sources ws
JOIN web_source_ban_status bs ON ws.id = bs.web_source_id
WHERE bs.is_banned = TRUE;
```

### Nettoyage anciennes métriques

```sql
-- Garder 30 jours d'historique
DELETE FROM crawler_health_metrics
WHERE period_start < NOW() - INTERVAL '30 days';
```

## 🔮 Améliorations futures

- [ ] Dashboard temps réel (WebSocket)
- [ ] Alertes Email/Slack automatiques
- [ ] Rotation d'IP via proxies (si budget)
- [ ] ML pour détecter patterns de bannissement
- [ ] Auto-ajustement du rate limit basé sur les erreurs
