/**
 * Middleware NextAuth pour protection des routes
 *
 * Protège automatiquement toutes les routes définies dans le matcher.
 * Redirige vers /login si l'utilisateur n'est pas authentifié.
 */

export { default } from 'next-auth/middleware'

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

    // API routes protégées (sauf webhooks et auth)
    '/api/clients/:path*',
    '/api/dossiers/:path*',
    '/api/factures/:path*',
    '/api/documents/:path*',
    '/api/echeances/:path*',
    '/api/templates/:path*',
    '/api/user/:path*',

    // Exclure explicitement les routes publiques
    // (le ! signifie exclusion dans les patterns Next.js)
    // Note: Les routes ci-dessous ne sont PAS matchées donc restent publiques:
    // - /
    // - /login
    // - /register
    // - /auth/*
    // - /api/auth/*
    // - /api/webhooks/*
    // - /api/health
    // - /api/cron/*
  ],
}
