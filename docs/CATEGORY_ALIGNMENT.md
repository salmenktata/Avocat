# 🎯 Alignement des Catégories Juridiques

## Vue d'ensemble

Ce document décrit le système centralisé de catégories juridiques dans l'application Qadhya. Toutes les catégories sont maintenant alignées à travers les différents systèmes (Web Sources, Knowledge Base, RAG, Classification, Filtres).

## 🏗️ Architecture

### Fichier Central

**`lib/categories/legal-categories.ts`** - Système unifié contenant :

- `LegalCategory` : Type principal avec 15 catégories
- `LEGAL_CATEGORY_TRANSLATIONS` : Traductions FR/AR
- `LEGAL_CATEGORY_COLORS` : Couleurs Tailwind pour chaque catégorie
- `LEGAL_CATEGORY_ICONS` : Icônes Lucide pour chaque catégorie
- `LEGAL_CATEGORY_DESCRIPTIONS` : Descriptions bilingues
- Fonctions utilitaires : `getLegalCategoryLabel()`, `getCategoriesForContext()`, etc.

### Mapping par Système

```typescript
// Type central
type LegalCategory = 'legislation' | 'jurisprudence' | ... | 'autre'

// Alias pour chaque système
type WebSourceCategory = LegalCategory
type KnowledgeCategory = Exclude<LegalCategory, 'google_drive' | 'actualites'>
type LegalContentCategory = Exclude<LegalCategory, 'codes' | 'constitution' | ... >
```

## 📋 Catégories (15 total)

| Catégorie | 🇫🇷 Français | 🇸🇦 العربية | Web | KB | Classif | Couleur |
|-----------|------------|------------|:---:|:--:|:-------:|---------|
| `legislation` | Législation | التشريع | ✅ | ✅ | ✅ | Bleu |
| `jurisprudence` | Jurisprudence | فقه القضاء | ✅ | ✅ | ✅ | Violet |
| `doctrine` | Doctrine | الفقه | ✅ | ✅ | ✅ | Vert |
| `jort` | JORT | الرائد الرسمي | ✅ | ✅ | ✅ | Rouge |
| `modeles` | Modèles | النماذج | ✅ | ✅ | ✅ | Orange |
| `procedures` | Procédures | الإجراءات | ✅ | ✅ | ✅ | Cyan |
| `formulaires` | Formulaires | الاستمارات | ✅ | ✅ | ✅ | Jaune |
| `codes` | Codes juridiques | المجلات القانونية | ✅ | ✅ | ❌ | Indigo |
| `constitution` | Constitution | الدستور | ✅ | ✅ | ❌ | Rose |
| `conventions` | Conventions internationales | الاتفاقيات الدولية | ✅ | ✅ | ❌ | Teal |
| `guides` | Guides pratiques | الأدلة | ✅ | ✅ | ❌ | Lime |
| `lexique` | Lexique juridique | المصطلحات | ✅ | ✅ | ❌ | Émeraude |
| `actualites` | Actualités | الأخبار | ✅ | ❌ | ✅ | Ambre |
| `google_drive` | Google Drive | مستندات جوجل درايف | ✅ | ❌ | ❌ | Violet |
| `autre` | Autres | أخرى | ✅ | ✅ | ✅ | Gris |

### Contextes d'utilisation

- **Web Sources** : Toutes les catégories (15)
- **Knowledge Base** : Exclut `google_drive`, `actualites` (13)
- **Classification** : Exclut les catégories spécifiques web (`codes`, `constitution`, etc.) (9)

## 🔧 Utilisation

### 1. Obtenir le label traduit

```typescript
import { getLegalCategoryLabel } from '@/lib/categories/legal-categories'
import { useLocale } from 'next-intl'

const locale = useLocale() as 'fr' | 'ar'
const label = getLegalCategoryLabel('legislation', locale)
// FR: "Législation"
// AR: "التشريع"
```

### 2. Obtenir toutes les catégories pour un contexte

```typescript
import { getCategoriesForContext } from '@/lib/categories/legal-categories'

// Pour les sources web
const webCategories = getCategoriesForContext('web_sources', 'fr', true)
// 16 items (15 catégories + option "Toutes")

// Pour la base de connaissances
const kbCategories = getCategoriesForContext('knowledge_base', 'ar')
// 13 items (exclut google_drive, actualites)

// Pour la classification
const classifCategories = getCategoriesForContext('classification', 'fr')
// 9 items (catégories principales uniquement)
```

### 3. Badge de catégorie avec couleur

```typescript
import { getLegalCategoryColor, getLegalCategoryIcon } from '@/lib/categories/legal-categories'

const color = getLegalCategoryColor('jurisprudence', true)
// "bg-purple-500/20 text-purple-400 border-purple-500/30"

const icon = getLegalCategoryIcon('legislation')
// "scale"
```

### 4. Composant CategoryBadge (Web Sources)

```tsx
import { CategoryBadge } from '@/components/super-admin/web-sources/CategoryBadge'

<CategoryBadge category="legislation" />
// Affiche automatiquement le label traduit selon la langue de l'utilisateur
```

### 5. Filtres avec Select

```tsx
import { getCategoriesForContext } from '@/lib/categories/legal-categories'
import { useLocale } from 'next-intl'
import { useMemo } from 'react'

export function CategoryFilter() {
  const locale = useLocale() as 'fr' | 'ar'
  const categories = useMemo(
    () => getCategoriesForContext('web_sources', locale, true),
    [locale]
  )

  return (
    <Select>
      {categories.map(cat => (
        <SelectItem key={cat.value} value={cat.value}>
          {cat.label}
        </SelectItem>
      ))}
    </Select>
  )
}
```

## 🔄 Rétrocompatibilité

### Anciennes catégories KB

Le système gère automatiquement la normalisation des anciennes catégories :

```typescript
import { normalizeLegalCategory } from '@/lib/categories/legal-categories'

normalizeLegalCategory('code')   // → 'codes'
normalizeLegalCategory('modele') // → 'modeles'
```

### Fichiers dépréciés

Les anciens fichiers sont conservés pour compatibilité mais redirigent vers le système central :

- ✅ `lib/web-scraper/category-labels.ts` (wrapper)
- ✅ `lib/web-scraper/types.ts` (re-export)
- ✅ `lib/knowledge-base/categories.ts` (enrichi avec sys. central)

## ✅ Tests

### Test d'alignement complet

```bash
npm run test:category-alignment
```

Vérifie :
1. ✅ Cohérence des traductions FR/AR
2. ✅ Fonctions de contexte (web, KB, classification)
3. ✅ Fonctions utilitaires
4. ✅ Normalisation des anciennes catégories
5. ✅ Complétude des traductions
6. ✅ Options de catégories

### Test traductions de base

```bash
npm run test:categories
```

Vérifie uniquement les traductions web sources (ancien test).

## 📊 Systèmes Alignés

| Système | Fichier | Statut |
|---------|---------|--------|
| **Web Sources** | `lib/web-scraper/types.ts` | ✅ Aligné |
| **Knowledge Base** | `lib/knowledge-base/categories.ts` | ✅ Aligné |
| **Classification** | `LegalContentCategory` type | ✅ Aligné |
| **RAG Search** | Utilise le système central | ✅ Aligné |
| **Filtres** | Composants `WebSourcesFilters`, etc. | ✅ Aligné |

## 🎨 Couleurs & Icônes

Chaque catégorie a :
- **Couleur unique** : Format Tailwind avec transparence (`bg-{color}-500/20`)
- **Icône Lucide** : Icône sémantique (`scale`, `gavel`, `book-open`, etc.)
- **Badge solide** : Couleur sans transparence pour badges simples

### Palette complète

```typescript
{
  legislation: { color: 'bleu', icon: 'scale' },
  jurisprudence: { color: 'violet', icon: 'gavel' },
  doctrine: { color: 'vert', icon: 'book-open' },
  jort: { color: 'rouge', icon: 'newspaper' },
  modeles: { color: 'orange', icon: 'file-text' },
  procedures: { color: 'cyan', icon: 'clipboard-list' },
  formulaires: { color: 'jaune', icon: 'file-input' },
  codes: { color: 'indigo', icon: 'book' },
  constitution: { color: 'rose', icon: 'scroll' },
  conventions: { color: 'teal', icon: 'handshake' },
  guides: { color: 'lime', icon: 'compass' },
  lexique: { color: 'emerald', icon: 'book-a' },
  actualites: { color: 'ambre', icon: 'rss' },
  google_drive: { color: 'violet', icon: 'cloud' },
  autre: { color: 'gris', icon: 'file' },
}
```

## 🚀 Ajout d'une Nouvelle Catégorie

1. **Ajouter dans le type central** (`lib/categories/legal-categories.ts`) :

```typescript
export type LegalCategory =
  | 'legislation'
  // ...
  | 'ma_nouvelle_categorie'  // ← Ajouter ici
```

2. **Ajouter les traductions** :

```typescript
export const LEGAL_CATEGORY_TRANSLATIONS: Record<LegalCategory, { ar: string; fr: string }> = {
  // ...
  ma_nouvelle_categorie: { ar: 'فئتي الجديدة', fr: 'Ma nouvelle catégorie' },
}
```

3. **Ajouter couleur et icône** :

```typescript
export const LEGAL_CATEGORY_COLORS: Record<LegalCategory, string> = {
  // ...
  ma_nouvelle_categorie: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
}

export const LEGAL_CATEGORY_ICONS: Record<LegalCategory, string> = {
  // ...
  ma_nouvelle_categorie: 'sparkles',
}
```

4. **Ajouter la description** :

```typescript
export const LEGAL_CATEGORY_DESCRIPTIONS: Record<LegalCategory, { ar: string; fr: string }> = {
  // ...
  ma_nouvelle_categorie: {
    ar: 'وصف بالعربية',
    fr: 'Description en français',
  },
}
```

5. **Mettre à jour les alias de types** (si nécessaire) :

```typescript
// Si la nouvelle catégorie n'est pas disponible dans KB par exemple
export type KnowledgeCategory = Exclude<LegalCategory, 'google_drive' | 'actualites' | 'ma_nouvelle_categorie'>
```

6. **Tester** :

```bash
npm run test:category-alignment
```

7. **Migration DB** (si nécessaire) :

```sql
ALTER TABLE web_sources
DROP CONSTRAINT IF EXISTS web_sources_category_check;

ALTER TABLE web_sources
ADD CONSTRAINT web_sources_category_check
CHECK (category IN ('legislation', 'jurisprudence', ..., 'ma_nouvelle_categorie'));
```

## 📚 Ressources

- [Traductions Web Sources](./CATEGORY_TRANSLATIONS.md)
- [Système central](../lib/categories/legal-categories.ts)
- [Tests d'alignement](../scripts/test-category-alignment.ts)
- [MEMORY.md - Architecture](../.claude/projects/-Users-salmenktata-Projets-GitHub-Avocat/memory/MEMORY.md)

## 🎯 Avantages de l'Alignement

✅ **Source unique de vérité** : Une seule définition pour toutes les catégories
✅ **Traductions cohérentes** : Mêmes labels FR/AR partout
✅ **Couleurs uniformes** : Design system cohérent
✅ **Maintenance facile** : Modification en un seul endroit
✅ **Type-safe** : TypeScript garantit la cohérence
✅ **Rétrocompatible** : Supporte les anciennes catégories
✅ **Testable** : Scripts de validation automatiques
✅ **Contextualisé** : Catégories adaptées à chaque usage

---

**Dernière mise à jour** : 10 février 2026
**Version** : 1.0.0
