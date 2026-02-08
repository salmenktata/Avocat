/**
 * Script de test: Crawl parallèle de plusieurs sources
 * Usage: npx tsx scripts/test-parallel-crawl.ts
 */

import { db } from '@/lib/db/postgres'
import { crawlSource } from '@/lib/web-scraper/crawler-service'
import { indexSourcePages } from '@/lib/web-scraper/web-indexer-service'

interface WebSourceRow {
  id: string
  name: string
  base_url: string
  category: string
  is_active: boolean
  max_pages: number
  max_depth: number
  rate_limit_ms: number
  download_files: boolean
  respect_robots_txt: boolean
  user_agent: string | null
  requires_javascript: boolean
  css_selectors: Record<string, string> | null
  url_patterns: string[] | null
  excluded_patterns: string[] | null
  timeout_ms: number
  follow_links: boolean
}

async function main() {
  console.log('🚀 Test de crawl parallèle de sources web\n')

  // 1. Récupérer les sources actives
  const sources = await db.query<WebSourceRow>(`
    SELECT id, name, base_url, category, is_active,
           max_pages, max_depth, rate_limit_ms, download_files,
           respect_robots_txt, user_agent, requires_javascript,
           css_selectors, url_patterns, excluded_patterns,
           timeout_ms, follow_links
    FROM web_sources
    WHERE is_active = true
    ORDER BY priority DESC
    LIMIT 3
  `)

  if (sources.rows.length === 0) {
    console.log('❌ Aucune source active trouvée')
    process.exit(1)
  }

  console.log(`📋 ${sources.rows.length} sources trouvées:\n`)
  sources.rows.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.name} (${s.base_url})`)
  })
  console.log('')

  // 2. Lancer les crawls en parallèle
  console.log('⏳ Lancement des crawls en parallèle...\n')
  const startTime = Date.now()

  const crawlPromises = sources.rows.map(async (source) => {
    const sourceStart = Date.now()
    console.log(`🔄 [${source.name}] Démarrage du crawl...`)

    try {
      // Limiter à 5 pages pour le test
      const result = await crawlSource(source as any, {
        maxPages: 5,
        maxDepth: 2,
        incrementalMode: true,
        downloadFiles: false,
      })

      const duration = ((Date.now() - sourceStart) / 1000).toFixed(1)
      console.log(
        `✅ [${source.name}] Terminé en ${duration}s - ` +
          `${result.pagesNew} nouvelles, ${result.pagesChanged} modifiées, ${result.pagesFailed} erreurs`
      )

      return { source: source.name, success: true, result }
    } catch (error) {
      const duration = ((Date.now() - sourceStart) / 1000).toFixed(1)
      console.log(`❌ [${source.name}] Échec après ${duration}s: ${error}`)
      return { source: source.name, success: false, error }
    }
  })

  const results = await Promise.all(crawlPromises)

  // 3. Résumé
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '='.repeat(60))
  console.log('📊 RÉSUMÉ DU CRAWL PARALLÈLE')
  console.log('='.repeat(60))
  console.log(`⏱️  Durée totale: ${totalDuration}s`)
  console.log(`✅ Réussites: ${results.filter((r) => r.success).length}/${results.length}`)

  let totalNew = 0
  let totalChanged = 0
  let totalErrors = 0

  results.forEach((r) => {
    if (r.success && r.result) {
      totalNew += r.result.pagesNew
      totalChanged += r.result.pagesChanged
      totalErrors += r.result.pagesFailed
    }
  })

  console.log(`📄 Pages nouvelles: ${totalNew}`)
  console.log(`🔄 Pages modifiées: ${totalChanged}`)
  console.log(`❌ Erreurs: ${totalErrors}`)

  // 4. Indexation des pages crawlées
  console.log('\n' + '='.repeat(60))
  console.log('📚 INDEXATION DES PAGES CRAWLÉES')
  console.log('='.repeat(60))

  for (const source of sources.rows) {
    try {
      console.log(`🔄 [${source.name}] Indexation...`)
      const indexResult = await indexSourcePages(source.id, { limit: 10, reindex: false })
      console.log(
        `✅ [${source.name}] ${indexResult.succeeded} indexées, ${indexResult.failed} erreurs`
      )
    } catch (error) {
      console.log(`❌ [${source.name}] Erreur d'indexation: ${error}`)
    }
  }

  console.log('\n✨ Test terminé!')
  process.exit(0)
}

main().catch((error) => {
  console.error('💥 Erreur fatale:', error)
  process.exit(1)
})
