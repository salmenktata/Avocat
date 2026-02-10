# 🌐 Traductions des Catégories de Sources Web

## Vue d'ensemble

Ce document explique comment fonctionne le système de traduction des catégories de sources web en français et en arabe dans l'application Qadhya.

## Architecture

### Fichiers principaux

1. **`lib/web-scraper/types.ts`**
   - Définit l'enum `WebSourceCategory` avec toutes les catégories disponibles
   - Contient `CATEGORY_TRANSLATIONS` avec les traductions FR/AR

2. **`lib/web-scraper/category-labels.ts`**
   - Utilitaire pour obtenir les labels traduits
   - Fonctions: `getCategoryLabel()` et `getAllCategoryOptions()`
   - Définit les couleurs pour chaque catégorie (`CATEGORY_COLORS`)

3. **Composants modifiés**
   - `components/super-admin/web-sources/WebSourcesList.tsx`
   - `components/super-admin/web-sources/WebSourcesFilters.tsx`
   - `components/super-admin/web-sources/CategoryBadge.tsx` (nouveau)
   - `components/super-admin/web-sources/AddWebSourceWizard.tsx`
   - `app/super-admin/web-sources/[id]/page.tsx`

## Catégories disponibles

| Clé | 🇫🇷 Français | 🇸🇦 العربية |
|-----|------------|------------|
| `legislation` | Textes législatifs | النصوص القانونية |
| `jurisprudence` | Jurisprudence | الفقه القضائي |
| `doctrine` | Doctrine | الفقه |
| `jort` | Journal Officiel (JORT) | الجريدة الرسمية |
| `codes` | Codes juridiques | المجلات القانونية |
| `constitution` | Constitutions | الدساتير |
| `conventions` | Conventions internationales | الاتفاقيات الدولية |
| `modeles` | Modèles de documents | النماذج |
| `procedures` | Procédures | الإجراءات |
| `formulaires` | Formulaires | الاستمارات |
| `guides` | Guides pratiques | الأدلة |
| `lexique` | Lexique juridique | المصطلحات |
| `google_drive` | Google Drive | مستندات جوجل درايف |
| `autre` | Autres | أخرى |

## Utilisation

### 1. Dans un composant client

```tsx
'use client'

import { useLocale } from 'next-intl'
import { getCategoryLabel } from '@/lib/web-scraper/category-labels'
import type { WebSourceCategory } from '@/lib/web-scraper/types'

export function MyComponent({ category }: { category: WebSourceCategory }) {
  const locale = useLocale() as 'fr' | 'ar'

  return (
    <div>
      {getCategoryLabel(category, locale)}
    </div>
  )
}
```

### 2. Badge de catégorie

Pour afficher un badge avec la couleur appropriée :

```tsx
import { CategoryBadge } from '@/components/super-admin/web-sources/CategoryBadge'

export function MyComponent({ category }: { category: string }) {
  return <CategoryBadge category={category} />
}
```

### 3. Liste déroulante (Select)

Pour afficher toutes les catégories dans un select :

```tsx
'use client'

import { useLocale } from 'next-intl'
import { useMemo } from 'react'
import { getAllCategoryOptions } from '@/lib/web-scraper/category-labels'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function CategorySelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const locale = useLocale() as 'fr' | 'ar'
  const categories = useMemo(() => getAllCategoryOptions(locale), [locale])

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {categories.map((cat) => (
          <SelectItem key={cat.value} value={cat.value}>
            {cat.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

## Couleurs des catégories

Chaque catégorie a une couleur associée définie dans `CATEGORY_COLORS` :

- **Législation** : Bleu (`bg-blue-500/20`)
- **Jurisprudence** : Violet (`bg-purple-500/20`)
- **Doctrine** : Vert (`bg-green-500/20`)
- **JORT** : Rouge (`bg-red-500/20`)
- **Codes** : Indigo (`bg-indigo-500/20`)
- **Constitution** : Rose (`bg-pink-500/20`)
- **Conventions** : Teal (`bg-teal-500/20`)
- **Modèles** : Orange (`bg-orange-500/20`)
- **Procédures** : Cyan (`bg-cyan-500/20`)
- **Formulaires** : Jaune (`bg-yellow-500/20`)
- **Guides** : Lime (`bg-lime-500/20`)
- **Lexique** : Émeraude (`bg-emerald-500/20`)
- **Google Drive** : Violet (`bg-violet-500/20`)
- **Autre** : Gris (`bg-slate-500/20`)

## Tests

Pour vérifier que les traductions fonctionnent correctement :

```bash
npm run test:categories
```

Ce script vérifie :
1. ✅ Toutes les catégories ont des traductions FR et AR
2. ✅ La fonction `getCategoryLabel()` retourne les bonnes valeurs
3. ✅ La fonction `getAllCategoryOptions()` retourne le même nombre d'options pour FR et AR

## Ajout d'une nouvelle catégorie

Pour ajouter une nouvelle catégorie :

1. **Ajouter à l'enum dans `lib/web-scraper/types.ts`** :
```typescript
export type WebSourceCategory =
  | 'legislation'
  | 'jurisprudence'
  | 'ma_nouvelle_categorie'  // ← Ajouter ici
  | ...
```

2. **Ajouter les traductions dans `CATEGORY_TRANSLATIONS`** :
```typescript
export const CATEGORY_TRANSLATIONS: Record<WebSourceCategory, { ar: string; fr: string }> = {
  // ...
  ma_nouvelle_categorie: { ar: 'فئتي الجديدة', fr: 'Ma nouvelle catégorie' },
}
```

3. **Ajouter une couleur dans `lib/web-scraper/category-labels.ts`** :
```typescript
export const CATEGORY_COLORS: Record<string, string> = {
  // ...
  ma_nouvelle_categorie: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}
```

4. **Ajouter dans `getAllCategoryOptions()`** :
```typescript
export function getAllCategoryOptions(locale: Locale = 'fr') {
  return [
    { value: 'all', label: locale === 'ar' ? 'جميع الفئات' : 'Toutes les catégories' },
    // ...
    { value: 'ma_nouvelle_categorie', label: getCategoryLabel('ma_nouvelle_categorie', locale) },
  ]
}
```

5. **Tester** :
```bash
npm run test:categories
```

## Migration base de données

Si nécessaire, créer une migration pour ajouter la nouvelle catégorie :

```sql
-- migrations/YYYYMMDD_add_new_category.sql
ALTER TABLE web_sources
DROP CONSTRAINT IF EXISTS web_sources_category_check;

ALTER TABLE web_sources
ADD CONSTRAINT web_sources_category_check
CHECK (category IN (
  'legislation',
  'jurisprudence',
  'ma_nouvelle_categorie',  -- ← Ajouter ici
  ...
));
```

## Support RTL pour l'arabe

Les composants gèrent automatiquement la direction RTL (right-to-left) pour l'arabe grâce à l'attribut `dir`:

```tsx
<Input
  placeholder={locale === 'ar' ? 'البحث...' : 'Rechercher...'}
  dir={locale === 'ar' ? 'rtl' : 'ltr'}
/>
```

## Ressources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [MEMORY.md - Architecture du projet](/Users/salmenktata/.claude/projects/-Users-salmenktata-Projets-GitHub-Avocat/memory/MEMORY.md)
- [Types Web Scraper](../lib/web-scraper/types.ts)
