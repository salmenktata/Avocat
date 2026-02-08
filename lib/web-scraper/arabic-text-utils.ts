/**
 * Utilitaires de normalisation du texte arabe
 * Optimisé pour les textes juridiques tunisiens
 *
 * Normalise les variantes d'écriture arabe pour améliorer
 * la recherche et le matching dans le RAG
 */

export interface ArabicNormalizationOptions {
  /** Supprimer les diacritiques (tashkeel) — utile pour la recherche */
  stripDiacritics?: boolean
}

/**
 * Normalise le texte arabe pour la cohérence de recherche
 * - Unifie les variantes de lettres (alef, etc.)
 * - Convertit les chiffres arabes orientaux en chiffres occidentaux
 * - Nettoie les caractères invisibles Unicode
 * - Normalise l'espacement autour de la ponctuation arabe
 */
export function normalizeArabicText(
  text: string,
  options?: ArabicNormalizationOptions
): string {
  let result = text

  // B1. Normalisation des lettres arabes
  result = normalizeArabicLetters(result)

  // B2. Normalisation des chiffres arabes orientaux → occidentaux
  result = normalizeArabicDigits(result)

  // B3. Nettoyage des caractères invisibles et espaces arabes
  result = cleanArabicSpaces(result)

  // B4. Suppression optionnelle des diacritiques
  if (options?.stripDiacritics) {
    result = stripTashkeel(result)
  }

  return result
}

// =============================================================================
// B1. NORMALISATION DES LETTRES ARABES
// =============================================================================

/**
 * Unifie les variantes de lettres arabes
 * - Alef variants (آ أ إ ٱ) → ا
 * - Alef maqsura ى → ي
 * - NE NORMALISE PAS ة→ه (significations juridiques différentes en droit tunisien)
 */
function normalizeArabicLetters(text: string): string {
  return text
    // Alef avec hamza dessus أ → ا
    .replace(/\u0623/g, '\u0627')
    // Alef avec hamza dessous إ → ا
    .replace(/\u0625/g, '\u0627')
    // Alef avec madda آ → ا
    .replace(/\u0622/g, '\u0627')
    // Alef wasla ٱ → ا
    .replace(/\u0671/g, '\u0627')
    // Alef maqsura ى → ي
    .replace(/\u0649/g, '\u064A')
}

// =============================================================================
// B2. NORMALISATION DES CHIFFRES ARABES
// =============================================================================

/** Mapping chiffres arabes orientaux → occidentaux */
const ARABIC_DIGIT_MAP: Record<string, string> = {
  '\u0660': '0', // ٠
  '\u0661': '1', // ١
  '\u0662': '2', // ٢
  '\u0663': '3', // ٣
  '\u0664': '4', // ٤
  '\u0665': '5', // ٥
  '\u0666': '6', // ٦
  '\u0667': '7', // ٧
  '\u0668': '8', // ٨
  '\u0669': '9', // ٩
}

/**
 * Convertit les chiffres arabes orientaux (٠١٢٣٤٥٦٧٨٩) en chiffres occidentaux
 * Essentiel pour la cohérence des numéros d'articles (الفصل ١٢٣ → الفصل 123)
 */
function normalizeArabicDigits(text: string): string {
  return text.replace(/[\u0660-\u0669]/g, (char) => ARABIC_DIGIT_MAP[char] || char)
}

// =============================================================================
// B3. NETTOYAGE DES ESPACES ET CARACTÈRES INVISIBLES
// =============================================================================

/**
 * Nettoie les caractères invisibles Unicode et normalise l'espacement arabe
 * - Supprime ZWJ, ZWNJ, zero-width space, BOM
 * - Supprime les marques directionnelles RTL/LTR
 * - Normalise l'espacement autour de la ponctuation arabe (، ؛ ؟)
 */
function cleanArabicSpaces(text: string): string {
  return text
    // Supprimer zero-width joiner/non-joiner et zero-width space
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    // Supprimer les marques directionnelles RTL/LTR
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    // Normaliser espacement avant la ponctuation arabe (pas d'espace avant)
    .replace(/\s+([،؛؟])/g, '$1')
    // Normaliser espacement après la ponctuation arabe (un seul espace après)
    .replace(/([،؛؟])\s*/g, '$1 ')
}

// =============================================================================
// B4. DIACRITIQUES (TASHKEEL)
// =============================================================================

/**
 * Supprime les diacritiques arabes (tashkeel/harakat)
 * Utile pour la recherche : permet de matcher "كِتَاب" avec "كتاب"
 *
 * Supprime : fathah, dammah, kasrah, sukun, shadda, tanwin, etc.
 */
export function stripTashkeel(text: string): string {
  // Unicode range 0x064B-0x065F couvre tous les diacritiques arabes
  // + 0x0670 (superscript alef) + 0x06D6-0x06DC (Quran marks)
  return text.replace(/[\u064B-\u065F\u0670\u06D6-\u06DC]/g, '')
}

// =============================================================================
// POST-OCR NETTOYAGE
// =============================================================================

/**
 * Nettoie le texte arabe après OCR
 * Corrige les artefacts courants produits par Tesseract sur du texte arabe
 */
export function cleanArabicOcrText(text: string): string {
  return text
    // Supprimer les points isolés (artefact OCR fréquent sur documents scannés)
    .replace(/(?<=\s|^)\.(?=\s|$)/g, '')
    // Supprimer les zero-width chars insérés par l'OCR
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    // Corriger les séquences kashida/tatweel multiples (ـــ → ـ)
    .replace(/\u0640{2,}/g, '\u0640')
    // Supprimer les marques combinantes isolées (diacritiques sans lettre de base)
    .replace(/(?<=\s|^)[\u064B-\u065F]+(?=\s|$)/g, '')
    // Supprimer les séquences de caractères de contrôle
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/g, '')
}
