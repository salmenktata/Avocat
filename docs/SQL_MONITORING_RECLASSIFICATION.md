# Requêtes SQL de Monitoring - Reclassification KB

Documentation des requêtes SQL pour surveiller et auditer la reclassification de la base de connaissances.

---

## 📊 1. Distribution des Catégories

### État Actuel KB

```sql
-- Distribution complète des catégories
SELECT
  category,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct,
  LPAD('█', (COUNT(*) * 50 / MAX(COUNT(*)) OVER ())::int, '█') as bar
FROM knowledge_base
WHERE is_active = true
  AND source_file IS NOT NULL
GROUP BY category
ORDER BY COUNT(*) DESC;
```

### Distribution avec Métadonnées Classification

```sql
-- Inclut les infos de classification source
SELECT
  kb.category,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE metadata->>'classification_source' = 'ai') as from_ai,
  COUNT(*) FILTER (WHERE metadata->>'classification_source' = 'default') as from_default,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'classification_source' = 'ai') / COUNT(*), 1) as pct_ai,
  ROUND(AVG((metadata->>'classification_confidence')::float), 2) as avg_confidence
FROM knowledge_base kb
WHERE kb.is_active = true
  AND kb.source_file IS NOT NULL
GROUP BY kb.category
ORDER BY COUNT(*) DESC;
```

---

## 🔍 2. Audit des Classifications

### Documents Reclassifiés

```sql
-- Tous les documents modifiés par la reclassification
SELECT
  id,
  title,
  category as new_category,
  metadata->>'old_category' as old_category,
  (metadata->>'classification_confidence')::float as confidence,
  metadata->>'reclassified_at' as reclassified_at,
  source_file
FROM knowledge_base
WHERE metadata->>'reclassified_at' IS NOT NULL
ORDER BY (metadata->>'reclassified_at')::timestamp DESC
LIMIT 50;
```

### Changements par Catégorie

```sql
-- Matrice de transition : Avant → Après
SELECT
  metadata->>'old_category' as old_category,
  category as new_category,
  COUNT(*) as count
FROM knowledge_base
WHERE metadata->>'reclassified_at' IS NOT NULL
GROUP BY metadata->>'old_category', category
ORDER BY COUNT(*) DESC;
```

### Documents à Review

```sql
-- Docs sans classification IA (needs_review = true)
SELECT
  id,
  title,
  category,
  source_file,
  (metadata->>'classification_confidence')::float as confidence,
  metadata->>'classification_source' as source,
  created_at
FROM knowledge_base
WHERE metadata->>'needs_review' = 'true'
  AND is_active = true
ORDER BY created_at DESC
LIMIT 100;
```

---

## 📈 3. Qualité des Classifications

### Distribution par Niveau de Confiance

```sql
-- Stats par niveau de confiance
SELECT
  CASE
    WHEN (metadata->>'classification_confidence')::float IS NULL THEN '0. Aucune classification'
    WHEN (metadata->>'classification_confidence')::float >= 0.8 THEN '1. Haute confiance (≥0.8)'
    WHEN (metadata->>'classification_confidence')::float >= 0.5 THEN '2. Confiance moyenne (0.5-0.8)'
    ELSE '3. Faible confiance (<0.5)'
  END as confidence_range,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
FROM knowledge_base
WHERE is_active = true
  AND source_file IS NOT NULL
GROUP BY confidence_range
ORDER BY confidence_range;
```

### Confiance Moyenne par Catégorie

```sql
-- Identifier les catégories avec faible confiance
SELECT
  category,
  COUNT(*) as count,
  ROUND(AVG((metadata->>'classification_confidence')::float)::numeric, 2) as avg_confidence,
  ROUND(MIN((metadata->>'classification_confidence')::float)::numeric, 2) as min_confidence,
  ROUND(MAX((metadata->>'classification_confidence')::float)::numeric, 2) as max_confidence,
  COUNT(*) FILTER (WHERE (metadata->>'classification_confidence')::float < 0.5) as low_confidence_count
FROM knowledge_base
WHERE metadata->>'classification_confidence' IS NOT NULL
  AND is_active = true
GROUP BY category
ORDER BY avg_confidence DESC;
```

### Catégories avec Plus de Needs Review

```sql
-- Catégories nécessitant le plus de review
SELECT
  category,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') as needs_review,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') / COUNT(*), 1) as pct_needs_review
FROM knowledge_base
WHERE is_active = true
  AND source_file IS NOT NULL
GROUP BY category
HAVING COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') > 0
ORDER BY pct_needs_review DESC;
```

---

## 🌐 4. Analyse par Source Web

### Distribution par Source

```sql
-- Catégories par source web
SELECT
  kb.metadata->>'sourceName' as source_name,
  kb.category,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY kb.metadata->>'sourceName'), 1) as pct_within_source
FROM knowledge_base kb
WHERE kb.is_active = true
  AND kb.source_file IS NOT NULL
GROUP BY kb.metadata->>'sourceName', kb.category
ORDER BY kb.metadata->>'sourceName', COUNT(*) DESC;
```

### Sources avec Déséquilibre

```sql
-- Sources où 1 catégorie domine >70%
WITH source_stats AS (
  SELECT
    metadata->>'sourceName' as source_name,
    category,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY metadata->>'sourceName'), 1) as pct
  FROM knowledge_base
  WHERE is_active = true
    AND source_file IS NOT NULL
  GROUP BY metadata->>'sourceName', category
)
SELECT *
FROM source_stats
WHERE pct > 70
ORDER BY pct DESC;
```

---

## 🔗 5. Jointure avec Classifications IA

### Documents KB avec Détails Classification

```sql
-- Infos complètes : KB + Classification IA
SELECT
  kb.id,
  kb.title,
  kb.category as kb_category,
  lc.primary_category as ai_category,
  lc.confidence_score,
  lc.classification_source,
  lc.signals_used,
  kb.source_file,
  CASE
    WHEN kb.category = lc.primary_category THEN 'Match'
    WHEN lc.primary_category IS NULL THEN 'No AI Classification'
    ELSE 'Mismatch'
  END as alignment
FROM knowledge_base kb
LEFT JOIN web_pages wp ON kb.source_file = wp.url
LEFT JOIN legal_classifications lc ON wp.id = lc.web_page_id
WHERE kb.is_active = true
  AND kb.source_file IS NOT NULL
ORDER BY kb.created_at DESC
LIMIT 100;
```

### Mismatches (KB ≠ Classification IA)

```sql
-- Documents où KB category != AI primary_category
SELECT
  kb.id,
  kb.title,
  kb.category as kb_category,
  lc.primary_category as ai_category,
  lc.confidence_score,
  kb.metadata->>'old_category' as old_kb_category,
  kb.source_file
FROM knowledge_base kb
JOIN web_pages wp ON kb.source_file = wp.url
JOIN legal_classifications lc ON wp.id = lc.web_page_id
WHERE kb.is_active = true
  AND kb.category != lc.primary_category
ORDER BY lc.confidence_score DESC
LIMIT 50;
```

---

## ⏱️ 6. Timeline de Reclassification

### Progression dans le Temps

```sql
-- Reclassifications par jour
SELECT
  DATE(metadata->>'reclassified_at') as date,
  COUNT(*) as reclassified_count,
  COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') as needs_review_count
FROM knowledge_base
WHERE metadata->>'reclassified_at' IS NOT NULL
GROUP BY DATE(metadata->>'reclassified_at')
ORDER BY date DESC;
```

### Dernières Reclassifications

```sql
-- 50 dernières modifications
SELECT
  id,
  title,
  metadata->>'old_category' as old_category,
  category as new_category,
  (metadata->>'classification_confidence')::float as confidence,
  metadata->>'reclassified_at' as reclassified_at
FROM knowledge_base
WHERE metadata->>'reclassified_at' IS NOT NULL
ORDER BY (metadata->>'reclassified_at')::timestamp DESC
LIMIT 50;
```

---

## 🎯 7. Impact RAG (Recherche Sémantique)

### Test Recherche par Catégorie

```sql
-- Vérifier que chaque catégorie retourne des résultats
SELECT
  category,
  COUNT(*) as total_docs,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding,
  ROUND(100.0 * COUNT(*) FILTER (WHERE embedding IS NOT NULL) / COUNT(*), 1) as pct_indexed
FROM knowledge_base
WHERE is_active = true
  AND source_file IS NOT NULL
GROUP BY category
ORDER BY COUNT(*) DESC;
```

### Recherche Sémantique Test

```sql
-- Test recherche avec fonction PostgreSQL
SELECT * FROM search_knowledge_base(
  'القانون الجنائي التونسي',  -- Query
  'ar',                        -- Language
  10,                          -- Limit
  0.0,                         -- Min similarity
  NULL                         -- Category filter (all)
);
```

### Diversité des Résultats RAG

```sql
-- Distribution catégories dans top 100 résultats
WITH top_results AS (
  SELECT * FROM search_knowledge_base(
    'قانون',
    'ar',
    100,
    0.0,
    NULL
  )
)
SELECT
  category,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
FROM top_results
GROUP BY category
ORDER BY COUNT(*) DESC;
```

---

## 📊 8. Dashboard Complet

### Vue d'Ensemble Reclassification

```sql
-- Métrique unique avec toutes les stats clés
SELECT
  -- Totaux
  COUNT(*) as total_docs,
  COUNT(*) FILTER (WHERE metadata->>'reclassified_at' IS NOT NULL) as reclassified,

  -- Classification source
  COUNT(*) FILTER (WHERE metadata->>'classification_source' = 'ai') as from_ai,
  COUNT(*) FILTER (WHERE metadata->>'classification_source' = 'default') as from_default,

  -- Quality
  COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') as needs_review,
  ROUND(AVG((metadata->>'classification_confidence')::float)::numeric, 2) as avg_confidence,

  -- Percentages
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'reclassified_at' IS NOT NULL) / COUNT(*), 1) as pct_reclassified,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') / COUNT(*), 1) as pct_needs_review,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'classification_source' = 'ai') / COUNT(*), 1) as pct_from_ai,

  -- Diversity
  COUNT(DISTINCT category) as distinct_categories,
  MAX(category_count.count) as max_category_count,
  ROUND(100.0 * MAX(category_count.count) / COUNT(*), 1) as max_category_pct
FROM knowledge_base kb
LEFT JOIN LATERAL (
  SELECT COUNT(*) as count
  FROM knowledge_base
  WHERE category = kb.category
    AND is_active = true
    AND source_file IS NOT NULL
) category_count ON true
WHERE kb.is_active = true
  AND kb.source_file IS NOT NULL;
```

---

## 🔧 9. Maintenance et Corrections

### Rollback vers Catégorie Originale

```sql
-- Annuler la reclassification (restaurer old_category)
UPDATE knowledge_base
SET
  category = (metadata->>'old_category')::text,
  metadata = metadata - 'old_category' - 'reclassified_at',
  updated_at = NOW()
WHERE metadata->>'reclassified_at' IS NOT NULL
  AND metadata->>'old_category' IS NOT NULL;
```

### Forcer Reclassification sur Docs Spécifiques

```sql
-- Réinitialiser metadata reclassification (pour relancer)
UPDATE knowledge_base
SET
  metadata = metadata - 'reclassified_at' - 'old_category',
  updated_at = NOW()
WHERE category = 'autre'
  AND metadata->>'needs_review' = 'true';
```

### Supprimer Flag needs_review

```sql
-- Marquer docs reviewed manuellement
UPDATE knowledge_base
SET
  metadata = jsonb_set(
    metadata,
    '{needs_review}',
    'false'
  ),
  metadata = jsonb_set(
    metadata,
    '{manually_reviewed_at}',
    to_jsonb(NOW())
  )
WHERE id IN (
  -- Liste des IDs validés manuellement
  'uuid-1', 'uuid-2', 'uuid-3'
);
```

---

## 🚨 10. Alertes et Seuils

### Alerte : Déséquilibre Catégories

```sql
-- Catégories dominantes (>40%)
SELECT
  category,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
FROM knowledge_base
WHERE is_active = true
  AND source_file IS NOT NULL
GROUP BY category
HAVING ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) > 40
ORDER BY pct DESC;
```

### Alerte : Trop de Needs Review

```sql
-- Si >20% needs review → problème classification
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') as needs_review,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') / COUNT(*), 1) as pct,
  CASE
    WHEN ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') / COUNT(*), 1) > 20 THEN '🚨 CRITIQUE'
    WHEN ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') / COUNT(*), 1) > 10 THEN '⚠️ WARNING'
    ELSE '✅ OK'
  END as status
FROM knowledge_base
WHERE is_active = true
  AND source_file IS NOT NULL;
```

### Alerte : Confiance Globale Faible

```sql
-- Si confiance moyenne <0.6 → améliorer classification
SELECT
  ROUND(AVG((metadata->>'classification_confidence')::float)::numeric, 2) as avg_confidence,
  CASE
    WHEN AVG((metadata->>'classification_confidence')::float) < 0.5 THEN '🚨 CRITIQUE'
    WHEN AVG((metadata->>'classification_confidence')::float) < 0.6 THEN '⚠️ WARNING'
    ELSE '✅ OK'
  END as status
FROM knowledge_base
WHERE metadata->>'classification_confidence' IS NOT NULL
  AND is_active = true
  AND source_file IS NOT NULL;
```

---

## 📝 Notes d'Utilisation

### Connexion Production

```bash
# Via tunnel SSH
ssh -p 5434 localhost "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya"

# Ou connexion directe
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya"
```

### Exécuter une Requête

```bash
# Format texte
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya -t -c 'SELECT ...'"

# Format tableau
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya -c 'SELECT ...'"

# Sauvegarder résultat
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya -c 'SELECT ...' > /tmp/results.txt"
```

---

**Dernière mise à jour** : 12 février 2026
**Auteur** : Claude Sonnet 4.5
