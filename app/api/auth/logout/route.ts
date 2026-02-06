/**
 * API Route: POST /api/auth/logout
 * Déconnexion - supprime le cookie de session
 */

import { NextResponse } from 'next/server'

// Force dynamic rendering - pas de prérendu statique
export const dynamic = 'force-dynamic'

import { logoutUser } from '@/lib/auth/session'

export async function POST() {
  try {
    await logoutUser()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Logout] Erreur:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
