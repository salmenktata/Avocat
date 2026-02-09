import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'

interface MatrixCell {
  tokens: number
  cost: number
  requests: number
}

interface MatrixData {
  [provider: string]: {
    [operation: string]: MatrixCell
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check (super-admin only)
    const session = await getSession()
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 2. Parse query params
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '7')
    const userId = searchParams.get('userId')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 3. SQL query with GROUP BY
    const query = `
      SELECT
        provider,
        operation_type,
        COUNT(*) as request_count,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(estimated_cost_usd) as total_cost_usd
      FROM ai_usage_logs
      WHERE created_at >= $1
        AND provider IS NOT NULL
        AND operation_type IS NOT NULL
        AND ($2::uuid IS NULL OR user_id = $2)
      GROUP BY provider, operation_type
      ORDER BY total_cost_usd DESC
    `

    const result = await db.query(query, [startDate.toISOString(), userId || null])

    // 4. Transform to matrix structure
    const matrix: MatrixData = {}
    const totals = {
      byProvider: {} as Record<string, number>,
      byOperation: {} as Record<string, number>,
      total: 0
    }

    for (const row of result.rows) {
      const { provider, operation_type, request_count, total_tokens, total_cost_usd } = row

      if (!matrix[provider]) matrix[provider] = {}

      matrix[provider][operation_type] = {
        tokens: parseInt(total_tokens) || 0,
        cost: parseFloat(total_cost_usd) || 0,
        requests: parseInt(request_count) || 0
      }

      // Accumulate totals
      totals.byProvider[provider] = (totals.byProvider[provider] || 0) + parseFloat(total_cost_usd || '0')
      totals.byOperation[operation_type] = (totals.byOperation[operation_type] || 0) + parseFloat(total_cost_usd || '0')
      totals.total += parseFloat(total_cost_usd || '0')
    }

    // 5. Return response
    return NextResponse.json({
      matrix,
      totals,
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('[Provider Usage Matrix API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
