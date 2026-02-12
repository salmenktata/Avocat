/**
 * Script pour indexer les pages Google Drive non-indexées
 * Usage: node scripts/index-gdrive-pages.mjs [limit]
 */

import { db } from '/app/lib/db/postgres.js'
import { indexSourcePages } from '/app/lib/web-scraper/web-indexer-service.js'

const SOURCE_ID = '546d11c8-b3fd-4559-977b-c3572aede0e4'
const BATCH_LIMIT = parseInt(process.argv[2]) || 20

async function main() {
  console.log('🚀 Démarrage indexation Google Drive...\n')
  console.log(`📊 Batch size: ${BATCH_LIMIT} pages\n`)

  try {
    // Statistiques avant
    const beforeStats = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE is_indexed = true) as indexed,
        COUNT(*) FILTER (WHERE is_indexed = false) as not_indexed,
        COUNT(*) as total
      FROM web_pages
      WHERE web_source_id = $1
      AND status IN ('crawled', 'unchanged')`,
      [SOURCE_ID]
    )
    const before = beforeStats.rows[0]
    console.log('📈 AVANT:')
    console.log(`  ✅ Indexées: ${before.indexed}`)
    console.log(`  ⏳ Non-indexées: ${before.not_indexed}`)
    console.log(`  📊 Total: ${before.total}\n`)

    // Lancer l'indexation
    console.log(`⏳ Indexation en cours (max ${BATCH_LIMIT} pages)...\n`)
    const result = await indexSourcePages(SOURCE_ID, {
      limit: BATCH_LIMIT,
      reindex: false,
    })

    console.log('\n✅ INDEXATION TERMINÉE')
    console.log('======================')
    console.log(`📊 Traitées: ${result.processed}`)
    console.log(`✅ Réussies: ${result.succeeded}`)
    console.log(`❌ Échouées: ${result.failed}`)

    if (result.failed > 0) {
      console.log('\n⚠️ ERREURS:')
      const errors = result.results.filter(r => !r.success)
      errors.slice(0, 10).forEach((err, i) => {
        console.log(`  ${i + 1}. Page ${err.pageId}: ${err.error}`)
      })
      if (errors.length > 10) {
        console.log(`  ... et ${errors.length - 10} autres erreurs`)
      }
    }

    // Statistiques après
    const afterStats = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE is_indexed = true) as indexed,
        COUNT(*) FILTER (WHERE is_indexed = false) as not_indexed,
        COUNT(*) as total
      FROM web_pages
      WHERE web_source_id = $1
      AND status IN ('crawled', 'unchanged')`,
      [SOURCE_ID]
    )
    const after = afterStats.rows[0]
    console.log('\n📈 APRÈS:')
    console.log(`  ✅ Indexées: ${after.indexed} (+${after.indexed - before.indexed})`)
    console.log(`  ⏳ Non-indexées: ${after.not_indexed}`)
    console.log(`  📊 Total: ${after.total}`)

    // Vérifier les documents KB créés
    const kbStats = await db.query(
      `SELECT COUNT(*) as count
      FROM knowledge_base
      WHERE metadata->>'web_source_id' = $1`,
      [SOURCE_ID]
    )
    console.log(`\n📚 Documents KB créés: ${kbStats.rows[0].count}`)

    process.exit(0)
  } catch (error) {
    console.error('\n❌ ERREUR:', error)
    process.exit(1)
  }
}

main()
