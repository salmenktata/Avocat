/**
 * Utilitaire pour obtenir les labels de catégories dans la langue appropriée
 * DÉPRÉCIÉ : Utiliser lib/categories/legal-categories.ts pour le nouveau système unifié
 *
 * Ce fichier est conservé pour rétrocompatibilité mais redirige vers le système central
 */

import {
  type WebSourceCategory,
  getLegalCategoryLabel,
  getLegalCategoryColor,
  getAllLegalCategories,
  getCategoriesForContext,
  LEGAL_CATEGORY_TRANSLATIONS,
} from '@/lib/categories/legal-categories'

type Locale = 'fr' | 'ar'

/**
 * @deprecated Utiliser getLegalCategoryLabel depuis @/lib/categories/legal-categories
 */
export function getCategoryLabel(category: WebSourceCategory, locale: Locale = 'fr'): string {
  return getLegalCategoryLabel(category, locale)
}

/**
 * Retourne toutes les catégories web sources avec leurs labels traduits
 */
export function getAllCategoryOptions(locale: Locale = 'fr') {
  return getCategoriesForContext('web_sources', locale, true)
}

/**
 * Mapping des couleurs par catégorie (avec transparence)
 * @deprecated Utiliser getLegalCategoryColor depuis @/lib/categories/legal-categories
 */
export const CATEGORY_COLORS: Record<string, string> = {
  legislation: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  jurisprudence: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  doctrine: 'bg-green-500/20 text-green-400 border-green-500/30',
  jort: 'bg-red-500/20 text-red-400 border-red-500/30',
  codes: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  constitution: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  conventions: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  modeles: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  procedures: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  formulaires: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  guides: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  lexique: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  google_drive: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  actualites: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  autre: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

/**
 * @deprecated Utiliser LEGAL_CATEGORY_TRANSLATIONS depuis @/lib/categories/legal-categories
 */
export { LEGAL_CATEGORY_TRANSLATIONS as CATEGORY_TRANSLATIONS }
