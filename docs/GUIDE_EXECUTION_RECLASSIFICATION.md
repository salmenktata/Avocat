# Guide d'Exécution - Reclassification KB par Contenu

**Date** : 12 février 2026
**Objectif** : Reclassifier 8 735 documents KB selon classification IA (0% → 100%)
**Durée estimée** : 4-6 heures (classification) + 5 minutes (reclassification)

---

## 🎯 Plan d'Action

### **Situation Actuelle Confirmée**

```
Total documents KB      : 8 735
Distribution            : 85.2% legislation (DÉSÉQUILIBRE)
Classification IA dispo : 50 pages (0.6%)
Pages à classifier      : 8 683 (99.4%)
```

### **Problème Critique**

❌ **Impossible de reclassifier sans classifications IA**

Si nous lançons la reclassification maintenant → **99% des docs iront en catégorie "autre"**

### **Solution**

1. ✅ **Classifier les 8 683 pages web** (classification IA)
2. ✅ **Reclassifier les 8 735 docs KB** (basé sur classifications IA)

---

## 📋 Étapes d'Exécution

### **ÉTAPE 0 : Backup Critique** ⚠️

```bash
# 1. Backup table knowledge_base
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres pg_dump -U moncabinet qadhya -t knowledge_base > /tmp/kb_backup_\$(date +%Y%m%d_%H%M%S).sql"

# 2. Backup table legal_classifications
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres pg_dump -U moncabinet qadhya -t legal_classifications > /tmp/classifications_backup_\$(date +%Y%m%d_%H%M%S).sql"

# 3. Vérifier backups
ssh root@84.247.165.187 "ls -lh /tmp/*backup*.sql"
```

---

### **ÉTAPE 1 : Classification Batch des Pages Web** (4-6h)

#### 1.1 Test Local (Dry-Run)

```bash
# Test sur 10 pages
npx tsx scripts/classify-pages-batch.ts --limit=10

# Vérifier :
# - ✅ Aucune erreur SQL
# - ✅ Classifications créées
# - ✅ Temps moyen par page (~5-10s)
```

#### 1.2 Production - Échantillon (30 min)

```bash
# Classifier 100 pages test
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/classify-pages-batch.ts --limit=100"

# Vérifier distribution
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya -c 'SELECT primary_category, COUNT(*) FROM legal_classifications GROUP BY primary_category ORDER BY COUNT(*) DESC'"
```

**Analyse** :
- Distribution plausible ? (pas 90% dans 1 catégorie)
- Confiance moyenne >0.5 ?
- Pas d'erreurs SQL ?

#### 1.3 Production - Full (4-6h)

```bash
# Lancer monitoring dans un terminal séparé
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/monitor-classification.ts"

# Terminal 2 : Lancer classification complète
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/classify-pages-batch.ts"
```

**Monitoring** :
- Progression : 8 683 pages à ~10s/page = ~24h
- **Optimisation** : Batch de 10 pages, concurrence LLM
- Temps réel : ~4-6h avec Groq/Gemini

**En cas d'interruption** :
```bash
# Le script reprend automatiquement là où il s'est arrêté
# (Skip pages déjà classifiées)
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/classify-pages-batch.ts"
```

#### 1.4 Validation Classifications

```bash
# Stats post-classification
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya -c \"
SELECT
  primary_category,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct,
  ROUND(AVG(confidence_score), 2) as avg_confidence
FROM legal_classifications
GROUP BY primary_category
ORDER BY COUNT(*) DESC
\""
```

**Critères de succès** :
- ✅ 8 600+ pages classifiées (>98%)
- ✅ Distribution équilibrée (aucune >50%)
- ✅ Confiance moyenne >0.6

---

### **ÉTAPE 2 : Reclassification KB** (5 min)

#### 2.1 Dry-Run (Test)

```bash
# Test sur 100 docs
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/reclassify-kb-batch.ts --dry-run --limit=100"

# Analyser :
# - Distribution projetée
# - % needs_review
# - Aucune erreur SQL
```

#### 2.2 Dry-Run (Full)

```bash
# Simulation complète
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/reclassify-kb-batch.ts --dry-run"

# Temps estimé : ~3 minutes
# Vérifier rapport final
```

#### 2.3 Exécution Réelle

```bash
# ⚠️ WRITE MODE - Modifications effectives
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/reclassify-kb-batch.ts"
```

**Logs attendus** :
```
📦 Batch 1/175 (50 docs)...
   ✅ Traités : 50/8735 (0.6%)

📦 Batch 2/175 (50 docs)...
   ✅ Traités : 100/8735 (1.1%)

...

═══════════════════════════════════════════════════════════
📊 RECLASSIFICATION KB COMPLÉTÉE
═══════════════════════════════════════════════════════════

Total documents     : 8735
Reclassifiés        : 7842 (89.8%)
Inchangés           : 893 (10.2%)
Besoin review       : 893 (10.2%)
Erreurs             : 0

📈 Distribution par catégorie :
   legislation        :  2200 (25.2%)
   jurisprudence      :  1800 (20.6%)
   codes              :  1500 (17.2%)
   doctrine           :  1200 (13.7%)
   autre              :   893 (10.2%)
   google_drive       :   521 (6.0%)
   jort               :   400 (4.6%)
   procedures         :   221 (2.5%)
```

---

### **ÉTAPE 3 : Validation Post-Reclassification** (10 min)

#### 3.1 Validation Automatique

```bash
# Script complet de validation
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/validate-reclassification.ts"
```

**Vérifications** :
1. ✅ Distribution équilibrée (max 30%)
2. ✅ 6-8 catégories actives
3. ✅ Échantillons cohérents
4. ✅ RAG trouve résultats

#### 3.2 Monitoring Temps Réel

```bash
# Dashboard live (refresh 5s)
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/monitor-reclassification.ts --interval=5"
```

#### 3.3 Requêtes SQL Manuelles

```bash
# Dashboard complet
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya -f /app/docs/SQL_MONITORING_RECLASSIFICATION.md"
```

Ou requêtes individuelles depuis `docs/SQL_MONITORING_RECLASSIFICATION.md`

---

### **ÉTAPE 4 : Tests Assistant IA** (15 min)

#### 4.1 Test Recherche RAG

```bash
# Test 5 queries représentatives
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/test-rag-queries.ts"
```

#### 4.2 Test Interface Web

1. Ouvrir https://qadhya.tn
2. Tester Assistant IA :
   - "القانون الجنائي التونسي" → Doit trouver docs codes/legislation
   - "jurisprudence cassation divorce" → Doit trouver jurisprudence
   - "نماذج عقد العمل" → Doit trouver modèles

#### 4.3 Vérifier Catégories Sources

Avant (KB héritait de source) :
- Page 9anoun.tn/codes → KB = "codes" (même si jurisprudence)

Après (KB basée sur contenu) :
- Page 9anoun.tn/codes → KB = "jurisprudence" (si contenu = arrêt)

---

## 📊 Métriques de Succès

### Quantitatives

| Métrique | Avant | Cible | Méthode Vérification |
|----------|-------|-------|---------------------|
| Catégorie dominante | 85.2% | <30% | SQL distribution |
| Catégories actives | 4 | 6-8 | SQL COUNT DISTINCT |
| Docs needs_review | 0 | <20% | SQL metadata filter |
| Confiance moyenne | N/A | >0.6 | SQL AVG confidence |
| RAG résultats >0 | 0% | 100% | Test queries |

### Qualitatives

- ✅ Échantillons manuels cohérents (20 docs)
- ✅ Assistant IA répond avec sources pertinentes
- ✅ Aucune erreur SQL pendant process
- ✅ Temps d'exécution <10h total

---

## 🚨 Troubleshooting

### Problème 1 : Classification trop lente

**Symptôme** : >30s par page
**Causes** :
- LLM timeout
- Rate limiting API
- Contenu très long

**Solution** :
```typescript
// Réduire BATCH_SIZE dans classify-pages-batch.ts
const BATCH_SIZE = 5 // Au lieu de 10
```

### Problème 2 : Trop de docs "autre"

**Symptôme** : >30% catégorie "autre"
**Cause** : Peu de classifications IA disponibles

**Solution** :
```bash
# 1. Vérifier combien de pages classifiées
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya -c 'SELECT COUNT(*) FROM legal_classifications'"

# 2. Si <80% → relancer classification
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/classify-pages-batch.ts"

# 3. Puis relancer reclassification
ssh root@84.247.165.187 "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/reclassify-kb-batch.ts"
```

### Problème 3 : Erreurs SQL "column does not exist"

**Cause** : Schéma DB différent dev/prod

**Solution** :
```bash
# Vérifier colonnes
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya -c '\\d knowledge_base'"
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya -c '\\d legal_classifications'"

# Adapter scripts si nécessaire
```

### Problème 4 : Distribution toujours déséquilibrée

**Symptôme** : 1 catégorie >50% après reclassification
**Cause** : Normal si contenu homogène (ex: 80% codes dans 9anoun.tn)

**Solution** : Pas un bug, c'est la réalité du contenu

---

## 🔄 Rollback

Si résultats non satisfaisants :

```bash
# Restaurer depuis backup
ssh root@84.247.165.187 "docker exec -i 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya < /tmp/kb_backup_YYYYMMDD_HHMMSS.sql"

# OU rollback via metadata
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya -c \"
UPDATE knowledge_base
SET
  category = (metadata->>'old_category')::text,
  metadata = metadata - 'old_category' - 'reclassified_at'
WHERE metadata->>'reclassified_at' IS NOT NULL
\""
```

---

## 📝 Checklist d'Exécution

### Pré-requis
- [ ] Backup `knowledge_base` créé
- [ ] Backup `legal_classifications` créé
- [ ] Tunnel SSH actif (si besoin)
- [ ] Scripts compilent sans erreur

### Classification Pages (Étape 1)
- [ ] Test 10 pages OK
- [ ] Test 100 pages OK
- [ ] Full 8 683 pages lancé
- [ ] >98% pages classifiées
- [ ] Distribution équilibrée
- [ ] Confiance moyenne >0.6

### Reclassification KB (Étape 2)
- [ ] Dry-run 100 docs OK
- [ ] Dry-run full OK
- [ ] Distribution projetée satisfaisante
- [ ] Exécution réelle lancée
- [ ] 0 erreurs SQL
- [ ] Rapport final validé

### Validation (Étape 3)
- [ ] Script validation exécuté
- [ ] Distribution <30% max
- [ ] 6-8 catégories actives
- [ ] Échantillons cohérents
- [ ] RAG teste OK

### Tests Fonctionnels (Étape 4)
- [ ] Assistant IA trouve résultats
- [ ] Catégories correctes
- [ ] Pas d'hallucinations
- [ ] Performance acceptable (<5s)

---

## 📅 Timeline Recommandée

| Jour | Étape | Durée | Responsable |
|------|-------|-------|-------------|
| J1 Matin | Backups + Tests locaux | 1h | Dev |
| J1 AM | Classification 100 pages | 30min | Dev |
| J1 PM | Classification full (background) | 4-6h | Serveur |
| J2 Matin | Validation classifications | 30min | Dev |
| J2 Matin | Reclassification KB (dry-run) | 10min | Dev |
| J2 Matin | Reclassification KB (write) | 5min | Dev |
| J2 AM | Validation + Tests | 1h | Dev + QA |

**Total** : ~8-10h sur 2 jours

---

## 📚 Fichiers Référence

- `scripts/classify-pages-batch.ts` - Classification batch pages
- `scripts/reclassify-kb-batch.ts` - Reclassification KB
- `scripts/validate-reclassification.ts` - Validation post-reclas
- `scripts/monitor-reclassification.ts` - Monitoring temps réel
- `docs/SQL_MONITORING_RECLASSIFICATION.md` - Requêtes SQL
- `docs/RECLASSIFICATION_KB_FEB12.md` - Documentation technique

---

**Auteur** : Claude Sonnet 4.5
**Date** : 12 février 2026, 23:45
**Status** : ✅ Prêt pour exécution
