/**
 * Tests unitaires - Service Validation Citations
 *
 * Vérifie la détection et validation des citations juridiques :
 * 1. Extraction références (articles, lois, bracketed)
 * 2. Vérification contre sources (exact, fuzzy, partial match)
 * 3. Validation complète (génération warnings)
 * 4. Formatage warnings
 *
 * Objectif coverage : ≥90% citation-validator-service.ts
 */

import { describe, it, expect } from 'vitest'
import {
  extractLegalReferences,
  verifyCitationAgainstSource,
  validateArticleCitations,
  formatValidationWarnings,
  normalizeReference,
  isBracketedCitation,
  type CitationReference,
} from '@/lib/ai/citation-validator-service'
import type { ChatSource } from '@/lib/ai/rag-chat-service'

// =============================================================================
// FIXTURES
// =============================================================================

const mockSources: ChatSource[] = [
  {
    documentId: 'doc-1',
    documentName: 'Code Statut Personnel - Article 30',
    chunkContent: 'Article 30. Le mariage est un contrat entre un homme et une femme ayant pour but la fondation d\'une famille...',
    similarity: 0.95,
  },
  {
    documentId: 'doc-2',
    documentName: 'Loi n°2017-58 du 11 août 2017',
    chunkContent: 'La présente loi, promulguée en août 2017, vise à lutter contre les violences faites aux femmes...',
    similarity: 0.88,
  },
  {
    documentId: 'doc-3',
    documentName: 'الفصل 234 من المجلة الجزائية',
    chunkContent: 'الفصل 234. يعاقب بالسجن من عامين إلى خمس أعوام كل من ارتكب السرقة مع استعمال العنف...',
    similarity: 0.82,
  },
]

// =============================================================================
// TESTS - extractLegalReferences
// =============================================================================

describe('Citation Validator - extractLegalReferences', () => {
  it('devrait extraire citations bracketed [Source-N]', () => {
    const text = 'Selon [Source-1] et [Source-2], la loi stipule...'
    const refs = extractLegalReferences(text)

    expect(refs).toHaveLength(2)
    expect(refs[0].type).toBe('source')
    expect(refs[0].reference).toBe('[Source-1]')
    expect(refs[1].reference).toBe('[Source-2]')
  })

  it('devrait extraire articles français (Article N)', () => {
    const text = 'Article 234 du Code pénal et Article 30 bis du CSP...'
    const refs = extractLegalReferences(text)

    const articles = refs.filter(r => r.type === 'article')
    expect(articles.length).toBeGreaterThanOrEqual(2)
    expect(articles.some(a => a.reference.includes('234'))).toBe(true)
    expect(articles.some(a => a.reference.includes('30'))).toBe(true)
  })

  it('devrait extraire lois françaises (Loi n°YYYY-NN)', () => {
    const text = 'La Loi n°2017-58 et L.2024-123 régissent...'
    const refs = extractLegalReferences(text)

    const lois = refs.filter(r => r.type === 'law')
    expect(lois.length).toBeGreaterThanOrEqual(2)
    expect(lois.some(l => l.reference.includes('2017-58'))).toBe(true)
  })

  it('devrait extraire articles arabes (الفصل N)', () => {
    const text = 'الفصل 234 من المجلة الجزائية والفصل 10 مكرر...'
    const refs = extractLegalReferences(text)

    const articlesAR = refs.filter(r => r.type === 'article' && /[\u0600-\u06FF]/.test(r.reference))
    expect(articlesAR.length).toBeGreaterThanOrEqual(2)
    expect(articlesAR.some(a => a.reference.includes('234'))).toBe(true)
  })

  it('devrait extraire lois arabes (القانون عدد N)', () => {
    const text = 'القانون عدد 58 لسنة 2017 والقانون رقم 12...'
    const refs = extractLegalReferences(text)

    const loisAR = refs.filter(r => r.type === 'law' && /[\u0600-\u06FF]/.test(r.reference))
    expect(loisAR.length).toBeGreaterThanOrEqual(2)
    expect(loisAR.some(l => l.reference.includes('58'))).toBe(true)
  })

  it('devrait trier citations par position dans le texte', () => {
    const text = '[KB-5] mentionne Article 30 puis [Source-1] cite Article 234'
    const refs = extractLegalReferences(text)

    expect(refs.length).toBeGreaterThanOrEqual(2)
    // Première citation devrait être [KB-5] (position ~0)
    expect(refs[0].position).toBeLessThan(refs[1].position)
  })

  it('devrait retourner array vide si pas de citations', () => {
    const text = 'Texte juridique sans aucune citation référencée.'
    const refs = extractLegalReferences(text)

    expect(refs).toEqual([])
  })

  it('devrait gérer texte mixte FR/AR', () => {
    const text = 'Article 30 du CSP correspond au الفصل 30 selon [Source-1]'
    const refs = extractLegalReferences(text)

    expect(refs.length).toBeGreaterThanOrEqual(3)
    const hasFR = refs.some(r => r.reference.includes('Article'))
    const hasAR = refs.some(r => /[\u0600-\u06FF]/.test(r.reference))
    const hasBracketed = refs.some(r => r.type === 'source')

    expect(hasFR).toBe(true)
    expect(hasAR).toBe(true)
    expect(hasBracketed).toBe(true)
  })
})

// =============================================================================
// TESTS - verifyCitationAgainstSource
// =============================================================================

describe('Citation Validator - verifyCitationAgainstSource', () => {
  it('devrait valider match exact (confidence 1.0)', () => {
    const citation: CitationReference = {
      type: 'article',
      reference: 'Article 30',
      position: 0,
      rawMatch: 'Article 30',
    }

    const validation = verifyCitationAgainstSource(citation, mockSources[0])

    expect(validation.isValid).toBe(true)
    expect(validation.confidence).toBe(1.0)
    expect(validation.matchedInSource).toBe('doc-1')
    expect(validation.excerpt).toBeTruthy()
  })

  it('devrait valider fuzzy match (confidence ≥0.7)', () => {
    const citation: CitationReference = {
      type: 'law',
      reference: 'Loi 2017 violences femmes',
      position: 0,
      rawMatch: 'Loi 2017 violences femmes',
    }

    const validation = verifyCitationAgainstSource(citation, mockSources[1])

    // Fuzzy match basé sur mots communs
    expect(validation.isValid).toBe(true)
    expect(validation.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('devrait valider partial match sur numéros (confidence 0.6)', () => {
    const citation: CitationReference = {
      type: 'article',
      reference: 'Article 234',
      position: 0,
      rawMatch: 'Article 234',
    }

    // Source arabe contient "الفصل 234"
    const validation = verifyCitationAgainstSource(citation, mockSources[2])

    expect(validation.isValid).toBe(true)
    expect(validation.confidence).toBeGreaterThanOrEqual(0.6)
  })

  it('devrait rejeter citation non trouvée (isValid=false)', () => {
    const citation: CitationReference = {
      type: 'article',
      reference: 'Article 999',
      position: 0,
      rawMatch: 'Article 999',
    }

    const validation = verifyCitationAgainstSource(citation, mockSources[0])

    expect(validation.isValid).toBe(false)
    expect(validation.confidence).toBe(0)
    expect(validation.matchedInSource).toBeUndefined()
  })

  it('devrait gérer citations arabes dans sources arabes', () => {
    const citation: CitationReference = {
      type: 'article',
      reference: 'الفصل 234',
      position: 0,
      rawMatch: 'الفصل 234',
    }

    const validation = verifyCitationAgainstSource(citation, mockSources[2])

    expect(validation.isValid).toBe(true)
    expect(validation.confidence).toBeGreaterThan(0)
  })
})

// =============================================================================
// TESTS - validateArticleCitations
// =============================================================================

describe('Citation Validator - validateArticleCitations', () => {
  it('devrait valider citations valides sans warnings', () => {
    const answer = 'Selon Article 30 du CSP [Source-1], le mariage est un contrat...'

    const result = validateArticleCitations(answer, mockSources)

    expect(result.totalCitations).toBeGreaterThan(0)
    expect(result.validCitations).toBe(result.totalCitations)
    expect(result.warnings).toHaveLength(0)
    expect(result.validationTimeMs).toBeLessThan(100)
  })

  it('devrait générer warnings pour citations invalides', () => {
    const answer = 'Article 999 non existant et Article 888 inventé...'

    const result = validateArticleCitations(answer, mockSources)

    expect(result.totalCitations).toBeGreaterThan(0)
    expect(result.validCitations).toBeLessThan(result.totalCitations)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.invalidCitations.length).toBeGreaterThan(0)
  })

  it('devrait skip citations bracketed (déjà validées)', () => {
    const answer = '[Source-1] et [KB-2] sont des citations bracketed'

    const result = validateArticleCitations(answer, mockSources)

    // Citations bracketed ne doivent pas être comptées
    expect(result.totalCitations).toBe(0)
  })

  it('devrait gérer citations mixtes FR/AR', () => {
    const answer = 'Article 30 (FR) correspond à الفصل 30 (AR) selon les sources.'

    const result = validateArticleCitations(answer, mockSources)

    expect(result.totalCitations).toBeGreaterThan(0)
    // Au moins une citation devrait matcher
    expect(result.validCitations).toBeGreaterThan(0)
  })

  it('devrait retourner résultat vide si aucune citation', () => {
    const answer = 'Texte sans citations juridiques explicites.'

    const result = validateArticleCitations(answer, mockSources)

    expect(result.totalCitations).toBe(0)
    expect(result.validCitations).toBe(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('devrait compléter validation en <100ms', () => {
    const answer = 'Article 30, Article 234, Loi n°2017-58, [Source-1]'

    const result = validateArticleCitations(answer, mockSources)

    expect(result.validationTimeMs).toBeLessThan(100)
  })
})

// =============================================================================
// TESTS - formatValidationWarnings
// =============================================================================

describe('Citation Validator - formatValidationWarnings', () => {
  it('devrait retourner string vide si aucun warning', () => {
    const result = {
      totalCitations: 2,
      validCitations: 2,
      invalidCitations: [],
      warnings: [],
      validationTimeMs: 50,
    }

    const formatted = formatValidationWarnings(result)

    expect(formatted).toBe('')
  })

  it('devrait formater warnings avec détails', () => {
    const result = {
      totalCitations: 3,
      validCitations: 1,
      invalidCitations: [],
      warnings: [
        {
          citation: 'Article 999',
          reason: 'not_found' as const,
          suggestion: 'Vérifier que cette référence est présente dans les sources',
        },
        {
          citation: 'Loi n°9999-99',
          reason: 'not_found' as const,
        },
      ],
      validationTimeMs: 75,
    }

    const formatted = formatValidationWarnings(result)

    expect(formatted).toContain('⚠️')
    expect(formatted).toContain('2 citation(s) non vérifiée(s)')
    expect(formatted).toContain('Article 999')
    expect(formatted).toContain('non trouvée dans les sources')
    expect(formatted).toContain('75ms')
  })
})

// =============================================================================
// TESTS - Utilitaires
// =============================================================================

describe('Citation Validator - Utilitaires', () => {
  it('normalizeReference - devrait normaliser référence', () => {
    expect(normalizeReference('Article 30 bis')).toBe('article 30 bis')
    expect(normalizeReference('L.2017-58')).toBe('l201758')
    expect(normalizeReference('الفصل 234')).toContain('234')
  })

  it('isBracketedCitation - devrait détecter citations bracketed', () => {
    expect(isBracketedCitation('[Source-1]')).toBe(true)
    expect(isBracketedCitation('[KB-12]')).toBe(true)
    expect(isBracketedCitation('[Juris-3]')).toBe(true)
    expect(isBracketedCitation('Article 30')).toBe(false)
    expect(isBracketedCitation('[Invalid]')).toBe(false)
  })
})

// =============================================================================
// TESTS - Edge Cases
// =============================================================================

describe('Citation Validator - Edge Cases', () => {
  it('devrait gérer texte vide', () => {
    const refs = extractLegalReferences('')
    expect(refs).toEqual([])

    const result = validateArticleCitations('', mockSources)
    expect(result.totalCitations).toBe(0)
  })

  it('devrait gérer sources vides', () => {
    const answer = 'Article 30 du CSP'
    const result = validateArticleCitations(answer, [])

    expect(result.totalCitations).toBeGreaterThan(0)
    expect(result.validCitations).toBe(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('devrait gérer caractères spéciaux dans citations', () => {
    const text = 'Article 30 §2 (alinéa 3) et Article "234-bis"'
    const refs = extractLegalReferences(text)

    // Devrait au moins extraire les numéros d'articles
    expect(refs.length).toBeGreaterThan(0)
  })

  it('devrait gérer citations dupliquées', () => {
    const text = 'Article 30, puis encore Article 30, et enfin Article 30'
    const refs = extractLegalReferences(text)

    // Devrait extraire les 3 occurrences
    expect(refs.length).toBe(3)
    expect(refs.every(r => r.reference.includes('30'))).toBe(true)
  })

  it('devrait gérer très longues citations', () => {
    const longCitation = 'Article 30 ' + 'bis '.repeat(100)
    const refs = extractLegalReferences(longCitation)

    expect(refs.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// TESTS - Performance
// =============================================================================

describe('Citation Validator - Performance', () => {
  it('devrait extraire 100 citations en <50ms', () => {
    const citations = Array.from({ length: 100 }, (_, i) => `Article ${i}`).join(', ')

    const start = Date.now()
    const refs = extractLegalReferences(citations)
    const elapsed = Date.now() - start

    expect(refs.length).toBeGreaterThanOrEqual(50)
    expect(elapsed).toBeLessThan(50)
  })

  it('devrait valider 50 citations en <100ms', () => {
    const citations = Array.from({ length: 50 }, (_, i) => `Article ${i}`).join(', ')

    const start = Date.now()
    const result = validateArticleCitations(citations, mockSources)
    const elapsed = Date.now() - start

    expect(result.validationTimeMs).toBeLessThan(100)
    expect(elapsed).toBeLessThan(150) // Overhead total
  })
})
