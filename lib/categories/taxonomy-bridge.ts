/**
 * Module pont entre le système de catégories TS et la taxonomie DB
 *
 * Résout les divergences de nommage entre les deux systèmes :
 * - TS (legal-categories.ts) = source de vérité pour les 15 catégories
 * - DB (legal_taxonomy) = données dynamiques (domaines, doc_types, tribunaux, chambres)
 *
 * Exemples de divergences :
 * - Domaine : TS `social` ↔ DB `travail` (même concept)
 * - Label : TS `JORT` ↔ DB `Journal Officiel (JORT)` (harmonisé par migration)
 */

import {
  LEGAL_CATEGORY_TRANSLATIONS,
  LEGACY_DOMAIN_MAPPING,
  type LegalCategory,
  isValidLegalCategory,
  getLegalCategoryLabel,
} from './legal-categories'

import {
  LEGAL_DOMAIN_TRANSLATIONS,
  type LegalDomain,
} from '@/lib/web-scraper/types'

// ============================================================================
// Mapping domaine TS ↔ DB
// ============================================================================

/**
 * Mapping TS → DB pour les codes domaines divergents
 * Ex: TS `social` → DB `travail`
 */
const TS_TO_DB_DOMAIN: Record<string, string> = {
  'social': 'travail',
}

/**
 * Mapping DB → TS pour les codes domaines divergents
 * (inverse de TS_TO_DB_DOMAIN + LEGACY_DOMAIN_MAPPING)
 */
const DB_TO_TS_DOMAIN: Record<string, string> = {
  ...LEGACY_DOMAIN_MAPPING,
}

// ============================================================================
// Fonctions publiques
// ============================================================================

/**
 * Normalise un code domaine provenant de la DB vers le code TS
 *
 * @example
 *   normalizeDomainFromDB('travail')  → 'social'
 *   normalizeDomainFromDB('civil')    → 'civil' (pas de mapping)
 *   normalizeDomainFromDB('inconnu')  → 'autre' (fallback)
 */
export function normalizeDomainFromDB(dbCode: string | null): LegalDomain | null {
  if (!dbCode) return null

  const normalized = dbCode.toLowerCase().trim()

  // 1. Chercher dans le mapping DB → TS
  if (DB_TO_TS_DOMAIN[normalized]) {
    return DB_TO_TS_DOMAIN[normalized] as LegalDomain
  }

  // 2. Vérifier si c'est un domaine TS valide directement
  if (normalized in LEGAL_DOMAIN_TRANSLATIONS) {
    return normalized as LegalDomain
  }

  // 3. Fallback
  return 'autre'
}

/**
 * Convertit un code domaine TS vers le code DB
 *
 * @example
 *   domainToDBCode('social')  → 'travail'
 *   domainToDBCode('civil')   → 'civil' (pas de mapping)
 */
export function domainToDBCode(tsCode: string): string {
  const normalized = tsCode.toLowerCase().trim()
  return TS_TO_DB_DOMAIN[normalized] || normalized
}

/**
 * Retourne le label unifié (FR ou AR) pour un code de catégorie ou domaine
 *
 * Stratégie : essaie d'abord le TS (source de vérité), sinon retourne le code formaté
 *
 * @example
 *   getUnifiedLabel('legislation', 'fr')  → 'Législation'
 *   getUnifiedLabel('legislation', 'ar')  → 'التشريع'
 *   getUnifiedLabel('civil', 'fr')        → 'Droit civil'
 *   getUnifiedLabel('civil', 'ar')        → 'القانون المدني'
 *   getUnifiedLabel('travail', 'ar')      → 'القانون الاجتماعي' (résolu via mapping)
 */
export function getUnifiedLabel(code: string, locale: 'fr' | 'ar' = 'ar'): string {
  if (!code) return locale === 'ar' ? 'غير محدد' : 'Non défini'

  const normalized = code.toLowerCase().trim()

  // 1. Essayer comme catégorie TS
  if (isValidLegalCategory(normalized)) {
    return getLegalCategoryLabel(normalized as LegalCategory, locale)
  }

  // 2. Essayer comme domaine TS (avec mapping DB→TS si nécessaire)
  const tsDomain = DB_TO_TS_DOMAIN[normalized] || normalized
  if (tsDomain in LEGAL_DOMAIN_TRANSLATIONS) {
    return LEGAL_DOMAIN_TRANSLATIONS[tsDomain as LegalDomain][locale]
  }

  // 3. Fallback : retourner le code formaté
  return code.replace(/_/g, ' ')
}

/**
 * Retourne le label arabe pour un code (raccourci fréquent dans l'admin)
 */
export function getArabicLabel(code: string): string {
  return getUnifiedLabel(code, 'ar')
}

/**
 * Retourne le label français pour un code
 */
export function getFrenchLabel(code: string): string {
  return getUnifiedLabel(code, 'fr')
}

/**
 * Vérifie si un code de catégorie existe dans le système TS
 */
export function isTSCategory(code: string): boolean {
  return isValidLegalCategory(code.toLowerCase().trim())
}

/**
 * Vérifie si un code de domaine existe dans le système TS
 */
export function isTSDomain(code: string): boolean {
  const normalized = code.toLowerCase().trim()
  const mapped = DB_TO_TS_DOMAIN[normalized] || normalized
  return mapped in LEGAL_DOMAIN_TRANSLATIONS
}

/**
 * Retourne toutes les catégories TS avec leurs labels bilingues
 * Utile pour les selects/filtres côté admin
 */
export function getAllCategoriesWithLabels(): Array<{
  code: LegalCategory
  labelFr: string
  labelAr: string
}> {
  return (Object.keys(LEGAL_CATEGORY_TRANSLATIONS) as LegalCategory[]).map((code) => ({
    code,
    labelFr: LEGAL_CATEGORY_TRANSLATIONS[code].fr,
    labelAr: LEGAL_CATEGORY_TRANSLATIONS[code].ar,
  }))
}

/**
 * Retourne tous les domaines TS avec leurs labels bilingues
 */
export function getAllDomainsWithLabels(): Array<{
  code: LegalDomain
  labelFr: string
  labelAr: string
}> {
  return (Object.keys(LEGAL_DOMAIN_TRANSLATIONS) as LegalDomain[]).map((code) => ({
    code,
    labelFr: LEGAL_DOMAIN_TRANSLATIONS[code].fr,
    labelAr: LEGAL_DOMAIN_TRANSLATIONS[code].ar,
  }))
}
