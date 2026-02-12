#!/usr/bin/env tsx
/**
 * Script de classification batch des pages web
 *
 * Objectif : Classifier les 8 683 pages web sans classification IA
 *           AVANT de lancer la reclassification KB
 *
 * Principe : Utilise legal-classifier-service.ts pour classifier chaque page
 *
 * Usage : npx tsx scripts/classify-pages-batch.ts [--limit=N] [--skip-cache]
 */

import { db } from '@/lib/db/postgres'
import { classifyLegalContent } from '@/lib/web-scraper/legal-classifier-service'

// =============================================================================
// CONFIGURATION
// =============================================================================

const BATCH_SIZE = 10 // Traiter 10 pages par batch (éviter surcharge LLM)
const LIMIT_ARG = process.argv.find(arg => arg.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : undefined
const SKIP_CACHE = process.argv.includes('--skip-cache')

// =============================================================================
// TYPES
// =============================================================================

interface WebPageToClassify {
  id: string
  url: string
  title: string | null
  extracted_text: string
  web_source_id: string
}

interface Stats {
  total: number
  processed: number
  succeeded: number
  failed: number
  skipped: number
  errors: Array<{ page_id: string; url: string; error: string }>
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Découpe un array en chunks
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Calcule un pourcentage formaté
 */
function pct(value: number, total: number): string {
  return total === 0 ? '0.0' : ((value / total) * 100).toFixed(1)
}

// =============================================================================
// CLASSIFICATION BATCH
// =============================================================================

async function classifyPagesBatch(): Promise<Stats> {
  console.log('\n🔍 CLASSIFICATION BATCH - Pages Web\n')
  if (LIMIT) console.log(`Limite : ${LIMIT} pages`)
  if (SKIP_CACHE) console.log(`Mode : Skip cache`)
  console.log('')

  // Initialiser les stats
  const stats: Stats = {
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  // 1. Récupérer les pages sans classification
  console.log('📊 Récupération des pages sans classification...')
  let sql = `
    SELECT
      wp.id,
      wp.url,
      wp.title,
      wp.extracted_text,
      wp.web_source_id
    FROM web_pages wp
    LEFT JOIN legal_classifications lc ON wp.id = lc.web_page_id
    WHERE wp.status IN ('crawled', 'indexed')
      AND wp.extracted_text IS NOT NULL
      AND LENGTH(wp.extracted_text) >= 100
      AND lc.id IS NULL
    ORDER BY wp.last_crawled_at DESC
  `

  if (LIMIT) {
    sql += ` LIMIT ${LIMIT}`
  }

  const pagesResult = await db.query(sql)
  const pages = pagesResult.rows as WebPageToClassify[]

  stats.total = pages.length
  console.log(`✅ ${stats.total} pages à classifier\n`)

  if (stats.total === 0) {
    console.log('✅ Toutes les pages sont déjà classifiées !')
    return stats
  }

  // 2. Traitement par batch
  const batches = chunk(pages, BATCH_SIZE)
  const startTime = Date.now()

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const batchStartTime = Date.now()

    console.log(`📦 Batch ${i + 1}/${batches.length} (${batch.length} pages)...`)

    // Traiter chaque page du batch séquentiellement (éviter surcharge LLM)
    for (const page of batch) {
      try {
        // Classifier la page
        const classification = await classifyLegalContent({
          url: page.url,
          title: page.title || '',
          content: page.extracted_text,
          webSourceId: page.web_source_id,
          pageId: page.id,
        })

        if (classification) {
          stats.succeeded++
          console.log(`   ✅ ${page.url.substring(0, 60)}... → ${classification.primaryCategory} (${(classification.confidenceScore * 100).toFixed(0)}%)`)
        } else {
          stats.skipped++
          console.log(`   ⚠️  ${page.url.substring(0, 60)}... → Skipped (no classification)`)
        }

        stats.processed++
      } catch (error) {
        stats.failed++
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        stats.errors.push({
          page_id: page.id,
          url: page.url,
          error: errorMsg,
        })
        console.error(`   ❌ ${page.url.substring(0, 60)}... → Error: ${errorMsg}`)
      }
    }

    const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1)
    const avgPerPage = (parseFloat(batchDuration) / batch.length).toFixed(1)
    const progress = pct(stats.processed, stats.total)

    console.log(`   ⏱️  Batch: ${batchDuration}s (${avgPerPage}s/page) - Progress: ${progress}%\n`)

    // Pause entre les batches pour éviter rate limiting
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2s pause
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  console.log(`⏱️  Durée totale : ${totalDuration} minutes\n`)

  return stats
}

// =============================================================================
// RAPPORT
// =============================================================================

function printReport(stats: Stats) {
  console.log('\n' + '='.repeat(60))
  console.log('📊 CLASSIFICATION BATCH COMPLÉTÉE')
  console.log('='.repeat(60) + '\n')

  console.log(`Total pages         : ${stats.total}`)
  console.log(`Traitées            : ${stats.processed} (${pct(stats.processed, stats.total)}%)`)
  console.log(`Succès              : ${stats.succeeded} (${pct(stats.succeeded, stats.total)}%)`)
  console.log(`Échouées            : ${stats.failed} (${pct(stats.failed, stats.total)}%)`)
  console.log(`Skipped             : ${stats.skipped} (${pct(stats.skipped, stats.total)}%)`)

  if (stats.errors.length > 0) {
    console.log('\n⚠️  ERREURS :')
    stats.errors.slice(0, 10).forEach((err, i) => {
      console.log(`   ${i + 1}. ${err.url}`)
      console.log(`      → ${err.error}`)
    })
    if (stats.errors.length > 10) {
      console.log(`   ... et ${stats.errors.length - 10} autres erreurs`)
    }
  }

  // Statistiques finales
  console.log('\n📈 Statistiques post-classification :')
  console.log('   Exécutez cette requête pour voir la distribution :')
  console.log('')
  console.log('   SELECT primary_category, COUNT(*) as count')
  console.log('   FROM legal_classifications')
  console.log('   GROUP BY primary_category')
  console.log('   ORDER BY COUNT(*) DESC;')
  console.log('')

  console.log('💡 Prochaine étape :')
  console.log('   npx tsx scripts/reclassify-kb-batch.ts --dry-run')

  console.log('\n' + '='.repeat(60) + '\n')
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  try {
    const stats = await classifyPagesBatch()
    printReport(stats)

    process.exit(stats.failed > 0 ? 1 : 0)
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  }
}

main()
