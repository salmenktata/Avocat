import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '7')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startISO = startDate.toISOString()

    // Run all queries in parallel
    const [usageResult, classifTotals, bySource, byConfidence, byCategory, validationRate] =
      await Promise.all([
        // 1. ai_usage_logs: coûts classification + extraction
        db.query(
          `SELECT
            provider,
            operation_type,
            COUNT(*) as request_count,
            SUM(input_tokens + output_tokens) as total_tokens,
            SUM(estimated_cost_usd) as total_cost_usd
          FROM ai_usage_logs
          WHERE created_at >= $1
            AND operation_type IN ('classification', 'extraction')
            AND provider IS NOT NULL
          GROUP BY provider, operation_type
          ORDER BY total_cost_usd DESC`,
          [startISO]
        ),

        // 2. Totaux classifications
        db.query(
          `SELECT
            COUNT(*) as total,
            AVG(confidence_score) as avg_confidence
          FROM legal_classifications
          WHERE classified_at >= $1`,
          [startISO]
        ),

        // 3. Distribution par classification_source
        db.query(
          `SELECT
            COALESCE(classification_source, 'unknown') as source,
            COUNT(*) as count
          FROM legal_classifications
          WHERE classified_at >= $1
          GROUP BY classification_source
          ORDER BY count DESC`,
          [startISO]
        ),

        // 4. Distribution par tranches de confiance
        db.query(
          `SELECT
            CASE
              WHEN confidence_score < 0.5 THEN 'low'
              WHEN confidence_score < 0.7 THEN 'medium'
              WHEN confidence_score < 0.85 THEN 'high'
              ELSE 'excellent'
            END as bracket,
            COUNT(*) as count
          FROM legal_classifications
          WHERE classified_at >= $1
          GROUP BY bracket
          ORDER BY
            CASE bracket
              WHEN 'low' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'high' THEN 3
              WHEN 'excellent' THEN 4
            END`,
          [startISO]
        ),

        // 5. Top 10 catégories
        db.query(
          `SELECT
            primary_category as category,
            COUNT(*) as count
          FROM legal_classifications
          WHERE classified_at >= $1
          GROUP BY primary_category
          ORDER BY count DESC
          LIMIT 10`,
          [startISO]
        ),

        // 6. Taux requires_validation
        db.query(
          `SELECT
            COUNT(*) FILTER (WHERE requires_validation = true) as validation_count,
            COUNT(*) as total
          FROM legal_classifications
          WHERE classified_at >= $1`,
          [startISO]
        ),
      ])

    // Transform usage data
    const byProvider: Record<string, { requests: number; tokens: number; cost: number }> = {}
    const byOperation: Record<string, { requests: number; tokens: number; cost: number }> = {}
    let totalRequests = 0
    let totalTokens = 0
    let totalCost = 0

    for (const row of usageResult.rows) {
      const requests = parseInt(row.request_count) || 0
      const tokens = parseInt(row.total_tokens) || 0
      const cost = parseFloat(row.total_cost_usd) || 0

      // By provider
      if (!byProvider[row.provider]) {
        byProvider[row.provider] = { requests: 0, tokens: 0, cost: 0 }
      }
      byProvider[row.provider].requests += requests
      byProvider[row.provider].tokens += tokens
      byProvider[row.provider].cost += cost

      // By operation
      if (!byOperation[row.operation_type]) {
        byOperation[row.operation_type] = { requests: 0, tokens: 0, cost: 0 }
      }
      byOperation[row.operation_type].requests += requests
      byOperation[row.operation_type].tokens += tokens
      byOperation[row.operation_type].cost += cost

      totalRequests += requests
      totalTokens += tokens
      totalCost += cost
    }

    // Transform classification data
    const totalClassifications = parseInt(classifTotals.rows[0]?.total) || 0
    const avgConfidence = parseFloat(classifTotals.rows[0]?.avg_confidence) || 0

    const sourceDistribution: Record<string, number> = {}
    for (const row of bySource.rows) {
      sourceDistribution[row.source] = parseInt(row.count) || 0
    }

    const confidenceDistribution: Record<string, number> = {}
    for (const row of byConfidence.rows) {
      confidenceDistribution[row.bracket] = parseInt(row.count) || 0
    }

    const topCategories: Array<{ category: string; count: number }> = byCategory.rows.map(
      (row: { category: string; count: string }) => ({
        category: row.category,
        count: parseInt(row.count) || 0,
      })
    )

    const validationCount = parseInt(validationRate.rows[0]?.validation_count) || 0
    const validationTotal = parseInt(validationRate.rows[0]?.total) || 0

    // Compute LLM rate from source distribution
    const llmCount = sourceDistribution['llm'] || 0
    const llmRate = totalClassifications > 0 ? llmCount / totalClassifications : 0

    return NextResponse.json(
      {
        usage: {
          totalRequests,
          totalTokens,
          totalCost,
          byProvider,
          byOperation,
        },
        classifications: {
          total: totalClassifications,
          avgConfidence,
          llmRate,
          validationRate: validationTotal > 0 ? validationCount / validationTotal : 0,
          sourceDistribution,
          confidenceDistribution,
          topCategories,
        },
        period: {
          start: startISO,
          end: new Date().toISOString(),
          days,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('[Classification Metrics API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
