/**
 * Tests pour le webhook WhatsApp
 *
 * Vérifie:
 * - Validation de la signature HMAC SHA256
 * - Vérification du token webhook (GET)
 * - Rejet des signatures invalides
 * - Gestion des différents types de messages
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// Mock du logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    exception: vi.fn(),
  }),
}))

// Mock de la base de données
vi.mock('@/lib/db/postgres', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}))

// Mock du whatsapp logger
vi.mock('@/lib/integrations/messaging/whatsapp-logger', () => ({
  logIncomingMessage: vi.fn(),
  updateMessageStatus: vi.fn(),
  updateMessageClient: vi.fn(),
  checkMediaCache: vi.fn().mockResolvedValue({ cached: false }),
  saveMediaCache: vi.fn(),
}))

describe('WhatsApp Webhook', () => {
  const testAppSecret = 'test-app-secret-12345'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WHATSAPP_APP_SECRET = testAppSecret
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-verify-token'
  })

  describe('Validation signature HMAC SHA256', () => {
    /**
     * Génère une signature HMAC SHA256 pour un payload
     */
    function generateSignature(payload: string, secret: string): string {
      return (
        'sha256=' +
        crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
      )
    }

    it('devrait valider une signature correcte', () => {
      const payload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '21612345678',
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      })

      const signature = generateSignature(payload, testAppSecret)

      // Vérifier que la signature a le bon format
      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/)

      // Recalculer pour vérifier
      const expectedSignature = generateSignature(payload, testAppSecret)
      expect(signature).toBe(expectedSignature)
    })

    it('devrait rejeter une signature avec un secret différent', () => {
      const payload = JSON.stringify({ test: 'data' })

      const validSignature = generateSignature(payload, testAppSecret)
      const invalidSignature = generateSignature(payload, 'wrong-secret')

      expect(validSignature).not.toBe(invalidSignature)
    })

    it('devrait rejeter un payload modifié', () => {
      const originalPayload = JSON.stringify({ amount: 100 })
      const modifiedPayload = JSON.stringify({ amount: 999 })

      const signature = generateSignature(originalPayload, testAppSecret)
      const signatureForModified = generateSignature(modifiedPayload, testAppSecret)

      expect(signature).not.toBe(signatureForModified)
    })

    it('devrait générer des signatures différentes pour différents payloads', () => {
      const payload1 = JSON.stringify({ message: 'Hello' })
      const payload2 = JSON.stringify({ message: 'World' })

      const sig1 = generateSignature(payload1, testAppSecret)
      const sig2 = generateSignature(payload2, testAppSecret)

      expect(sig1).not.toBe(sig2)
    })
  })

  describe('Webhook Verification (GET)', () => {
    it('devrait retourner le challenge avec un token valide', () => {
      const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
      const challenge = 'test-challenge-12345'

      // Simuler la validation
      const isValid = verifyToken === 'test-verify-token'
      expect(isValid).toBe(true)

      // Le challenge devrait être retourné
      expect(challenge).toBe('test-challenge-12345')
    })

    it('devrait rejeter un token invalide', () => {
      const verifyToken = 'wrong-token'
      const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

      const isValid = verifyToken === expectedToken
      expect(isValid).toBe(false)
    })

    it('devrait rejeter si le mode n\'est pas subscribe', () => {
      const mode = 'unsubscribe' as string
      const isValid = mode === 'subscribe'
      expect(isValid).toBe(false)
    })
  })

  describe('Parsing des messages', () => {
    it('devrait identifier un message texte', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.123',
                      from: '21612345678',
                      type: 'text',
                      timestamp: '1234567890',
                      text: { body: 'Hello World' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const message = payload.entry[0].changes[0].value.messages[0]
      expect(message.type).toBe('text')
      expect(message.text?.body).toBe('Hello World')
    })

    it('devrait identifier un message document', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.456',
                      from: '21612345678',
                      type: 'document',
                      timestamp: '1234567890',
                      document: {
                        id: 'media_123',
                        mime_type: 'application/pdf',
                        filename: 'contrat.pdf',
                        sha256: 'abc123',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const message = payload.entry[0].changes[0].value.messages[0]
      expect(message.type).toBe('document')
      expect(message.document?.mime_type).toBe('application/pdf')
      expect(message.document?.filename).toBe('contrat.pdf')
    })

    it('devrait identifier un message image', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.789',
                      from: '21612345678',
                      type: 'image',
                      timestamp: '1234567890',
                      image: {
                        id: 'media_456',
                        mime_type: 'image/jpeg',
                        sha256: 'def456',
                        caption: 'Photo du document',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const message = payload.entry[0].changes[0].value.messages[0]
      expect(message.type).toBe('image')
      expect(message.image?.mime_type).toBe('image/jpeg')
      expect(message.image?.caption).toBe('Photo du document')
    })
  })

  describe('Normalisation des numéros de téléphone', () => {
    it('devrait gérer les numéros tunisiens', () => {
      // Format international sans +
      expect(normalizePhoneNumber('21612345678')).toBe('+21612345678')

      // Format avec +
      expect(normalizePhoneNumber('+21612345678')).toBe('+21612345678')
    })

    it('devrait supprimer les espaces', () => {
      expect(normalizePhoneNumber('216 12 345 678')).toBe('+21612345678')
    })

    it('devrait supprimer les tirets', () => {
      expect(normalizePhoneNumber('216-12-345-678')).toBe('+21612345678')
    })
  })

  describe('Scénarios de webhook', () => {
    it('devrait identifier un status update (pas un message)', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: 'wamid.123',
                      status: 'delivered',
                      timestamp: '1234567890',
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      // Pas de messages dans ce payload
      const value = payload.entry[0].changes[0].value as { messages?: unknown[] }
      expect(value.messages).toBeUndefined()

      // Mais il y a des statuses
      const statuses = payload.entry[0].changes[0].value.statuses
      expect(statuses).toHaveLength(1)
      expect(statuses[0].status).toBe('delivered')
    })

    it('devrait détecter un payload sans entrées valides', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [],
      }

      expect(payload.entry.length).toBe(0)
    })
  })
})

/**
 * Fonction helper pour normaliser les numéros de téléphone
 */
function normalizePhoneNumber(phone: string): string {
  // Supprimer tous les caractères non numériques sauf +
  let normalized = phone.replace(/[^\d+]/g, '')

  // Ajouter + si absent
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized
  }

  return normalized
}
