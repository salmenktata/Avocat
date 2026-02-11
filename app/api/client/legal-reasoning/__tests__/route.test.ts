/**
 * Tests Unitaires : API /api/client/legal-reasoning
 *
 * Sprint 5 - Tests & Performance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

// =============================================================================
// MOCKS
// =============================================================================

// Mock Next-Auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

// Mock Auth Options
vi.mock('@/lib/auth/auth-options', () => ({
  authOptions: {},
}))

// Mock Services
vi.mock('@/lib/ai/explanation-tree-builder', () => ({
  buildExplanationTree: vi.fn(),
}))

vi.mock('@/lib/ai/unified-rag-service', () => ({
  search: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import { buildExplanationTree } from '@/lib/ai/explanation-tree-builder'
import { search } from '@/lib/ai/unified-rag-service'

// =============================================================================
// MOCK DATA
// =============================================================================

const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  },
}

const mockRAGSources = [
  {
    kbId: 'kb-1',
    chunkId: 'chunk-1',
    title: 'Article 371 COC',
    category: 'codes',
    chunkContent: 'La prescription est de quinze ans...',
    similarity: 0.92,
    metadata: {
      decisionDate: null,
      tribunalLabelFr: null,
      legalBasis: ['COC Article 371'],
    },
  },
  {
    kbId: 'kb-2',
    chunkId: 'chunk-2',
    title: 'Arrêt Cassation 2023-001',
    category: 'jurisprudence',
    chunkContent: 'La Cour de Cassation confirme...',
    similarity: 0.88,
    metadata: {
      decisionDate: new Date('2023-06-15'),
      tribunalLabelFr: 'Cour de Cassation',
      legalBasis: ['Article 371 COC'],
    },
  },
]

const mockExplanationTree = {
  rootNode: {
    id: 'node-1',
    type: 'question' as const,
    content: 'Quelle est la prescription en matière civile ?',
    confidence: 90,
    sources: [
      {
        id: 'kb-1',
        type: 'code' as const,
        title: 'Article 371 COC',
        relevance: 0.92,
      },
    ],
    children: ['node-2'],
    metadata: {
      isControversial: false,
      hasAlternative: false,
      isReversed: false,
    },
  },
  nodes: [
    {
      id: 'node-1',
      type: 'question' as const,
      content: 'Quelle est la prescription en matière civile ?',
      confidence: 90,
      sources: [],
      children: [],
      metadata: {},
    },
    {
      id: 'node-2',
      type: 'rule' as const,
      content: 'Article 371 COC : La prescription est de quinze ans.',
      confidence: 95,
      sources: [],
      children: [],
      metadata: {},
    },
  ],
  metadata: {
    totalNodes: 2,
    maxDepth: 2,
    totalSources: 1,
    averageConfidence: 92.5,
    language: 'fr' as const,
    generatedAt: new Date(),
  },
}

// =============================================================================
// HELPERS
// =============================================================================

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/client/legal-reasoning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/client/legal-reasoning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentification', () => {
    it('retourne 401 si pas de session', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)

      const req = createRequest({ question: 'Test' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Non authentifié')
    })

    it('retourne 401 si session sans userId', async () => {
      vi.mocked(getServerSession).mockResolvedValue({ user: {} } as any)

      const req = createRequest({ question: 'Test' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('accepte session valide', async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(search).mockResolvedValue(mockRAGSources as any)
      vi.mocked(buildExplanationTree).mockResolvedValue(mockExplanationTree as any)

      const req = createRequest({ question: 'Test' })
      const response = await POST(req)

      expect(response.status).toBe(200)
    })
  })

  describe('Validation requête', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(search).mockResolvedValue(mockRAGSources as any)
      vi.mocked(buildExplanationTree).mockResolvedValue(mockExplanationTree as any)
    })

    it('retourne 400 si question manquante', async () => {
      const req = createRequest({})
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Question requise')
    })

    it('retourne 400 si question vide', async () => {
      const req = createRequest({ question: '   ' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Question requise')
    })

    it('retourne 400 si question trop longue (>1000 chars)', async () => {
      const longQuestion = 'a'.repeat(1001)
      const req = createRequest({ question: longQuestion })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Question trop longue (max 1000 caractères)')
    })

    it('accepte question de 1000 chars exactement', async () => {
      const question = 'a'.repeat(1000)
      const req = createRequest({ question })
      const response = await POST(req)

      expect(response.status).toBe(200)
    })
  })

  describe('Récupération sources RAG', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(buildExplanationTree).mockResolvedValue(mockExplanationTree as any)
    })

    it('appelle search avec bons paramètres', async () => {
      vi.mocked(search).mockResolvedValue(mockRAGSources as any)

      const req = createRequest({
        question: 'Quelle est la prescription ?',
        domain: 'civil',
        language: 'fr',
      })

      await POST(req)

      expect(search).toHaveBeenCalledWith(
        'Quelle est la prescription ?',
        {
          category: 'civil',
          language: 'fr',
          limit: 10,
        }
      )
    })

    it('utilise valeurs par défaut si non spécifiées', async () => {
      vi.mocked(search).mockResolvedValue(mockRAGSources as any)

      const req = createRequest({ question: 'Test' })
      await POST(req)

      expect(search).toHaveBeenCalledWith('Test', {
        category: undefined,
        language: 'fr',
        limit: 10,
      })
    })

    it('retourne 404 si aucune source trouvée', async () => {
      vi.mocked(search).mockResolvedValue([])

      const req = createRequest({ question: 'Test' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Aucune source juridique trouvée pour cette question')
    })
  })

  describe('Construction arbre décisionnel', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(search).mockResolvedValue(mockRAGSources as any)
    })

    it('appelle buildExplanationTree avec bons paramètres', async () => {
      vi.mocked(buildExplanationTree).mockResolvedValue(mockExplanationTree as any)

      const req = createRequest({
        question: 'Test question',
        domain: 'civil',
        maxDepth: 4,
        language: 'ar',
        includeAlternatives: true,
      })

      await POST(req)

      expect(buildExplanationTree).toHaveBeenCalledWith({
        question: 'Test question',
        domain: 'civil',
        sources: expect.arrayContaining([
          expect.objectContaining({
            id: 'kb-1',
            type: 'code',
            title: 'Article 371 COC',
          }),
        ]),
        maxDepth: 4,
        language: 'ar',
        includeAlternatives: true,
      })
    })

    it('utilise maxDepth par défaut = 3', async () => {
      vi.mocked(buildExplanationTree).mockResolvedValue(mockExplanationTree as any)

      const req = createRequest({ question: 'Test' })
      await POST(req)

      expect(buildExplanationTree).toHaveBeenCalledWith(
        expect.objectContaining({ maxDepth: 3 })
      )
    })

    it('utilise language par défaut = fr', async () => {
      vi.mocked(buildExplanationTree).mockResolvedValue(mockExplanationTree as any)

      const req = createRequest({ question: 'Test' })
      await POST(req)

      expect(buildExplanationTree).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'fr' })
      )
    })

    it('utilise includeAlternatives par défaut = false', async () => {
      vi.mocked(buildExplanationTree).mockResolvedValue(mockExplanationTree as any)

      const req = createRequest({ question: 'Test' })
      await POST(req)

      expect(buildExplanationTree).toHaveBeenCalledWith(
        expect.objectContaining({ includeAlternatives: false })
      )
    })
  })

  describe('Réponse succès', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
      vi.mocked(search).mockResolvedValue(mockRAGSources as any)
      vi.mocked(buildExplanationTree).mockResolvedValue(mockExplanationTree as any)
    })

    it('retourne 200 avec tree', async () => {
      const req = createRequest({ question: 'Test' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.tree).toBeDefined()
      expect(data.tree.nodes).toHaveLength(2)
    })

    it('retourne sources utilisées', async () => {
      const req = createRequest({ question: 'Test' })
      const response = await POST(req)
      const data = await response.json()

      expect(data.sources).toHaveLength(2)
      expect(data.sources[0]).toEqual({
        id: 'kb-1',
        title: 'Article 371 COC',
        category: 'codes',
        relevance: 0.92,
      })
    })

    it('retourne metadata avec stats', async () => {
      const req = createRequest({ question: 'Test' })
      const response = await POST(req)
      const data = await response.json()

      expect(data.metadata).toBeDefined()
      expect(data.metadata.processingTimeMs).toBeGreaterThan(0)
      expect(data.metadata.nodesGenerated).toBe(2)
      expect(data.metadata.sourcesUsed).toBe(2)
    })
  })

  describe('Gestion erreurs', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    })

    it('retourne 500 si search échoue', async () => {
      vi.mocked(search).mockRejectedValue(new Error('DB Error'))

      const req = createRequest({ question: 'Test' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('DB Error')
    })

    it('retourne 500 si buildExplanationTree échoue', async () => {
      vi.mocked(search).mockResolvedValue(mockRAGSources as any)
      vi.mocked(buildExplanationTree).mockRejectedValue(new Error('LLM Error'))

      const req = createRequest({ question: 'Test' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('LLM Error')
    })

    it('gère erreurs non-Error', async () => {
      vi.mocked(search).mockRejectedValue('Unknown error')

      const req = createRequest({ question: 'Test' })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Erreur serveur')
    })
  })
})
