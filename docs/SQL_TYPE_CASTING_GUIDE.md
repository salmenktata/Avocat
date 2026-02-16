# Guide - Type Casting SQL PostgreSQL

**Date** : 16 février 2026
**Contexte** : Correction typage `subcategory` dans fonctions recherche KB

---

## 🐛 Problème

### Symptôme
Erreur SQL ou warnings : Fonction retourne `subcategory text` mais colonne DB est `subcategory varchar(50)`.

### Root Cause
```sql
-- Table DB
CREATE TABLE knowledge_base (
  subcategory character varying(50),  -- Type: VARCHAR(50)
  ...
);

-- Fonction (AVANT - INCORRECT)
CREATE FUNCTION search_knowledge_base_flexible(...)
RETURNS TABLE (
  subcategory text,  -- Déclare TEXT
  ...
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.subcategory,  -- ❌ Retourne VARCHAR(50) dans colonne TEXT
    ...
  FROM knowledge_base kb;
END;
$$;
```

**Incohérence** : `varchar(50)` → `text` (cast implicite)

---

## ✅ Solution

### Pattern Standard
**Toujours caster explicitement** quand type colonne ≠ type retour :

```sql
CREATE FUNCTION search_knowledge_base_flexible(...)
RETURNS TABLE (
  subcategory text,  -- Type retour: TEXT
  ...
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.subcategory::text,  -- ✅ Cast explicite VARCHAR(50) → TEXT
    ...
  FROM knowledge_base kb;
END;
$$;
```

---

## 📋 Règles de Typage

### Quand Caster ?

| Colonne DB | RETURNS TABLE | Action |
|------------|---------------|--------|
| `varchar(50)` | `varchar(50)` | ✅ OK, pas de cast |
| `varchar(50)` | `character varying` | ✅ OK, pas de cast |
| `varchar(50)` | `text` | ⚠️ **CAST REQUIS** : `::text` |
| `text` | `varchar(50)` | ⚠️ **CAST REQUIS** : `::varchar(50)` |

### Casts Courants

```sql
-- Types numériques
column::integer
column::bigint
column::double precision
column::float

-- Types texte
column::text
column::varchar(N)
column::character varying(N)

-- Types dates
column::date
column::timestamp
column::timestamptz

-- Types custom
column::uuid
column::jsonb
```

---

## 🔍 Détection

### 1. Vérifier Schéma DB
```sql
SELECT
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'knowledge_base'
  AND column_name = 'subcategory';

-- Résultat attendu:
-- subcategory | character varying | 50
```

### 2. Vérifier Signature Fonction
```sql
SELECT
  proname AS function_name,
  pg_get_function_result(oid) AS return_type
FROM pg_proc
WHERE proname = 'search_knowledge_base_flexible'
  AND pronamespace = 'public'::regnamespace;

-- Résultat attendu:
-- return_type: TABLE(..., subcategory text, ...)
```

### 3. Comparer Types
Si `data_type` (DB) ≠ `return_type` (fonction) → **Cast explicite requis**

---

## 🛠️ Corrections Appliquées (Feb 16, 2026)

### Fichiers Corrigés

1. **`migrations/20260215_kb_approval.sql`**
   - Fonction : `search_knowledge_base_flexible`
   - Lignes : 54, 76
   - Fix : `kb.subcategory` → `kb.subcategory::text`

2. **`migrations/2026-02-12-add-openai-embeddings.sql`**
   - Fonction : `search_knowledge_base_flexible`
   - Lignes : 69, 91
   - Fix : `kb.subcategory` → `kb.subcategory::text`

3. **`db/migrations/20260207000001_knowledge_base_categories.sql`**
   - Fonction : `search_knowledge_base`
   - Ligne : 185
   - Fix : `kb.subcategory` → `kb.subcategory::text`

### Migration Production
```bash
# Appliquer migration
psql -U moncabinet -d qadhya -f migrations/20260216_fix_subcategory_type_casting.sql

# Valider
psql -U moncabinet -d qadhya -f scripts/validate-sql-function-types.sql
```

---

## 📊 Impact

### Avant
- ⚠️ Cast implicite PostgreSQL (`varchar` → `text`)
- ⚠️ Warnings potentiels selon version PostgreSQL
- ⚠️ Typage incohérent (code pas clair)

### Après
- ✅ Cast explicite (`kb.subcategory::text`)
- ✅ Aucun warning PostgreSQL
- ✅ Typage strict et documenté
- ✅ Cohérent avec pattern existant (`kb.category::text`)

---

## 🎯 Best Practices

### ✅ À Faire
- **Toujours** caster explicitement si types différents
- Vérifier schéma DB avant écrire fonctions
- Utiliser `::text` pour colonnes VARCHAR retournées en TEXT
- Tester fonctions après création :
  ```sql
  SELECT pg_typeof(column) FROM function_name(...);
  ```

### ❌ À Éviter
- Compter sur cast implicite PostgreSQL
- Mélanger `varchar(50)` et `text` sans cast
- Copier-coller code sans vérifier types

---

## 🔗 Références

### Scripts
- **Migration** : `migrations/20260216_fix_subcategory_type_casting.sql`
- **Validation** : `scripts/validate-sql-function-types.sql`

### Documentation
- **Bug Fix** : `memory/bugs-fixes.md` (Feb 16, 2026)
- **PostgreSQL Docs** : https://www.postgresql.org/docs/current/typeconv.html

### Fonctions Affectées
- `search_knowledge_base_flexible()`
- `search_knowledge_base()`
- `search_knowledge_base_hybrid()` ✅ Déjà correct
- `find_related_documents()` ✅ Déjà correct (retourne varchar)

---

## 📝 Checklist Nouvelle Fonction

Avant de créer une fonction SQL :

- [ ] Vérifier types colonnes DB (`information_schema.columns`)
- [ ] Déclarer RETURNS TABLE avec types exacts
- [ ] Caster colonnes si types différents (`column::type`)
- [ ] Tester typage avec `pg_typeof()`
- [ ] Documenter casts non-évidents (commentaire SQL)

---

**Auteur** : Claude Code
**Version** : 1.0
**Dernière mise à jour** : 16 février 2026
