/**
 * Service de normalisation de texte pour le pipeline d'indexation RAG
 *
 * Normalise les numéros d'articles et supprime le boilerplate
 * avant le chunking pour améliorer la qualité des embeddings et du BM25.
 */

// =============================================================================
// NORMALISATION DES NUMÉROS D'ARTICLES
// =============================================================================

/**
 * Unifie les différentes formes de numéros d'articles en format canonique.
 *
 * Transformations :
 * - "Art. 52" / "art 52" / "ART. 52" → "Article 52"
 * - "الفصل 52" / "فصل 52" → "الفصل 52"
 * - Préserve les suffixes : bis/ter/quater (FR), مكرر (AR)
 * - Préserve les tirets : "Article 52-1" reste intact
 */
export function normalizeArticleNumbers(text: string): string {
  let result = text

  // FR: "art." / "Art" / "ART." → "Article" (avec ou sans point)
  result = result.replace(
    /\b(?:art\.?|ART\.?)\s+(\d+(?:\s*[-–]\s*\d+)?(?:\s+(?:bis|ter|quater|quinquies|sexies))?)/gi,
    (match, num) => `Article ${num.trim()}`
  )

  // AR: "فصل" (sans article défini) → "الفصل"
  result = result.replace(
    /(?<!\u0627\u0644)فصل\s+(\d+(?:\s+مكرر)?)/g,
    (match, num) => `الفصل ${num.trim()}`
  )

  return result
}

// =============================================================================
// SUPPRESSION DU BOILERPLATE
// =============================================================================

/**
 * Supprime le boilerplate courant des documents juridiques tunisiens.
 *
 * Supprime :
 * - En-têtes JORT (Journal Officiel de la République Tunisienne)
 * - Numéros de page isolés
 * - Séquences de points de suspension (tables des matières)
 * - Lignes de séparateurs (----, ====, etc.)
 * - Mentions "Page X sur Y"
 * - En-têtes/pieds de page répétitifs des documents scannés
 */
export function removeDocumentBoilerplate(text: string): string {
  let result = text

  // En-têtes JORT
  result = result.replace(
    /(?:^|\n)\s*(?:Journal Officiel de la R[ée]publique Tunisienne|الرائد الرسمي للجمهورية التونسية)[^\n]*/gi,
    '\n'
  )

  // Numéros de page isolés sur une ligne
  result = result.replace(/(?:^|\n)\s*(?:[-–—]\s*)?\d{1,4}\s*(?:[-–—]\s*)?(?:\n|$)/g, '\n')

  // "Page X sur Y" / "Page X/Y" / "صفحة X"
  result = result.replace(
    /(?:^|\n)\s*(?:page\s+\d+\s*(?:sur|\/|de)\s*\d+|صفحة\s+\d+)[^\n]*/gi,
    '\n'
  )

  // Séquences de points (tables des matières) : "Titre......... 42"
  result = result.replace(/\.{5,}\s*\d*/g, '')

  // Lignes de séparateurs
  result = result.replace(/(?:^|\n)\s*[-=_]{3,}\s*(?:\n|$)/g, '\n')

  // Lignes vides multiples → max 2
  result = result.replace(/\n{4,}/g, '\n\n\n')

  return result.trim()
}
