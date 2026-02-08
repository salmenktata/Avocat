/**
 * Tests pour le parsing des citations inline
 *
 * Couvre:
 * - Détection [Source-N]
 * - Détection [KB-N]
 * - Détection [Juris-N]
 * - Extraction correcte des indices
 */

import { describe, it, expect } from 'vitest'

// Fonction de parsing extraite pour les tests
// Cette regex correspond exactement à celle utilisée dans InlineCitation.tsx
function parseCitationPattern(text: string): Array<{
  fullMatch: string
  type: string
  number: string
  index: number
}> {
  // Pattern pour matcher [Source-N], [SourceN], [KB-N], [Juris-N]
  const citationPattern = /\[(Source|KB|Juris)-?(\d+)\]/g
  const results: Array<{
    fullMatch: string
    type: string
    number: string
    index: number
  }> = []

  let match: RegExpExecArray | null
  while ((match = citationPattern.exec(text)) !== null) {
    results.push({
      fullMatch: match[0],
      type: match[1],
      number: match[2],
      index: match.index,
    })
  }

  return results
}

describe('Citation Parser', () => {
  describe('parseCitationPattern', () => {
    it('devrait détecter [Source-1] avec tiret', () => {
      const text = 'Voir la référence [Source-1] pour plus de détails.'
      const results = parseCitationPattern(text)

      expect(results).toHaveLength(1)
      expect(results[0].fullMatch).toBe('[Source-1]')
      expect(results[0].type).toBe('Source')
      expect(results[0].number).toBe('1')
    })

    it('devrait détecter [Source1] sans tiret', () => {
      const text = 'Selon [Source1], cette loi...'
      const results = parseCitationPattern(text)

      expect(results).toHaveLength(1)
      expect(results[0].fullMatch).toBe('[Source1]')
      expect(results[0].type).toBe('Source')
      expect(results[0].number).toBe('1')
    })

    it('devrait détecter [KB-2]', () => {
      const text = 'La base de connaissances [KB-2] indique...'
      const results = parseCitationPattern(text)

      expect(results).toHaveLength(1)
      expect(results[0].type).toBe('KB')
      expect(results[0].number).toBe('2')
    })

    it('devrait détecter [Juris-3]', () => {
      const text = 'La jurisprudence [Juris-3] confirme cette interprétation.'
      const results = parseCitationPattern(text)

      expect(results).toHaveLength(1)
      expect(results[0].type).toBe('Juris')
      expect(results[0].number).toBe('3')
    })

    it('devrait détecter plusieurs citations', () => {
      const text = 'Voir [Source-1] et [KB-2], ainsi que [Juris-1].'
      const results = parseCitationPattern(text)

      expect(results).toHaveLength(3)
      expect(results[0].type).toBe('Source')
      expect(results[1].type).toBe('KB')
      expect(results[2].type).toBe('Juris')
    })

    it('devrait retourner un tableau vide si pas de citations', () => {
      const text = 'Un texte sans citations.'
      const results = parseCitationPattern(text)

      expect(results).toHaveLength(0)
    })

    it('devrait ignorer les formats invalides', () => {
      const text = '[Source] [KB] [Juris] [Other-1]'
      const results = parseCitationPattern(text)

      expect(results).toHaveLength(0)
    })

    it('devrait ignorer [Source 1] avec espace (format non supporté)', () => {
      const text = '[Source 1] [KB 2]'
      const results = parseCitationPattern(text)

      // Le format avec espace n'est pas supporté par la regex
      expect(results).toHaveLength(0)
    })

    it('devrait gérer les numéros à plusieurs chiffres', () => {
      const text = 'Référence [Source-15] et [KB-123].'
      const results = parseCitationPattern(text)

      expect(results).toHaveLength(2)
      expect(results[0].number).toBe('15')
      expect(results[1].number).toBe('123')
    })

    it('devrait retourner les indices corrects', () => {
      const text = 'Début [Source-1] milieu [KB-2] fin.'
      const results = parseCitationPattern(text)

      expect(results[0].index).toBe(6)  // Position de [Source-1]
      expect(results[1].index).toBe(24) // Position de [KB-2]
    })
  })
})
