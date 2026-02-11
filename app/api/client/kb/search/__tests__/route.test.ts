/**
 * Tests Unitaires : API /api/client/kb/search
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

vi.mock('@/lib/ai/unified-rag-service', () => ({
  search: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import { search } from '@/lib/ai/unified-rag-service'

// =============================================================================
// MOCK DATA
// =============================================================================

const mockSession = {
  user: { id: 'user-123', email: 'test@example.com' },
}

const mockResults = [
  {
    kbId: 'kb-1',
    chunkId: 'chunk-1',
    title: 'Article 371 COC',
    category: 'codes',
    chunkContent: 'Prescription quinze ans...',
    similarity: 0.92,
    metadata: {
      decisionDate: new Date('2020-01-01'),
      tribunalLabelFr: null,
      citedByCount: 15,
    },
  },
  {
    kbId: 'kb-2',
    chunkId: 'chunk-2',
    title: 'Arrêt 2023-001',
    category: 'jurisprudence',
    chunkContent: 'La Cour confirme...',
    similarity: 0.88,
    metadata: {
      decisionDate: new Date('2023-06-15'),
      tribunalLabelFr: 'Cour de Cassation',
      citedByCount: 8,
    },
  },
]

// =============================================================================
// HELPERS
// =============================================================================

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/client/kb/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/client/kb/search')
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return new NextRequest(url, { method: 'GET' })
}

// =============================================================================
// TESTS POST
// =============================================================================

describe('POST /api/client/kb/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentification', () => {
    it('retourne 401 si pas de session', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)

      const req = createPostRequest({ query: 'test' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Non authentifié')
    })

    it('accepte session valide', async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(search).mockResolvedValue(mockResults as any)

      const req = createPostRequest({ query: 'test' })
      const response = await POST(req)

      expect(response.status).toBe(200)
    })
  })

  describe('Validation requête', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(search).mockResolvedValue(mockResults as any)
    })

    it('retourne 400 si query manquante', async () => {
      const req = createPostRequest({})
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Query requise')
    })

    it('retourne 400 si query vide', async () => {
      const req = createPostRequest({ query: '   ' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Query requise')
    })

    it('retourne 400 si query trop longue (>500 chars)', async () => {
      const longQuery = 'a'.repeat(501)
      const req = createPostRequest({ query: longQuery })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Query trop longue (max 500 caractères)')
    })

    it('accepte query de 500 chars exactement', async () => {
      const query = 'a'.repeat(500)
      const req = createPostRequest({ query })
      const response = await POST(req)

      expect(response.status).toBe(200)
    })

    it('retourne 400 si limit < 1', async () => {
      const req = createPostRequest({ query: 'test', limit: 0 })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Limit doit être entre 1 et 100')
    })

    it('retourne 400 si limit > 100', async () => {
      const req = createPostRequest({ query: 'test', limit: 101 })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Limit doit être entre 1 et 100')
    })

    it('accepte limit = 1', async () => {
      const req = createPostRequest({ query: 'test', limit: 1 })
      const response = await POST(req)

      expect(response.status).toBe(200)
    })

    it('accepte limit = 100', async () => {
      const req = createPostRequest({ query: 'test', limit: 100 })
      const response = await POST(req)

      expect(response.status).toBe(200)
    })
  })

  describe('Construction filtres RAG', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(search).mockResolvedValue(mockResults as any)
    })

    it('appelle search avec filtres basiques', async () => {
      const req = createPostRequest({
        query: 'prescription',
        filters: {
          category: 'codes',
          language: 'fr',
        },
        limit: 50,
      })

      await POST(req)

      expect(search).toHaveBeenCalledWith(
        'prescription',
        {
          category: 'codes',
          domain: undefined,
          language: 'fr',
          limit: 50,
        },
        { includeRelations: true, useCache: true }
      )
    })

    it('ajoute metadataFilters si tribunal fourni', async () => {
      const req = createPostRequest({
        query: 'test',
        filters: { tribunal: 'TRIBUNAL_CASSATION' },
      })

      await POST(req)

      expect(search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          metadataFilters: expect.objectContaining({
            tribunalCode: 'TRIBUNAL_CASSATION',
          }),
        }),
        expect.anything()
      )
    })

    it('ajoute chambre dans metadataFilters', async () => {
      const req = createPostRequest({
        query: 'test',
        filters: { chambre: 'CHAMBRE_CIVILE' },
      })

      await POST(req)

      expect(search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          metadataFilters: expect.objectContaining({
            chambreCode: 'CHAMBRE_CIVILE',
          }),
        }),
        expect.anything()
      )
    })

    it('ajoute decisionDateRange si dateFrom/dateTo fournis', async () => {
      const req = createPostRequest({
        query: 'test',
        filters: {
          dateFrom: '2020-01-01',
          dateTo: '2023-12-31',
        },
      })

      await POST(req)

      expect(search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          metadataFilters: expect.objectContaining({
            decisionDateRange: {
              from: new Date('2020-01-01'),
              to: new Date('2023-12-31'),
            },
          }),
        }),
        expect.anything()
      )
    })

    it('utilise limit par défaut = 20', async () => {
      const req = createPostRequest({ query: 'test' })

      await POST(req)

      expect(search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ limit: 20 }),
        expect.anything()
      )
    })

    it('utilise includeRelations par défaut = true', async () => {
      const req = createPostRequest({ query: 'test' })

      await POST(req)

      expect(search).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ includeRelations: true })
      )
    })
  })

  describe('Tri résultats', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(search).mockResolvedValue([...mockResults] as any)
    })

    it('trie par relevance (défaut) - aucun changement', async () => {
      const req = createPostRequest({ query: 'test', sortBy: 'relevance' })
      const response = await POST(req)
      const data = await response.json()

      // mockResults déjà triés par similarity
      expect(data.results[0].kbId).toBe('kb-1') // 0.92
      expect(data.results[1].kbId).toBe('kb-2') // 0.88
    })

    it('trie par date décroissante', async () => {
      const req = createPostRequest({ query: 'test', sortBy: 'date' })
      const response = await POST(req)
      const data = await response.json()

      // kb-2 (2023-06-15) avant kb-1 (2020-01-01)
      expect(data.results[0].kbId).toBe('kb-2')
      expect(data.results[1].kbId).toBe('kb-1')
    })

    it('trie par citations décroissantes', async () => {
      const req = createPostRequest({ query: 'test', sortBy: 'citations' })
      const response = await POST(req)
      const data = await response.json()

      // kb-1 (15 citations) avant kb-2 (8 citations)
      expect(data.results[0].kbId).toBe('kb-1')
      expect(data.results[1].kbId).toBe('kb-2')
    })
  })

  describe('Réponse succès', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(search).mockResolvedValue(mockResults as any)
    })

    it('retourne 200 avec results', async () => {
      const req = createPostRequest({ query: 'test' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results).toHaveLength(2)
    })

    it('retourne pagination info', async () => {
      const req = createPostRequest({ query: 'test', limit: 20 })
      const response = await POST(req)
      const data = await response.json()

      expect(data.pagination).toEqual({
        total: 2,
        limit: 20,
        hasMore: false,
      })
    })

    it('retourne metadata avec processingTime', async () => {
      const req = createPostRequest({ query: 'test' })
      const response = await POST(req)
      const data = await response.json()

      expect(data.metadata).toBeDefined()
      expect(data.metadata.processingTimeMs).toBeGreaterThan(0)
      expect(data.metadata.cacheHit).toBe(false)
    })
  })

  describe('Gestion erreurs', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    })

    it('retourne 500 si search échoue', async () => {
      vi.mocked(search).mockRejectedValue(new Error('DB Error'))

      const req = createPostRequest({ query: 'test' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('DB Error')
    })
  })
})

// =============================================================================
// TESTS GET
// =============================================================================

describe('GET /api/client/kb/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentification', () => {
    it('retourne 401 si pas de session', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)

      const req = createGetRequest({ q: 'test' })
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Non authentifié')
    })
  })

  describe('Query params', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(search).mockResolvedValue(mockResults as any)
    })

    it('retourne 400 si query param "q" manquant', async () => {
      const req = createGetRequest({})
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Query parameter "q" requise')
    })

    it('accepte query param "q"', async () => {
      const req = createGetRequest({ q: 'prescription' })
      const response = await GET(req)

      expect(response.status).toBe(200)
      expect(search).toHaveBeenCalledWith('prescription', expect.anything())
    })

    it('parse limit param', async () => {
      const req = createGetRequest({ q: 'test', limit: '50' })
      await GET(req)

      expect(search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ limit: 50 })
      )
    })

    it('utilise limit par défaut = 20', async () => {
      const req = createGetRequest({ q: 'test' })
      await GET(req)

      expect(search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ limit: 20 })
      )
    })

    it('parse category param', async () => {
      const req = createGetRequest({ q: 'test', category: 'codes' })
      await GET(req)

      expect(search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({ category: 'codes' })
      )
    })
  })

  describe('Réponse succès', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(search).mockResolvedValue(mockResults as any)
    })

    it('retourne 200 avec results', async () => {
      const req = createGetRequest({ q: 'test' })
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results).toHaveLength(2)
    })

    it('retourne pagination et metadata', async () => {
      const req = createGetRequest({ q: 'test' })
      const response = await GET(req)
      const data = await response.json()

      expect(data.pagination).toBeDefined()
      expect(data.metadata).toBeDefined()
      expect(data.metadata.processingTimeMs).toBeGreaterThan(0)
    })
  })

  describe('Gestion erreurs', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    })

    it('retourne 500 si search échoue', async () => {
      vi.mocked(search).mockRejectedValue(new Error('DB Error'))

      const req = createGetRequest({ q: 'test' })
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('DB Error')
    })
  })
})
