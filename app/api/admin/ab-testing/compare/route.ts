/**
 * API Route - Comparaison A/B Testing (Phase 5.3)
 *
 * GET /api/admin/ab-testing/compare?daysBack=30
 *
 * Retourne comparaison complète variants avec tests statistiques.
 *
 * @module app/api/admin/ab-testing/compare/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { compareVariants } from '@/lib/ai/prompt-ab-testing-service'
import { safeParseInt } from '@/lib/utils/safe-number'

export async function GET(request: NextRequest) {
  try {
    // Auth admin
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userRole = session.user.role
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Paramètres
    const searchParams = request.nextUrl.searchParams
    const daysBack = parseInt(searchParams.get('daysBack') || '30', 10)

    if (daysBack < 1 || daysBack > 365) {
      return NextResponse.json(
        { error: 'daysBack invalide (1-365)' },
        { status: 400 }
      )
    }

    // Appeler service
    const result = await compareVariants(daysBack)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[A/B Testing API] Erreur:', error)
    return NextResponse.json(
      {
        error: 'Erreur serveur',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
