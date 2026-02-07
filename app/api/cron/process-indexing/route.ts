/**
 * API Route: Worker Cron pour traitement queue d'indexation
 *
 * Sécurisé par CRON_SECRET.
 * À appeler régulièrement (toutes les minutes) pour traiter les jobs en attente.
 *
 * GET /api/cron/process-indexing
 * Headers: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  processBatch,
  getQueueStats,
  cleanupOldJobs,
} from '@/lib/ai/indexing-queue-service'

// Nombre de jobs à traiter par appel
const BATCH_SIZE = parseInt(process.env.INDEXING_BATCH_SIZE || '5', 10)

/**
 * Vérifie le secret cron
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return false
  }

  // Support Bearer token ou direct secret
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || cronSecret.length < 32) {
    console.error('[Cron] CRON_SECRET non configuré ou trop court')
    return false
  }

  return token === cronSecret
}

export async function GET(request: NextRequest) {
  // Vérifier l'authentification
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Non autorisé' },
      { status: 401 }
    )
  }

  const startTime = Date.now()

  try {
    // Traiter un batch de jobs
    const processed = await processBatch(BATCH_SIZE)

    // Récupérer les stats
    const stats = await getQueueStats()

    // Nettoyer les vieux jobs (une fois par appel)
    const cleaned = await cleanupOldJobs()

    const duration = Date.now() - startTime

    console.log(
      `[Cron Indexing] ${processed} jobs traités, ${stats.pendingCount} en attente, ${cleaned} nettoyés (${duration}ms)`
    )

    return NextResponse.json({
      success: true,
      processed,
      stats: {
        pending: stats.pendingCount,
        processing: stats.processingCount,
        completedToday: stats.completedToday,
        failedToday: stats.failedToday,
        avgTimeMs: stats.avgProcessingTimeMs,
      },
      cleaned,
      durationMs: duration,
    })
  } catch (error) {
    console.error('[Cron Indexing] Erreur:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    )
  }
}

// Aussi supporter POST pour certains services cron
export async function POST(request: NextRequest) {
  return GET(request)
}
