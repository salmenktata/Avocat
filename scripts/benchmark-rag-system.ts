/**
 * Benchmark complet du système RAG : Crawling + Indexation
 * Évalue performance, fiabilité et gestion des PDFs
 *
 * Usage: DATABASE_URL="..." OPENAI_API_KEY="..." npx tsx scripts/benchmark-rag-system.ts
 */

import { db } from '@/lib/db/postgres'
import { crawlSource } from '@/lib/web-scraper/crawler-service'
import { indexSourcePages } from '@/lib/web-scraper/web-indexer-service'
import { indexPageFiles } from '@/lib/web-scraper/file-indexer-service'

// Types
interface WebSourceRow {
  id: string
  name: string
  base_url: string
  category: string
  max_pages: number
  max_depth: number
  rate_limit_ms: number
  download_files: boolean
}

interface BenchmarkResult {
  phase: string
  source: string
  duration: number
  success: boolean
  metrics: Record<string, number | string>
  errors: string[]
}

interface PerformanceMetrics {
  crawlResults: BenchmarkResult[]
  indexResults: BenchmarkResult[]
  fileResults: BenchmarkResult[]
  totalDuration: number
  summary: {
    totalPages: number
    totalIndexed: number
    totalFiles: number
    filesIndexed: number
    avgCrawlSpeed: number
    avgIndexSpeed: number
    successRate: number
    errorCount: number
  }
}

// Helpers
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// Main benchmark
async function runBenchmark(): Promise<PerformanceMetrics> {
  const metrics: PerformanceMetrics = {
    crawlResults: [],
    indexResults: [],
    fileResults: [],
    totalDuration: 0,
    summary: {
      totalPages: 0,
      totalIndexed: 0,
      totalFiles: 0,
      filesIndexed: 0,
      avgCrawlSpeed: 0,
      avgIndexSpeed: 0,
      successRate: 0,
      errorCount: 0,
    },
  }

  const startTime = Date.now()

  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║        BENCHMARK SYSTÈME RAG - CRAWLING & INDEXATION       ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // 1. Récupérer les sources (focus sur JORT pour les PDFs)
  console.log('📋 Phase 1: Récupération des sources...\n')

  const sources = await db.query<WebSourceRow>(`
    SELECT id, name, base_url, category, max_pages, max_depth,
           rate_limit_ms, download_files
    FROM web_sources
    WHERE is_active = true
    ORDER BY
      CASE WHEN name LIKE '%JORT%' THEN 0 ELSE 1 END,
      priority DESC
  `)

  console.log(`   Sources disponibles: ${sources.rows.length}`)
  sources.rows.forEach((s) => {
    console.log(`   • ${s.name} (${s.base_url}) - download_files: ${s.download_files}`)
  })

  // 2. CRAWLING BENCHMARK
  console.log('\n' + '─'.repeat(60))
  console.log('🕷️  Phase 2: BENCHMARK CRAWLING')
  console.log('─'.repeat(60) + '\n')

  // Activer le téléchargement de fichiers pour JORT
  for (const source of sources.rows) {
    if (source.name.includes('JORT')) {
      await db.query(`UPDATE web_sources SET download_files = true WHERE id = $1`, [source.id])
      console.log(`   ✓ Activé download_files pour ${source.name}`)
    }
  }

  // Crawl en parallèle avec métriques détaillées
  const crawlPromises = sources.rows.slice(0, 3).map(async (source) => {
    const result: BenchmarkResult = {
      phase: 'crawl',
      source: source.name,
      duration: 0,
      success: false,
      metrics: {},
      errors: [],
    }

    const start = Date.now()
    console.log(`   🔄 [${source.name}] Crawl démarré...`)

    try {
      const crawlResult = await crawlSource(source as any, {
        maxPages: 20, // Plus de pages pour le benchmark
        maxDepth: 3,
        incrementalMode: false, // Force le re-crawl
        downloadFiles: source.name.includes('JORT'), // PDFs pour JORT
      })

      result.duration = Date.now() - start
      result.success = true
      result.metrics = {
        pagesProcessed: crawlResult.pagesProcessed,
        pagesNew: crawlResult.pagesNew,
        pagesChanged: crawlResult.pagesChanged,
        pagesFailed: crawlResult.pagesFailed,
        filesDownloaded: crawlResult.filesDownloaded,
        pagesPerSecond: crawlResult.pagesProcessed / (result.duration / 1000),
      }

      console.log(
        `   ✅ [${source.name}] ${formatDuration(result.duration)} - ` +
        `${crawlResult.pagesProcessed} pages (${(result.metrics.pagesPerSecond as number).toFixed(1)}/s), ` +
        `${crawlResult.filesDownloaded} fichiers`
      )

      if (crawlResult.errors.length > 0) {
        result.errors = crawlResult.errors.slice(0, 3).map((e) => `${e.url}: ${e.error}`)
        console.log(`   ⚠️  ${crawlResult.errors.length} erreurs`)
      }
    } catch (error) {
      result.duration = Date.now() - start
      result.errors.push(String(error))
      console.log(`   ❌ [${source.name}] Échec: ${error}`)
    }

    return result
  })

  metrics.crawlResults = await Promise.all(crawlPromises)

  // 3. INDEXATION BENCHMARK
  console.log('\n' + '─'.repeat(60))
  console.log('📚 Phase 3: BENCHMARK INDEXATION')
  console.log('─'.repeat(60) + '\n')

  // Vérifier les pages à indexer
  const pagesToIndex = await db.query<{ source_name: string; count: number }>(`
    SELECT ws.name as source_name, COUNT(*) as count
    FROM web_pages wp
    JOIN web_sources ws ON wp.web_source_id = ws.id
    WHERE wp.is_indexed = false AND wp.status = 'crawled'
    GROUP BY ws.name
  `)

  console.log('   Pages à indexer par source:')
  pagesToIndex.rows.forEach((r) => {
    console.log(`   • ${r.source_name}: ${r.count} pages`)
  })

  // Indexation en parallèle
  const indexPromises = sources.rows.slice(0, 3).map(async (source) => {
    const result: BenchmarkResult = {
      phase: 'index',
      source: source.name,
      duration: 0,
      success: false,
      metrics: {},
      errors: [],
    }

    const start = Date.now()
    console.log(`   🔄 [${source.name}] Indexation démarrée...`)

    try {
      const indexResult = await indexSourcePages(source.id, {
        limit: 20,
        reindex: false,
      })

      result.duration = Date.now() - start
      result.success = true
      result.metrics = {
        indexed: indexResult.succeeded || 0,
        failed: indexResult.failed || 0,
        skipped: 0,
        chunksCreated: 0,
        pagesPerSecond: ((indexResult.succeeded || 0) / (result.duration / 1000)),
      }

      console.log(
        `   ✅ [${source.name}] ${formatDuration(result.duration)} - ` +
        `${indexResult.succeeded} indexées, ` +
        `${indexResult.failed} erreurs`
      )
    } catch (error) {
      result.duration = Date.now() - start
      result.errors.push(String(error))
      console.log(`   ❌ [${source.name}] Échec: ${error}`)
    }

    return result
  })

  metrics.indexResults = await Promise.all(indexPromises)

  // 4. FICHIERS/PDFs BENCHMARK
  console.log('\n' + '─'.repeat(60))
  console.log('📄 Phase 4: BENCHMARK INDEXATION FICHIERS (PDFs)')
  console.log('─'.repeat(60) + '\n')

  // Vérifier les fichiers téléchargés
  const filesStats = await db.query<{
    source_name: string
    total_files: number
    indexed_files: number
    total_size: number
  }>(`
    SELECT
      ws.name as source_name,
      COUNT(wf.id) as total_files,
      COUNT(CASE WHEN wf.is_indexed THEN 1 END) as indexed_files,
      COALESCE(SUM(wf.file_size), 0) as total_size
    FROM web_sources ws
    LEFT JOIN web_pages wp ON ws.id = wp.web_source_id
    LEFT JOIN web_page_files wf ON wp.id = wf.web_page_id
    GROUP BY ws.name
    HAVING COUNT(wf.id) > 0
  `)

  if (filesStats.rows.length > 0) {
    console.log('   Fichiers par source:')
    filesStats.rows.forEach((r) => {
      console.log(
        `   • ${r.source_name}: ${r.total_files} fichiers ` +
        `(${r.indexed_files} indexés, ${formatBytes(Number(r.total_size))})`
      )
    })

    // Indexer les fichiers non indexés
    for (const source of sources.rows) {
      const result: BenchmarkResult = {
        phase: 'files',
        source: source.name,
        duration: 0,
        success: false,
        metrics: {},
        errors: [],
      }

      const start = Date.now()

      try {
        // Récupérer les pages avec fichiers non indexés
        const pagesWithFiles = await db.query<{ id: string }>(`
          SELECT DISTINCT wp.id
          FROM web_pages wp
          JOIN web_page_files wf ON wp.id = wf.web_page_id
          WHERE wp.web_source_id = $1 AND wf.is_indexed = false
          LIMIT 10
        `, [source.id])

        if (pagesWithFiles.rows.length > 0) {
          console.log(`   🔄 [${source.name}] Indexation de ${pagesWithFiles.rows.length} pages avec fichiers...`)

          let filesIndexed = 0
          let filesFailed = 0

          for (const page of pagesWithFiles.rows) {
            try {
              const fileResult = await indexPageFiles(page.id, source.id, source.name, source.category)
              filesIndexed += fileResult.indexed || 0
              filesFailed += fileResult.failed || 0
            } catch (e) {
              filesFailed++
              result.errors.push(String(e))
            }
          }

          result.duration = Date.now() - start
          result.success = true
          result.metrics = { filesIndexed, filesFailed }

          console.log(
            `   ✅ [${source.name}] ${formatDuration(result.duration)} - ` +
            `${filesIndexed} fichiers indexés, ${filesFailed} erreurs`
          )
        }
      } catch (error) {
        result.duration = Date.now() - start
        result.errors.push(String(error))
      }

      if (result.duration > 0) {
        metrics.fileResults.push(result)
      }
    }
  } else {
    console.log('   Aucun fichier téléchargé à indexer')
  }

  // 5. CALCUL DES MÉTRIQUES FINALES
  metrics.totalDuration = Date.now() - startTime

  // Statistiques finales de la DB
  const finalStats = await db.query<{
    total_pages: number
    indexed_pages: number
    total_chunks: number
    total_files: number
    indexed_files: number
  }>(`
    SELECT
      (SELECT COUNT(*) FROM web_pages) as total_pages,
      (SELECT COUNT(*) FROM web_pages WHERE is_indexed = true) as indexed_pages,
      (SELECT COUNT(*) FROM knowledge_base_chunks) as total_chunks,
      (SELECT COUNT(*) FROM web_page_files) as total_files,
      (SELECT COUNT(*) FROM web_page_files WHERE is_indexed = true) as indexed_files
  `)

  const stats = finalStats.rows[0]

  const successfulCrawls = metrics.crawlResults.filter((r) => r.success)
  const successfulIndexes = metrics.indexResults.filter((r) => r.success)

  metrics.summary = {
    totalPages: Number(stats.total_pages),
    totalIndexed: Number(stats.indexed_pages),
    totalFiles: Number(stats.total_files),
    filesIndexed: Number(stats.indexed_files),
    avgCrawlSpeed: successfulCrawls.length > 0
      ? successfulCrawls.reduce((sum, r) => sum + (r.metrics.pagesPerSecond as number || 0), 0) / successfulCrawls.length
      : 0,
    avgIndexSpeed: successfulIndexes.length > 0
      ? successfulIndexes.reduce((sum, r) => sum + (r.metrics.pagesPerSecond as number || 0), 0) / successfulIndexes.length
      : 0,
    successRate: (successfulCrawls.length + successfulIndexes.length) /
      (metrics.crawlResults.length + metrics.indexResults.length) * 100,
    errorCount: metrics.crawlResults.reduce((sum, r) => sum + r.errors.length, 0) +
      metrics.indexResults.reduce((sum, r) => sum + r.errors.length, 0),
  }

  return metrics
}

// Affichage du rapport
function printReport(metrics: PerformanceMetrics) {
  console.log('\n')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║                    RAPPORT DE BENCHMARK                     ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // Résumé global
  console.log('📊 RÉSUMÉ GLOBAL')
  console.log('─'.repeat(60))
  console.log(`   Durée totale:        ${formatDuration(metrics.totalDuration)}`)
  console.log(`   Taux de succès:      ${metrics.summary.successRate.toFixed(1)}%`)
  console.log(`   Erreurs totales:     ${metrics.summary.errorCount}`)
  console.log('')

  // Statistiques pages
  console.log('📄 PAGES')
  console.log('─'.repeat(60))
  console.log(`   Total crawlées:      ${metrics.summary.totalPages}`)
  console.log(`   Total indexées:      ${metrics.summary.totalIndexed}`)
  console.log(`   Taux d'indexation:   ${((metrics.summary.totalIndexed / Math.max(1, metrics.summary.totalPages)) * 100).toFixed(1)}%`)
  console.log(`   Vitesse crawl:       ${metrics.summary.avgCrawlSpeed.toFixed(2)} pages/s`)
  console.log(`   Vitesse indexation:  ${metrics.summary.avgIndexSpeed.toFixed(2)} pages/s`)
  console.log('')

  // Statistiques fichiers
  console.log('📁 FICHIERS (PDFs, etc.)')
  console.log('─'.repeat(60))
  console.log(`   Total téléchargés:   ${metrics.summary.totalFiles}`)
  console.log(`   Total indexés:       ${metrics.summary.filesIndexed}`)
  console.log(`   Taux d'indexation:   ${((metrics.summary.filesIndexed / Math.max(1, metrics.summary.totalFiles)) * 100).toFixed(1)}%`)
  console.log('')

  // Détail par source - Crawling
  console.log('🕷️  DÉTAIL CRAWLING PAR SOURCE')
  console.log('─'.repeat(60))
  metrics.crawlResults.forEach((r) => {
    const status = r.success ? '✅' : '❌'
    console.log(`   ${status} ${r.source}`)
    console.log(`      Durée: ${formatDuration(r.duration)}`)
    if (r.success) {
      console.log(`      Pages: ${r.metrics.pagesProcessed} (${(r.metrics.pagesPerSecond as number).toFixed(1)}/s)`)
      console.log(`      Nouvelles: ${r.metrics.pagesNew}, Modifiées: ${r.metrics.pagesChanged}`)
      console.log(`      Fichiers: ${r.metrics.filesDownloaded}`)
    }
    if (r.errors.length > 0) {
      console.log(`      Erreurs: ${r.errors.length}`)
      r.errors.slice(0, 2).forEach((e) => console.log(`        • ${e.substring(0, 80)}`))
    }
  })
  console.log('')

  // Détail par source - Indexation
  console.log('📚 DÉTAIL INDEXATION PAR SOURCE')
  console.log('─'.repeat(60))
  metrics.indexResults.forEach((r) => {
    const status = r.success ? '✅' : '❌'
    console.log(`   ${status} ${r.source}`)
    console.log(`      Durée: ${formatDuration(r.duration)}`)
    if (r.success) {
      console.log(`      Indexées: ${r.metrics.indexed}, Chunks: ${r.metrics.chunksCreated}`)
      console.log(`      Vitesse: ${(r.metrics.pagesPerSecond as number).toFixed(2)} pages/s`)
    }
    if (r.errors.length > 0) {
      console.log(`      Erreurs: ${r.errors.length}`)
    }
  })
  console.log('')

  // Évaluation de la fiabilité
  console.log('🔍 ÉVALUATION FIABILITÉ')
  console.log('─'.repeat(60))

  const reliability = {
    crawling: metrics.crawlResults.filter((r) => r.success).length / Math.max(1, metrics.crawlResults.length) * 100,
    indexing: metrics.indexResults.filter((r) => r.success).length / Math.max(1, metrics.indexResults.length) * 100,
    files: metrics.fileResults.filter((r) => r.success).length / Math.max(1, metrics.fileResults.length) * 100,
  }

  const getGrade = (pct: number) => {
    if (pct >= 95) return 'A (Excellent)'
    if (pct >= 80) return 'B (Bon)'
    if (pct >= 60) return 'C (Acceptable)'
    if (pct >= 40) return 'D (Problématique)'
    return 'F (Critique)'
  }

  console.log(`   Crawling:    ${reliability.crawling.toFixed(0)}% - ${getGrade(reliability.crawling)}`)
  console.log(`   Indexation:  ${reliability.indexing.toFixed(0)}% - ${getGrade(reliability.indexing)}`)
  console.log(`   Fichiers:    ${reliability.files.toFixed(0)}% - ${getGrade(reliability.files)}`)
  console.log(`   Global:      ${metrics.summary.successRate.toFixed(0)}% - ${getGrade(metrics.summary.successRate)}`)
  console.log('')

  // Recommandations
  console.log('💡 RECOMMANDATIONS')
  console.log('─'.repeat(60))

  if (metrics.summary.errorCount > 5) {
    console.log('   ⚠️  Nombre d\'erreurs élevé - vérifier les logs détaillés')
  }
  if (metrics.summary.avgCrawlSpeed < 0.5) {
    console.log('   ⚠️  Vitesse de crawl lente - vérifier le rate limiting')
  }
  if (metrics.summary.avgIndexSpeed < 0.1) {
    console.log('   ⚠️  Indexation lente - vérifier la connexion OpenAI')
  }
  if (metrics.summary.totalFiles > 0 && metrics.summary.filesIndexed === 0) {
    console.log('   ⚠️  Aucun fichier indexé - vérifier le parser PDF')
  }
  if (metrics.summary.successRate >= 80) {
    console.log('   ✅ Système globalement fiable')
  }

  console.log('\n' + '═'.repeat(60))
  console.log('✨ Benchmark terminé')
  console.log('═'.repeat(60) + '\n')
}

// Exécution
async function main() {
  try {
    const metrics = await runBenchmark()
    printReport(metrics)
    process.exit(0)
  } catch (error) {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  }
}

main()
