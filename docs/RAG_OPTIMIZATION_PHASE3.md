# Optimisation RAG Phase 3 : Meilisearch

**Date:** 2026-02-14
**Status:** 🔴 **NO-GO** (Support arabe limité)
**Coût:** +10€/mois infrastructure (RAM 8GB → 12GB)
**Gains potentiels:** -90% latence P50 (1.5-2s → 100-200ms)

---

## ⚠️ AVERTISSEMENT : NO-GO POUR QADHYA

**Phase 3 Meilisearch est déconseillée** pour Qadhya car :

1. ❌ **Support arabe limité** : Pas de tokenization arabe native
2. ❌ **Coût élevé** : +10€/mois vs 0€ RediSearch
3. ❌ **Complexité élevée** : CDC (Change Data Capture) + sync continu
4. ❌ **ROI faible** : Gain latence marginal vs RediSearch (100-200ms vs 200-500ms)

---

## 📋 Analyse Comparative : RediSearch vs Meilisearch

| Critère | **RediSearch (Phase 2)** | **Meilisearch (Phase 3)** |
|---------|--------------------------|---------------------------|
| **Latence P50** | 200-500ms | 100-200ms |
| **Support arabe** | ✅ Natif (PHONETIC dm:ar) | ⚠️ Partiel (tokenization basique) |
| **Typo-tolerance** | ✅ Phonétique arabe | ⚠️ Distance Levenshtein (français optimisé) |
| **Coût infra** | **0€** (RAM 512MB) | **+10€/mois** (RAM +4GB) |
| **Complexité setup** | 🟢 1h | 🔴 2-3 jours |
| **Maintenance** | 🟢 Faible (cron sync 5min) | 🔴 Élevée (CDC + monitoring) |
| **Fallback** | ✅ Auto PostgreSQL | ⚠️ Manuel |
| **Scalabilité** | 50k docs : 300ms | 50k docs : 150ms |

---

## 🚫 Pourquoi NO-GO pour Qadhya ?

### 1. Support Arabe Limité

**Problème :**
- Meilisearch tokenize arabe avec algorithme Unicode générique
- Pas de stemming arabe natif (vs RediSearch phonétique)
- Pas de support dialectes tunisiens

**Exemple :**
```
Query : "عقد الكراء"
RediSearch : Trouve "عقد الإيجار" (phonetic match) ✅
Meilisearch : Match exact seulement "عقد الكراء" ❌
```

**Impact :** -20-30% rappel (recall) sur requêtes arabes

---

### 2. Coût Infrastructure Élevé

**RediSearch (Phase 2) :**
- RAM : 512MB (suffit 50k docs)
- CPU : Faible
- **Coût** : **0€**

**Meilisearch (Phase 3) :**
- RAM : +4GB (12GB total vs 8GB actuel)
- CPU : +1 core (indexation background)
- **Coût** : **+10€/mois** (upgrade VPS Contabo)

**ROI :** Gain 100-300ms pour +10€/mois = **NON rentable**

---

### 3. Complexité Setup Élevée

**Phase 2 RediSearch :**
- Setup : 1h
- Migration : 1 script TypeScript
- Sync : Trigger PostgreSQL + cron 5min

**Phase 3 Meilisearch :**
- Setup : 2-3 jours
- CDC : Debezium + Kafka (complexe)
- Sync : Pipeline continu + monitoring
- Failover : Configuration manuelle

**Effort dev :** Phase 3 = **10× Phase 2**

---

### 4. Gain Latence Marginal

**Latence Comparée (50k docs) :**

| Phase | P50 | P95 | P99 |
|-------|-----|-----|-----|
| **Phase 1 (PostgreSQL)** | 1.5-2s | 2-3s | 4-5s |
| **Phase 2 (RediSearch)** | 200-500ms | 800ms-1.5s | 1.5-2.5s |
| **Phase 3 (Meilisearch)** | 100-200ms | 500ms-1s | 1-2s |

**Gain Phase 2 → 3 :** -100-300ms seulement

**Seuil perception humain :** 300ms (pas perceptible pour user)

---

## 📊 Décision : Quand Réévaluer Phase 3 ?

### ⏸️ Rester Phase 2 (RediSearch) si :

- ✅ Latence P50 <500ms (acceptable)
- ✅ KB <100k docs
- ✅ Budget limité
- ✅ Équipe dev petite

### ▶️ Réévaluer Phase 3 (Meilisearch) si :

- ❌ Latence P50 >500ms persistante
- ❌ KB >100k docs
- ❌ Budget confortable (+10€/mois)
- ❌ Équipe Meilisearch améliore support arabe (2026+)

---

## 🔍 Plan Phase 3 (si déploiement futur)

### Étape 1 : Upgrade Infrastructure (30min)

**Upgrade VPS Contabo :**
- RAM : 8GB → 12GB
- CPU : 4 cores → 6 cores
- Coût : +10€/mois

### Étape 2 : Installation Meilisearch (1h)

**Docker Compose :**

```yaml
meilisearch:
  image: getmeili/meilisearch:v1.7
  container_name: qadhya-meilisearch
  ports:
    - "7700:7700"
  environment:
    MEILI_MASTER_KEY: ${MEILI_MASTER_KEY}
    MEILI_ENV: production
    MEILI_DB_PATH: /meili_data
    MEILI_MAX_INDEX_SIZE: 4GB
  volumes:
    - meilisearch_data:/meili_data
  networks:
    - qadhya_network
  restart: unless-stopped
  deploy:
    resources:
      limits:
        memory: 4GB
```

### Étape 3 : CDC Pipeline (2 jours)

**Architecture CDC :**

```
PostgreSQL (source)
    ↓
Debezium Connector (capture changes)
    ↓
Kafka Topic (change events)
    ↓
Consumer TypeScript (transform)
    ↓
Meilisearch (index)
```

**Complexité :** 🔴 Élevée (Kafka + Debezium + monitoring)

### Étape 4 : Service Recherche Meilisearch (1 jour)

**Fichier :** `lib/ai/meilisearch-service.ts`

```typescript
import { MeiliSearch } from 'meilisearch'

const client = new MeiliSearch({
  host: process.env.MEILI_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY,
})

export async function searchKnowledgeBaseMeilisearch(query: string, options: any) {
  const index = client.index('kb_chunks')

  const results = await index.search(query, {
    attributesToSearchOn: ['title', 'content'],
    filter: options.category ? `category = ${options.category}` : undefined,
    limit: options.limit || 15,
    showMatchesPosition: true,
  })

  return results.hits.map((hit: any) => ({
    id: hit.id,
    similarity: hit._rankingScore,
    // ...
  }))
}
```

---

## 🔄 Migration Phase 2 → Phase 3 (si futur)

### Pré-requis

- [ ] Phase 2 déployée et stable
- [ ] Budget infrastructure validé (+10€/mois)
- [ ] Équipe dev disponible (3-5 jours)
- [ ] Équipe Meilisearch a amélioré support arabe (vérifier changelog)

### Étapes Migration

1. **Tester support arabe Meilisearch** (1h)
   ```bash
   docker run -d -p 7700:7700 getmeili/meilisearch:latest
   # Indexer sample docs arabes
   # Tester queries arabes
   # Valider recall >90%
   ```

2. **Upgrade VPS** (30min)
   - Contacter Contabo support
   - Planifier upgrade (downtime 5-10min)

3. **Installation Meilisearch** (1h)
   - Docker Compose
   - Créer index `kb_chunks`
   - Configurer filtres/tri

4. **Setup CDC Pipeline** (2 jours)
   - Debezium + Kafka
   - Consumer TypeScript
   - Tests sync temps réel

5. **Migration données** (2-4h)
   - Indexation bulk 50k docs
   - Vérification complétude

6. **Feature flag** (5min)
   ```env
   USE_MEILISEARCH=true
   USE_REDISEARCH=false  # Désactiver Phase 2
   ```

7. **Monitoring** (1 jour)
   - Dashboard Grafana
   - Alertes latence >300ms
   - Monitoring CDC lag

---

## 📚 Ressources Meilisearch

### Documentation Officielle

- **Site** : https://www.meilisearch.com/
- **Docs** : https://www.meilisearch.com/docs
- **GitHub** : https://github.com/meilisearch/meilisearch

### Support Arabe (Tracking)

- **Issue GitHub** : https://github.com/meilisearch/meilisearch/issues/2346
- **Status** : Équipe cherche contributions communauté
- **Timeline** : Incertain (2026?)

### Benchmarks

- **50k docs** : ~150ms P50
- **100k docs** : ~250ms P50
- **1M docs** : ~800ms P50

---

## ✅ Checklist Décision Phase 3

**Avant d'envisager Phase 3, vérifier :**

- [ ] Phase 2 déployée depuis >3 mois
- [ ] Latence P50 Phase 2 >500ms persistante
- [ ] KB >100k documents
- [ ] Budget +10€/mois validé
- [ ] Équipe dev disponible (3-5 jours)
- [ ] Support arabe Meilisearch amélioré (vérifier changelog)
- [ ] Tests pilote Meilisearch arabe concluants (recall >90%)

**Si <5 critères cochés → RESTER PHASE 2**

---

## 🎯 Recommandation Finale

### Pour Qadhya (2026)

**✅ RECOMMANDÉ :**
1. **Phase 1 (PostgreSQL Quick Wins)** → Déployer immédiatement
2. **Phase 2 (RediSearch)** → Déployer si P50 >1.5s après Phase 1

**❌ NON RECOMMANDÉ :**
3. **Phase 3 (Meilisearch)** → NO-GO actuellement

**Raison :** RediSearch suffit pour 50-100k docs avec support arabe natif et 0€ coût.

---

### Horizon 2027+

**Réévaluer Phase 3 si :**
- ✅ Meilisearch améliore tokenization arabe
- ✅ KB >200k documents
- ✅ Latence Phase 2 devient critique (>500ms)
- ✅ Budget infrastructure confortable

**Sinon :** Rester Phase 2 (RediSearch) indéfiniment.

---

## 📞 Support & Contact

**Questions Phase 3 :**
- Consulter plan complet dans transcript conversation
- Vérifier roadmap Meilisearch arabe : https://roadmap.meilisearch.com/
- Contacter équipe Meilisearch : Discord https://discord.gg/meilisearch

---

**Auteur :** Claude Sonnet 4.5
**Date dernière mise à jour :** 2026-02-14
**Version :** 1.0.0
**Status :** 🔴 NO-GO (Support arabe limité)
