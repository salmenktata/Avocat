/**
 * Tests Unitaires : API /api/client/jurisprudence/timeline
 *
 * Sprint 5 - Tests & Performance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from '../route'
import { NextRequest } from 'next/server'

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth/auth-options', () => ({
  authOptions: {},
}))

vi.mock('@/lib/ai/jurisprudence-timeline-service', () => ({
  buildJurisprudenceTimeline: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import { buildJurisprudenceTimeline } from '@/lib/ai/jurisprudence-timeline-service'

// =============================================================================
// MOCK DATA
// =============================================================================

const mockSession = {
  user: { id: 'user-123', email: 'test@example.com' },
}

const mockTimeline = {
  events: [
    {
      id: 'event-1',
      title: 'Arrêt 2023-001',
      decisionDate: new Date('2023-06-15'),
      eventType: 'major_shift',
      tribunalCode: 'TRIBUNAL_CASSATION',
      domain: 'civil',
      precedentValue: 85,
      citedByCount: 12,
    },
    {
      id: 'event-2',
      title: 'Arrêt 2022-001',
      decisionDate: new Date('2022-12-20'),
      eventType: 'confirmation',
      tribunalCode: 'TRIBUNAL_CASSATION',
      domain: 'commercial',
      precedentValue: 70,
      citedByCount: 8,
    },
  ],
  stats: {
    totalEvents: 2,
    majorShifts: 1,
    confirmations: 1,
    nuances: 0,
    standardEvents: 0,
    dateRange: {
      earliest: new Date('2022-12-20'),
      latest: new Date('2023-06-15'),
    },
    topPrecedents: [
      { id: 'event-1', title: 'Arrêt 2023-001', precedentValue: 85, citedByCount: 12 },
    ],
  },
}

// =============================================================================
// HELPERS
// =============================================================================

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/client/jurisprudence/timeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/client/jurisprudence/timeline')
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return new NextRequest(url, { method: 'GET' })
}

// =============================================================================
// TESTS POST
// =============================================================================

describe('POST /api/client/jurisprudence/timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentification', () => {
    it('retourne 401 si pas de session', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)

      const req = createPostRequest({})
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Non authentifié')
    })

    it('accepte session valide', async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(buildJurisprudenceTimeline).mockResolvedValue(mockTimeline as any)

      const req = createPostRequest({})
      const response = await POST(req)

      expect(response.status).toBe(200)
    })
  })

  describe('Validation requête', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(buildJurisprudenceTimeline).mockResolvedValue(mockTimeline as any)
    })

    it('retourne 400 si limit < 1', async () => {
      const req = createPostRequest({ limit: 0 })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Limit doit être entre 1 et 500')
    })

    it('retourne 400 si limit > 500', async () => {
      const req = createPostRequest({ limit: 501 })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Limit doit être entre 1 et 500')
    })

    it('accepte limit = 1', async () => {
      const req = createPostRequest({ limit: 1 })
      const response = await POST(req)

      expect(response.status).toBe(200)
    })

    it('accepte limit = 500', async () => {
      const req = createPostRequest({ limit: 500 })
      const response = await POST(req)

      expect(response.status).toBe(200)
    })

    it('utilise limit par défaut = 100', async () => {
      const req = createPostRequest({})
      await POST(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith({
        filters: {},
        limit: 100,
        includeStats: true,
      })
    })
  })

  describe('Construction filtres', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(buildJurisprudenceTimeline).mockResolvedValue(mockTimeline as any)
    })

    it('appelle buildJurisprudenceTimeline avec filtres basiques', async () => {
      const req = createPostRequest({
        filters: {
          domain: 'civil',
          tribunalCode: 'TRIBUNAL_CASSATION',
          eventType: 'major_shift',
        },
        limit: 200,
      })

      await POST(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith({
        filters: {
          domain: 'civil',
          tribunalCode: 'TRIBUNAL_CASSATION',
          chambreCode: undefined,
          eventType: 'major_shift',
        },
        limit: 200,
        includeStats: true,
      })
    })

    it('ajoute chambreCode aux filtres', async () => {
      const req = createPostRequest({
        filters: { chambreCode: 'CHAMBRE_CIVILE' },
      })

      await POST(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            chambreCode: 'CHAMBRE_CIVILE',
          }),
        })
      )
    })

    it('parse dateRange si dateFrom/dateTo fournis', async () => {
      const req = createPostRequest({
        filters: {
          dateFrom: '2020-01-01',
          dateTo: '2023-12-31',
        },
      })

      await POST(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            dateRange: {
              from: new Date('2020-01-01'),
              to: new Date('2023-12-31'),
            },
          }),
        })
      )
    })

    it('parse dateFrom seul', async () => {
      const req = createPostRequest({
        filters: { dateFrom: '2020-01-01' },
      })

      await POST(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            dateRange: {
              from: new Date('2020-01-01'),
              to: undefined,
            },
          }),
        })
      )
    })

    it('parse dateTo seul', async () => {
      const req = createPostRequest({
        filters: { dateTo: '2023-12-31' },
      })

      await POST(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            dateRange: {
              from: undefined,
              to: new Date('2023-12-31'),
            },
          }),
        })
      )
    })

    it('utilise includeStats par défaut = true', async () => {
      const req = createPostRequest({})
      await POST(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith(
        expect.objectContaining({ includeStats: true })
      )
    })

    it('respecte includeStats=false', async () => {
      const req = createPostRequest({ includeStats: false })
      await POST(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith(
        expect.objectContaining({ includeStats: false })
      )
    })
  })

  describe('Réponse succès', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(buildJurisprudenceTimeline).mockResolvedValue(mockTimeline as any)
    })

    it('retourne 200 avec events', async () => {
      const req = createPostRequest({})
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.events).toHaveLength(2)
    })

    it('retourne stats si includeStats=true', async () => {
      const req = createPostRequest({ includeStats: true })
      const response = await POST(req)
      const data = await response.json()

      expect(data.stats).toBeDefined()
      expect(data.stats.totalEvents).toBe(2)
      expect(data.stats.majorShifts).toBe(1)
    })

    it('ne retourne pas stats si includeStats=false', async () => {
      const req = createPostRequest({ includeStats: false })
      const response = await POST(req)
      const data = await response.json()

      expect(data.stats).toBeUndefined()
    })

    it('retourne metadata avec processingTime', async () => {
      const req = createPostRequest({})
      const response = await POST(req)
      const data = await response.json()

      expect(data.metadata).toBeDefined()
      expect(data.metadata.processingTimeMs).toBeGreaterThan(0)
      expect(data.metadata.eventsGenerated).toBe(2)
    })

    it('convertit dates en ISO strings dans metadata', async () => {
      const req = createPostRequest({})
      const response = await POST(req)
      const data = await response.json()

      expect(data.metadata.dateRange.earliest).toBe('2022-12-20T00:00:00.000Z')
      expect(data.metadata.dateRange.latest).toBe('2023-06-15T00:00:00.000Z')
    })

    it('gère dateRange null', async () => {
      const timelineWithoutDates = {
        ...mockTimeline,
        stats: {
          ...mockTimeline.stats,
          dateRange: { earliest: null, latest: null },
        },
      }
      vi.mocked(buildJurisprudenceTimeline).mockResolvedValue(timelineWithoutDates as any)

      const req = createPostRequest({})
      const response = await POST(req)
      const data = await response.json()

      expect(data.metadata.dateRange.earliest).toBeNull()
      expect(data.metadata.dateRange.latest).toBeNull()
    })
  })

  describe('Gestion erreurs', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    })

    it('retourne 500 si buildJurisprudenceTimeline échoue', async () => {
      vi.mocked(buildJurisprudenceTimeline).mockRejectedValue(new Error('DB Error'))

      const req = createPostRequest({})
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('DB Error')
    })

    it('gère erreurs non-Error', async () => {
      vi.mocked(buildJurisprudenceTimeline).mockRejectedValue('Unknown error')

      const req = createPostRequest({})
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Erreur serveur')
    })
  })
})

// =============================================================================
// TESTS GET
// =============================================================================

describe('GET /api/client/jurisprudence/timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentification', () => {
    it('retourne 401 si pas de session', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)

      const req = createGetRequest({})
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Non authentifié')
    })
  })

  describe('Query params', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(buildJurisprudenceTimeline).mockResolvedValue(mockTimeline as any)
    })

    it('fonctionne sans params', async () => {
      const req = createGetRequest({})
      const response = await GET(req)

      expect(response.status).toBe(200)
    })

    it('parse domain param', async () => {
      const req = createGetRequest({ domain: 'civil' })
      await GET(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ domain: 'civil' }),
        })
      )
    })

    it('parse limit param', async () => {
      const req = createGetRequest({ limit: '200' })
      await GET(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 200 })
      )
    })

    it('utilise limit par défaut = 100', async () => {
      const req = createGetRequest({})
      await GET(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      )
    })

    it('utilise includeStats = true par défaut', async () => {
      const req = createGetRequest({})
      await GET(req)

      expect(buildJurisprudenceTimeline).toHaveBeenCalledWith(
        expect.objectContaining({ includeStats: true })
      )
    })
  })

  describe('Réponse succès', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(buildJurisprudenceTimeline).mockResolvedValue(mockTimeline as any)
    })

    it('retourne 200 avec events et stats', async () => {
      const req = createGetRequest({})
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.events).toHaveLength(2)
      expect(data.stats).toBeDefined()
    })

    it('retourne metadata complète', async () => {
      const req = createGetRequest({})
      const response = await GET(req)
      const data = await response.json()

      expect(data.metadata).toBeDefined()
      expect(data.metadata.processingTimeMs).toBeGreaterThan(0)
      expect(data.metadata.eventsGenerated).toBe(2)
      expect(data.metadata.dateRange).toBeDefined()
    })
  })

  describe('Gestion erreurs', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    })

    it('retourne 500 si buildJurisprudenceTimeline échoue', async () => {
      vi.mocked(buildJurisprudenceTimeline).mockRejectedValue(new Error('DB Error'))

      const req = createGetRequest({})
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('DB Error')
    })
  })
})
