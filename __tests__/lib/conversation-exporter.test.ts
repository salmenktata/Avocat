/**
 * Tests pour le service d'export de conversations
 *
 * Couvre:
 * - Export Markdown
 * - Export JSON
 * - Export Texte brut
 * - Formatage des sources
 * - Métadonnées
 */

import { describe, it, expect } from 'vitest'
import {
  exportConversation,
} from '@/lib/export/conversation-exporter'
import type { ChatMessage } from '@/components/assistant-ia/ChatMessages'

// Type pour les données de test
interface ConversationData {
  id: string
  title: string
  createdAt: Date
  updatedAt?: Date
  messages: ChatMessage[]
}

const mockConversation: ConversationData = {
  id: 'conv-123',
  title: 'Test Conversation',
  createdAt: new Date('2025-01-15T10:00:00Z'),
  updatedAt: new Date('2025-01-15T11:00:00Z'),
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Quelle est la procédure de divorce?',
      sources: [],
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'La procédure de divorce en Tunisie...',
      sources: [
        {
          documentId: 'doc-1',
          documentName: 'Code du Statut Personnel',
          chunkContent: 'Article 30 - Le divorce...',
          similarity: 0.92,
        },
      ],
      createdAt: new Date('2025-01-15T10:01:00Z'),
    },
  ],
}

describe('Conversation Exporter', () => {
  describe('exportConversation - Markdown', () => {
    it('devrait exporter en format Markdown', () => {
      const result = exportConversation(mockConversation, {
        format: 'markdown',
        includeSources: true,
        includeMetadata: true,
        locale: 'fr',
      })

      expect(result).toContain('# Test Conversation')
      expect(result).toContain('**Vous**')
      expect(result).toContain('**Qadhya**')
      expect(result).toContain('Quelle est la procédure de divorce?')
      expect(result).toContain('La procédure de divorce en Tunisie...')
    })

    it('devrait inclure les sources si demandé', () => {
      const result = exportConversation(mockConversation, {
        format: 'markdown',
        includeSources: true,
        includeMetadata: false,
        locale: 'fr',
      })

      expect(result).toContain('**Sources:**')
      expect(result).toContain('Code du Statut Personnel')
      expect(result).toContain('92%')
    })

    it('devrait exclure les sources si non demandé', () => {
      const result = exportConversation(mockConversation, {
        format: 'markdown',
        includeSources: false,
        includeMetadata: false,
        locale: 'fr',
      })

      expect(result).not.toContain('**Sources:**')
      expect(result).not.toContain('Code du Statut Personnel')
    })

    it('devrait inclure les métadonnées si demandé', () => {
      const result = exportConversation(mockConversation, {
        format: 'markdown',
        includeSources: false,
        includeMetadata: true,
        locale: 'fr',
      })

      expect(result).toContain('conv-123')
      expect(result).toContain('**ID:**')
      expect(result).toContain('**Date:**')
    })
  })

  describe('exportConversation - JSON', () => {
    it('devrait exporter en format JSON valide', () => {
      const result = exportConversation(mockConversation, {
        format: 'json',
        includeSources: true,
        includeMetadata: true,
        locale: 'fr',
      })

      const parsed = JSON.parse(result)
      expect(parsed).toBeDefined()
      expect(parsed.id).toBe('conv-123')
      expect(parsed.title).toBe('Test Conversation')
      expect(parsed.messages).toHaveLength(2)
    })

    it('devrait inclure les sources dans JSON si demandé', () => {
      const result = exportConversation(mockConversation, {
        format: 'json',
        includeSources: true,
        includeMetadata: false,
        locale: 'fr',
      })

      const parsed = JSON.parse(result)
      expect(parsed.messages[1].sources).toHaveLength(1)
      expect(parsed.messages[1].sources[0].documentName).toBe('Code du Statut Personnel')
    })

    it('devrait exclure les sources dans JSON si non demandé', () => {
      const result = exportConversation(mockConversation, {
        format: 'json',
        includeSources: false,
        includeMetadata: false,
        locale: 'fr',
      })

      const parsed = JSON.parse(result)
      expect(parsed.messages[1].sources).toBeUndefined()
    })
  })

  describe('exportConversation - Text', () => {
    it('devrait exporter en format texte brut', () => {
      const result = exportConversation(mockConversation, {
        format: 'text',
        includeSources: false,
        includeMetadata: false,
        locale: 'fr',
      })

      expect(result).toContain('Test Conversation')
      expect(result).toContain('VOUS')
      expect(result).toContain('QADHYA')
      expect(result).not.toContain('**')
      expect(result).not.toContain('# ')
    })

    it('devrait inclure les sources en texte si demandé', () => {
      const result = exportConversation(mockConversation, {
        format: 'text',
        includeSources: true,
        includeMetadata: false,
        locale: 'fr',
      })

      expect(result).toContain('Sources consultées:')
      expect(result).toContain('Code du Statut Personnel')
    })
  })

  describe('Conversation vide', () => {
    it('devrait gérer une conversation sans messages', () => {
      const emptyConversation: ConversationData = {
        id: 'empty-conv',
        title: 'Empty',
        createdAt: new Date(),
        messages: [],
      }

      const result = exportConversation(emptyConversation, {
        format: 'markdown',
        includeSources: true,
        includeMetadata: true,
        locale: 'fr',
      })

      expect(result).toContain('# Empty')
      expect(result).toContain('empty-conv')
    })
  })
})
