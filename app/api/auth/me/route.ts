/**
 * API Route: GET /api/auth/me
 * Récupère l'utilisateur connecté
 */

import { NextResponse } from 'next/server'

// Force dynamic rendering - pas de prérendu statique
export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth/session'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 }
      )
    }

    return NextResponse.json({
      authenticated: true,
      user: session.user,
      expires: session.expires,
    })
  } catch (error) {
    console.error('[API Me] Erreur:', error)
    return NextResponse.json(
      { authenticated: false, user: null, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
