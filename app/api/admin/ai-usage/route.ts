/**
 * API Admin : Usage IA et monitoring providers
 *
 * Retourne les statistiques d'utilisation des providers IA :
 * - Tokens consommés par provider (Gemini, DeepSeek, Groq, Ollama)
 * - Coûts estimés
 * - Tier gratuit Gemini restant
 * - Historique quotidien/hebdomadaire
 * - Alertes quotas
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { aiConfig } from '@/lib/ai/config'
import { getGeminiRPMStats } from '@/lib/ai/gemini-client'
import { getCircuitBreakerState } from '@/lib/ai/embeddings-service'
import { safeParseInt } from '@/lib/utils/safe-number'

// =============================================================================
// TYPES
// =============================================================================

interface AIUsageStats {
  providers: {
    gemini: ProviderStats
    deepseek: ProviderStats
    groq: ProviderStats
    anthropic: ProviderStats
    ollama: ProviderStats
  }
  totalCost: number
  alerts: Alert[]
  period: {
    start: Date
    end: Date
  }
}

interface ProviderStats {
  enabled: boolean
  tokensInput: number
  tokensOutput: number
  tokensTotal: number
  requestCount: number
  errorCount: number
  avgLatencyMs: number
  costEstimated: number
  tierInfo?: {
    type: 'free' | 'paid'
    limit?: number
    used?: number
    remaining?: number
  }
}

interface Alert {
  type: 'warning' | 'error' | 'info'
  provider: string
  message: string
  threshold?: number
  current?: number
}

// =============================================================================
// TARIFICATION (Février 2026)
// =============================================================================

const PRICING = {
  gemini: {
    input: 0.075 / 1_000_000, // $0.075 par million tokens
    output: 0.30 / 1_000_000,
  },
  deepseek: {
    input: 0.27 / 1_000_000, // $0.27 par million tokens (input=output)
    output: 0.27 / 1_000_000,
  },
  groq: {
    input: 0, // Tier gratuit
    output: 0,
  },
  anthropic: {
    input: 3.0 / 1_000_000, // Claude Sonnet
    output: 15.0 / 1_000_000,
  },
  ollama: {
    input: 0, // Local gratuit
    output: 0,
  },
}

// =============================================================================
// HANDLERS
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Vérifier authentification admin
    const session = await getSession()
    if (!session || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Paramètres de période (défaut: 7 derniers jours)
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7', 10)

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Récupérer stats depuis la table rag_metrics
    const stats = await getAIUsageStats(startDate, endDate)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('[AI-Usage] Error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}

// =============================================================================
// FONCTIONS HELPER
// =============================================================================

async function getAIUsageStats(startDate: Date, endDate: Date): Promise<AIUsageStats> {
  // Requête agrégée sur rag_metrics (stocke provider, tokens, latence)
  const result = await db.query(
    `SELECT
       llm_provider,
       COUNT(*) as request_count,
       SUM(tokens_used) as total_tokens,
       SUM(CASE WHEN error_occurred THEN 1 ELSE 0 END) as error_count,
       AVG(response_time_ms) as avg_latency_ms
     FROM rag_metrics
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY llm_provider`,
    [startDate, endDate]
  )

  // Initialiser les stats par provider
  const providerStats: Record<string, ProviderStats> = {
    gemini: {
      enabled: !!aiConfig.gemini.apiKey,
      tokensInput: 0,
      tokensOutput: 0,
      tokensTotal: 0,
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: 0,
      costEstimated: 0,
    },
    deepseek: {
      enabled: !!aiConfig.deepseek.apiKey,
      tokensInput: 0,
      tokensOutput: 0,
      tokensTotal: 0,
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: 0,
      costEstimated: 0,
    },
    groq: {
      enabled: !!aiConfig.groq.apiKey,
      tokensInput: 0,
      tokensOutput: 0,
      tokensTotal: 0,
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: 0,
      costEstimated: 0,
    },
    anthropic: {
      enabled: !!aiConfig.anthropic.apiKey,
      tokensInput: 0,
      tokensOutput: 0,
      tokensTotal: 0,
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: 0,
      costEstimated: 0,
    },
    ollama: {
      enabled: aiConfig.ollama.enabled,
      tokensInput: 0,
      tokensOutput: 0,
      tokensTotal: 0,
      requestCount: 0,
      errorCount: 0,
      avgLatencyMs: 0,
      costEstimated: 0,
    },
  }

  // Remplir les stats depuis DB
  for (const row of result.rows) {
    const provider = row.llm_provider
    if (providerStats[provider]) {
      providerStats[provider].tokensTotal = parseInt(row.total_tokens || '0', 10)
      providerStats[provider].requestCount = parseInt(row.request_count || '0', 10)
      providerStats[provider].errorCount = parseInt(row.error_count || '0', 10)
      providerStats[provider].avgLatencyMs = parseFloat(row.avg_latency_ms || '0')

      // Estimation tokens input/output (ratio 2:1 typique)
      providerStats[provider].tokensInput = Math.floor(providerStats[provider].tokensTotal * 0.66)
      providerStats[provider].tokensOutput = Math.floor(providerStats[provider].tokensTotal * 0.33)

      // Calculer coût estimé
      const pricing = PRICING[provider as keyof typeof PRICING]
      if (pricing) {
        providerStats[provider].costEstimated =
          providerStats[provider].tokensInput * pricing.input +
          providerStats[provider].tokensOutput * pricing.output
      }
    }
  }

  // Ajouter info tier Gemini (RPM actuel)
  if (providerStats.gemini.enabled) {
    const geminiRPM = getGeminiRPMStats()
    providerStats.gemini.tierInfo = {
      type: 'free',
      limit: geminiRPM.limit,
      used: geminiRPM.requestsThisMinute,
      remaining: geminiRPM.availableSlots,
    }
  }

  // Générer alertes
  const alerts = generateAlerts(providerStats)

  // Calculer coût total
  const totalCost = Object.values(providerStats).reduce(
    (sum, stats) => sum + stats.costEstimated,
    0
  )

  return {
    providers: providerStats as AIUsageStats['providers'],
    totalCost,
    alerts,
    period: {
      start: startDate,
      end: endDate,
    },
  }
}

function generateAlerts(providerStats: Record<string, ProviderStats>): Alert[] {
  const alerts: Alert[] = []

  // Alert Gemini RPM >80%
  if (providerStats.gemini.tierInfo) {
    const { used, limit } = providerStats.gemini.tierInfo
    if (used !== undefined && limit !== undefined && used / limit > 0.8) {
      alerts.push({
        type: 'warning',
        provider: 'gemini',
        message: `Gemini RPM élevé (${used}/${limit})`,
        threshold: 80,
        current: Math.round((used / limit) * 100),
      })
    }
  }

  // Alert DeepSeek solde (si taux d'erreur élevé)
  if (providerStats.deepseek.enabled && providerStats.deepseek.requestCount > 0) {
    const errorRate = providerStats.deepseek.errorCount / providerStats.deepseek.requestCount
    if (errorRate > 0.5) {
      alerts.push({
        type: 'error',
        provider: 'deepseek',
        message: `DeepSeek taux d'erreur élevé (${Math.round(errorRate * 100)}%). Vérifier solde.`,
        threshold: 50,
        current: Math.round(errorRate * 100),
      })
    }
  }

  // Alert Ollama circuit breaker
  const cbState = getCircuitBreakerState()
  if (cbState.state === 'OPEN') {
    alerts.push({
      type: 'error',
      provider: 'ollama',
      message: `Ollama circuit breaker OPEN (${cbState.failures} échecs). Service indisponible.`,
    })
  } else if (cbState.state === 'HALF_OPEN') {
    alerts.push({
      type: 'warning',
      provider: 'ollama',
      message: `Ollama circuit breaker HALF_OPEN (test de récupération en cours)`,
    })
  }

  // Alert coût total >$10
  const totalCost = Object.values(providerStats).reduce(
    (sum, stats) => sum + stats.costEstimated,
    0
  )
  if (totalCost > 10) {
    alerts.push({
      type: 'warning',
      provider: 'all',
      message: `Coût total élevé: $${totalCost.toFixed(2)}`,
      threshold: 10,
      current: totalCost,
    })
  }

  return alerts
}
