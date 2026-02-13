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

    // Récupérer stats DB
    const usageStats = await db.query<{
      total_calls: number
      total_tokens: number
      estimated_cost_usd: number
      period_start: Date
    }>(`
      SELECT
        COUNT(*) as total_calls,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(
          (input_tokens * 0.0025 / 1000) +
          (output_tokens * 0.01 / 1000)
        ) as estimated_cost_usd,
        MIN(created_at) as period_start
      FROM llm_operations
      WHERE provider = 'openai'
        AND operation_name LIKE '%quality-analysis%'
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `)

    const stats = usageStats.rows[0]
    const costUsd = stats.estimated_cost_usd || 0
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
        calls: stats.total_calls || 0,
        tokens: stats.total_tokens || 0,
        costUsd: parseFloat(costUsd.toFixed(2)),
        periodStart: stats.period_start,
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
