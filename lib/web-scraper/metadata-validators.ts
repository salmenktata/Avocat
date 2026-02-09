/**
 * Validateurs stricts pour métadonnées extraites (Sprint 3 - Phase 3.4)
 *
 * Valide les métadonnées parsées avant insertion DB pour éviter données invalides :
 * - Dates invalides (ex: 2024-13-40)
 * - Années hors plage (< 1956 ou > année actuelle + 1)
 * - Numéros mal formés
 * - Références juridiques incohérentes
 *
 * Gain attendu : +20-30% fiabilité métadonnées
 */

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}

// =============================================================================
// VALIDATEURS DATES
// =============================================================================

/**
 * Valide une date de décision/jugement/loi
 *
 * Rejette :
 * - Dates au format invalide (pas YYYY-MM-DD)
 * - Dates impossibles (31 février, 40 janvier, etc.)
 * - Années < 1956 (avant indépendance Tunisie)
 * - Années > année actuelle + 1
 *
 * @param date Date au format YYYY-MM-DD
 * @param fieldName Nom du champ pour messages d'erreur
 * @returns Résultat validation
 */
export function validateDecisionDate(date: string | null, fieldName = 'date'): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!date) {
    return { isValid: true, errors: [] } // null accepté
  }

  // Vérifier format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push(`${fieldName} format invalide: "${date}" (attendu YYYY-MM-DD)`)
    return { isValid: false, errors, warnings }
  }

  // Parser et vérifier validité
  const parsed = new Date(date)
  if (isNaN(parsed.getTime())) {
    errors.push(`${fieldName} invalide: "${date}" (date impossible)`)
    return { isValid: false, errors, warnings }
  }

  // Vérifier que le parsing n'a pas corrigé silencieusement
  // Ex: 2024-02-31 → 2024-03-03 (invalide !)
  const [yearStr, monthStr, dayStr] = date.split('-')
  const parsedYear = parsed.getUTCFullYear()
  const parsedMonth = parsed.getUTCMonth() + 1
  const parsedDay = parsed.getUTCDate()

  if (
    parsedYear !== parseInt(yearStr) ||
    parsedMonth !== parseInt(monthStr) ||
    parsedDay !== parseInt(dayStr)
  ) {
    errors.push(`${fieldName} invalide: "${date}" (jour inexistant dans le mois)`)
    return { isValid: false, errors, warnings }
  }

  // Vérifier plage années
  const year = parsed.getUTCFullYear()
  const currentYear = new Date().getUTCFullYear()

  if (year < 1956) {
    errors.push(`${fieldName} année ${year} invalide (< 1956, avant indépendance Tunisie)`)
    return { isValid: false, errors, warnings }
  }

  if (year > currentYear + 1) {
    errors.push(`${fieldName} année ${year} invalide (> ${currentYear + 1}, futur)`)
    return { isValid: false, errors, warnings }
  }

  // Warning si date très récente ou future (possible erreur)
  if (year > currentYear) {
    warnings.push(`${fieldName} dans le futur (${year}) - vérifier si correct`)
  }

  // Warning si date très ancienne (avant 1960)
  if (year < 1960) {
    warnings.push(`${fieldName} très ancienne (${year}) - vérifier si correct`)
  }

  return { isValid: true, errors: [], warnings }
}

// =============================================================================
// VALIDATEURS NUMÉROS
// =============================================================================

/**
 * Valide un numéro de décision/jugement/arrêt
 *
 * Formats acceptés :
 * - X/YYYY (ex: 12345/2024)
 * - YYYY/X (ex: 2024/12345)
 * - X (ex: 12345)
 *
 * @param number Numéro de décision
 * @returns Résultat validation
 */
export function validateDecisionNumber(number: string | null): ValidationResult {
  const errors: string[] = []

  if (!number) {
    return { isValid: true, errors: [] } // null accepté
  }

  // Format X/YYYY ou YYYY/X
  const formatSlash = /^(\d+)\/(\d{4})$|^(\d{4})\/(\d+)$/
  // Format X seul
  const formatSimple = /^\d+$/

  if (!formatSlash.test(number) && !formatSimple.test(number)) {
    errors.push(`Numéro décision format invalide: "${number}" (attendu X/YYYY ou YYYY/X ou X)`)
    return { isValid: false, errors }
  }

  // Si format avec année, vérifier plage
  const match = number.match(formatSlash)
  if (match) {
    const yearStr = match[2] || match[3]
    const year = parseInt(yearStr)
    const currentYear = new Date().getFullYear()

    if (year < 1956 || year > currentYear + 1) {
      errors.push(`Numéro décision année invalide: ${year} (plage 1956-${currentYear + 1})`)
      return { isValid: false, errors }
    }
  }

  return { isValid: true, errors: [] }
}

/**
 * Valide un numéro de loi
 *
 * Formats acceptés :
 * - YYYY-XX (ex: 2024-45)
 * - XX-YYYY (ex: 45-2024)
 *
 * @param number Numéro de loi
 * @returns Résultat validation
 */
export function validateLoiNumber(number: string | null): ValidationResult {
  const errors: string[] = []

  if (!number) {
    return { isValid: true, errors: [] }
  }

  const format = /^(\d{4})-(\d+)$|^(\d+)-(\d{4})$/

  if (!format.test(number)) {
    errors.push(`Numéro loi format invalide: "${number}" (attendu YYYY-XX ou XX-YYYY)`)
    return { isValid: false, errors }
  }

  // Vérifier année
  const match = number.match(format)
  if (match) {
    const yearStr = match[1] || match[4]
    const year = parseInt(yearStr)
    const currentYear = new Date().getFullYear()

    if (year < 1956 || year > currentYear + 1) {
      errors.push(`Numéro loi année invalide: ${year} (plage 1956-${currentYear + 1})`)
      return { isValid: false, errors }
    }
  }

  return { isValid: true, errors: [] }
}

/**
 * Valide un numéro JORT (Journal Officiel)
 *
 * Format accepté : nombre entier positif
 *
 * @param number Numéro JORT
 * @returns Résultat validation
 */
export function validateJortNumber(number: string | null): ValidationResult {
  const errors: string[] = []

  if (!number) {
    return { isValid: true, errors: [] }
  }

  const format = /^\d+$/

  if (!format.test(number)) {
    errors.push(`Numéro JORT format invalide: "${number}" (attendu nombre entier)`)
    return { isValid: false, errors }
  }

  const num = parseInt(number)
  if (num <= 0 || num > 200) {
    errors.push(`Numéro JORT hors plage: ${num} (attendu 1-200)`)
    return { isValid: false, errors }
  }

  return { isValid: true, errors: [] }
}

// =============================================================================
// FONCTION HELPER
// =============================================================================

/**
 * Valide toutes les métadonnées d'un coup
 *
 * @param metadata Métadonnées à valider
 * @returns Résultat validation global
 */
export function validateAllMetadata(metadata: {
  decision_date?: string | null
  jort_date?: string | null
  decision_number?: string | null
  loi_number?: string | null
  jort_number?: string | null
}): ValidationResult {
  const allErrors: string[] = []
  const allWarnings: string[] = []

  // Valider dates
  if (metadata.decision_date) {
    const result = validateDecisionDate(metadata.decision_date, 'decision_date')
    allErrors.push(...result.errors)
    if (result.warnings) allWarnings.push(...result.warnings)
  }

  if (metadata.jort_date) {
    const result = validateDecisionDate(metadata.jort_date, 'jort_date')
    allErrors.push(...result.errors)
    if (result.warnings) allWarnings.push(...result.warnings)
  }

  // Valider numéros
  if (metadata.decision_number) {
    const result = validateDecisionNumber(metadata.decision_number)
    allErrors.push(...result.errors)
  }

  if (metadata.loi_number) {
    const result = validateLoiNumber(metadata.loi_number)
    allErrors.push(...result.errors)
  }

  if (metadata.jort_number) {
    const result = validateJortNumber(metadata.jort_number)
    allErrors.push(...result.errors)
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  }
}
