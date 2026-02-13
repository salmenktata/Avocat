/**
 * API: Stats agrégées des exécutions de crons
 * GET /api/admin/cron-executions/stats?hours=24
 * Auth: Session admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/postgres'

export async function GET(req: NextRequest) {
  try {
    // 1. Parse params
    const searchParams = req.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24', 10)

    if (hours < 1 || hours > 168) {
      return NextResponse.json(
        { error: 'hours must be between 1 and 168 (7 days)' },
        { status: 400 }
      )
    }

    // 2. Récupérer stats via fonction SQL
    const statsResult = await db.query(
      'SELECT * FROM get_cron_monitoring_stats($1)',
      [hours]
    )
    const stats = statsResult.rows

    // 3. Récupérer timeline (par jour pour graph)
    const timelineResult = await db.query(
      `SELECT cron_name, status, started_at
       FROM cron_executions
       WHERE started_at >= NOW() - INTERVAL '${hours} hours'
       ORDER BY started_at ASC`
    )
    const timeline = timelineResult.rows

    // 4. Grouper timeline par jour
    const timelineByDay: Record<string, any> = {}

    timeline.forEach((exec) => {
      const day = new Date(exec.started_at).toISOString().split('T')[0]
      if (!timelineByDay[day]) {
        timelineByDay[day] = {
          date: day,
          completed: 0,
          failed: 0,
          running: 0,
          total: 0,
        }
      }
      timelineByDay[day][exec.status] = (timelineByDay[day][exec.status] || 0) + 1
      timelineByDay[day].total += 1
    })

    const timelineArray = Object.values(timelineByDay).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    )

    // 5. Détecter crons bloqués
    const stuckResult = await db.query('SELECT * FROM detect_stuck_crons()')
    const stuckCrons = stuckResult.rows

    return NextResponse.json({
      success: true,
      stats: stats || [],
      timeline: timelineArray,
      stuckCrons: stuckCrons || [],
      hoursBack: hours,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Cron Stats] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
