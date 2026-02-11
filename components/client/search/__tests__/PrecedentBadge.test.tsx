/**
 * Tests Unitaires : PrecedentBadge
 *
 * Sprint 5 - Tests & Performance
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrecedentBadge, sortByPrecedentScore, hasPrecedentScoreAbove } from '../PrecedentBadge'

// =============================================================================
// TESTS COMPOSANT
// =============================================================================

describe('PrecedentBadge', () => {
  describe('Affichage basique', () => {
    it('affiche le score correctement', () => {
      render(<PrecedentBadge score={85} showTooltip={false} />)
      expect(screen.getByText('85')).toBeInTheDocument()
    })

    it('arrondit le score à l\'entier le plus proche', () => {
      render(<PrecedentBadge score={84.7} showTooltip={false} />)
      expect(screen.getByText('85')).toBeInTheDocument()
    })

    it('limite le score min à 0', () => {
      render(<PrecedentBadge score={-10} showTooltip={false} />)
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('limite le score max à 100', () => {
      render(<PrecedentBadge score={150} showTooltip={false} />)
      expect(screen.getByText('100')).toBeInTheDocument()
    })
  })

  describe('Couleurs selon score', () => {
    it('applique classe verte pour score élevé (≥75)', () => {
      const { container } = render(<PrecedentBadge score={85} showTooltip={false} />)
      const badge = container.querySelector('.bg-green-600')
      expect(badge).toBeInTheDocument()
    })

    it('applique classe amber pour score moyen (50-74)', () => {
      const { container } = render(<PrecedentBadge score={60} showTooltip={false} />)
      const badge = container.querySelector('.bg-amber-500')
      expect(badge).toBeInTheDocument()
    })

    it('applique classe bleue pour score standard (<50)', () => {
      const { container } = render(<PrecedentBadge score={30} showTooltip={false} />)
      const badge = container.querySelector('.border-blue-300')
      expect(badge).toBeInTheDocument()
    })

    it('seuil 75 : score 75 = vert, score 74 = amber', () => {
      const { container: container75 } = render(<PrecedentBadge score={75} showTooltip={false} />)
      expect(container75.querySelector('.bg-green-600')).toBeInTheDocument()

      const { container: container74 } = render(<PrecedentBadge score={74} showTooltip={false} />)
      expect(container74.querySelector('.bg-amber-500')).toBeInTheDocument()
    })

    it('seuil 50 : score 50 = amber, score 49 = bleu', () => {
      const { container: container50 } = render(<PrecedentBadge score={50} showTooltip={false} />)
      expect(container50.querySelector('.bg-amber-500')).toBeInTheDocument()

      const { container: container49 } = render(<PrecedentBadge score={49} showTooltip={false} />)
      expect(container49.querySelector('.border-blue-300')).toBeInTheDocument()
    })
  })

  describe('Tailles', () => {
    it('applique taille sm correctement', () => {
      const { container } = render(<PrecedentBadge score={85} size="sm" showTooltip={false} />)
      const badge = container.querySelector('.text-xs')
      expect(badge).toBeInTheDocument()
    })

    it('applique taille md par défaut', () => {
      const { container } = render(<PrecedentBadge score={85} showTooltip={false} />)
      const badge = container.querySelector('.text-sm')
      expect(badge).toBeInTheDocument()
    })

    it('applique taille lg correctement', () => {
      const { container } = render(<PrecedentBadge score={85} size="lg" showTooltip={false} />)
      const badge = container.querySelector('.text-base')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('Tooltip', () => {
    it('affiche tooltip par défaut', () => {
      render(<PrecedentBadge score={85} />)
      // Tooltip trigger est présent
      expect(screen.getByText('85').closest('[role="button"]')).toBeInTheDocument()
    })

    it('masque tooltip quand showTooltip=false', () => {
      render(<PrecedentBadge score={85} showTooltip={false} />)
      // Pas de trigger tooltip
      expect(screen.getByText('85').closest('[role="button"]')).not.toBeInTheDocument()
    })

    it('affiche le score dans le tooltip au survol', async () => {
      const user = userEvent.setup()
      render(<PrecedentBadge score={85} />)

      const trigger = screen.getByText('85').closest('[role="button"]')!
      await user.hover(trigger)

      // Tooltip content devrait apparaître (timing peut varier)
      // Note: peut nécessiter waitFor selon timing Radix UI
      expect(screen.getByText(/Score de Précédent : 85/i)).toBeInTheDocument()
    })

    it('affiche "Autorité forte" pour score élevé', async () => {
      const user = userEvent.setup()
      render(<PrecedentBadge score={85} />)

      const trigger = screen.getByText('85').closest('[role="button"]')!
      await user.hover(trigger)

      expect(screen.getByText(/Autorité forte/i)).toBeInTheDocument()
    })

    it('affiche "Influence modérée" pour score moyen', async () => {
      const user = userEvent.setup()
      render(<PrecedentBadge score={60} />)

      const trigger = screen.getByText('60').closest('[role="button"]')!
      await user.hover(trigger)

      expect(screen.getByText(/Influence modérée/i)).toBeInTheDocument()
    })

    it('affiche "Précédent ordinaire" pour score standard', async () => {
      const user = userEvent.setup()
      render(<PrecedentBadge score={30} />)

      const trigger = screen.getByText('30').closest('[role="button"]')!
      await user.hover(trigger)

      expect(screen.getByText(/Précédent ordinaire/i)).toBeInTheDocument()
    })
  })

  describe('Icône', () => {
    it('affiche icône TrendingUp', () => {
      const { container } = render(<PrecedentBadge score={85} showTooltip={false} />)
      // SVG icon présent (recherche par classe Lucide)
      const icon = container.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('ClassName personnalisée', () => {
    it('applique className supplémentaire', () => {
      const { container } = render(
        <PrecedentBadge score={85} showTooltip={false} className="custom-class" />
      )
      const badge = container.querySelector('.custom-class')
      expect(badge).toBeInTheDocument()
    })
  })
})

// =============================================================================
// TESTS HELPERS
// =============================================================================

describe('sortByPrecedentScore', () => {
  it('trie par score décroissant', () => {
    const items = [
      { id: '1', precedentValue: 50 },
      { id: '2', precedentValue: 85 },
      { id: '3', precedentValue: 30 },
    ]

    const sorted = [...items].sort(sortByPrecedentScore)

    expect(sorted[0].id).toBe('2') // 85
    expect(sorted[1].id).toBe('1') // 50
    expect(sorted[2].id).toBe('3') // 30
  })

  it('traite precedentValue undefined comme 0', () => {
    const items = [
      { id: '1', precedentValue: 50 },
      { id: '2' }, // undefined
      { id: '3', precedentValue: 30 },
    ]

    const sorted = [...items].sort(sortByPrecedentScore)

    expect(sorted[0].id).toBe('1') // 50
    expect(sorted[1].id).toBe('3') // 30
    expect(sorted[2].id).toBe('2') // 0 (undefined)
  })

  it('préserve ordre pour scores égaux', () => {
    const items = [
      { id: '1', precedentValue: 50 },
      { id: '2', precedentValue: 50 },
      { id: '3', precedentValue: 50 },
    ]

    const sorted = [...items].sort(sortByPrecedentScore)

    // Ordre stable (même ordre qu'avant)
    expect(sorted[0].id).toBe('1')
    expect(sorted[1].id).toBe('2')
    expect(sorted[2].id).toBe('3')
  })
})

describe('hasPrecedentScoreAbove', () => {
  it('retourne true si score >= minScore', () => {
    const item = { precedentValue: 85 }
    expect(hasPrecedentScoreAbove(item, 75)).toBe(true)
    expect(hasPrecedentScoreAbove(item, 85)).toBe(true)
  })

  it('retourne false si score < minScore', () => {
    const item = { precedentValue: 50 }
    expect(hasPrecedentScoreAbove(item, 75)).toBe(false)
  })

  it('traite precedentValue undefined comme 0', () => {
    const item = {}
    expect(hasPrecedentScoreAbove(item, 1)).toBe(false)
    expect(hasPrecedentScoreAbove(item, 0)).toBe(true)
  })

  it('fonctionne avec minScore=0', () => {
    const item1 = { precedentValue: 50 }
    const item2 = { precedentValue: 0 }
    const item3 = {}

    expect(hasPrecedentScoreAbove(item1, 0)).toBe(true)
    expect(hasPrecedentScoreAbove(item2, 0)).toBe(true)
    expect(hasPrecedentScoreAbove(item3, 0)).toBe(true)
  })
})
