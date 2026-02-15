import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/postgres'
import { indexFile } from '@/lib/web-scraper/file-indexer-service'
import type { LinkedFile } from '@/lib/web-scraper/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface FileResult {
  pageId: string
  filename: string
  chunksCreated: number
  durationMs: number
  error?: string
}

/**
 * POST /api/admin/web-sources/index-files
 *
 * Indexe les fichiers (PDF, DOCX) téléchargés mais non indexés dans la KB.
 * Rattrapage pour les pages crawlées sans auto-indexation.
 *
 * Query params:
 * - source=<id|name> : Filtrer par web source (ID ou nom partiel). Requis.
 * - dry-run=true     : Mode simulation
 * - limit=<n>        : Nombre max de fichiers à traiter (défaut: 50)
 * - file-index=<n>   : Index du fichier dans linked_files (défaut: 1, car 0 = menu PDF)
 *
 * Headers:
 * - X-Cron-Secret: Secret cron pour authentification
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('X-Cron-Secret')
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = request.nextUrl.searchParams
    const sourceFilter = params.get('source')
    const dryRun = params.get('dry-run') === 'true'
    const limit = Math.min(parseInt(params.get('limit') || '50'), 500)
    const fileIndex = parseInt(params.get('file-index') || '1')

    if (!sourceFilter) {
      return NextResponse.json(
        { error: 'Paramètre "source" requis (ID ou nom partiel)' },
        { status: 400 }
      )
    }

    const startTime = Date.now()

    // 1. Trouver la source
    const sourceResult = await db.query<{
      id: string
      name: string
      category: string
    }>(
      `SELECT id, name, category FROM web_sources
       WHERE id::text = $1 OR name ILIKE '%' || $1 || '%' OR base_url ILIKE '%' || $1 || '%'
       LIMIT 1`,
      [sourceFilter]
    )

    if (sourceResult.rows.length === 0) {
      return NextResponse.json(
        { error: `Source non trouvée: ${sourceFilter}` },
        { status: 404 }
      )
    }

    const source = sourceResult.rows[0]

    // 2. Trouver les pages avec des fichiers téléchargés mais non indexés
    //    Un fichier est "non indexé" s'il n'existe pas dans web_files avec is_indexed=true
    const pagesResult = await db.query<{
      page_id: string
      page_url: string
      linked_files: LinkedFile[]
    }>(
      `SELECT wp.id as page_id, wp.url as page_url, wp.linked_files
       FROM web_pages wp
       WHERE wp.web_source_id = $1
         AND wp.linked_files IS NOT NULL
         AND jsonb_array_length(wp.linked_files) > $2
         AND NOT EXISTS (
           SELECT 1 FROM web_files wf
           WHERE wf.web_page_id = wp.id
             AND wf.url = wp.linked_files->$2->>'url'
             AND wf.is_indexed = true
         )
       ORDER BY wp.created_at
       LIMIT $3`,
      [source.id, fileIndex, limit]
    )

    const pages = pagesResult.rows

    if (pages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun fichier non indexé trouvé',
        source: { id: source.id, name: source.name },
        summary: { filesToIndex: 0 }
      })
    }

    // 3. Dry run
    if (dryRun) {
      const files = pages.map(p => {
        const file = p.linked_files[fileIndex]
        return {
          pageId: p.page_id,
          url: p.page_url,
          filename: file?.filename || 'unknown',
          downloaded: file?.downloaded || false,
          minioPath: file?.minioPath || null,
        }
      })

      return NextResponse.json({
        success: true,
        dryRun: true,
        source: { id: source.id, name: source.name, category: source.category },
        summary: {
          filesToIndex: pages.length,
          filesWithMinioPath: files.filter(f => f.minioPath).length,
          filesDownloaded: files.filter(f => f.downloaded).length,
        },
        files,
      })
    }

    // 4. Indexer chaque fichier
    console.log(`[IndexFiles] Démarrage : ${pages.length} fichiers à indexer pour "${source.name}"`)

    const results: FileResult[] = []
    let totalChunks = 0
    let successCount = 0
    let errorCount = 0

    for (const page of pages) {
      const file = page.linked_files[fileIndex]
      if (!file || !file.downloaded || !file.minioPath) {
        results.push({
          pageId: page.page_id,
          filename: file?.filename || 'unknown',
          chunksCreated: 0,
          durationMs: 0,
          error: 'Fichier non téléchargé ou sans minioPath',
        })
        errorCount++
        continue
      }

      const fileStart = Date.now()

      try {
        const result = await indexFile(
          file,
          page.page_id,
          source.id,
          source.name,
          source.category
        )

        const durationMs = Date.now() - fileStart

        if (result.success) {
          totalChunks += result.chunksCreated
          successCount++
          results.push({
            pageId: page.page_id,
            filename: file.filename,
            chunksCreated: result.chunksCreated,
            durationMs,
          })
          console.log(`[IndexFiles] ✅ ${file.filename} : ${result.chunksCreated} chunks (${durationMs}ms)`)
        } else {
          errorCount++
          results.push({
            pageId: page.page_id,
            filename: file.filename,
            chunksCreated: 0,
            durationMs,
            error: result.error,
          })
          console.warn(`[IndexFiles] ⚠️ ${file.filename} : ${result.error}`)
        }
      } catch (error) {
        const durationMs = Date.now() - fileStart
        errorCount++
        const errorMsg = error instanceof Error ? error.message : String(error)
        results.push({
          pageId: page.page_id,
          filename: file.filename,
          chunksCreated: 0,
          durationMs,
          error: errorMsg,
        })
        console.error(`[IndexFiles] ❌ ${file.filename} : ${errorMsg}`)
      }
    }

    const totalDurationMs = Date.now() - startTime

    console.log(`[IndexFiles] Terminé : ${successCount}/${pages.length} fichiers, ${totalChunks} chunks, ${totalDurationMs}ms`)

    return NextResponse.json({
      success: errorCount === 0,
      source: { id: source.id, name: source.name, category: source.category },
      summary: {
        filesIndexed: successCount,
        filesFailed: errorCount,
        totalChunksCreated: totalChunks,
        totalDurationMs,
      },
      results,
    })

  } catch (error) {
    console.error('[IndexFiles] Erreur fatale:', error)
    return NextResponse.json(
      { error: 'Erreur interne', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
