/**
 * API Route: Cron - Index Web Pages
 *
 * POST /api/cron/index-web-pages
 * - Indexe les pages web crawlées sans pipeline intelligent
 * - Bypass l'analyse qualité LLM (indexation directe)
 *
 * Protégé par CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

import { indexSourcePages } from '@/lib/web-scraper/web-indexer-service'
import { db } from '@/lib/db/postgres'

// =============================================================================
// VÉRIFICATION CRON SECRET
// =============================================================================

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return false
  }

  return true
}

// =============================================================================
// POST: Indexer les pages web directement
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  console.log('[IndexWebPages Cron] Démarrage...')

  try {
    const body = await request.json().catch(() => ({}))
    const sourceId = body.sourceId || null
    const limit = body.limit || 10

    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId requis' },
        { status: 400 }
      )
    }

    // Vérifier que la source existe
    const sourceResult = await db.query(
      'SELECT id, name FROM web_sources WHERE id = $1',
      [sourceId]
    )

    if (sourceResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Source non trouvée' },
        { status: 404 }
      )
    }

    const sourceName = sourceResult.rows[0].name

    console.log(`[IndexWebPages Cron] Indexation de ${limit} pages pour ${sourceName}`)

    // Lancer l'indexation directe (sans pipeline intelligent)
    const result = await indexSourcePages(sourceId, {
      limit,
      reindex: false,
    })

    console.log(
      `[IndexWebPages Cron] Terminé: ${result.succeeded}/${result.processed} réussies`
    )

    return NextResponse.json({
      success: true,
      source: sourceName,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    })
  } catch (error) {
    console.error('[IndexWebPages Cron] Erreur:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur indexation',
      },
      { status: 500 }
    )
  }
}
