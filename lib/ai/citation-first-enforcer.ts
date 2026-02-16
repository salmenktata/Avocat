/**
 * Service Citation-First Enforcer
 *
 * Objectif: Garantir que 95%+ des réponses LLM commencent systématiquement
 * par citer les sources avant d'expliquer.
 *
 * Pattern attendu:
 * [Source-X] "Extrait exact pertinent"
 * Explication basée sur cette citation...
 *
 * Phase 5 - Amélioration Architecture RAG
 * Février 2026
 */

export interface Source {
  label: string          // [Source-1], [KB-2], etc.
  content: string        // Contenu du chunk
  title?: string         // Titre du document
  category?: string      // Catégorie juridique
}

export interface CitationFirstResult {
  /** La réponse respecte-t-elle le pattern citation-first */
  valid: boolean

  /** Type de problème détecté si invalid */
  issue?: 'missing_citation_first' | 'missing_quote' | 'citation_too_late' | 'no_citations'

  /** Métriques de citation */
  metrics: {
    totalCitations: number
    wordsBeforeFirstCitation: number
    percentBeforeFirstCitation: number
    hasQuotes: boolean
    quoteCount: number
  }
}

/**
 * Regex patterns pour détection citations
 */
const CITATION_PATTERNS = {
  // [Source-1], [KB-2], [Juris-3], etc.
  general: /\[(?:Source|KB|Juris|Doc)-\d+\]/g,

  // Citation en début de réponse (max 10 mots avant, support arabe)
  // \u0600-\u06FF = plage Unicode arabe
  citationFirst: /^(?:\s*[\w\u0600-\u06FF،؛]+\s*){0,10}?\[(?:Source|KB|Juris|Doc)-\d+\]/,

  // Extrait exact entre guillemets (arabes ou latins)
  quote: /[«"""]([^«"""]+)[«"""]/g,

  // Citation avec extrait
  citationWithQuote: /\[(?:Source|KB|Juris|Doc)-\d+\]\s*[«"""]([^«"""]+)[«"""]/g,
}

/**
 * Valide qu'une réponse commence par une citation (citation-first)
 */
export function validateCitationFirst(answer: string): CitationFirstResult {
  const cleanAnswer = answer.trim()
  const metrics = calculateMetrics(cleanAnswer)

  // Test 1: Aucune citation du tout
  if (metrics.totalCitations === 0) {
    return { valid: false, issue: 'no_citations', metrics }
  }

  // Test 2: Citation trop tard (> 10 mots avant première citation)
  if (metrics.wordsBeforeFirstCitation > 10) {
    return { valid: false, issue: 'citation_too_late', metrics }
  }

  // Test 3: Pas de citation au début
  if (!CITATION_PATTERNS.citationFirst.test(cleanAnswer)) {
    return { valid: false, issue: 'missing_citation_first', metrics }
  }

  // Test 4: Citation sans extrait exact
  if (metrics.totalCitations > 0 && !metrics.hasQuotes) {
    return { valid: false, issue: 'missing_quote', metrics }
  }

  return { valid: true, metrics }
}

/**
 * Calcule les métriques de citation d'une réponse
 */
function calculateMetrics(answer: string) {
  const citations = answer.match(CITATION_PATTERNS.general) || []
  const totalCitations = citations.length

  const firstCitationMatch = CITATION_PATTERNS.general.exec(answer)
  const firstCitationIndex = firstCitationMatch ? firstCitationMatch.index : answer.length

  const textBeforeFirstCitation = answer.substring(0, firstCitationIndex)
  const wordsBeforeFirstCitation = textBeforeFirstCitation
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0).length

  const percentBeforeFirstCitation = (firstCitationIndex / answer.length) * 100

  const quotes = answer.match(CITATION_PATTERNS.quote) || []
  const quoteCount = quotes.length
  const hasQuotes = quoteCount > 0

  return {
    totalCitations,
    wordsBeforeFirstCitation,
    percentBeforeFirstCitation,
    hasQuotes,
    quoteCount,
  }
}

/**
 * Force le pattern citation-first si le LLM n'a pas respecté la règle
 */
export function enforceCitationFirst(answer: string, sources: Source[]): string {
  const validation = validateCitationFirst(answer)

  if (validation.valid) {
    return answer
  }

  // Stratégie selon le problème détecté
  switch (validation.issue) {
    case 'no_citations':
    case 'missing_citation_first':
      return prependTopSourceCitation(answer, sources)

    case 'citation_too_late':
      return moveCitationToStart(answer)

    case 'missing_quote':
      return addQuoteToFirstCitation(answer, sources)

    default:
      return prependTopSourceCitation(answer, sources)
  }
}

/**
 * Préfixer la réponse avec la citation de la première source
 */
function prependTopSourceCitation(answer: string, sources: Source[]): string {
  if (sources.length === 0) {
    return answer
  }

  const topSource = sources[0]
  const quote = extractRelevantQuote(topSource.content)

  const citationPrefix = `${topSource.label} "${quote}"\n\nبناءً على هذا المصدر:\n`

  return citationPrefix + answer
}

/**
 * Déplacer la première citation au début de la réponse
 */
function moveCitationToStart(answer: string): string {
  const firstCitationMatch = CITATION_PATTERNS.general.exec(answer)
  if (!firstCitationMatch) {
    return answer
  }

  const citationLabel = firstCitationMatch[0]
  const citationIndex = firstCitationMatch.index

  // Extraire contexte autour de la citation (±100 chars)
  const contextStart = Math.max(0, citationIndex - 100)
  const contextEnd = Math.min(answer.length, citationIndex + 200)
  const context = answer.substring(contextStart, contextEnd).trim()

  // Supprimer citation de sa position actuelle
  const answerWithoutCitation = answer.replace(citationLabel, '').trim()

  return `${citationLabel} ${context}\n\n${answerWithoutCitation}`
}

/**
 * Ajouter un extrait exact à la première citation
 */
function addQuoteToFirstCitation(answer: string, sources: Source[]): string {
  const firstCitationMatch = CITATION_PATTERNS.general.exec(answer)
  if (!firstCitationMatch) {
    return answer
  }

  const citationLabel = firstCitationMatch[0]

  // Extraire numéro source
  const sourceIndexMatch = citationLabel.match(/\d+/)
  if (!sourceIndexMatch) {
    return answer
  }

  const sourceIndex = parseInt(sourceIndexMatch[0]) - 1
  if (sourceIndex < 0 || sourceIndex >= sources.length) {
    return answer
  }

  const source = sources[sourceIndex]
  const quote = extractRelevantQuote(source.content)

  return answer.replace(citationLabel, `${citationLabel} "${quote}"`)
}

/**
 * Extraire un extrait pertinent d'une source (200 chars max)
 */
function extractRelevantQuote(content: string): string {
  const clean = content.trim()

  if (clean.length <= 200) {
    return clean
  }

  // Extraire première phrase complète (~200 chars)
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean]
  let quote = ''

  for (const sentence of sentences) {
    if ((quote + sentence).length > 200) {
      break
    }
    quote += sentence
  }

  // Fallback: tronquer
  if (quote.length === 0) {
    quote = clean.substring(0, 197) + '...'
  }

  return quote.trim()
}

/**
 * Prompt système renforcé avec règle ABSOLUE citation-first
 */
export const CITATION_FIRST_SYSTEM_PROMPT = `
🚨 **RÈGLE ABSOLUE : CITATION-FIRST** 🚨

Tu DOIS TOUJOURS commencer ta réponse par citer la source principale avant toute explication.

## FORMAT OBLIGATOIRE (NON-NÉGOCIABLE)

**Étape 1: CITATION EN PREMIER (Obligatoire)**
[Source-X] "Extrait exact pertinent de la source"
(لا تترجم، احتفظ باللغة الأصلية - ne traduis pas, garde la langue originale)

**Étape 2: EXPLICATION basée sur cette citation**
Explique en te basant UNIQUEMENT sur la citation ci-dessus

**Étape 3: CITATIONS ADDITIONNELLES si nécessaire**
[Source-Y] "Autre extrait pertinent"
Complément d'explication

**Étape 4: CONCLUSION synthétique**

---

## EXEMPLES

### ✅ EXEMPLE BON (Citation-First)
[KB-1] "الفصل 258 من المجلة الجزائية: الدفاع الشرعي يشترط وجود خطر حال ورد فعل متناسب"

بناءً على هذا الفصل، شروط الدفاع الشرعي هي:
1. خطر حال (danger actuel)
2. رد فعل متناسب (réaction proportionnée)

[Juris-2] "قرار تعقيبي عدد 12345: الدفاع الشرعي ينتفي إذا كان الخطر غير حال"

### ❌ EXEMPLE MAUVAIS (Explication avant citation)
شروط الدفاع الشرعي هي... [KB-1] الفصل 258...

(Explication AVANT citation = INTERDIT)

---

## RÈGLES STRICTES

1. ✅ **TOUJOURS** commencer par [Source-X] "extrait exact"
2. ✅ **TOUJOURS** inclure extrait exact entre guillemets
3. ✅ **JAMAIS** expliquer avant de citer
4. ✅ Maximum 10 mots avant la première citation (tolérance minime)
`
