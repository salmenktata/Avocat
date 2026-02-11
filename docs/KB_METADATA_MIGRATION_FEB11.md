# Migration kb_structured_metadata - 11 Février 2026

## 🐛 Problème Identifié

**Page affectée :** https://qadhya.tn/client/jurisprudence-timeline

**Erreur :**
```
relation "kb_structured_metadata" does not exist
```

**Cause :** La migration `20260209000001_kb_structured_metadata.sql` n'avait jamais été appliquée en production.

## ✅ Solution Appliquée

### Migration Appliquée

**Fichier :** `db/migrations/20260209000001_kb_structured_metadata.sql`

**Date d'application :** 11 février 2026

**Contenu de la migration :**

1. **Tables créées** :
   - `kb_structured_metadata` : Métadonnées juridiques structurées extraites des documents KB
   - `kb_legal_relations` : Graphe de connaissances juridiques (citations, abrogations, etc.)

2. **Colonnes ajoutées à `knowledge_base`** :
   - `taxonomy_category_code` : Code catégorie taxonomie
   - `taxonomy_domain_code` : Code domaine juridique
   - `taxonomy_document_type_code` : Code type document

3. **Fonctions SQL créées** :
   - `search_kb_with_legal_filters()` : Recherche sémantique avec filtres juridiques
   - `get_legal_relations()` : Obtenir relations juridiques d'un document
   - `update_kb_metadata_updated_at()` : Trigger auto-update timestamp

4. **Vues créées** :
   - `vw_kb_with_metadata` : Documents KB avec métadonnées enrichies
   - `vw_metadata_extraction_stats` : Statistiques extraction métadonnées
   - `vw_legal_relations_stats` : Statistiques relations juridiques

### Commandes Exécutées

```bash
# 1. Backup schéma avant migration
ssh root@84.247.165.187 "docker exec qadhya-postgres pg_dump -U moncabinet -d qadhya --schema-only > /tmp/schema_backup_before_kb_metadata_20260211.sql"

# 2. Upload migration
scp db/migrations/20260209000001_kb_structured_metadata.sql root@84.247.165.187:/tmp/kb_metadata_migration.sql

# 3. Application migration
ssh root@84.247.165.187 "docker exec -i qadhya-postgres psql -U moncabinet -d qadhya < /tmp/kb_metadata_migration.sql"
```

## ✅ Vérifications Post-Migration

### Tables Créées

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('kb_structured_metadata', 'kb_legal_relations');
```

**Résultat :**
```
kb_legal_relations
kb_structured_metadata
```
✅ 2 tables créées

### Colonnes Ajoutées

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'knowledge_base'
  AND column_name LIKE 'taxonomy%';
```

**Résultat :**
```
taxonomy_category_code
taxonomy_document_type_code
taxonomy_domain_code
```
✅ 3 colonnes ajoutées

### Fonctions SQL Créées

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('search_kb_with_legal_filters', 'get_legal_relations', 'update_kb_metadata_updated_at');
```

**Résultat :**
```
get_legal_relations
search_kb_with_legal_filters
update_kb_metadata_updated_at
```
✅ 3 fonctions créées

### Vues Créées

```sql
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'vw_%';
```

**Résultat :**
```
vw_kb_with_metadata
vw_legal_relations_stats
vw_metadata_extraction_stats
```
✅ 3 vues créées

## 📊 État Actuel de la Base

**Documents KB :** 580 documents
**Métadonnées structurées :** 0 (table vide, extraction à faire)

## 🎯 Prochaines Étapes

### 1. Extraction des Métadonnées Structurées

Pour remplir la table `kb_structured_metadata`, il faut lancer l'extraction des métadonnées sur les documents KB existants :

```bash
# Script d'extraction (à créer/exécuter)
npm run extract:kb-metadata

# Ou via API
POST /api/admin/kb/extract-metadata/bulk
```

**Services impliqués :**
- `lib/knowledge-base/structured-metadata-extractor-service.ts`
- `lib/knowledge-base/acquisition-pipeline-service.ts`

### 2. Construction des Relations Juridiques

Une fois les métadonnées extraites, construire le graphe de connaissances :

```bash
# Service de relations (à exécuter)
npm run build:legal-relations

# Ou via API
POST /api/admin/kb/build-relations
```

**Service impliqué :**
- `lib/knowledge-base/legal-relations-extractor-service.ts`

### 3. Population de la Taxonomie

S'assurer que la table `legal_taxonomy` contient toutes les entrées nécessaires :

- Tribunaux tunisiens (Cassation, Appel, Première Instance)
- Chambres (Civile, Pénale, Commerciale, etc.)
- Domaines juridiques (Civil, Pénal, Commercial, etc.)
- Types de documents (Arrêt, Jugement, Loi, Décret, etc.)

**Migrations liées :**
- `20260209100000_legal_taxonomy.sql`
- `20260210100000_enrich_tribunals_taxonomy.sql`
- `20260210100001_add_missing_tribunals.sql`
- `20260211100000_align_categories_taxonomy.sql`

## 🔧 Scripts Disponibles

### Script d'Application Migration

**Fichier :** `scripts/apply-kb-metadata-migration.sh`

Script bash interactif pour appliquer cette migration avec :
- Vérifications pré-migration
- Backup automatique schéma
- Vérifications post-migration
- Rapport détaillé

**Usage :**
```bash
./scripts/apply-kb-metadata-migration.sh
```

### Test Extraction Métadonnées

**Fichier :** `scripts/test-metadata-enrichment.ts`

Script TypeScript pour tester l'extraction de métadonnées structurées sur un document.

**Usage :**
```bash
npx ts-node scripts/test-metadata-enrichment.ts
```

### Extraction Bulk Métadonnées

**Fichier :** `scripts/extract-structured-metadata.ts`

Script pour extraire métadonnées sur tous les documents KB (batch processing).

**Usage :**
```bash
npx ts-node scripts/extract-structured-metadata.ts
```

## 📝 Notes Importantes

### Structure kb_structured_metadata

**Champs Jurisprudence :**
- `tribunal_code` : Code tribunal (FK vers legal_taxonomy)
- `chambre_code` : Code chambre (FK vers legal_taxonomy)
- `decision_number` : Numéro décision
- `decision_date` : Date décision
- `parties` : Parties (JSONB)
- `solution` : Solution (cassation, rejet, renvoi, etc.)
- `legal_basis` : Base légale (array TEXT[])
- `rapporteur` : Nom rapporteur

**Champs Législation :**
- `loi_number` : Numéro loi
- `jort_number` : Numéro JORT
- `jort_date` : Date publication JORT
- `effective_date` : Date entrée en vigueur
- `ministry` : Ministère
- `code_name` : Nom du code (COC, CPC, etc.)
- `article_range` : Plage d'articles

**Champs Doctrine :**
- `author` : Auteur principal
- `co_authors` : Co-auteurs (array TEXT[])
- `publication_name` : Nom publication
- `publication_date` : Date publication
- `university` : Université
- `keywords` : Mots-clés (array TEXT[])
- `abstract` : Résumé

**Métadonnées Extraction :**
- `field_confidence` : Confiance par champ (JSONB)
- `extraction_method` : Méthode (llm, regex, hybrid, manual)
- `extraction_confidence` : Confiance globale (0-1)
- `llm_provider` : Provider LLM utilisé
- `llm_model` : Modèle LLM utilisé

**Validation :**
- `validated_by` : ID utilisateur validateur
- `validated_at` : Date validation
- `validation_notes` : Notes validation

### Types de Relations Juridiques

**Relations supportées dans `kb_legal_relations` :**

| Type | Description | Exemple |
|------|-------------|---------|
| `cites` | Document A cite Document B | Arrêt cite un article de loi |
| `cited_by` | Document A cité par B (inverse) | Loi citée par arrêt |
| `supersedes` | Document A remplace/abroge B | Nouvelle loi abroge ancienne |
| `superseded_by` | Document A remplacé par B | Ancienne loi abrogée |
| `implements` | Arrêt A applique loi B | Arrêt applique article COC |
| `interpreted_by` | Loi A interprétée par juris B | COC interprété par cassation |
| `commented_by` | Décision A commentée par doctrine B | Arrêt commenté dans revue |
| `related_case` | Jurisprudences similaires | Affaires similaires |
| `same_topic` | Même sujet juridique | Documents même domaine |
| `contradicts` | Contradiction juridique | Arrêts contradictoires |

## 🔍 Debugging

### Vérifier si un Document a des Métadonnées

```sql
SELECT
  kb.id,
  kb.title,
  kb.category,
  meta.decision_number,
  meta.decision_date,
  meta.tribunal_code,
  meta.extraction_confidence
FROM knowledge_base kb
LEFT JOIN kb_structured_metadata meta ON kb.id = meta.knowledge_base_id
WHERE kb.id = 'UUID_DU_DOCUMENT';
```

### Statistiques Métadonnées

```sql
-- Vue statistiques extraction
SELECT * FROM vw_metadata_extraction_stats;

-- Statistiques relations
SELECT * FROM vw_legal_relations_stats;
```

### Recherche avec Filtres Juridiques

```sql
-- Recherche arrêts cassation civile depuis 2020
SELECT * FROM search_kb_with_legal_filters(
  p_embedding := '[...vector 1024 dimensions...]'::vector(1024),
  p_similarity_threshold := 0.65,
  p_limit := 10,
  p_tribunal_code := 'cassation',
  p_chambre_code := 'civile',
  p_date_from := '2020-01-01'::DATE
);
```

## 📚 Ressources

**Documentation :**
- `/docs/CATEGORY_ALIGNMENT.md` : Alignement catégories taxonomie
- `/docs/CLASSIFICATION_SPRINT2_SUMMARY.md` : Classification juridique
- `db/migrations/20260209000001_kb_structured_metadata.sql` : Migration complète

**Services :**
- `lib/knowledge-base/structured-metadata-extractor-service.ts` : Extraction métadonnées
- `lib/knowledge-base/legal-relations-extractor-service.ts` : Extraction relations
- `lib/ai/jurisprudence-timeline-service.ts` : Service timeline
- `lib/ai/precedent-scoring-service.ts` : Scoring précédents

**API Routes :**
- `POST /api/admin/kb/extract-metadata/:id` : Extraire métadonnées d'un doc
- `GET /api/client/jurisprudence/timeline` : Timeline jurisprudence
- `GET /api/client/jurisprudence/details/:id` : Détails arrêt

## ✅ Checklist Validation

- [x] Table `kb_structured_metadata` créée
- [x] Table `kb_legal_relations` créée
- [x] Colonnes `taxonomy_*` ajoutées à `knowledge_base`
- [x] Fonctions SQL créées (search_kb_with_legal_filters, get_legal_relations)
- [x] Vues créées (vw_kb_with_metadata, etc.)
- [x] Triggers créés (update_kb_metadata_updated_at)
- [x] Page `/client/jurisprudence-timeline` ne retourne plus d'erreur SQL
- [ ] Extraction métadonnées lancée sur documents KB
- [ ] Relations juridiques construites
- [ ] Timeline jurisprudence affiche des événements

## 🎉 Résultat

✅ **Migration réussie**
✅ **Page timeline jurisprudence accessible**
⏳ **Prochaine étape : Extraction métadonnées sur 580 documents KB**

---

**Date :** 11 février 2026
**Durée migration :** ~2 minutes
**Impact :** 0 downtime (tables nouvelles, pas de modification données existantes)
**Backup :** `/tmp/schema_backup_before_kb_metadata_20260211.sql` (VPS)
