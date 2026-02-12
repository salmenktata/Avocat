/**
 * API Route TEMPORAIRE: Forcer le crawl Google Drive
 * Protégé par CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { crawlGoogleDriveFolder } from '@/lib/web-scraper/gdrive-crawler-service'
import { db } from '@/lib/db/postgres'

export const dynamic = 'force-dynamic'
export const maxDuration = 600 // 10 minutes

const GDRIVE_SOURCE_ID = '546d11c8-b3fd-4559-977b-c3572aede0e4'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Vérifier CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const incrementalMode = body.incremental ?? false

    console.log(`[ForceCrawlGDrive] Démarrage crawl (incremental: ${incrementalMode})...`)

    // Récupérer la source
    const sourceResult = await db.query(
      'SELECT * FROM web_sources WHERE id = $1',
      [GDRIVE_SOURCE_ID]
    )

    if (sourceResult.rows.length === 0) {
      return NextResponse.json(
        { error: `Source ${GDRIVE_SOURCE_ID} non trouvée` },
        { status: 404 }
      )
    }

    const row = sourceResult.rows[0]
    const source = {
      id: row.id,
      name: row.name,
      baseUrl: row.base_url,
      category: row.category,
      downloadFiles: row.download_files,
      followLinks: row.follow_links,
      driveConfig: row.drive_config,
    }

    // Lancer le crawl
    const result = await crawlGoogleDriveFolder(source, { incrementalMode })

    console.log(
      `[ForceCrawlGDrive] Terminé: ${result.processed} pages, ` +
        `${result.pagesAdded} new, ${result.pagesUpdated} updated, ` +
        `${result.errors.length} errors`
    )

    // Statistiques contenu
    const statsResult = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE LENGTH(extracted_text) > 100) as with_content,
        COUNT(*) FILTER (WHERE LENGTH(extracted_text) <= 100 OR extracted_text IS NULL) as without_content,
        COUNT(*) as total
      FROM web_pages
      WHERE web_source_id = $1 AND status IN ('crawled', 'unchanged')`,
      [GDRIVE_SOURCE_ID]
    )

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      message: `Crawl terminé: ${result.processed} pages traitées`,
      crawl: {
        processed: result.processed,
        new: result.pagesAdded,
        updated: result.pagesUpdated,
        errors: result.errors.length,
      },
      content: {
        withContent: parseInt(stats.with_content),
        withoutContent: parseInt(stats.without_content),
        total: parseInt(stats.total),
      },
      errorDetails: result.errors.slice(0, 10), // Limiter à 10 premières erreurs
    })
  } catch (error) {
    console.error('[ForceCrawlGDrive] Erreur:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur crawl',
      },
      { status: 500 }
    )
  }
}
