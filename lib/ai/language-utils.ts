/**
 * Utilitaires de détection de langue AR/FR
 *
 * Détecte la langue dominante d'un texte pour la recherche bilingue.
 */

// Plage Unicode des caractères arabes
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g

// Plage des caractères latins (inclut accents français)
const LATIN_RANGE = /[A-Za-zÀ-ÿ]/g

export type DetectedLanguage = 'ar' | 'fr' | 'mixed'

/**
 * Détecte la langue dominante d'un texte
 *
 * @param text - Texte à analyser
 * @returns 'ar' pour arabe, 'fr' pour français/latin, 'mixed' pour mélange
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.length === 0) {
    return 'fr' // Défaut français
  }

  // Compter les caractères de chaque type
  const arabicMatches = text.match(ARABIC_RANGE)
  const latinMatches = text.match(LATIN_RANGE)

  const arabicCount = arabicMatches?.length || 0
  const latinCount = latinMatches?.length || 0

  // Calculer les ratios
  const totalChars = arabicCount + latinCount

  if (totalChars === 0) {
    return 'fr' // Défaut si seulement des chiffres/symboles
  }

  const arabicRatio = arabicCount / totalChars
  const latinRatio = latinCount / totalChars

  // Seuils de détection
  if (arabicRatio > 0.7) {
    return 'ar'
  }

  if (latinRatio > 0.7) {
    return 'fr'
  }

  return 'mixed'
}

/**
 * Vérifie si un texte contient de l'arabe
 */
export function containsArabic(text: string): boolean {
  return ARABIC_RANGE.test(text)
}

/**
 * Vérifie si un texte contient du français/latin
 */
export function containsFrench(text: string): boolean {
  return LATIN_RANGE.test(text)
}

/**
 * Retourne la langue opposée pour la traduction
 */
export function getOppositeLanguage(lang: DetectedLanguage): 'ar' | 'fr' {
  if (lang === 'ar') return 'fr'
  if (lang === 'fr') return 'ar'
  // Pour mixed, on traduit vers l'arabe (plus de contenu KB en arabe)
  return 'ar'
}

/**
 * Nettoie un texte pour la détection de langue
 * Supprime les chiffres, ponctuation, espaces multiples
 */
export function cleanTextForDetection(text: string): string {
  return text
    .replace(/[0-9]/g, '') // Supprimer chiffres
    .replace(/[^\p{L}\s]/gu, '') // Garder lettres et espaces
    .replace(/\s+/g, ' ') // Normaliser espaces
    .trim()
}

/**
 * Analyse détaillée de la composition linguistique
 */
export function analyzeLanguageComposition(text: string): {
  language: DetectedLanguage
  arabicPercentage: number
  frenchPercentage: number
  arabicCount: number
  frenchCount: number
} {
  const arabicMatches = text.match(ARABIC_RANGE)
  const latinMatches = text.match(LATIN_RANGE)

  const arabicCount = arabicMatches?.length || 0
  const frenchCount = latinMatches?.length || 0
  const total = arabicCount + frenchCount

  const arabicPercentage = total > 0 ? (arabicCount / total) * 100 : 0
  const frenchPercentage = total > 0 ? (frenchCount / total) * 100 : 0

  return {
    language: detectLanguage(text),
    arabicPercentage: Math.round(arabicPercentage * 10) / 10,
    frenchPercentage: Math.round(frenchPercentage * 10) / 10,
    arabicCount,
    frenchCount,
  }
}
