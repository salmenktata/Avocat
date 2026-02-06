/**
 * Middleware d'authentification avec cookies HttpOnly
 *
 * Protège les routes définies dans le matcher.
 * Redirige vers /login si l'utilisateur n'est pas authentifié.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// SÉCURITÉ: Ne jamais utiliser de fallback pour le secret JWT
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    'NEXTAUTH_SECRET est requis. Définissez cette variable d\'environnement avec une valeur sécurisée.'
  )
}

const SECRET_KEY = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)

const COOKIE_NAME = 'auth_session'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value

  // Pas de token = pas authentifié
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Vérifier le token JWT
  try {
    await jwtVerify(token, SECRET_KEY)
    return NextResponse.next()
  } catch {
    // Token invalide ou expiré
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete(COOKIE_NAME)
    return response
  }
}

/**
 * Routes protégées par authentification
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/clients/:path*',
    '/dossiers/:path*',
    '/factures/:path*',
    '/parametres/:path*',
    '/echeances/:path*',
    '/templates/:path*',
    '/settings/:path*',
    '/profile/:path*',
    '/documents/:path*',
    '/time-tracking/:path*',
  ],
}
