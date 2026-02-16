import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'
import { safeParseInt } from '@/lib/utils/safe-number'

/**
 * API Route - AI Costs Summary
 *
 * GET /api/admin/ai-costs/summary
 *
 * Retourne statistiques globales coûts IA (30j)
 */
export async function GET(req: NextRequest) {
  try {
    // Auth admin
    const session = await getSession()
    if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Stats globales 30j
    const globalStats = await db.query(`
      SELECT
        COALESCE(SUM(estimated_cost_usd), 0) as total_cost,
        COUNT(*) as total_operations,
        COUNT(DISTINCT user_id) as unique_users,
        COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens
      FROM ai_usage_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
    `)

    // Coûts par jour (7j)
    const dailyCosts = await db.query(`
      SELECT
        DATE_TRUNC('day', created_at)::TEXT as date,
        SUM(estimated_cost_usd) as cost,
        COUNT(*) as operations
      FROM ai_usage_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `)

    // Top users (30j)
    const topUsers = await db.query(`
      SELECT
        l.user_id,
        u.email as user_email,
        SUM(l.estimated_cost_usd) as total_cost,
        COUNT(*) as operations
      FROM ai_usage_logs l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE l.created_at > NOW() - INTERVAL '30 days'
      GROUP BY l.user_id, u.email
      ORDER BY total_cost DESC
      LIMIT 10
    `)

    // Coûts par provider (30j)
    const costsByProvider = await db.query(`
      SELECT
        provider,
        SUM(estimated_cost_usd) as total_cost,
        COUNT(*) as operations
      FROM ai_usage_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY provider
      ORDER BY total_cost DESC
    `)

    const stats = {
      total_cost: parseFloat(globalStats.rows[0]?.total_cost || 0),
      total_operations: parseInt(globalStats.rows[0]?.total_operations || 0, 10),
      unique_users: parseInt(globalStats.rows[0]?.unique_users || 0, 10),
      total_tokens: parseInt(globalStats.rows[0]?.total_tokens || 0, 10),
      daily_costs: dailyCosts.rows.map(row => ({
        date: row.date,
        cost: parseFloat(row.cost || 0),
        operations: parseInt(row.operations || 0, 10),
      })),
      top_users: topUsers.rows.map(row => ({
        user_id: row.user_id,
        user_email: row.user_email || 'Unknown',
        total_cost: parseFloat(row.total_cost || 0),
        operations: parseInt(row.operations || 0, 10),
      })),
      costs_by_provider: costsByProvider.rows.map(row => ({
        provider: row.provider,
        total_cost: parseFloat(row.total_cost || 0),
        operations: parseInt(row.operations || 0, 10),
      })),
    }

    return NextResponse.json({ success: true, stats })
  } catch (error) {
    console.error('Error fetching AI costs summary:', error)
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    )
  }
}
