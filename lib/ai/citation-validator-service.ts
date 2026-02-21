/**
 * Service Validation Citations Juridiques
 *
 * Valide que les citations juridiques (articles, lois, jurisprudence) dans les réponses
 * correspondent réellement au contenu des sources fournies.
 *
 * Objectifs :
 * - Détecter citations inventées ou erronées
 * - Vérifier correspondance entre citations et sources
 * - Générer warnings pour citations non vérifiées
 *
 * Performance : <100ms overhead par réponse
 */

import type { ChatSource } from './rag-chat-service'

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type CitationType = 'source' | 'kb' | 'juris' | 'article' | 'law'

export interface CitationReference {
  type: CitationType
  reference: string // "KB-12", "Article 234", "القانون رقم 58"
  position: number
  rawMatch: string
}

export interface CitationValidation {
  citation: CitationReference
  isValid: boolean
  matchedInSource?: string // documentId où trouvé
  excerpt?: string // Extrait du texte source
  confidence?: number // 0-1
}

export type CitationWarningReason = 'not_found' | 'source_mismatch' | 'ambiguous'

export interface CitationWarning {
  citation: string
  reason: CitationWarningReason
  suggestion?: string
}

export interface ValidationResult {
  totalCitations: number
  validCitations: number
  invalidCitations: CitationValidation[]
  warnings: CitationWarning[]
  validationTimeMs: number
}

// =============================================================================
// PATTERNS REGEX - Citations Juridiques FR/AR
// =============================================================================

const CITATION_PATTERNS = {
  // Citations bracketed (déjà validées par sanitizeCitations)
  bracketed: /\[(Source|KB|Juris)-?(\d+)\]/gi,

  // Articles français
  articlesFR: /Article\s+(\d+)(?:\s+(?:bis|ter|quater))?/gi,

  // Lois françaises
  loisFR: /(?:Loi|L\.)\s*n?°?\s*(\d{4})-(\d+)/gi,

  // Articles arabes
  articlesAR: /(?:الفصل|الفقرة)\s+(\d+)(?:\s+(?:مكرر|ثالثا|رابعا))?/gi,

  // Lois arabes
  loisAR: /القانون\s+(?:عدد|رقم)\s+(\d+)(?:\s+لسنة\s+(\d{4}))?/gi,

  // Codes
  codes: /(?:Code|المجلة)\s+([^\s,\.]+)/gi,
}

// =============================================================================
// FONCTION 1 : EXTRACTION RÉFÉRENCES JURIDIQUES
// =============================================================================

/**
 * Extrait toutes les références juridiques d'un texte
 * @param text Texte contenant potentiellement des citations
 * @returns Liste de citations triées par position
 */
export function extractLegalReferences(text: string): CitationReference[] {
  const references: CitationReference[] = []

  // 1. Citations bracketed [Source-N], [KB-N], [Juris-N]
  let match: RegExpExecArray | null
  const bracketedRegex = new RegExp(CITATION_PATTERNS.bracketed)

  while ((match = bracketedRegex.exec(text)) !== null) {
    const type = match[1].toLowerCase() as 'source' | 'kb' | 'juris'
    references.push({
      type,
      reference: match[0], // [Source-1]
      position: match.index,
      rawMatch: match[0],
    })
  }

  // 2. Articles français
  const articlesFRRegex = new RegExp(CITATION_PATTERNS.articlesFR)
  while ((match = articlesFRRegex.exec(text)) !== null) {
    references.push({
      type: 'article',
      reference: match[0], // "Article 234"
      position: match.index,
      rawMatch: match[0],
    })
  }

  // 3. Lois françaises
  const loisFRRegex = new RegExp(CITATION_PATTERNS.loisFR)
  while ((match = loisFRRegex.exec(text)) !== null) {
    references.push({
      type: 'law',
      reference: match[0], // "Loi n°2024-123"
      position: match.index,
      rawMatch: match[0],
    })
  }

  // 4. Articles arabes
  const articlesARRegex = new RegExp(CITATION_PATTERNS.articlesAR)
  while ((match = articlesARRegex.exec(text)) !== null) {
    references.push({
      type: 'article',
      reference: match[0], // "الفصل 234"
      position: match.index,
      rawMatch: match[0],
    })
  }

  // 5. Lois arabes
  const loisARRegex = new RegExp(CITATION_PATTERNS.loisAR)
  while ((match = loisARRegex.exec(text)) !== null) {
    references.push({
      type: 'law',
      reference: match[0], // "القانون عدد 58"
      position: match.index,
      rawMatch: match[0],
    })
  }

  // Trier par position dans le texte
  return references.sort((a, b) => a.position - b.position)
}

// =============================================================================
// FONCTION 2 : VÉRIFICATION CITATION CONTRE SOURCE
// =============================================================================

/**
 * Vérifie si une citation correspond au contenu d'une source
 * @param citation Citation à vérifier
 * @param source Source à comparer
 * @returns Validation avec niveau de confiance
 */
export function verifyCitationAgainstSource(
  citation: CitationReference,
  source: ChatSource
): CitationValidation {
  const sourceText = `${source.documentName} ${source.chunkContent}`.toLowerCase()
  const citationText = citation.reference.toLowerCase()

  // 1. Match exact (case-insensitive)
  if (sourceText.includes(citationText)) {
    return {
      citation,
      isValid: true,
      matchedInSource: source.documentId,
      excerpt: extractExcerpt(source.chunkContent, citationText, 100),
      confidence: 1.0,
    }
  }

  // 2. Fuzzy match (basé sur mots communs)
  const fuzzyScore = calculateFuzzyMatch(citationText, sourceText)
  if (fuzzyScore >= 0.7) {
    return {
      citation,
      isValid: true,
      matchedInSource: source.documentId,
      excerpt: extractExcerpt(source.chunkContent, citation.reference, 100),
      confidence: fuzzyScore,
    }
  }

  // 3. Partial match sur numéros (pour articles)
  if (citation.type === 'article' || citation.type === 'law') {
    const numbers = citation.reference.match(/\d+/g)
    if (numbers) {
      const hasAllNumbers = numbers.every(num => sourceText.includes(num))
      if (hasAllNumbers) {
        return {
          citation,
          isValid: true,
          matchedInSource: source.documentId,
          excerpt: extractExcerpt(source.chunkContent, numbers[0], 100),
          confidence: 0.6,
        }
      }
    }
  }

  // 4. Pas de match
  return {
    citation,
    isValid: false,
    confidence: 0,
  }
}

/**
 * Calcule un score de similarité fuzzy entre deux textes
 * Basé sur le ratio de mots communs
 */
function calculateFuzzyMatch(text1: string, text2: string): number {
  const words1 = text1.split(/\s+/).filter(w => w.length > 2)
  const words2 = text2.split(/\s+/).filter(w => w.length > 2)

  if (words1.length === 0 || words2.length === 0) return 0

  const commonWords = words1.filter(w => words2.includes(w))
  return commonWords.length / Math.min(words1.length, words2.length)
}

/**
 * Extrait un extrait de texte autour d'une référence
 */
function extractExcerpt(text: string, reference: string, maxLength: number): string {
  const index = text.toLowerCase().indexOf(reference.toLowerCase())
  if (index === -1) return text.slice(0, maxLength)

  const start = Math.max(0, index - 50)
  const end = Math.min(text.length, index + reference.length + 50)

  let excerpt = text.slice(start, end)
  if (start > 0) excerpt = '...' + excerpt
  if (end < text.length) excerpt = excerpt + '...'

  return excerpt.slice(0, maxLength)
}

// =============================================================================
// FONCTION 3 : VALIDATION CITATIONS ARTICLES
// =============================================================================

/**
 * Valide toutes les citations d'articles dans une réponse
 * @param answer Réponse générée par le LLM
 * @param sources Sources utilisées pour générer la réponse
 * @returns Résultat de validation avec warnings
 */
export function validateArticleCitations(
  answer: string,
  sources: ChatSource[]
): ValidationResult {
  const startTime = Date.now()

  // Extraire toutes les citations
  const allReferences = extractLegalReferences(answer)

  // Filtrer pour ne garder que les citations non-bracketed
  // (les bracketed [Source-N] sont déjà validées par sanitizeCitations)
  const referencesToValidate = allReferences.filter(
    ref => ref.type !== 'source' && ref.type !== 'kb' && ref.type !== 'juris'
  )

  if (referencesToValidate.length === 0) {
    return {
      totalCitations: 0,
      validCitations: 0,
      invalidCitations: [],
      warnings: [],
      validationTimeMs: Date.now() - startTime,
    }
  }

  // Valider chaque citation contre toutes les sources
  const validations: CitationValidation[] = []

  for (const ref of referencesToValidate) {
    let bestValidation: CitationValidation | null = null
    let bestConfidence = 0

    // Tester contre chaque source
    for (const source of sources) {
      const validation = verifyCitationAgainstSource(ref, source)

      if (validation.isValid && (validation.confidence || 0) > bestConfidence) {
        bestValidation = validation
        bestConfidence = validation.confidence || 0
      }
    }

    // Si aucune validation trouvée, marquer comme invalide
    if (!bestValidation) {
      validations.push({
        citation: ref,
        isValid: false,
        confidence: 0,
      })
    } else {
      validations.push(bestValidation)
    }
  }

  // Générer warnings pour citations invalides
  const invalidCitations = validations.filter(v => !v.isValid)
  const warnings: CitationWarning[] = invalidCitations.map(v => ({
    citation: v.citation.reference,
    reason: 'not_found',
    suggestion: 'Vérifier que cette référence est présente dans les sources',
  }))

  return {
    totalCitations: referencesToValidate.length,
    validCitations: validations.filter(v => v.isValid).length,
    invalidCitations,
    warnings,
    validationTimeMs: Date.now() - startTime,
  }
}

// =============================================================================
// FONCTION 4 : FORMATAGE WARNINGS
// =============================================================================

/**
 * Formate les warnings de validation en message lisible
 * @param result Résultat de validation
 * @returns Message formaté (vide si aucun warning)
 */
export function formatValidationWarnings(result: ValidationResult): string {
  if (result.warnings.length === 0) {
    return '' // Pas de warnings = succès silencieux
  }

  const lines: string[] = [
    `⚠️ ${result.warnings.length} citation(s) non vérifiée(s) :`,
  ]

  result.warnings.forEach((warning, idx) => {
    lines.push(`  ${idx + 1}. "${warning.citation}" - ${translateReason(warning.reason)}`)
    if (warning.suggestion) {
      lines.push(`     → ${warning.suggestion}`)
    }
  })

  lines.push(`\nValidation effectuée en ${result.validationTimeMs}ms`)

  return lines.join('\n')
}

/**
 * Traduit une raison de warning en message français
 */
function translateReason(reason: CitationWarningReason): string {
  const translations: Record<CitationWarningReason, string> = {
    not_found: 'non trouvée dans les sources',
    source_mismatch: 'source incorrecte',
    ambiguous: 'référence ambiguë',
  }
  return translations[reason] || reason
}

// =============================================================================
// FONCTION 5 : CLAIM VERIFICATION (Phase 4 RAG Pipeline v2)
// =============================================================================

export interface ClaimVerificationResult {
  totalClaims: number
  supportedClaims: number
  unsupportedClaims: { claim: string; citedSource: string; issue: string }[]
}

/**
 * Vérifie l'alignement entre les claims de la réponse et les sources citées.
 *
 * Pattern matching (<50ms) :
 * 1. Split réponse en phrases contenant une citation [KB-N] ou [Source-N]
 * 2. Pour chaque phrase citée, extraire les termes juridiques clés
 * 3. Vérifier que le chunk source référencé contient ≥30% de ces termes
 * 4. Vérifier que les numéros d'articles mentionnés existent dans le chunk source
 *
 * Feature flag : ENABLE_CLAIM_VERIFICATION=true
 *
 * @param answer - Réponse générée par le LLM
 * @param sources - Sources utilisées pour générer la réponse
 * @returns Résultat de vérification avec claims non supportées
 */
export function verifyClaimSourceAlignment(
  answer: string,
  sources: ChatSource[]
): ClaimVerificationResult {
  const result: ClaimVerificationResult = {
    totalClaims: 0,
    supportedClaims: 0,
    unsupportedClaims: [],
  }

  if (!answer || sources.length === 0) return result

  // Split en phrases contenant une citation [Source-N], [KB-N], [Juris-N]
  const citationPattern = /\[(?:Source|KB|Juris)-?(\d+)\]/gi
  const sentences = answer.split(/[.،。\n]/).filter(s => s.trim().length > 10)

  for (const sentence of sentences) {
    const citations = [...sentence.matchAll(citationPattern)]
    if (citations.length === 0) continue

    result.totalClaims++

    // Extraire les termes juridiques clés de la phrase (mots > 3 chars)
    const sentenceTerms = sentence
      .replace(/\[(?:Source|KB|Juris)-?\d+\]/gi, '') // Retirer les citations
      .replace(/[^\u0600-\u06FFa-zA-Z\s]/g, ' ') // Garder arabe + latin
      .split(/\s+/)
      .filter(w => w.length > 3)
      .map(w => w.toLowerCase())

    if (sentenceTerms.length === 0) {
      result.supportedClaims++ // Phrase trop courte, pas de termes à vérifier
      continue
    }

    // Extraire les numéros d'articles mentionnés dans la phrase
    const articleNumbers = [...sentence.matchAll(/(?:الفصل|Article)\s+(\d+)/gi)].map(m => m[1])

    // Vérifier contre chaque source citée
    let isSupported = false
    for (const citation of citations) {
      const sourceIndex = parseInt(citation[1]) - 1 // [Source-1] → index 0
      if (sourceIndex < 0 || sourceIndex >= sources.length) continue

      const source = sources[sourceIndex]
      const sourceContent = `${source.documentName} ${source.chunkContent}`.toLowerCase()

      // Check 1: Overlap lexical — ≥30% des termes de la phrase trouvés dans la source
      const matchingTerms = sentenceTerms.filter(term => sourceContent.includes(term))
      const overlapRatio = matchingTerms.length / sentenceTerms.length

      if (overlapRatio >= 0.30) {
        isSupported = true
        break
      }

      // Check 2: Numéros d'articles — tous les articles cités doivent exister dans la source
      if (articleNumbers.length > 0) {
        const allArticlesFound = articleNumbers.every(num => sourceContent.includes(num))
        if (allArticlesFound) {
          isSupported = true
          break
        }
      }
    }

    if (isSupported) {
      result.supportedClaims++
    } else {
      result.unsupportedClaims.push({
        claim: sentence.trim().substring(0, 150),
        citedSource: citations.map(c => c[0]).join(', '),
        issue: 'Faible correspondance lexicale entre la phrase et la source citée',
      })
    }
  }

  return result
}

// =============================================================================
// FONCTION 6 : VÉRIFICATION ALIGNEMENT BRANCHE (Sprint 1 RAG Audit-Proof)
// =============================================================================

export interface BranchAlignmentResult {
  totalSources: number
  violatingCount: number
  violatingSources: Array<{
    documentName: string
    branch: string
    allowedBranches: string[]
  }>
}

/**
 * Vérifie que les sources utilisées appartiennent aux branches juridiques autorisées.
 *
 * Utilisé post-génération pour détecter les citations cross-domaine.
 * Ex: question marchés_publics → source مجلة الشغل (branch='travail') = violation.
 *
 * @param sources - Sources retournées par le RAG
 * @param allowedBranches - Branches autorisées pour la query (du RouterResult)
 * @returns Résultat avec nombre et liste des sources hors-domaine
 */
export function verifyBranchAlignment(
  sources: ChatSource[],
  allowedBranches: string[]
): BranchAlignmentResult {
  if (!allowedBranches || allowedBranches.length === 0) {
    return { totalSources: sources.length, violatingCount: 0, violatingSources: [] }
  }

  const violatingSources = sources
    .filter(s => {
      const branch = s.metadata?.branch as string | undefined
      // Pas de branch définie ou 'autre' → on garde (pas de restriction)
      if (!branch || branch === 'autre') return false
      return !allowedBranches.includes(branch)
    })
    .map(s => ({
      documentName: s.documentName,
      branch: s.metadata?.branch as string,
      allowedBranches,
    }))

  return {
    totalSources: sources.length,
    violatingCount: violatingSources.length,
    violatingSources,
  }
}

// =============================================================================
// UTILITAIRES EXPORT
// =============================================================================

/**
 * Normalise une référence pour matching (lowercase, sans ponctuation)
 */
export function normalizeReference(reference: string): string {
  return reference
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, '') // Garder alphanumériques + arabe
    .trim()
}

/**
 * Vérifie si une citation est de type bracketed (déjà validée)
 */
export function isBracketedCitation(citation: string): boolean {
  return /^\[(Source|KB|Juris)-?\d+\]$/i.test(citation)
}
