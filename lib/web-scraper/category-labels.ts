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
  LEGAL_CATEGORY_COLORS,
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
 * @deprecated Utiliser LEGAL_CATEGORY_COLORS depuis @/lib/categories/legal-categories
 */
export const CATEGORY_COLORS: Record<string, string> = LEGAL_CATEGORY_COLORS as Record<string, string>

/**
 * @deprecated Utiliser LEGAL_CATEGORY_TRANSLATIONS depuis @/lib/categories/legal-categories
 */
export { LEGAL_CATEGORY_TRANSLATIONS as CATEGORY_TRANSLATIONS }
