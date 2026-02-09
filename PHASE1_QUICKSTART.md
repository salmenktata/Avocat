# 🚀 Phase 1 Quick Wins - Quick Start

**Statut** : ✅ **PRODUCTION ACTIVE** (9 février 2026, 22h01)
**URL** : https://qadhya.tn

---

## ✅ Ce Qui Est Déployé

| Optimisation | Statut | Configuration |
|--------------|--------|---------------|
| Parallel Embeddings | ✅ ACTIF | `OLLAMA_EMBEDDING_CONCURRENCY=2` |
| Cache Threshold | ✅ ACTIF | `SEARCH_CACHE_THRESHOLD=0.75` |
| Batch Metadata | ✅ Déployé | Code actif |
| Index DB | ✅ Existe | `idx_knowledge_base_category_language` |

---

## 📊 Monitoring Quotidien (1×/jour, ~2 min)

### Script Automatisé (RECOMMANDÉ)

```bash
./MONITORING_PHASE1.sh
```

**Output** : `metrics-phase1-YYYY-MM-DD.log`

### Commandes Manuelles

**1. Latency RAG (P50/P95)** - Objectif: P50 <2s, P95 <5s
```bash
ssh root@84.247.165.187 'docker logs moncabinet-nextjs --since 24h | grep "RAG Search.*Latency"' | \
  grep -oP 'Latency: \K[0-9]+' | \
  awk '{latencies[NR]=$1; sum+=$1} END {
    asort(latencies)
    print "P50: " latencies[int(NR*0.5)] "ms"
    print "P95: " latencies[int(NR*0.95)] "ms"
  }'
```

**2. Throughput** - Objectif: >30 docs/h
```bash
ssh root@84.247.165.187 'docker logs moncabinet-nextjs --since 24h | grep "Indexing completed"' | wc -l
# Diviser par 24 pour obtenir docs/heure
```

**3. Cache Hit Rate** - Objectif: >20%
```bash
ssh root@84.247.165.187 'docker exec moncabinet-redis redis-cli INFO stats' | \
  grep -E "keyspace_hits|keyspace_misses"
# Calculer: hits / (hits + misses) * 100
```

**4. API Santé**
```bash
curl -s https://qadhya.tn/api/health | jq '.status, .responseTime'
```

---

## 📅 Calendrier Semaine 1 (10-17 Feb 2026)

**Quotidien** : Exécuter `./MONITORING_PHASE1.sh` chaque jour

**17 février 2026** :
1. Calculer moyennes semaine
2. Remplir `docs/PHASE1_WEEKLY_REPORT_TEMPLATE.md`
3. **Décision** :
   - ✅ 4-5/5 objectifs atteints → **PAUSE** (KISS)
   - ⚠️ 2-3/5 objectifs → **AJUSTEMENTS**
   - ❌ 0-1/5 objectifs → **DEBUG**

---

## 🎯 Objectifs Semaine 1

| Métrique | Baseline | Objectif | Statut |
|----------|----------|----------|--------|
| P50 RAG | ~4-6s | <2s | 🔄 À mesurer |
| P95 RAG | ~10-15s | <5s | 🔄 À mesurer |
| Throughput | ~12 docs/h | >30 docs/h | 🔄 À mesurer |
| Cache hit rate | ~5% | >20% | 🔄 À mesurer |

---

## 📚 Documentation Complète

| Document | Description |
|----------|-------------|
| **PHASE1_DEPLOYMENT_SUCCESS.md** | Rapport déploiement détaillé |
| **PHASE1_MONITORING_GUIDE.md** | Guide monitoring complet (430 lignes) |
| **PHASE1_WEEKLY_REPORT_TEMPLATE.md** | Template rapport final |
| **PHASE1_PRESENTATION.md** | Présentation technique (580 lignes) |

---

## ⚠️ Notes Importantes

### Docker Compose

⚠️ **TOUJOURS** utiliser `-f docker-compose.prod.yml` :
```bash
# ✅ Correct
docker compose -f docker-compose.prod.yml up -d

# ❌ Incorrect (utilise mauvais port)
docker compose up -d
```

### Validation Variables Env

```bash
ssh root@84.247.165.187 'docker exec moncabinet-nextjs printenv | grep -E "OLLAMA_EMBEDDING_CONCURRENCY|SEARCH_CACHE_THRESHOLD"'

# Output attendu:
# OLLAMA_EMBEDDING_CONCURRENCY=2 ✅
# SEARCH_CACHE_THRESHOLD=0.75 ✅
```

### Rollback (si nécessaire)

```bash
ssh root@84.247.165.187 "cd /opt/moncabinet && \
  cp .env.backup-20260209-215932 .env && \
  docker compose -f docker-compose.prod.yml restart nextjs"
```

---

## 🆘 Support

**Problème** | **Solution**
------------|-------------
API 502 | Vérifier port mapping (doit être 3000:3000)
Variables env manquantes | Vérifier fichier `.env` sur VPS
Container unhealthy | `docker logs moncabinet-nextjs`
Latency élevée | Attendre warm-up Ollama (première query lente)

---

## ✨ Quick Commands

```bash
# Santé système
curl -s https://qadhya.tn/api/health | jq

# Containers status
ssh root@84.247.165.187 'docker ps --filter name=moncabinet'

# Logs temps réel
ssh root@84.247.165.187 'docker logs -f moncabinet-nextjs | grep -E "RAG|Indexing|Error"'

# Monitoring quotidien
./MONITORING_PHASE1.sh
```

---

**🎉 Phase 1 Active - Monitoring en cours jusqu'au 17 février 2026**
