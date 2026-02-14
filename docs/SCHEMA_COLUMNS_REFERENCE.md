# Référence Schéma Base de Données - Colonnes Content

**Date**: 14 Février 2026
**Auteur**: Correction Architecturale Définitive

---

## 🚨 RÈGLE CRITIQUE

Il existe **DEUX tables différentes** avec des **colonnes de contenu différentes** :

| Table | Colonne Content | Alias SQL Autorisé | Usage |
|-------|----------------|-------------------|-------|
| **`knowledge_base_chunks`** | `content` | `content AS chunk_content` | Base de connaissances juridique |
| **`document_embeddings`** | `content_chunk` | - | Documents utilisateurs (dossiers) |

---

## ❌ ERREURS COURANTES

### Erreur #1 : Utiliser `kbc.content_chunk`

```sql
-- ❌ INCORRECT
SELECT kbc.content_chunk
FROM knowledge_base_chunks kbc
```

```sql
-- ✅ CORRECT
SELECT kbc.content
FROM knowledge_base_chunks kbc

-- ✅ OU avec alias
SELECT kbc.content AS chunk_content
FROM knowledge_base_chunks kbc
```

### Erreur #2 : Utiliser `de.content`

```sql
-- ❌ INCORRECT
SELECT de.content
FROM document_embeddings de
```

```sql
-- ✅ CORRECT
SELECT de.content_chunk
FROM document_embeddings de
```

---

## 📋 Schémas Complets

### Table : `knowledge_base_chunks`

```sql
CREATE TABLE knowledge_base_chunks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id uuid NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  chunk_index       integer NOT NULL,
  content           text NOT NULL,              -- ← NOM CORRECT
  embedding         vector(1024),                -- Ollama
  embedding_openai  vector(1536),                -- OpenAI
  content_tsvector  tsvector,                    -- BM25 fulltext
  metadata          jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now()
);
```

**Règles** :
- ✅ Utiliser `kbc.content`
- ✅ Alias OK : `kbc.content AS chunk_content`
- ❌ JAMAIS `kbc.content_chunk`

---

### Table : `document_embeddings`

```sql
CREATE TABLE document_embeddings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_chunk text NOT NULL,                   -- ← NOM CORRECT
  chunk_index   integer NOT NULL,
  embedding     vector(1024),
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);
```

**Règles** :
- ✅ Utiliser `de.content_chunk`
- ❌ JAMAIS `de.content`

---

## 🔍 Checklist Avant Commit

Avant de committer du code qui touche aux embeddings, vérifier :

- [ ] SQL avec `kbc.*` → utilise `kbc.content`
- [ ] SQL avec `de.*` → utilise `de.content_chunk`
- [ ] TypeScript reçoit `content` (KB) ou `content_chunk` (documents)
- [ ] Migrations SQL testées localement avant push
- [ ] Script `npm run validate:schema` passe (quand implémenté)

---

## 🛠️ Scripts de Validation

### Vérifier Usages Incorrects

```bash
# Chercher usages incorrects kbc.content_chunk
grep -r "kbc\.content_chunk" --include="*.ts" --include="*.sql" . | grep -v node_modules

# Chercher usages incorrects de.content (sans _chunk)
grep -r "de\.content[^_]" --include="*.ts" --include="*.sql" . | grep -v node_modules
```

### Test Automatisé (TODO)

```bash
npm run test:schema-validation
```

---

## 📚 Historique Bug

### Incident : 14 Février 2026

**Symptôme** : Assistant IA ne répond pas, erreur SQL `column kbc.content_chunk does not exist`

**Cause racine** : Migrations et scripts utilisaient `content_chunk` au lieu de `content` pour `knowledge_base_chunks`

**Fichiers corrigés** :
- `migrations/2026-02-12-add-hybrid-search.sql`
- `migrations/20260214_redisearch_setup.sql`
- `migrations/fix-content-chunk-column.sql`
- `scripts/reindex-kb-openai.ts`
- `app/api/admin/reindex-kb-openai/route.ts`

**Commit** : `b654bc2`, `18fc3b0`

**Leçon** : Toujours référencer ce document avant d'écrire du SQL qui touche aux embeddings.

---

## 🎯 Actions Futures

1. **Types TypeScript** : Créer types `KBChunk` et `DocEmbedding` clairs
2. **Schema Tests** : Tests E2E qui vérifient les requêtes SQL
3. **Pre-commit Hook** : Valider SQL avant commit
4. **Documentation** : Former équipe sur cette différence critique

---

**⚠️ IMPORTANT** : Cette différence est **intentionnelle** car les deux tables ont des origines et usages différents. Ne PAS renommer pour uniformiser sans migration complète.
