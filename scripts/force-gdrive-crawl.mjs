/**
 * Script pour forcer le crawl Google Drive manuellement
 * Usage: node scripts/force-gdrive-crawl.mjs
 */

import { db } from '../lib/db/postgres.js'
import { crawlGoogleDriveFolder } from '../lib/web-scraper/gdrive-crawler-service.js'

const SOURCE_ID = '546d11c8-b3fd-4559-977b-c3572aede0e4'

async function main() {
  console.log('🚀 Démarrage crawl Google Drive forcé...\n')

  try {
    // Récupérer la source
    const sourceResult = await db.query(
      'SELECT * FROM web_sources WHERE id = $1',
      [SOURCE_ID]
    )

    if (sourceResult.rows.length === 0) {
      throw new Error(`Source ${SOURCE_ID} non trouvée`)
    }

    const sourceRow = sourceResult.rows[0]

    // Construire l'objet WebSource
    const source = {
      id: sourceRow.id,
      name: sourceRow.name,
      baseUrl: sourceRow.base_url,
      category: sourceRow.category,
      downloadFiles: sourceRow.download_files,
      followLinks: sourceRow.follow_links,
      driveConfig: sourceRow.drive_config,
    }

    console.log(`📁 Source: ${source.name}`)
    console.log(`🔗 URL: ${source.baseUrl}`)
    console.log(`📥 Download files: ${source.downloadFiles}`)
    console.log(`🔄 Recursive: ${source.driveConfig?.recursive}\n`)

    // Lancer le crawl (mode non-incrémental pour forcer le re-téléchargement)
    console.log('⏳ Crawl en cours...\n')
    const result = await crawlGoogleDriveFolder(source, {
      incrementalMode: false, // Force re-download
    })

    // Afficher les résultats
    console.log('\n✅ CRAWL TERMINÉ')
    console.log('================')
    console.log(`📊 Pages traitées: ${result.processed}`)
    console.log(`✨ Nouvelles pages: ${result.pagesAdded}`)
    console.log(`🔄 Pages modifiées: ${result.pagesUpdated}`)
    console.log(`❌ Erreurs: ${result.errors.length}`)

    if (result.errors.length > 0) {
      console.log('\n⚠️ ERREURS:')
      result.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.url || err.message}`)
        if (err.error) console.log(`     → ${err.error}`)
      })
    }

    // Compter les pages avec extracted_text
    const statsResult = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE LENGTH(extracted_text) > 100) as with_content,
        COUNT(*) FILTER (WHERE LENGTH(extracted_text) <= 100 OR extracted_text IS NULL) as without_content,
        COUNT(*) as total
      FROM web_pages
      WHERE web_source_id = $1 AND status IN ('crawled', 'unchanged')`,
      [SOURCE_ID]
    )

    const stats = statsResult.rows[0]
    console.log('\n📈 STATISTIQUES CONTENU:')
    console.log(`  ✅ Avec contenu (>100 chars): ${stats.with_content}`)
    console.log(`  ⚠️ Sans contenu (≤100 chars): ${stats.without_content}`)
    console.log(`  📊 Total: ${stats.total}`)

    process.exit(0)
  } catch (error) {
    console.error('\n❌ ERREUR:', error)
    process.exit(1)
  }
}

main()
