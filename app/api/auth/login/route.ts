/**
 * API Route: POST /api/auth/login
 * Authentification avec cookies HttpOnly
 *
 * Rate limited: 5 tentatives / 15 minutes par IP
 */

import { NextRequest, NextResponse } from 'next/server'
import { loginUser } from '@/lib/auth/session'
import { loginLimiter, getClientIP, getRateLimitHeaders } from '@/lib/rate-limiter'
import { createLogger } from '@/lib/logger'

const log = createLogger('Auth:Login')

export async function POST(request: NextRequest) {
  // Rate limiting par IP
  const clientIP = getClientIP(request)
  const rateLimitResult = loginLimiter.check(clientIP)

  if (!rateLimitResult.allowed) {
    log.warn('Rate limit atteint', { ip: clientIP, retryAfter: rateLimitResult.retryAfter })
    return NextResponse.json(
      {
        success: false,
        error: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.',
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    )
  }

  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email et mot de passe requis' },
        { status: 400, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    const result = await loginUser(email, password)

    if (!result.success) {
      log.info('Échec connexion', { email, ip: clientIP })
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    // Connexion réussie - reset le rate limiter pour cette IP
    loginLimiter.reset(clientIP)
    log.info('Connexion réussie', { email, ip: clientIP })

    return NextResponse.json({
      success: true,
      user: result.user,
    })
  } catch (error) {
    log.exception('Erreur login', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
