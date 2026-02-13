import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { db } from '@/lib/db/postgres'

/**
 * GET /api/admin/monitor-openai
 *
 * Vérifie l'usage OpenAI et alerte si budget critique
 *
 * Headers:
 * - X-Cron-Secret: Secret cron pour authentification
 *
 * @returns Rapport de monitoring
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier le secret cron
    const cronSecret = request.headers.get('X-Cron-Secret')
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Monitor OpenAI] Démarrage vérification...')

    // Configuration
    const ALERT_THRESHOLD_USD = 5.0
    const MONTHLY_BUDGET_USD = 10.0

    // Test connexion OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    let openaiStatus = 'unknown'
    let testError = null

    try {
      const testResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      })

      openaiStatus = 'accessible'
      console.log(`[Monitor OpenAI] ✅ OpenAI accessible (${testResponse.model})`)
    } catch (error: any) {
      openaiStatus = 'error'
      testError = error.message

      console.error(`[Monitor OpenAI] ❌ OpenAI erreur:`, error.message)

      if (error.status === 401) {
        testError = 'Clé API invalide ou expirée'
      } else if (error.status === 429) {
        testError = 'Quota dépassé ou rate limit'
      } else if (error.code === 'insufficient_quota') {
        testError = 'SOLDE ÉPUISÉ - Recharger le compte OpenAI'
      }
    }

    // Récupérer stats DB (via knowledge_base pour l'instant)
    // TODO: Migrer vers table llm_operations quand disponible
    const usageStats = await db.query<{
      total_analyzed: number
      openai_count: number
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE quality_score IS NOT NULL) as total_analyzed,
        COUNT(*) FILTER (WHERE quality_llm_provider = 'openai') as openai_count
      FROM knowledge_base
      WHERE is_active = true
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `)

    const stats = usageStats.rows[0]

    // Estimation coût basée sur nombre de docs OpenAI
    // Hypothèse: ~700 tokens moyen par doc (500 input + 200 output)
    const avgTokensPerDoc = 700
    const costPerDoc = (500 * 0.0025 + 200 * 0.01) / 1000
    const costUsd = (stats.openai_count || 0) * costPerDoc
    const budgetRemaining = MONTHLY_BUDGET_USD - costUsd

    // Déterminer niveau d'alerte
    let alertLevel = 'ok'
    let alertMessage = null

    if (openaiStatus === 'error') {
      alertLevel = 'critical'
      alertMessage = `OpenAI inaccessible: ${testError}`
    } else if (budgetRemaining < ALERT_THRESHOLD_USD) {
      alertLevel = 'critical'
      alertMessage = `Budget restant < $${ALERT_THRESHOLD_USD.toFixed(2)}`
    } else if (budgetRemaining < MONTHLY_BUDGET_USD * 0.2) {
      alertLevel = 'warning'
      alertMessage = `Budget à ${((1 - budgetRemaining / MONTHLY_BUDGET_USD) * 100).toFixed(0)}%`
    }

    const result = {
      timestamp: new Date().toISOString(),
      openai: {
        status: openaiStatus,
        error: testError,
      },
      usage: {
        totalAnalyzed: stats.total_analyzed || 0,
        openaiCount: stats.openai_count || 0,
        estimatedCostUsd: parseFloat(costUsd.toFixed(2)),
        note: 'Estimation basée sur ~700 tokens/doc',
      },
      budget: {
        totalUsd: MONTHLY_BUDGET_USD,
        consumedUsd: parseFloat(costUsd.toFixed(2)),
        remainingUsd: parseFloat(budgetRemaining.toFixed(2)),
        percentUsed: parseFloat(((costUsd / MONTHLY_BUDGET_USD) * 100).toFixed(1)),
      },
      alert: {
        level: alertLevel,
        message: alertMessage,
      },
    }

    console.log('[Monitor OpenAI] Résultat:', JSON.stringify(result, null, 2))

    // Retourner avec code approprié
    const statusCode = alertLevel === 'critical' ? 500 : alertLevel === 'warning' ? 200 : 200

    return NextResponse.json(result, { status: statusCode })

  } catch (error: any) {
    console.error('[Monitor OpenAI] Erreur:', error)
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        error: error.message,
        alert: {
          level: 'critical',
          message: 'Erreur monitoring OpenAI',
        },
      },
      { status: 500 }
    )
  }
}
