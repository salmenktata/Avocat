#!/usr/bin/env tsx
/**
 * Script d'extraction bulk des métadonnées pour les pages web
 *
 * Usage:
 *   npm run extract:metadata -- <source-id>
 *
 * Options:
 *   --batch-size <n>      Nombre de pages par batch (défaut: 10)
 *   --concurrency <n>     Nombre de requêtes parallèles (défaut: 5)
 *   --max-batches <n>     Nombre maximum de batches (défaut: illimité)
 *   --delay <ms>          Délai entre batches en ms (défaut: 1000)
 *   --category <cat>      Filtrer par catégorie (défaut: toutes)
 *   --dry-run             Afficher les stats sans extraire
 *
 * Exemple:
 *   npm run extract:metadata -- 4319d2d1-569c-4107-8f52-d71e2a2e9fe9
 *   npm run extract:metadata -- 4319d2d1-569c-4107-8f52-d71e2a2e9fe9 --batch-size 20 --concurrency 10
 *   npm run extract:metadata -- 4319d2d1-569c-4107-8f52-d71e2a2e9fe9 --max-batches 5 --dry-run
 */

import { db } from '@/lib/db/postgres'
import { extractStructuredMetadata } from '@/lib/web-scraper/metadata-extractor-service'

interface BulkExtractionOptions {
  batchSize: number
  concurrency: number
  maxBatches?: number
  delay: number
  onlyCategory?: string
  dryRun: boolean
}

interface BulkExtractionStats {
  totalPages: number
  pagesWithMetadata: number
  pagesWithoutMetadata: number
  processedInSession: number
  failedInSession: number
  errors: Array<{ pageId: string; url: string; error: string }>
}

async function getStats(sourceId: string): Promise<{
  totalPages: number
  pagesWithMetadata: number
  pagesWithoutMetadata: number
}> {
  const result = await db.query<{
    total_pages: string
    pages_with_metadata: string
    pages_without_metadata: string
  }>(
    `SELECT
      COUNT(*) as total_pages,
      COUNT(wpsm.web_page_id) as pages_with_metadata,
      COUNT(*) - COUNT(wpsm.web_page_id) as pages_without_metadata
    FROM web_pages wp
    LEFT JOIN web_page_structured_metadata wpsm ON wp.id = wpsm.web_page_id
    WHERE wp.web_source_id = $1`,
    [sourceId]
  )

  const stats = result.rows[0]
  return {
    totalPages: parseInt(stats.total_pages, 10),
    pagesWithMetadata: parseInt(stats.pages_with_metadata, 10),
    pagesWithoutMetadata: parseInt(stats.pages_without_metadata, 10),
  }
}

async function extractBatch(
  sourceId: string,
  options: BulkExtractionOptions
): Promise<{
  processed: number
  failed: number
  errors: Array<{ pageId: string; url: string; error: string }>
  hasMore: boolean
}> {
  // Récupérer les pages à traiter
  let query = `
    SELECT wp.id, wp.url, wp.title, wp.extracted_text,
           ws.category as source_category
    FROM web_pages wp
    JOIN web_sources ws ON wp.web_source_id = ws.id
    WHERE wp.web_source_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM web_page_structured_metadata wpsm
        WHERE wpsm.web_page_id = wp.id
      )
  `
  const queryParams: (string | number)[] = [sourceId]

  if (options.onlyCategory) {
    query += ` AND ws.category = $${queryParams.length + 1}`
    queryParams.push(options.onlyCategory)
  }

  query += ` ORDER BY wp.created_at DESC LIMIT $${queryParams.length + 1}`
  queryParams.push(options.batchSize)

  const pagesResult = await db.query(query, queryParams)

  if (pagesResult.rows.length === 0) {
    return {
      processed: 0,
      failed: 0,
      errors: [],
      hasMore: false,
    }
  }

  const errors: Array<{ pageId: string; url: string; error: string }> = []
  const results: string[] = []

  // Traiter par batch avec concurrency
  for (let i = 0; i < pagesResult.rows.length; i += options.concurrency) {
    const batch = pagesResult.rows.slice(i, i + options.concurrency)

    const batchPromises = batch.map(async (page) => {
      try {
        await extractStructuredMetadata(page.id)
        results.push(page.id)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue'
        errors.push({
          pageId: page.id,
          url: page.url,
          error: errorMsg,
        })
      }
    })

    await Promise.all(batchPromises)
  }

  return {
    processed: results.length,
    failed: errors.length,
    errors,
    hasMore: pagesResult.rows.length === options.batchSize,
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

async function runBulkExtraction(
  sourceId: string,
  options: BulkExtractionOptions
): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════╗')
  console.log('║     EXTRACTION BULK MÉTADONNÉES - 9ANOUN.TN                  ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  // Étape 1 : Récupérer les stats initiales
  console.log('📊 Récupération des statistiques...\n')
  const initialStats = await getStats(sourceId)

  console.log(`📄 Total pages              : ${initialStats.totalPages.toLocaleString()}`)
  console.log(`✅ Pages avec métadonnées   : ${initialStats.pagesWithMetadata.toLocaleString()}`)
  console.log(`⏳ Pages sans métadonnées   : ${initialStats.pagesWithoutMetadata.toLocaleString()}`)
  console.log(`📈 Couverture              : ${((initialStats.pagesWithMetadata / initialStats.totalPages) * 100).toFixed(2)}%\n`)

  if (initialStats.pagesWithoutMetadata === 0) {
    console.log('✨ Toutes les pages ont déjà des métadonnées !\n')
    return
  }

  // Estimations
  const avgTimePerPage = 10 // secondes (moyenne entre regex seul et LLM)
  const estimatedTimeSeconds = Math.ceil(
    (initialStats.pagesWithoutMetadata * avgTimePerPage) / options.concurrency
  )
  const estimatedBatches = Math.ceil(initialStats.pagesWithoutMetadata / options.batchSize)

  console.log('⏱️  Estimations :')
  console.log(`   - Temps estimé          : ${formatDuration(estimatedTimeSeconds)}`)
  console.log(`   - Nombre de batches     : ${estimatedBatches}`)
  console.log(`   - Pages par batch       : ${options.batchSize}`)
  console.log(`   - Concurrency           : ${options.concurrency}`)
  if (options.maxBatches) {
    console.log(`   - Batches max (limite)  : ${options.maxBatches}`)
  }
  if (options.onlyCategory) {
    console.log(`   - Catégorie filtrée     : ${options.onlyCategory}`)
  }
  console.log()

  if (options.dryRun) {
    console.log('🔍 Mode dry-run activé - Aucune extraction lancée\n')
    return
  }

  // Confirmation
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const answer = await new Promise<string>((resolve) => {
    rl.question('▶️  Lancer l\'extraction ? (o/N) ', resolve)
  })
  rl.close()

  if (answer.toLowerCase() !== 'o' && answer.toLowerCase() !== 'oui') {
    console.log('\n❌ Extraction annulée\n')
    return
  }

  console.log('\n🚀 Lancement de l\'extraction...\n')

  // Étape 2 : Extraction par batches
  const stats: BulkExtractionStats = {
    ...initialStats,
    processedInSession: 0,
    failedInSession: 0,
    errors: [],
  }

  let batchNumber = 0
  let hasMore = true
  const startTime = Date.now()

  while (hasMore && (!options.maxBatches || batchNumber < options.maxBatches)) {
    batchNumber++
    const batchStartTime = Date.now()

    console.log(`\n📦 Batch ${batchNumber} / ${estimatedBatches} (max: ${options.maxBatches || '∞'})`)
    console.log('─'.repeat(70))

    try {
      const result = await extractBatch(sourceId, options)

      stats.processedInSession += result.processed
      stats.failedInSession += result.failed
      stats.errors.push(...result.errors)
      hasMore = result.hasMore

      const batchDuration = Math.floor((Date.now() - batchStartTime) / 1000)
      const totalDuration = Math.floor((Date.now() - startTime) / 1000)

      console.log(`✅ Réussies : ${result.processed}`)
      console.log(`❌ Échecs   : ${result.failed}`)
      console.log(`⏱️  Durée    : ${batchDuration}s`)

      if (result.errors.length > 0) {
        console.log(`\n⚠️  Erreurs dans ce batch :`)
        result.errors.slice(0, 3).forEach((err) => {
          console.log(`   - ${err.url.substring(0, 60)}...`)
          console.log(`     ${err.error}`)
        })
        if (result.errors.length > 3) {
          console.log(`   ... et ${result.errors.length - 3} autres erreurs`)
        }
      }

      // Progression globale
      const currentStats = await getStats(sourceId)
      const progressPercent = (currentStats.pagesWithMetadata / currentStats.totalPages) * 100

      console.log(`\n📊 Progression globale :`)
      console.log(`   Métadonnées : ${currentStats.pagesWithMetadata} / ${currentStats.totalPages} (${progressPercent.toFixed(2)}%)`)
      console.log(`   Temps écoulé : ${formatDuration(totalDuration)}`)
      console.log(`   Vitesse moy. : ${(stats.processedInSession / totalDuration).toFixed(2)} pages/s`)

      if (!hasMore) {
        console.log('\n✅ Tous les batches ont été traités !')
        break
      }

      // Délai entre batches
      if (options.delay > 0) {
        console.log(`\n⏳ Pause de ${options.delay}ms avant le prochain batch...`)
        await new Promise((resolve) => setTimeout(resolve, options.delay))
      }
    } catch (error) {
      console.error(`\n❌ Erreur dans le batch ${batchNumber}:`, error)
      stats.failedInSession += options.batchSize
      hasMore = false
    }
  }

  // Étape 3 : Rapport final
  const finalStats = await getStats(sourceId)
  const totalDuration = Math.floor((Date.now() - startTime) / 1000)

  console.log('\n\n╔════════════════════════════════════════════════════════════════╗')
  console.log('║                    RAPPORT FINAL                              ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  console.log(`📊 Statistiques finales :`)
  console.log(`   Total pages             : ${finalStats.totalPages.toLocaleString()}`)
  console.log(`   Avec métadonnées        : ${finalStats.pagesWithMetadata.toLocaleString()}`)
  console.log(`   Sans métadonnées        : ${finalStats.pagesWithoutMetadata.toLocaleString()}`)
  console.log(`   Couverture              : ${((finalStats.pagesWithMetadata / finalStats.totalPages) * 100).toFixed(2)}%`)

  console.log(`\n🔧 Cette session :`)
  console.log(`   Pages traitées          : ${stats.processedInSession.toLocaleString()}`)
  console.log(`   Pages échouées          : ${stats.failedInSession.toLocaleString()}`)
  console.log(`   Batches exécutés        : ${batchNumber}`)
  console.log(`   Durée totale            : ${formatDuration(totalDuration)}`)
  console.log(`   Vitesse moyenne         : ${(stats.processedInSession / totalDuration).toFixed(2)} pages/s`)

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Erreurs rencontrées : ${stats.errors.length}`)
    console.log(`\n   Exemples d'erreurs :`)
    stats.errors.slice(0, 5).forEach((err, i) => {
      console.log(`   ${i + 1}. ${err.url.substring(0, 60)}...`)
      console.log(`      ${err.error}\n`)
    })
  }

  console.log('\n✨ Extraction terminée !\n')
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: npm run extract:metadata -- <source-id> [options]

Options:
  --batch-size <n>      Nombre de pages par batch (défaut: 10)
  --concurrency <n>     Nombre de requêtes parallèles (défaut: 5)
  --max-batches <n>     Nombre maximum de batches (défaut: illimité)
  --delay <ms>          Délai entre batches en ms (défaut: 1000)
  --category <cat>      Filtrer par catégorie (défaut: toutes)
  --dry-run             Afficher les stats sans extraire

Exemple:
  npm run extract:metadata -- 4319d2d1-569c-4107-8f52-d71e2a2e9fe9
  npm run extract:metadata -- 4319d2d1-569c-4107-8f52-d71e2a2e9fe9 --batch-size 20 --concurrency 10
  npm run extract:metadata -- 4319d2d1-569c-4107-8f52-d71e2a2e9fe9 --max-batches 5 --dry-run
    `)
    process.exit(0)
  }

  const sourceId = args[0]

  const options: BulkExtractionOptions = {
    batchSize: 10,
    concurrency: 5,
    delay: 1000,
    dryRun: false,
  }

  // Parser les options
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10)
        break
      case '--concurrency':
        options.concurrency = parseInt(args[++i], 10)
        break
      case '--max-batches':
        options.maxBatches = parseInt(args[++i], 10)
        break
      case '--delay':
        options.delay = parseInt(args[++i], 10)
        break
      case '--category':
        options.onlyCategory = args[++i]
        break
      case '--dry-run':
        options.dryRun = true
        break
    }
  }

  try {
    await runBulkExtraction(sourceId, options)
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  } finally {
    await db.end()
  }
}

main()
