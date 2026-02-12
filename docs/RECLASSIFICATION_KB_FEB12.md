# Reclassification Intelligente KB - Documentation Exécution

**Date** : 12 février 2026
**Objectif** : Reclassifier 8 735 documents KB selon leur contenu réel (classification IA pure)
**Principe** : ❌ Aucun fallback source | ✅ Classification pure par contenu

---

## 📋 Contexte

### Problème Identifié

- **8 735 documents** dans KB avec **85% catégorisés "legislation"** (déséquilibre massif)
- **Cause racine** : Héritage statique de `web_source.category`
- **Réalité** : Une source comme 9anoun.tn (catégorie "codes") contient jurisprudence, doctrine, législation
- **Impact** : RAG trouve 0 documents pertinents, hallucinations, qualité dégradée

### Solution Implémentée

**Classification pure par contenu** :
1. Utiliser UNIQUEMENT `legal_classifications.primary_category`
2. Si NULL → catégorie `"autre"` + flag `needs_review: true`
3. Enrichissement metadata pour traçabilité complète
4. Batch reclassification de l'existant (8 735 docs)

---

## 🏗️ Architecture

### Fichiers Modifiés

1. **`lib/web-scraper/web-indexer-service.ts`**
   - Ajout JOIN `legal_classifications`
   - Fonction `determineCategoryForKB()` (classification IA pure)
   - Enrichissement metadata (classification_source, confidence, needs_review)
   - Utilisation `kbCategory` au lieu de `row.category`

### Fichiers Créés

1. **`scripts/reclassify-kb-batch.ts`** : Reclassification batch (8 735 docs)
2. **`scripts/validate-reclassification.ts`** : Validation qualité post-reclassification
3. **`docs/RECLASSIFICATION_KB_FEB12.md`** : Documentation (ce fichier)

---

## 🚀 Guide d'Exécution

### Prérequis

1. **Backup base de données** (CRITIQUE)
   ```bash
   # Sur le serveur de prod
   ssh -p 5434 localhost "docker exec qadhya-postgres pg_dump -U moncabinet qadhya -t knowledge_base > /tmp/kb_backup_$(date +%Y%m%d_%H%M%S).sql"
   ```

2. **Vérifier que `legal_classifications` est peuplée**
   ```bash
   ssh -p 5434 localhost "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c 'SELECT COUNT(*) FROM legal_classifications'"
   ```

### Étape 1 : Test en DRY-RUN (Local)

```bash
# Test sur un échantillon (100 docs)
npx tsx scripts/reclassify-kb-batch.ts --dry-run --limit=100
```

**Vérifications** :
- ✅ Aucune erreur SQL
- ✅ Statistiques cohérentes (reclassified + unchanged = total)
- ✅ Distribution catégories plausible

### Étape 2 : Exécution Production (Dry-Run)

```bash
# Via tunnel SSH
ssh -p 5434 localhost "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/reclassify-kb-batch.ts --dry-run"
```

**Analyse des logs** :
- Temps d'exécution estimé (~3-5 min pour 8 735 docs)
- Distribution projetée par catégorie
- % docs `needs_review`

### Étape 3 : Exécution Production (WRITE)

```bash
# ⚠️ ATTENTION : Modifications effectives
ssh -p 5434 localhost "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/reclassify-kb-batch.ts"
```

**Monitoring** :
- Suivre les logs batch par batch
- Vérifier `errors: 0`
- Noter les stats finales

### Étape 4 : Validation

```bash
# Validation complète (distribution, échantillons, RAG, qualité)
ssh -p 5434 localhost "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/validate-reclassification.ts"

# Échantillons personnalisés
ssh -p 5434 localhost "cd /opt/qadhya && docker exec -i qadhya-nextjs npx tsx scripts/validate-reclassification.ts --samples=50"
```

**Critères de succès** :
- ✅ Distribution équilibrée (aucune catégorie >40%)
- ✅ 6+ catégories actives (vs 4 avant)
- ✅ `needs_review` <20%
- ✅ RAG trouve >0 résultats sur queries test
- ✅ Échantillons cohérents avec contenu

---

## 📊 Résultats Attendus

### Avant Reclassification

| Catégorie      | Docs  | %     |
|----------------|-------|-------|
| legislation    | 7 442 | 85.2% |
| google_drive   | 521   | 6.0%  |
| autre          | 457   | 5.2%  |
| jurisprudence  | 315   | 3.6%  |

**Problèmes** :
- ❌ 1 catégorie domine (85%)
- ❌ Seulement 4 catégories actives
- ❌ RAG trouve 0 docs pertinents

### Après Reclassification (Projection)

| Catégorie      | Docs  | %     |
|----------------|-------|-------|
| legislation    | 2 200 | 25%   |
| jurisprudence  | 1 800 | 21%   |
| codes          | 1 500 | 17%   |
| doctrine       | 1 200 | 14%   |
| autre          | 900   | 10%   |
| google_drive   | 521   | 6%    |
| jort           | 400   | 5%    |
| procedures     | 214   | 2%    |

**Gains attendus** :
- ✅ Équilibre restauré (aucune catégorie >30%)
- ✅ 7-8 catégories actives vs 4
- ✅ RAG trouve documents pertinents (+80% rappel)
- ✅ Qualité réponses améliorée (-60% hallucinations)

---

## 🔍 Audit Post-Reclassification

### Documents à Review

```sql
-- Docs sans classification IA (catégorie "autre")
SELECT
  id,
  title,
  source_file,
  metadata->>'classification_source' as source
FROM knowledge_base
WHERE category = 'autre'
  AND metadata->>'needs_review' = 'true'
ORDER BY created_at DESC
LIMIT 50;
```

### Distribution par Confiance

```sql
-- Stats par niveau de confiance
SELECT
  CASE
    WHEN (metadata->>'classification_confidence')::float >= 0.8 THEN 'Haute (≥0.8)'
    WHEN (metadata->>'classification_confidence')::float >= 0.5 THEN 'Moyenne (0.5-0.8)'
    ELSE 'Faible (<0.5)'
  END as confidence,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
FROM knowledge_base
WHERE metadata->>'classification_confidence' IS NOT NULL
GROUP BY confidence
ORDER BY confidence;
```

### Impact RAG

```sql
-- Test recherche sémantique
SELECT search_knowledge_base(
  'القانون الجنائي التونسي',
  'ar',
  5,
  0.0,
  NULL -- toutes catégories
);
```

---

## 🐛 Troubleshooting

### Erreur : "column legal_classifications.page_id does not exist"

**Cause** : Nom de colonne incorrect
**Solution** :
```sql
-- Vérifier les colonnes
\d legal_classifications

-- Adapter le script si besoin (ex: web_page_id au lieu de page_id)
```

### Erreur : "Too many rows updated"

**Cause** : Batch trop large
**Solution** :
```typescript
// Réduire BATCH_SIZE dans reclassify-kb-batch.ts
const BATCH_SIZE = 25 // Au lieu de 50
```

### Trop de docs "autre" (>30%)

**Cause** : Peu de classifications IA disponibles
**Solution** :
1. Lancer classification batch sur pages manquantes
2. Vérifier `legal_classifications` table est à jour
3. Re-exécuter reclassification après classification

### Distribution toujours déséquilibrée

**Cause** : Source domine réellement (ex: 80% codes dans 9anoun.tn)
**Solution** : Normal si le contenu est homogène, pas un bug

---

## 🔄 Rollback

Si reclassification échoue ou résultats non satisfaisants :

```sql
-- Restaurer catégories d'origine (depuis metadata.old_category)
UPDATE knowledge_base
SET
  category = (metadata->>'old_category')::text,
  metadata = metadata - 'old_category' - 'reclassified_at'
WHERE metadata->>'reclassified_at' IS NOT NULL;

-- OU restaurer depuis backup
psql -U moncabinet -d qadhya < /tmp/kb_backup_YYYYMMDD_HHMMSS.sql
```

---

## 📈 Métriques de Succès

### Critères Quantitatifs

- ✅ **Distribution** : Aucune catégorie >40%
- ✅ **Diversité** : 6+ catégories actives (>100 docs)
- ✅ **Qualité** : `needs_review` <20%
- ✅ **Confiance** : Moyenne >0.6

### Critères Qualitatifs

- ✅ **RAG** : Trouve >0 résultats sur queries test
- ✅ **Cohérence** : Échantillons manuels validés
- ✅ **Impact** : -60% hallucinations Assistant IA

### Monitoring Continue

```sql
-- Dashboard reclassification
SELECT
  category,
  COUNT(*) as docs,
  COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') as needs_review,
  ROUND(AVG((metadata->>'classification_confidence')::float), 2) as avg_confidence
FROM knowledge_base
WHERE source_type = 'web'
  AND is_active = true
GROUP BY category
ORDER BY COUNT(*) DESC;
```

---

## 🎓 Principes Appliqués

1. **Pureté Classification** : Aucun fallback source, seulement contenu
2. **Traçabilité Complète** : Metadata enrichie (old_category, reclassified_at, classification_source)
3. **Audit-Friendly** : Flag `needs_review` pour docs sans classification
4. **Batch Optimal** : 50 docs/batch, progress logging, interruptible
5. **Rollback Safe** : `old_category` stockée, backup DB
6. **Testable** : Validation distribution + échantillons + RAG

---

## 📅 Timeline

- **Jour 1** : Implémentation code + tests unitaires (2h) ✅
- **Jour 2** : Exécution batch production + validation (3h)
- **Jour 3-7** : Monitoring + ajustements (1h/jour)

**Temps total** : ~10h sur 1 semaine

---

## 📚 Références

- **Plan original** : `/docs/PLAN_RECLASSIFICATION_KB_FEB12.md`
- **Système classification** : `lib/web-scraper/legal-classifier-service.ts`
- **Catégories** : `lib/categories/legal-categories.ts`
- **Indexation KB** : `lib/web-scraper/web-indexer-service.ts`

---

**Auteur** : Claude Sonnet 4.5
**Date** : 12 février 2026
**Status** : ✅ Implémenté, prêt pour exécution production
