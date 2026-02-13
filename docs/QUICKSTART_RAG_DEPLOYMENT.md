# 🚀 Quick Start - Déploiement RAG Production

**Durée totale** : ~1h (+ 1 semaine monitoring)
**Impact** : Scores 54-63% → 80-90%, +50% pertinence

---

## ⚡ Déploiement Automatique (Recommandé)

### **Option 1 : Déploiement Complet Automatisé**

```bash
# 1. Sur votre machine locale
git pull origin main  # S'assurer d'avoir la dernière version

# 2. Connexion VPS
ssh vps

# 3. Pull latest code
cd /opt/qadhya
git pull origin main

# 4. Lancer déploiement automatique
bash scripts/deploy-rag-complete.sh

# ✓ Le script va tout faire :
#   - Backup DB
#   - Appliquer migrations SQL
#   - Installer dépendances
#   - Proposer réindexation
```

**C'est tout !** Le script gère automatiquement les 6 étapes.

---

### **Option 2 : Déploiement Manuel Étape par Étape**

```bash
# Connexion VPS
ssh vps
cd /opt/qadhya

# Étape 1: Appliquer migrations SQL
bash scripts/apply-rag-migrations-prod.sh

# Étape 2: Installer dépendances
docker exec qadhya-nextjs npm install @xenova/transformers

# Étape 3: Réindexation
docker exec qadhya-nextjs npx tsx scripts/reindex-kb-openai.ts \
  --categories jurisprudence,codes,legislation \
  --batch-size 50

# Étape 4: Validation
bash scripts/validate-rag-deployment.sh
```

---

## ✅ Validation Post-Déploiement

```bash
# Test automatique complet (20+ vérifications)
bash scripts/validate-rag-deployment.sh

# Tests E2E
docker exec qadhya-nextjs npx tsx scripts/test-rag-complete-e2e.ts

# Test manuel
# Visiter: https://qadhya.tn/chat
# Question: "ما هي شروط الدفاع الشرعي؟"
# Vérifier: 10-15 sources, scores >70%, latence <5s
```

---

## 📊 Monitoring (1 semaine)

### **Dashboard Interactif** (Recommandé)

```bash
# Dashboard temps réel avec rafraîchissement auto
bash scripts/rag-dashboard.sh

# Interface:
# - Stats migration OpenAI (progress bar)
# - Qualité RAG (scores moyens)
# - Activité récente
# - Actions rapides (R=réindexer, T=tests, M=monitoring, V=validation)
```

### **Monitoring Manuel**

```bash
# Snapshot quotidien
docker exec qadhya-nextjs npx tsx scripts/monitor-rag-quality.ts

# Export JSON (pour graphiques)
docker exec qadhya-nextjs npx tsx scripts/monitor-rag-quality.ts --export=json

# Tendances 7 jours
docker exec qadhya-nextjs npx tsx scripts/monitor-rag-quality.ts --days=7
```

---

## 🎯 Optimisations Fines (Après 7 jours)

```bash
# Analyse automatique + recommandations
docker exec qadhya-nextjs npx tsx scripts/optimize-rag-thresholds.ts

# Simulation (dry run)
docker exec qadhya-nextjs npx tsx scripts/optimize-rag-thresholds.ts --dry-run

# Application automatique
docker exec qadhya-nextjs npx tsx scripts/optimize-rag-thresholds.ts --apply

# Restart pour appliquer
docker-compose -f /opt/qadhya/docker-compose.prod.yml restart nextjs
```

---

## 📋 Checklist Déploiement

### **Jour 0 - Déploiement Initial**

- [ ] ✅ Code pushé vers GitHub (`git push origin main`)
- [ ] ✅ GitHub Actions build réussi
- [ ] ✅ Migrations SQL appliquées
- [ ] ✅ Dépendances installées
- [ ] ✅ Validation déploiement passée (20+ tests)
- [ ] ✅ Tests E2E réussis
- [ ] ✅ Test manuel assistant IA OK

### **Jours 1-7 - Monitoring**

- [ ] Jour 1: Snapshot métriques baseline
- [ ] Jour 2: Vérifier progression réindexation
- [ ] Jour 3: Monitoring quotidien (scores >70%)
- [ ] Jour 4: Export métriques JSON
- [ ] Jour 5: Vérifier latence <5s
- [ ] Jour 6: Analyser top catégories
- [ ] Jour 7: Préparer optimisations fines

### **Jour 8+ - Optimisations**

- [ ] Analyser recommandations automatiques
- [ ] Appliquer optimisations si pertinent
- [ ] Vérifier impact après 24h
- [ ] Documenter changements

---

## 🆘 Dépannage Rapide

### **Problème : Tests E2E échouent**

```bash
# Vérifier services
docker ps | grep qadhya

# Vérifier logs
docker logs qadhya-nextjs --tail 100

# Restart services
docker-compose -f /opt/qadhya/docker-compose.prod.yml restart
```

### **Problème : Scores toujours bas (<70%)**

```bash
# Vérifier provider OpenAI utilisé
docker exec qadhya-nextjs npx tsx -e "
import { generateEmbedding } from './lib/ai/embeddings-service'
generateEmbedding('test', { operationName: 'assistant-ia' })
  .then(r => console.log('Provider:', r.provider, 'Dims:', r.embedding.length))
"

# Attendu: Provider: openai Dims: 1536

# Forcer réindexation
docker exec qadhya-nextjs npx tsx scripts/reindex-kb-openai.ts --all --force
```

### **Problème : Migration SQL échoue**

```bash
# Vérifier si déjà appliquée
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c "\d knowledge_base_chunks" | grep embedding_openai

# Rollback si besoin
zcat /opt/backups/moncabinet/pre-rag-*.sql.gz | \
  docker exec -i qadhya-postgres psql -U moncabinet qadhya
```

---

## 📊 Métriques Cibles

| Métrique | Jour 1 | Jour 7 | Objectif |
|----------|--------|--------|----------|
| **Score moyen** | 65-70% | 75-80% | **>75%** |
| **Pertinents (>70%)** | 60-70% | 80-85% | **>80%** |
| **Indexation OpenAI** | 10-20% | 50-70% | **>50%** |
| **Latence P95** | 3-4s | 3-4s | **<5s** |

---

## 🔗 Ressources

- **Guide complet** : [`docs/DEPLOYMENT_GUIDE_RAG.md`](/Users/salmenktata/Projets/GitHub/Avocat/docs/DEPLOYMENT_GUIDE_RAG.md)
- **Doc technique** : [`docs/RAG_QUALITY_IMPROVEMENTS.md`](/Users/salmenktata/Projets/GitHub/Avocat/docs/RAG_QUALITY_IMPROVEMENTS.md)

---

## ⚡ Commandes Ultra-Rapides

```bash
# Dashboard interactif
bash scripts/rag-dashboard.sh

# Déploiement complet automatique
bash scripts/deploy-rag-complete.sh

# Validation post-déploiement
bash scripts/validate-rag-deployment.sh

# Monitoring quotidien
docker exec qadhya-nextjs npx tsx scripts/monitor-rag-quality.ts

# Optimisations auto
docker exec qadhya-nextjs npx tsx scripts/optimize-rag-thresholds.ts
```

---

**Dernière mise à jour** : Février 2026
**Version** : Sprints 1-3 complets

🎉 **Bon déploiement !**
