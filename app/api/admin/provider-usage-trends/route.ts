import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'
import { safeParseInt } from '@/lib/utils/safe-number'

interface DailyTrend {
  date: string
  [provider: string]: string | number
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

    // 3. SQL query with GROUP BY date and provider
    const query = `
      SELECT
        DATE(created_at) as date,
        provider,
        SUM(input_tokens + output_tokens) as tokens,
        SUM(estimated_cost_usd) as cost,
        COUNT(*) as requests
      FROM ai_usage_logs
      WHERE created_at >= $1
        AND provider IS NOT NULL
        AND ($2::uuid IS NULL OR user_id = $2)
      GROUP BY DATE(created_at), provider
      ORDER BY date DESC, provider
    `

    const result = await db.query(query, [startDate.toISOString(), userId || null])

    // 4. Transform to array format for Recharts
    // Group by date, then pivot providers as columns
    const trendsMap = new Map<string, DailyTrend>()

    for (const row of result.rows) {
      const date = row.date.toISOString().split('T')[0]
      const provider = row.provider

      if (!trendsMap.has(date)) {
        trendsMap.set(date, { date })
      }

      const dayData = trendsMap.get(date)!
      dayData[`${provider}_tokens`] = parseInt(row.tokens, 10) || 0
      dayData[`${provider}_cost`] = parseFloat(row.cost) || 0
      dayData[`${provider}_requests`] = parseInt(row.requests, 10) || 0
    }

    // Convert map to array and sort by date ascending
    const trends = Array.from(trendsMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )

    // 5. Calculate summary stats
    const providers = [...new Set(result.rows.map(r => r.provider))]
    const summary = providers.reduce((acc, provider) => {
      acc[provider] = {
        totalTokens: result.rows
          .filter(r => r.provider === provider)
          .reduce((sum, r) => sum + (parseInt(r.tokens, 10) || 0), 0),
        totalCost: result.rows
          .filter(r => r.provider === provider)
          .reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0),
        totalRequests: result.rows
          .filter(r => r.provider === provider)
          .reduce((sum, r) => sum + (parseInt(r.requests, 10) || 0), 0)
      }
      return acc
    }, {} as Record<string, { totalTokens: number; totalCost: number; totalRequests: number }>)

    // 6. Return response
    return NextResponse.json({
      trends,
      summary,
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
    console.error('[Provider Usage Trends API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
