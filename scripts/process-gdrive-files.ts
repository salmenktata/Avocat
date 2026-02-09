/**
 * Script: Traitement des fichiers Google Drive existants
 *
 * Télécharge et extrait le texte des fichiers Google Drive qui ont été crawlés
 * mais pas encore traités (downloaded = false)
 */

import { db } from '@/lib/db/postgres'
import { downloadFromGoogleDrive } from '@/lib/web-scraper/storage-adapter'
import { parseFile } from '@/lib/web-scraper/file-parser-service'

interface WebPage {
  id: string
  title: string
  linkedFiles: Array<{
    url: string
    type: string
    filename: string
    minioPath: string // Google Drive fileId
    downloaded: boolean
  }>
}

async function processGoogleDriveFiles(
  sourceId: string,
  batchSize: number = 10
): Promise<void> {
  console.log(`[ProcessGDrive] Démarrage traitement pour source ${sourceId}`)

  let processed = 0
  let succeeded = 0
  let failed = 0
  let totalPages = 0

  // Compter total
  const countResult = await db.query(
    `SELECT COUNT(*) as total
     FROM web_pages
     WHERE web_source_id = $1
       AND extracted_text IS NULL
       AND linked_files IS NOT NULL
       AND jsonb_array_length(linked_files) > 0`,
    [sourceId]
  )
  totalPages = parseInt(countResult.rows[0].total)
  console.log(`[ProcessGDrive] Total pages à traiter: ${totalPages}`)

  // Traiter par batch
  while (processed < totalPages) {
    // Récupérer un batch de pages
    const pagesResult = await db.query(
      `SELECT id, title, linked_files
       FROM web_pages
       WHERE web_source_id = $1
         AND extracted_text IS NULL
         AND linked_files IS NOT NULL
         AND jsonb_array_length(linked_files) > 0
       ORDER BY created_at ASC
       LIMIT $2`,
      [sourceId, batchSize]
    )

    if (pagesResult.rows.length === 0) {
      console.log('[ProcessGDrive] Plus de pages à traiter')
      break
    }

    console.log(
      `[ProcessGDrive] Traitement batch ${Math.floor(processed / batchSize) + 1}: ${pagesResult.rows.length} pages`
    )

    // Traiter chaque page séquentiellement
    for (const row of pagesResult.rows) {
      const page: WebPage = {
        id: row.id,
        title: row.title,
        linkedFiles: row.linked_files,
      }

      try {
        await processPage(page)
        succeeded++
        console.log(`  ✅ [${succeeded}/${totalPages}] ${page.title}`)
      } catch (error) {
        failed++
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`  ❌ [${failed}] ${page.title}: ${errorMsg}`)

        // Marquer comme échec dans la DB
        await db.query(
          `UPDATE web_pages
           SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('processingError', $2)
           WHERE id = $1`,
          [page.id, errorMsg]
        )
      }

      processed++

      // Pause entre fichiers pour éviter rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    console.log(
      `[ProcessGDrive] Progression: ${processed}/${totalPages} (${succeeded} succès, ${failed} échecs)`
    )
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║   📊 TRAITEMENT TERMINÉ                                    ║
╚════════════════════════════════════════════════════════════╝

Total traité:    ${processed} fichiers
✅ Succès:       ${succeeded}
❌ Échecs:       ${failed}
📈 Taux réussite: ${((succeeded / processed) * 100).toFixed(1)}%
`)
}

async function processPage(page: WebPage): Promise<void> {
  if (!page.linkedFiles || page.linkedFiles.length === 0) {
    throw new Error('Aucun fichier lié')
  }

  const file = page.linkedFiles[0]
  const googleDriveFileId = file.minioPath // C'est l'ID Google Drive

  // 1. Télécharger depuis Google Drive
  console.log(`    📥 Téléchargement ${file.filename}...`)
  const downloadResult = await downloadFromGoogleDrive(googleDriveFileId)

  if (!downloadResult.success || !downloadResult.buffer) {
    throw new Error(downloadResult.error || 'Échec téléchargement')
  }

  // 2. Parser le fichier (extraire texte)
  console.log(`    📄 Extraction texte...`)
  // Extraire l'extension du nom de fichier
  const fileExtension = file.filename.split('.').pop()?.toLowerCase() || 'pdf'

  const parseResult = await parseFile(
    downloadResult.buffer,
    fileExtension
  )

  if (!parseResult.success || !parseResult.text) {
    throw new Error(parseResult.error || 'Échec extraction texte')
  }

  const extractedText = parseResult.text.trim()
  const wordCount = extractedText.split(/\s+/).length

  console.log(`    📊 ${wordCount} mots extraits`)

  // 3. Mettre à jour la DB
  await db.query(
    `UPDATE web_pages
     SET extracted_text = $2,
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'fileProcessed', true,
           'wordCount', $3,
           'processedAt', NOW()
         ),
         linked_files = jsonb_set(
           linked_files,
           '{0,downloaded}',
           'true'::jsonb
         )
     WHERE id = $1`,
    [page.id, extractedText, wordCount]
  )
}

// Script principal
const SOURCE_ID = process.argv[2] || '546d11c8-b3fd-4559-977b-c3572aede0e4'
const BATCH_SIZE = parseInt(process.argv[3] || '10')

processGoogleDriveFiles(SOURCE_ID, BATCH_SIZE)
  .then(() => {
    console.log('✅ Script terminé avec succès')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
  })
