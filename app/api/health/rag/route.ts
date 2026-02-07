/**
 * API Route: Health Check RAG
 *
 * GET /api/health/rag
 * - Vérifie la santé du système RAG
 * - Retourne un status HTTP approprié (200 OK, 503 Service Unavailable)
 * - Pas d'authentification requise (pour monitoring externe)
 *
 * Query params:
 * - verbose: 'true' pour plus de détails
 */

import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { checkRAGHealth, getRAGMetricsSummary } from '@/lib/metrics/rag-metrics'
import { getCircuitBreakerState, checkOllamaHealth } from '@/lib/ai/embeddings-service'
import { getRerankerInfo } from '@/lib/ai/reranker-service'
import { isChatEnabled, getEmbeddingProvider, getChatProvider } from '@/lib/ai/config'

// =============================================================================
// Types
// =============================================================================

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    embeddings: boolean
    chat: boolean
    circuitBreaker: 'closed' | 'open' | 'half_open'
    reranker: boolean
  }
  warnings?: string[]
  critical?: string[]
}

// =============================================================================
// GET: Health Check
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    const searchParams = request.nextUrl.searchParams
    const verbose = searchParams.get('verbose') === 'true'

    // Vérifications de base
    const embeddingProvider = getEmbeddingProvider()
    const chatProvider = getChatProvider()
    const circuitBreaker = getCircuitBreakerState()
    const reranker = getRerankerInfo()

    // Health check basé sur les métriques
    const healthMetrics = checkRAGHealth()

    // Vérifier Ollama si c'est le provider d'embeddings
    let ollamaHealthy = true
    if (embeddingProvider === 'ollama') {
      ollamaHealthy = await checkOllamaHealth()
    }

    // Déterminer le status global
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (healthMetrics.critical.length > 0 || !embeddingProvider) {
      status = 'unhealthy'
    } else if (
      healthMetrics.warnings.length > 0 ||
      circuitBreaker.state !== 'CLOSED' ||
      !ollamaHealthy
    ) {
      status = 'degraded'
    }

    const response: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        embeddings: !!embeddingProvider,
        chat: isChatEnabled(),
        circuitBreaker: circuitBreaker.state.toLowerCase() as 'closed' | 'open' | 'half_open',
        reranker: reranker.enabled && reranker.loaded,
      },
    }

    // Ajouter warnings/critical si présents
    if (healthMetrics.warnings.length > 0) {
      response.warnings = healthMetrics.warnings
    }
    if (healthMetrics.critical.length > 0) {
      response.critical = healthMetrics.critical
    }

    // Ajouter plus de détails si verbose
    if (verbose) {
      const summary = getRAGMetricsSummary(60000) // Dernière minute

      const verboseResponse = {
        ...response,
        responseTimeMs: Date.now() - startTime,
        providers: {
          embedding: embeddingProvider,
          chat: chatProvider,
        },
        components: {
          circuitBreaker: {
            state: circuitBreaker.state,
            failures: circuitBreaker.failures,
            lastFailureAgo: circuitBreaker.lastFailureAgo,
          },
          reranker: {
            enabled: reranker.enabled,
            loaded: reranker.loaded,
            model: reranker.model,
          },
          ollama: embeddingProvider === 'ollama' ? { healthy: ollamaHealthy } : undefined,
        },
        metrics: {
          requestsLastMinute: summary.requests.total,
          latencyP95: summary.latency.total.p95,
          cacheHitRate: summary.cache.hitRate,
          errorRate: summary.requests.total > 0
            ? Math.round((summary.requests.failed / summary.requests.total) * 100)
            : 0,
        },
      }

      // HTTP status basé sur la santé
      const httpStatus = status === 'unhealthy' ? 503 : 200

      return NextResponse.json(verboseResponse, { status: httpStatus })
    }

    // Réponse simple
    const httpStatus = status === 'unhealthy' ? 503 : 200

    return NextResponse.json(response, { status: httpStatus })
  } catch (error) {
    console.error('Erreur health check RAG:', error)

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTimeMs: Date.now() - startTime,
      },
      { status: 503 }
    )
  }
}
