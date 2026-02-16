/**
 * API Route: Administration - Monitoring des coûts IA
 *
 * GET /api/admin/ai-costs
 * - Retourne les statistiques d'utilisation IA pour l'utilisateur connecté
 * - Ou les stats globales si admin
 */

import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering (pas de prérendu statique)
export const dynamic = 'force-dynamic'
import { getSession } from '@/lib/auth/session'
import {
  getUserMonthlyStats,
  getGlobalStats,
  checkBudgetLimit,
} from '@/lib/ai/usage-tracker'
import { db } from '@/lib/db/postgres'
import { safeParseInt } from '@/lib/utils/safe-number'

// =============================================================================
// GET: Statistiques d'utilisation IA
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id
    const searchParams = request.nextUrl.searchParams
    const global = searchParams.get('global') === 'true'
    const days = parseInt(searchParams.get('days') || '30')

    // Stats utilisateur
    const userStats = await getUserMonthlyStats(userId)
    const budgetStatus = await checkBudgetLimit(userId)

    // Récupérer les quotas de l'utilisateur
    const quotaResult = await db.query(
      `SELECT monthly_ai_queries_limit, monthly_ai_queries_used, quota_reset_date,
              enable_semantic_search, enable_ai_chat, enable_ai_generation
       FROM feature_flags
       WHERE user_id = $1`,
      [userId]
    )

    const quotas = quotaResult.rows[0] || {
      monthly_ai_queries_limit: 100,
      monthly_ai_queries_used: 0,
      quota_reset_date: new Date(),
      enable_semantic_search: false,
      enable_ai_chat: false,
      enable_ai_generation: false,
    }

    const response: any = {
      user: {
        stats: userStats,
        budget: budgetStatus,
        quotas: {
          limit: quotas.monthly_ai_queries_limit,
          used: quotas.monthly_ai_queries_used,
          remaining: Math.max(
            0,
            quotas.monthly_ai_queries_limit - quotas.monthly_ai_queries_used
          ),
          resetDate: quotas.quota_reset_date,
        },
        features: {
          semanticSearch: quotas.enable_semantic_search,
          aiChat: quotas.enable_ai_chat,
          aiGeneration: quotas.enable_ai_generation,
        },
      },
    }

    // Stats globales (pour tous les utilisateurs, utile pour l'admin)
    if (global) {
      const globalStats = await getGlobalStats(days)
      const activeUsersResult = await db.query(
        `SELECT COUNT(DISTINCT user_id) as count
         FROM ai_usage_logs
         WHERE created_at >= CURRENT_DATE - $1::integer`,
        [days]
      )

      response.global = {
        ...globalStats,
        activeUsers: parseInt(activeUsersResult.rows[0].count, 10),
        period: `${days} derniers jours`,
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Erreur stats IA:', error)
    return NextResponse.json(
      { error: 'Erreur récupération statistiques' },
      { status: 500 }
    )
  }
}
