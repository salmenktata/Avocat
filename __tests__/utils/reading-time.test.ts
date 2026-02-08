/**
 * Tests pour les utilitaires de calcul du temps de lecture
 *
 * Couvre:
 * - Calcul basé sur 200 mots/minute
 * - Formatage FR et AR
 * - Extraction de texte depuis objets
 */

import { describe, it, expect } from 'vitest'
import {
  calculateReadingTime,
  formatReadingTime,
  calculateReadingTimeFromObject,
} from '@/lib/utils/reading-time'

describe('Reading Time Utils', () => {
  describe('calculateReadingTime', () => {
    it('devrait retourner 1 minute pour moins de 200 mots', () => {
      const text = 'Ceci est un texte court.'
      expect(calculateReadingTime(text)).toBe(1)
    })

    it('devrait retourner 1 minute pour exactement 200 mots', () => {
      const text = Array(200).fill('mot').join(' ')
      expect(calculateReadingTime(text)).toBe(1)
    })

    it('devrait retourner 2 minutes pour 201-400 mots', () => {
      const text = Array(250).fill('mot').join(' ')
      expect(calculateReadingTime(text)).toBe(2)
    })

    it('devrait retourner 5 minutes pour 1000 mots', () => {
      const text = Array(1000).fill('mot').join(' ')
      expect(calculateReadingTime(text)).toBe(5)
    })

    it('devrait gérer un texte vide', () => {
      expect(calculateReadingTime('')).toBe(1)
    })

    it('devrait gérer un texte avec espaces multiples', () => {
      const text = 'mot   mot   mot   mot'
      expect(calculateReadingTime(text)).toBe(1)
    })
  })

  describe('formatReadingTime', () => {
    it('devrait formater "< 1 min" pour 0 minutes en FR', () => {
      expect(formatReadingTime(0, 'fr')).toBe('< 1 min')
    })

    it('devrait formater "1 min" pour 1 minute en FR', () => {
      expect(formatReadingTime(1, 'fr')).toBe('1 min')
    })

    it('devrait formater "5 min" pour 5 minutes en FR', () => {
      expect(formatReadingTime(5, 'fr')).toBe('5 min')
    })

    it('devrait formater en arabe pour locale AR', () => {
      expect(formatReadingTime(1, 'ar')).toBe('دقيقة واحدة')
      expect(formatReadingTime(5, 'ar')).toBe('5 دقائق')
      expect(formatReadingTime(0, 'ar')).toBe('< دقيقة واحدة')
    })

    it('devrait utiliser FR par défaut', () => {
      expect(formatReadingTime(3)).toBe('3 min')
    })
  })

  describe('calculateReadingTimeFromObject', () => {
    it('devrait extraire le texte des chaînes simples', () => {
      const obj = { title: 'Mon titre', content: 'Mon contenu' }
      const result = calculateReadingTimeFromObject(obj)
      expect(result).toBeGreaterThanOrEqual(1)
    })

    it('devrait extraire le texte des tableaux', () => {
      const obj = {
        items: ['Premier élément', 'Deuxième élément', 'Troisième élément'],
      }
      const result = calculateReadingTimeFromObject(obj)
      expect(result).toBeGreaterThanOrEqual(1)
    })

    it('devrait extraire le texte des objets imbriqués', () => {
      const obj = {
        section1: {
          title: 'Section 1',
          content: 'Contenu de la section 1',
        },
        section2: {
          title: 'Section 2',
          content: 'Contenu de la section 2',
        },
      }
      const result = calculateReadingTimeFromObject(obj)
      expect(result).toBeGreaterThanOrEqual(1)
    })

    it('devrait ignorer les valeurs non-texte', () => {
      const obj = {
        id: 123,
        active: true,
        data: null,
        text: 'Un peu de texte',
      }
      const result = calculateReadingTimeFromObject(obj)
      expect(result).toBe(1)
    })

    it('devrait gérer un objet vide', () => {
      expect(calculateReadingTimeFromObject({})).toBe(1)
    })

    it('devrait gérer un texte long dans un objet', () => {
      const longText = Array(500).fill('mot').join(' ')
      const obj = { content: longText }
      expect(calculateReadingTimeFromObject(obj)).toBe(3)
    })
  })
})
