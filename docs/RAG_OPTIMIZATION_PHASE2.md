# Optimisation RAG Phase 2 : RediSearch

**Date:** 2026-02-14
**Status:** 🟡 Optionnel (si Phase 1 insuffisante)
**Coût:** 0€ infrastructure (RAM suffisante)
**Gains attendus:** -80-85% latence P50 (1.5-2s → 200-500ms)

---

## 📋 Table des Matières

- [Quand Déployer Phase 2](#quand-déployer-phase-2)
- [Vue d'Ensemble](#vue-densemble)
- [Pré-requis](#pré-requis)
- [Installation](#installation)
- [Architecture](#architecture)
- [Tests & Validation](#tests--validation)
- [Monitoring](#monitoring)
- [Rollback](#rollback)
- [FAQ](#faq)

---

## 🎯 Quand Déployer Phase 2 ?

### ⏸️ **NE PAS** déployer Phase 2 si :

- ✅ Phase 1 atteint objectifs (P50 <1.5s)
- ✅ KB <30k documents
- ✅ Latence actuelle acceptable pour users

### ▶️ **DÉPLOYER** Phase 2 si :

- ❌ Latence P50 reste >1.5s après Phase 1
- ❌ Croissance KB vers 30-50k docs
- ❌ Users se plaignent de lenteur
- ✅ RAM serveur suffisante (+512MB pour Redis)

---

## 🔍 Vue d'Ensemble

### Problème

Après Phase 1, si latence reste >1.5s :
- PostgreSQL pgvector + BM25 trop lent pour >30k docs
- Indexes HNSW scalent mal au-delà de 50k vectors
- Cache hit rate plateau à 80-85%

### Solution Phase 2 : RediSearch

**RediSearch** = Module Redis avec recherche hybride (vectorielle + texte) ultra-rapide.

**Architecture :**
```
User Query
    ↓
[RediSearch] → RAM (cache recherche)
    ↓ (50-100ms)
[Format Response]
    ↓
Total: 200-500ms P50 ✅ (-80-85%)
```

**Fallback PostgreSQL** : Si Redis indisponible → Automatique

---

## 📊 Gains Attendus

| Métrique | Phase 1 | Phase 2 | Gain |
|----------|---------|---------|------|
| **Latence P50** | 1.5-2s | 200-500ms | **-80-85%** ⚡⚡⚡ |
| **Latence P95** | 2-3s | 800ms-1.5s | **-60-75%** ⚡⚡ |
| **Latence P99** | 4-5s | 1.5-2.5s | **-50-63%** ⚡ |
| **RAM** | 512MB | 1GB | +512MB |
| **Coût** | 0€ | 0€ | **0€** 🎉 |

---

## ✅ Pré-requis

### Système

- ✅ Phase 1 déployée et validée
- ✅ RAM disponible : +512MB minimum
- ✅ Redis actuel : v7.0+ (local) ou migration redis-stack

### RAM Check

```bash
# Local
docker stats redis --no-stream

# Prod
ssh root@84.247.165.187 'free -h && docker stats qadhya-redis --no-stream'
```

**Résultat attendu :** RAM disponible >1GB

---

## 📦 Installation

### Étape 1 : Migration Redis → Redis Stack (5 min)

#### **Local**

**Modifier `docker-compose.yml` :**

```yaml
redis:
  # AVANT:
  # image: redis:7-alpine

  # APRÈS:
  image: redis/redis-stack-server:7.2.0-v11  # +RediSearch, +RedisJSON, +RedisBloom
  container_name: avocat-redis
  ports:
    - "6379:6379"
  command: >
    redis-server
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
    --loadmodule /opt/redis-stack/lib/redisearch.so
    --save ""
  volumes:
    - redis_data:/data
  networks:
    - avocat_network
  restart: unless-stopped
```

**Recréer conteneur :**

```bash
docker-compose down redis
docker-compose up -d redis
```

**Vérifier RediSearch chargé :**

```bash
docker exec avocat-redis redis-cli MODULE LIST
# Résultat attendu: search (RediSearch module)
```

---

#### **Production**

**Backup Redis actuel (optionnel mais recommandé) :**

```bash
ssh root@84.247.165.187 'docker exec qadhya-redis redis-cli BGSAVE'
ssh root@84.247.165.187 'docker cp qadhya-redis:/data/dump.rdb /opt/backups/moncabinet/redis_dump_pre_phase2.rdb'
```

**Modifier `/opt/qadhya/docker-compose.yml` :**

```bash
ssh root@84.247.165.187 'nano /opt/qadhya/docker-compose.yml'

# Remplacer bloc redis:
  redis:
    image: redis/redis-stack-server:7.2.0-v11
    container_name: qadhya-redis
    command: >
      redis-server
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --loadmodule /opt/redis-stack/lib/redisearch.so
      --save ""
    volumes:
      - redis_data:/data
    networks:
      - qadhya_network
    restart: unless-stopped
```

**Recréer conteneur :**

```bash
ssh root@84.247.165.187 'cd /opt/qadhya && docker-compose down redis && docker-compose up -d redis'
```

**Vérifier :**

```bash
ssh root@84.247.165.187 'docker exec qadhya-redis redis-cli MODULE LIST'
# Résultat attendu: 1) 1) "name" 2) "search" ...
```

---

### Étape 2 : Appliquer Migration PostgreSQL (2 min)

**Migration SQL :** `migrations/20260214_redisearch_setup.sql`

**Local :**
```bash
psql -U postgres -d avocat_dev -f migrations/20260214_redisearch_setup.sql
```

**Production :**
```bash
ssh root@84.247.165.187 'docker exec -i qadhya-postgres psql -U moncabinet -d qadhya' < migrations/20260214_redisearch_setup.sql
```

**Validation :**
```sql
SELECT COUNT(*) FROM redisearch_sync_status;
-- Résultat attendu: 0 (table vide, indexation pas encore faite)
```

---

### Étape 3 : Indexation RediSearch (15-30 min)

**Exécuter script migration :**

```bash
# Local
npx tsx scripts/migrate-to-redisearch.ts

# Production (via tunnel)
npm run tunnel:start  # Port 6379 forwarded
npx tsx scripts/migrate-to-redisearch.ts
```

**Durée estimée :**
- 8,735 docs : ~15min
- 30k docs : ~30min
- 50k docs : ~45min

**Résultat attendu :**
```
✅ Index RediSearch créé avec succès
✅ Indexation terminée en 892.3s
✅ Indexed: 13996 chunks
✅ Errors: 0 chunks
```

---

### Étape 4 : Activer Feature Flag (1 min)

**Local (`.env.local`) :**
```env
USE_REDISEARCH=true
REDIS_URL=redis://localhost:6379
```

**Production (`.env.production.local`) :**
```bash
ssh root@84.247.165.187 "echo 'USE_REDISEARCH=true' >> /opt/qadhya/.env.production.local"
ssh root@84.247.165.187 "cd /opt/qadhya && docker-compose up -d --no-deps nextjs"
```

---

## 🏗️ Architecture

### Dual-Write System

```
┌─────────────────────────────────────────────────────────────┐
│                     USER QUERY                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Feature Flag Check: USE_REDISEARCH?                        │
└───────────┬───────────────────────┬─────────────────────────┘
            │                       │
     YES    │                       │  NO
            ▼                       ▼
┌───────────────────┐   ┌───────────────────────────┐
│   RediSearch      │   │   PostgreSQL              │
│   (RAM cache)     │   │   (source vérité)         │
│   50-100ms        │   │   1.5-2s                  │
└─────┬─────────────┘   └───────────────────────────┘
      │
      │ Error/Timeout?
      ├───────────────────────┐
      │                       │
      ▼                       ▼
┌──────────────┐   ┌──────────────────────┐
│   SUCCESS    │   │  Fallback PostgreSQL │
│   200-500ms  │   │  1.5-2s              │
└──────────────┘   └──────────────────────┘
```

### Data Flow (Dual-Write)

```
┌────────────────────────────────────────────────────┐
│  INSERT/UPDATE knowledge_base_chunks               │
└────────────┬───────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────┐
│  Trigger PostgreSQL: trg_redisearch_sync_insert    │
│  → Mark chunk as 'pending' in redisearch_sync_     │
│    status                                           │
└────────────┬───────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────┐
│  Cron (5min): sync-redisearch.sh                   │
│  → Fetch pending chunks from vw_redisearch_        │
│    pending_sync                                     │
│  → Push to Redis FT.ADD                            │
│  → Update sync_status = 'synced'                   │
└────────────────────────────────────────────────────┘
```

**PostgreSQL = Source de Vérité** : TOUJOURS

**RediSearch = Cache** : Rebuild-able, perte acceptable

---

## ✅ Tests & Validation

### Test 1 : Health Check RediSearch

```bash
curl -X POST http://localhost:7002/api/admin/redisearch-health \
  -H "Content-Type: application/json"
```

**Résultat attendu :**
```json
{
  "available": true,
  "latency": 3,
  "indexSize": "45.23 MB",
  "docsCount": 13996
}
```

---

### Test 2 : Recherche Simple

```typescript
// scripts/test-redisearch-search.ts
import { searchKnowledgeBaseRediSearch } from '@/lib/ai/redisearch-service'

const results = await searchKnowledgeBaseRediSearch({
  query: 'ما هي شروط الدفاع الشرعي',
  category: 'jurisprudence',
  limit: 10,
})

console.log(`Résultats: ${results.length}`)
console.log(`Premier résultat: ${results[0]?.similarity.toFixed(2)}`)
```

**Exécuter :**
```bash
npx tsx scripts/test-redisearch-search.ts
```

**Résultat attendu :** 10 résultats, similarity >0.70

---

### Test 3 : Benchmark Comparatif (PostgreSQL vs RediSearch)

```bash
npx tsx scripts/benchmark-redisearch.ts
```

**Résultat attendu :**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BENCHMARK COMPARATIF: PostgreSQL vs RediSearch
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PostgreSQL (Phase 1):
  P50: 1523ms
  P95: 2789ms
  Avg: 1687ms

RediSearch (Phase 2):
  P50: 387ms   🟢 -75% vs PostgreSQL
  P95: 891ms   🟢 -68% vs PostgreSQL
  Avg: 453ms   🟢 -73% vs PostgreSQL

🏆 Gain Phase 2: -73% latence moyenne
```

---

## 📊 Monitoring

### Monitoring Automatique

**Script :** `scripts/monitor-redisearch-health.sh`

```bash
# Local
bash scripts/monitor-redisearch-health.sh

# Prod
bash scripts/monitor-redisearch-health.sh --prod
```

**Résultat attendu :**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 MONITORING REDISEARCH HEALTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 Redis Connection
  Status:                Available                    🟢
  Latency:              3ms                           🟢
  Memory Used:          487MB / 512MB                 🟡

📊 RediSearch Index
  Docs Indexed:          13996                        ℹ️
  Index Size:            45.23 MB                     ℹ️
  Avg Doc Size:          3.4 KB                       ℹ️

🔄 Synchronisation PostgreSQL
  Total chunks:          13996                        ℹ️
  Synced:                13996 (100.0%)               🟢
  Pending:               0                            🟢
  Errors:                0                            🟢
  Stale (>1h):           0                            🟢

🎯 OBJECTIFS PHASE 2
  ✅ Sync coverage >99%:     100.0%
  ✅ Pending chunks = 0:     0
  ✅ Error chunks = 0:       0
  ✅ Latency <5ms:           3ms

🏆 Score: 4/4 objectifs atteints
```

---

### Métriques SQL

**Sync coverage :**
```sql
SELECT * FROM vw_redisearch_sync_stats;
```

**Chunks pending :**
```sql
SELECT COUNT(*) FROM vw_redisearch_pending_sync;
```

**Health global :**
```sql
SELECT * FROM vw_redisearch_health;
```

---

## 🔄 Rollback

### Rollback Immédiat (si problème critique)

**Désactiver RediSearch via feature flag :**

```bash
# Local
echo "USE_REDISEARCH=false" >> .env.local
npm run dev

# Prod
ssh root@84.247.165.187 "sed -i 's/USE_REDISEARCH=true/USE_REDISEARCH=false/' /opt/qadhya/.env.production.local"
ssh root@84.247.165.187 "cd /opt/qadhya && docker-compose up -d --no-deps nextjs"
```

**Impact :** Retour immédiat à PostgreSQL Phase 1. Latence augmentée mais système fonctionnel.

---

### Rollback Complet (si abandon Phase 2)

**Supprimer index RediSearch :**

```bash
docker exec avocat-redis redis-cli FT.DROPINDEX idx:kb_chunks DD
```

**Supprimer tracking PostgreSQL :**

```sql
DROP TRIGGER IF EXISTS trg_redisearch_sync_insert ON knowledge_base_chunks;
DROP FUNCTION IF EXISTS trigger_redisearch_sync() CASCADE;
DROP VIEW IF EXISTS vw_redisearch_health;
DROP VIEW IF EXISTS vw_redisearch_pending_sync;
DROP VIEW IF EXISTS vw_redisearch_sync_stats;
DROP TABLE IF EXISTS redisearch_sync_status CASCADE;
```

**Revert Docker Compose :**

```yaml
redis:
  image: redis:7-alpine  # Revert vers Redis vanilla
```

```bash
docker-compose down redis && docker-compose up -d redis
```

---

## ❓ FAQ

### Q1 : Combien de RAM RediSearch utilise ?

**R :** ~3-5 KB/document. Pour 14k docs ≈ **45-70 MB**. Pour 50k docs ≈ **150-250 MB**.

### Q2 : Que se passe-t-il si Redis crash ?

**R :** Fallback automatique vers PostgreSQL. Pas de downtime, latence augmentée temporairement.

### Q3 : Faut-il réindexer après chaque INSERT chunk ?

**R :** Non, le trigger marque chunk comme `pending`. Cron sync (5min) synchronise en batch.

### Q4 : RediSearch supporte l'arabe ?

**R :** ✅ Oui, via `PHONETIC dm:ar` (Double Metaphone arabe) pour typo-tolerance.

### Q5 : Performance RediSearch vs Meilisearch ?

**R :**
- **RediSearch** : Latence 200-500ms, setup 1h, 0€
- **Meilisearch** : Latence 100-200ms, setup 2-3 jours, +10€/mois, support arabe partiel ❌

→ **RediSearch** recommandé pour Qadhya (arabe natif)

### Q6 : Dois-je déployer Phase 2 maintenant ?

**R :** **NON** si Phase 1 atteint P50 <1.5s. Déployer Phase 2 uniquement si users se plaignent.

### Q7 : Comment migrer de Phase 2 vers Phase 3 (Meilisearch) ?

**R :** Voir `docs/RAG_OPTIMIZATION_PHASE3.md` (NO-GO actuellement, support arabe limité).

---

## 📚 Ressources

**Fichiers Phase 2 :**
```
migrations/
  20260214_redisearch_setup.sql           # Migration PostgreSQL

scripts/
  migrate-to-redisearch.ts                # Indexation RediSearch
  monitor-redisearch-health.sh            # Monitoring
  benchmark-redisearch.ts                 # Tests performance

lib/ai/
  redisearch-service.ts                   # Service recherche

docs/
  RAG_OPTIMIZATION_PHASE2.md              # Cette doc
```

**Documentation Complémentaire :**
- `docs/RAG_OPTIMIZATION_PHASE1.md` : Phase 1 PostgreSQL (pré-requis)
- `docs/RAG_OPTIMIZATION_QUICKSTART.md` : Quick start global

---

## ✅ Checklist Déploiement

**Pré-déploiement :**
- [ ] Phase 1 déployée et validée (P50 <1.5s souhaité)
- [ ] RAM disponible >1GB
- [ ] Backup Redis actuel (prod)

**Déploiement :**
- [ ] Migration Redis → redis-stack-server
- [ ] Migration PostgreSQL (redisearch_sync_status)
- [ ] Indexation RediSearch (15-30min)
- [ ] Feature flag USE_REDISEARCH=true

**Post-déploiement :**
- [ ] Health check RediSearch OK
- [ ] Benchmark comparatif (P50 <500ms)
- [ ] Surveiller logs 15min
- [ ] Configurer cron sync (5min)

**J+1 :**
- [ ] Vérifier sync coverage 100%
- [ ] Vérifier pending chunks = 0
- [ ] Benchmark prod (latence stable)

---

**Auteur :** Claude Sonnet 4.5
**Date dernière mise à jour :** 2026-02-14
**Version :** 1.0.0
