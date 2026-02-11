/**
 * Tests Unitaires : EventCard
 *
 * Sprint 5 - Tests & Performance
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventCard } from '../EventCard'
import type { TimelineEvent } from '../TimelineViewer'

// =============================================================================
// MOCK DATA
// =============================================================================

const mockEvent: TimelineEvent = {
  id: 'event-1',
  title: 'Arrêt 12345 - Prescription en matière civile',
  decisionNumber: '12345',
  decisionDate: new Date('2023-06-15'),
  tribunalCode: 'TRIBUNAL_CASSATION',
  tribunalLabel: 'Cour de Cassation',
  chambreCode: 'CHAMBRE_CIVILE',
  chambreLabel: 'Chambre Civile',
  domain: 'civil',
  domainLabel: 'Droit Civil',
  category: 'jurisprudence',
  eventType: 'major_shift',
  eventDescription: 'Revirement important sur la prescription civile',
  precedentValue: 85,
  citedByCount: 12,
  hasOverrules: true,
  isOverruled: false,
  overrulesIds: ['event-100', 'event-101'],
  confirmsIds: [],
  distinguishesIds: ['event-200'],
  summary: 'Cet arrêt modifie substantiellement la jurisprudence établie...',
  legalBasis: ['Article 371 COC', 'Article 374 COC'],
  solution: 'La Cour casse et annule le jugement attaqué',
}

const mockConfirmationEvent: TimelineEvent = {
  ...mockEvent,
  id: 'event-2',
  eventType: 'confirmation',
  eventDescription: 'Confirmation de la jurisprudence établie',
  hasOverrules: false,
  overrulesIds: [],
  confirmsIds: ['event-300', 'event-301'],
}

const mockNuanceEvent: TimelineEvent = {
  ...mockEvent,
  id: 'event-3',
  eventType: 'nuance',
  eventDescription: 'Distinction apportée à la règle générale',
  hasOverrules: false,
  overrulesIds: [],
  confirmsIds: [],
  distinguishesIds: ['event-400'],
}

const mockStandardEvent: TimelineEvent = {
  ...mockEvent,
  id: 'event-4',
  eventType: 'standard',
  eventDescription: 'Arrêt standard sans impact majeur',
  hasOverrules: false,
  overrulesIds: [],
  confirmsIds: [],
  distinguishesIds: [],
  isOverruled: false,
}

// =============================================================================
// TESTS MODE INLINE
// =============================================================================

describe('EventCard - Mode Inline', () => {
  describe('Affichage basique', () => {
    it('affiche le titre', () => {
      render(<EventCard event={mockEvent} />)
      expect(screen.getByText(mockEvent.title)).toBeInTheDocument()
    })

    it('affiche la description événement', () => {
      render(<EventCard event={mockEvent} />)
      expect(screen.getByText(mockEvent.eventDescription!)).toBeInTheDocument()
    })

    it('affiche le badge type événement', () => {
      render(<EventCard event={mockEvent} />)
      expect(screen.getByText('Revirement Jurisprudentiel')).toBeInTheDocument()
    })

    it('affiche la date si présente', () => {
      render(<EventCard event={mockEvent} />)
      expect(screen.getByText(/15\/06\/2023/)).toBeInTheDocument()
    })

    it('masque la date si absente', () => {
      const eventSansDate = { ...mockEvent, decisionDate: null }
      render(<EventCard event={eventSansDate} />)
      expect(screen.queryByText(/\d{2}\/\d{2}\/\d{4}/)).not.toBeInTheDocument()
    })

    it('affiche le score précédent si > 0', () => {
      render(<EventCard event={mockEvent} />)
      expect(screen.getByText(`Score: ${mockEvent.precedentValue}`)).toBeInTheDocument()
    })

    it('masque le score si = 0', () => {
      const eventSansScore = { ...mockEvent, precedentValue: 0 }
      render(<EventCard event={eventSansScore} />)
      expect(screen.queryByText(/Score:/)).not.toBeInTheDocument()
    })

    it('affiche le tribunal si présent', () => {
      render(<EventCard event={mockEvent} />)
      expect(screen.getByText(mockEvent.tribunalLabel!)).toBeInTheDocument()
    })

    it('affiche le numéro décision si présent', () => {
      render(<EventCard event={mockEvent} />)
      expect(screen.getByText(`N° ${mockEvent.decisionNumber}`)).toBeInTheDocument()
    })

    it('affiche le nombre de citations si > 0', () => {
      render(<EventCard event={mockEvent} />)
      expect(screen.getByText(`${mockEvent.citedByCount} citations`)).toBeInTheDocument()
    })

    it('masque citations si = 0', () => {
      const eventSansCitations = { ...mockEvent, citedByCount: 0 }
      render(<EventCard event={eventSansCitations} />)
      expect(screen.queryByText(/citations/)).not.toBeInTheDocument()
    })
  })

  describe('Types événements et couleurs', () => {
    it('affiche badge rouge pour major_shift', () => {
      const { container } = render(<EventCard event={mockEvent} />)
      expect(screen.getByText('Revirement Jurisprudentiel')).toBeInTheDocument()
      // Border rouge
      const card = container.querySelector('.border-red-300')
      expect(card).toBeInTheDocument()
    })

    it('affiche badge vert pour confirmation', () => {
      const { container } = render(<EventCard event={mockConfirmationEvent} />)
      expect(screen.getByText('Confirmation')).toBeInTheDocument()
      const card = container.querySelector('.border-green-300')
      expect(card).toBeInTheDocument()
    })

    it('affiche badge amber pour nuance', () => {
      const { container } = render(<EventCard event={mockNuanceEvent} />)
      expect(screen.getByText('Distinction/Précision')).toBeInTheDocument()
      const card = container.querySelector('.border-amber-300')
      expect(card).toBeInTheDocument()
    })

    it('affiche badge bleu pour standard', () => {
      const { container } = render(<EventCard event={mockStandardEvent} />)
      expect(screen.getByText('Arrêt Standard')).toBeInTheDocument()
      const card = container.querySelector('.border-blue-300')
      expect(card).toBeInTheDocument()
    })
  })

  describe('Interactivité', () => {
    it('est cliquable si onClick fourni', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<EventCard event={mockEvent} onClick={handleClick} />)

      const card = screen.getByText(mockEvent.title).closest('[role="button"]')
        || screen.getByText(mockEvent.title).closest('.cursor-pointer')

      await user.click(card!)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('hover change apparence', () => {
      const { container } = render(<EventCard event={mockEvent} />)
      const card = container.querySelector('.hover\\:shadow-md')
      expect(card).toBeInTheDocument()
    })
  })
})

// =============================================================================
// TESTS MODE MODAL
// =============================================================================

describe('EventCard - Mode Modal', () => {
  describe('Affichage modal', () => {
    it('ouvre dialog quand isModal=true', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      // Dialog ouvert
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('affiche titre dans DialogTitle', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText(mockEvent.title)).toBeInTheDocument()
    })

    it('affiche description complète', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText(mockEvent.eventDescription!)).toBeInTheDocument()
    })

    it('affiche bouton fermeture', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      const closeButton = screen.getByRole('button', { name: /close/i })
        || screen.getAllByRole('button').find(btn => btn.querySelector('svg'))
      expect(closeButton).toBeInTheDocument()
    })

    it('appelle onClose au clic sur X', async () => {
      const handleClose = vi.fn()
      const user = userEvent.setup()

      render(<EventCard event={mockEvent} isModal={true} onClose={handleClose} />)

      const closeButton = screen.getAllByRole('button').find(btn => btn.querySelector('svg'))!
      await user.click(closeButton)

      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Métadonnées étendues', () => {
    it('affiche tribunal avec icône', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Tribunal')).toBeInTheDocument()
      expect(screen.getByText(mockEvent.tribunalLabel!)).toBeInTheDocument()
    })

    it('affiche chambre avec icône', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Chambre')).toBeInTheDocument()
      expect(screen.getByText(mockEvent.chambreLabel!)).toBeInTheDocument()
    })

    it('affiche date décision formatée', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Date de décision')).toBeInTheDocument()
      expect(screen.getByText(/15 juin 2023/)).toBeInTheDocument()
    })

    it('affiche numéro décision', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Numéro de décision')).toBeInTheDocument()
      expect(screen.getByText(mockEvent.decisionNumber!)).toBeInTheDocument()
    })

    it('affiche domaine juridique', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Domaine juridique')).toBeInTheDocument()
      expect(screen.getByText(mockEvent.domainLabel!)).toBeInTheDocument()
    })

    it('affiche score précédent avec badge', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Score Précédent')).toBeInTheDocument()
      expect(screen.getByText(`${mockEvent.precedentValue}/100`)).toBeInTheDocument()
    })
  })

  describe('Résumé et base légale', () => {
    it('affiche résumé si présent', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Résumé')).toBeInTheDocument()
      expect(screen.getByText(mockEvent.summary!)).toBeInTheDocument()
    })

    it('affiche base légale si présente', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Base légale')).toBeInTheDocument()
      expect(screen.getByText('Article 371 COC')).toBeInTheDocument()
      expect(screen.getByText('Article 374 COC')).toBeInTheDocument()
    })

    it('affiche solution si présente', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Solution')).toBeInTheDocument()
      expect(screen.getByText(mockEvent.solution!)).toBeInTheDocument()
    })

    it('masque résumé si absent', () => {
      const eventSansResume = { ...mockEvent, summary: null }
      render(<EventCard event={eventSansResume} isModal={true} />)
      expect(screen.queryByText('Résumé')).not.toBeInTheDocument()
    })
  })

  describe('Relations juridiques', () => {
    it('affiche section Relations Juridiques', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Relations Juridiques')).toBeInTheDocument()
    })

    it('affiche "Renverse" si overrulesIds non vide', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Renverse')).toBeInTheDocument()
      expect(screen.getByText(`${mockEvent.overrulesIds.length} arrêt(s)`)).toBeInTheDocument()
    })

    it('affiche "Renversé" si isOverruled=true', () => {
      const eventRenverse = { ...mockEvent, isOverruled: true }
      render(<EventCard event={eventRenverse} isModal={true} />)
      expect(screen.getByText('Renversé')).toBeInTheDocument()
    })

    it('affiche "Confirme" si confirmsIds non vide', () => {
      render(<EventCard event={mockConfirmationEvent} isModal={true} />)
      expect(screen.getByText('Confirme')).toBeInTheDocument()
      expect(screen.getByText(`${mockConfirmationEvent.confirmsIds.length} arrêt(s)`)).toBeInTheDocument()
    })

    it('affiche "Distingue" si distinguishesIds non vide', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText('Distingue')).toBeInTheDocument()
      expect(screen.getByText(`${mockEvent.distinguishesIds.length} arrêt(s)`)).toBeInTheDocument()
    })

    it('affiche "Aucune relation" si aucune relation', () => {
      const eventSansRelations = {
        ...mockEvent,
        hasOverrules: false,
        isOverruled: false,
        overrulesIds: [],
        confirmsIds: [],
        distinguishesIds: [],
      }
      render(<EventCard event={eventSansRelations} isModal={true} />)
      expect(screen.getByText(/Aucune relation juridique identifiée/)).toBeInTheDocument()
    })

    it('affiche compteur citations', () => {
      render(<EventCard event={mockEvent} isModal={true} />)
      expect(screen.getByText(/Cité par :/)).toBeInTheDocument()
      expect(screen.getByText(`${mockEvent.citedByCount} arrêt(s)`)).toBeInTheDocument()
    })
  })

  describe('Couleurs relations', () => {
    it('section Renverse a border rouge', () => {
      const { container } = render(<EventCard event={mockEvent} isModal={true} />)
      const renverseSection = container.querySelector('.border-red-200')
      expect(renverseSection).toBeInTheDocument()
    })

    it('section Renversé a border amber', () => {
      const eventRenverse = { ...mockEvent, isOverruled: true }
      const { container } = render(<EventCard event={eventRenverse} isModal={true} />)
      const renverseSection = container.querySelector('.border-amber-200')
      expect(renverseSection).toBeInTheDocument()
    })

    it('section Confirme a border vert', () => {
      const { container } = render(<EventCard event={mockConfirmationEvent} isModal={true} />)
      const confirmeSection = container.querySelector('.border-green-200')
      expect(confirmeSection).toBeInTheDocument()
    })

    it('section Distingue a border bleu', () => {
      const { container } = render(<EventCard event={mockEvent} isModal={true} />)
      const distingueSection = container.querySelector('.border-blue-200')
      expect(distingueSection).toBeInTheDocument()
    })
  })
})
