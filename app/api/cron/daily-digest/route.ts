/**
 * API Route Cron - Notifications Quotidiennes (Daily Digest)
 *
 * Endpoint: POST /api/cron/daily-digest
 *
 * Déclenché par:
 * - Service cron externe (cron-job.org, Render, etc.)
 * - PM2 cron scheduler
 * - Test manuel
 *
 * Sécurité: Requiert header Authorization avec CRON_SECRET
 *
 * Exemple d'appel:
 * curl -X POST https://app.moncabinet.tn/api/cron/daily-digest \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendDailyDigestNotifications } from '@/lib/notifications/daily-digest-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

const CRON_SECRET = process.env.CRON_SECRET || ''

/**
 * POST /api/cron/daily-digest
 * Envoie les notifications quotidiennes à tous les utilisateurs éligibles
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!CRON_SECRET) {
      console.error('[Cron Daily Digest] CRON_SECRET non configuré')
      return NextResponse.json(
        { error: 'Configuration serveur incorrecte' },
        { status: 500 }
      )
    }

    if (token !== CRON_SECRET) {
      console.warn('[Cron Daily Digest] Tentative non autorisée')
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }

    console.log('[Cron Daily Digest] Démarrage du job...')
    const startTime = Date.now()

    // Exécuter le service de notifications
    const stats = await sendDailyDigestNotifications()

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        totalUsers: stats.totalUsers,
        emailsSent: stats.emailsSent,
        emailsFailed: stats.emailsFailed,
        duration: `${stats.duration}ms`,
      },
      errors: stats.errors.length > 0 ? stats.errors : undefined,
    }

    console.log('[Cron Daily Digest] Terminé:', response)

    return NextResponse.json(response)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[Cron Daily Digest] Erreur:', errorMessage)

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/daily-digest
 * Retourne le statut du service (health check)
 */
export async function GET(request: NextRequest) {
  // Vérification simple sans authentification pour health check
  const brevoConfigured = !!process.env.BREVO_API_KEY
  const cronConfigured = !!process.env.CRON_SECRET

  return NextResponse.json({
    service: 'daily-digest',
    status: brevoConfigured && cronConfigured ? 'ready' : 'misconfigured',
    config: {
      brevo: brevoConfigured ? 'configured' : 'missing BREVO_API_KEY',
      cron: cronConfigured ? 'configured' : 'missing CRON_SECRET',
    },
    timezone: 'Africa/Tunis',
    scheduledTime: '06:00 TN (05:00 UTC)',
  })
}
