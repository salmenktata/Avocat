/**
 * API Route: /api/auth/logout
 * Déconnexion - supprime le cookie de session
 * GET: redirige vers /login (accès direct navigateur)
 * POST: retourne JSON (appels programmatiques)
 */

import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - pas de prérendu statique
export const dynamic = 'force-dynamic'

const COOKIE_NAME = 'auth_session'

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL('/login', request.url)
    const response = NextResponse.redirect(url)
    clearSessionCookie(response)
    return response
  } catch (error) {
    console.error('[API Logout] Erreur GET:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })
    clearSessionCookie(response)
    return response
  } catch (error) {
    console.error('[API Logout] Erreur:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
