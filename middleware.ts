/**
 * Middleware Supabase pour protection des routes
 *
 * Protège automatiquement toutes les routes définies dans le matcher.
 * Redirige vers /login si l'utilisateur n'est pas authentifié.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Si pas d'utilisateur et route protégée, rediriger vers /login
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Si pas d'utilisateur et route protégée, rediriger vers /login
  if (!user && (
    request.nextUrl.pathname.startsWith('/clients') ||
    request.nextUrl.pathname.startsWith('/dossiers') ||
    request.nextUrl.pathname.startsWith('/factures') ||
    request.nextUrl.pathname.startsWith('/parametres') ||
    request.nextUrl.pathname.startsWith('/echeances') ||
    request.nextUrl.pathname.startsWith('/templates') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/documents') ||
    request.nextUrl.pathname.startsWith('/time-tracking')
  )) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

/**
 * Configuration du matcher
 *
 * Liste des routes protégées par authentification.
 * Toute tentative d'accès sans session redirigera vers /login.
 */
export const config = {
  matcher: [
    // Routes principales protégées
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
