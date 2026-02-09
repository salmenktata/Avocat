/**
 * Script de test Sprint 1 - Système de Classification Juridique
 *
 * Valide les fonctionnalités implémentées :
 * 1. Tracking opérations classification & extraction dans ai_usage_logs
 * 2. Index DB pour performance queries
 * 3. Cache Redis classification par URL pattern
 *
 * Usage: npx tsx scripts/test-classification-sprint1.ts
 */

import { db } from '@/lib/db/postgres'
import { classifyLegalContent } from '@/lib/web-scraper/legal-classifier-service'
import { getCacheStats, generateCacheKey } from '@/lib/cache/classification-cache-service'

// =============================================================================
// CONFIGURATION
// =============================================================================

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof COLORS = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

// =============================================================================
// TESTS
// =============================================================================

async function test1_trackingOperations() {
  log('\n=== Test 1 : Tracking opérations classification & extraction ===', 'cyan')

  // Vérifier que les colonnes existent dans ai_usage_logs
  const schemaCheck = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'ai_usage_logs'
      AND column_name IN ('operation_type', 'provider', 'model', 'input_tokens', 'output_tokens')
    ORDER BY column_name
  `)

  log(`✓ Colonnes ai_usage_logs trouvées : ${schemaCheck.rows.map(r => r.column_name).join(', ')}`, 'green')

  // Vérifier que les contraintes CHECK incluent 'classification' et 'extraction'
  const constraintCheck = await db.query(`
    SELECT conname, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'ai_usage_logs'::regclass
      AND conname LIKE '%operation_type%'
  `)

  if (constraintCheck.rows.length > 0) {
    const constraintDef = constraintCheck.rows[0].pg_get_constraintdef
    const hasClassification = constraintDef.includes('classification')
    const hasExtraction = constraintDef.includes('extraction')

    if (hasClassification && hasExtraction) {
      log('✓ Contrainte CHECK inclut classification et extraction', 'green')
    } else {
      log('✗ Contrainte CHECK manque classification ou extraction', 'red')
    }
  }

  // Compter les opérations classification/extraction existantes
  const usageCount = await db.query(`
    SELECT operation_type, COUNT(*) as count
    FROM ai_usage_logs
    WHERE operation_type IN ('classification', 'extraction')
    GROUP BY operation_type
  `)

  if (usageCount.rows.length > 0) {
    log('✓ Opérations trackées trouvées :', 'green')
    usageCount.rows.forEach(row => {
      log(`  - ${row.operation_type}: ${row.count} entrées`, 'yellow')
    })
  } else {
    log('⚠ Aucune opération classification/extraction trackée pour l\'instant', 'yellow')
    log('  (C\'est normal si aucune page n\'a été classifiée depuis le déploiement)', 'yellow')
  }
}

async function test2_indexDB() {
  log('\n=== Test 2 : Index DB pour performance ===', 'cyan')

  // Vérifier que les index existent
  const indexes = await db.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'ai_usage_logs'
      AND indexname IN (
        'idx_ai_usage_logs_operation_date',
        'idx_ai_usage_logs_provider_operation',
        'idx_ai_usage_logs_created_at'
      )
    ORDER BY indexname
  `)

  if (indexes.rows.length === 3) {
    log('✓ Tous les index requis sont créés :', 'green')
    indexes.rows.forEach(row => {
      log(`  - ${row.indexname}`, 'yellow')
    })
  } else {
    log(`✗ Seulement ${indexes.rows.length}/3 index trouvés`, 'red')
    indexes.rows.forEach(row => {
      log(`  - ${row.indexname}`, 'yellow')
    })
  }

  // Benchmark query performance (EXPLAIN ANALYZE)
  const query = `
    SELECT operation_type, provider, COUNT(*) as count
    FROM ai_usage_logs
    WHERE operation_type IN ('classification', 'extraction')
      AND created_at >= NOW() - INTERVAL '7 days'
    GROUP BY operation_type, provider
  `

  const explain = await db.query(`EXPLAIN ANALYZE ${query}`)
  const executionTime = explain.rows.find(r => r['QUERY PLAN'].includes('Execution Time'))

  if (executionTime) {
    const timeMatch = executionTime['QUERY PLAN'].match(/Execution Time: ([\d.]+) ms/)
    if (timeMatch) {
      const ms = parseFloat(timeMatch[1])
      if (ms < 100) {
        log(`✓ Query performance excellente : ${ms.toFixed(2)} ms`, 'green')
      } else if (ms < 500) {
        log(`⚠ Query performance acceptable : ${ms.toFixed(2)} ms`, 'yellow')
      } else {
        log(`✗ Query performance lente : ${ms.toFixed(2)} ms`, 'red')
      }
    }
  }
}

async function test3_cacheClassification() {
  log('\n=== Test 3 : Cache Redis classification ===', 'cyan')

  // Vérifier stats cache
  let cacheStats: { count: number; exampleKeys: string[] }
  try {
    cacheStats = await getCacheStats()
    log(`✓ Cache actif : ${cacheStats.count} classifications en cache`, 'green')
  } catch (error) {
    log('✗ Redis non disponible (erreur lors de getCacheStats)', 'red')
    log('  Vérifier que Redis tourne : docker ps | grep redis', 'yellow')
    return
  }

  if (cacheStats.exampleKeys.length > 0) {
    log('  Exemples de clés :', 'yellow')
    cacheStats.exampleKeys.forEach(key => {
      log(`    - ${key}`, 'yellow')
    })
  }

  // Récupérer une page à classifier (pour tester le cache hit/miss)
  const pageResult = await db.query(`
    SELECT wp.id, wp.url, ws.name as source_name, ws.category as source_category
    FROM web_pages wp
    JOIN web_sources ws ON wp.web_source_id = ws.id
    WHERE wp.extracted_text IS NOT NULL
      AND LENGTH(wp.extracted_text) > 200
    LIMIT 1
  `)

  if (pageResult.rows.length === 0) {
    log('⚠ Aucune page disponible pour tester le cache', 'yellow')
    return
  }

  const page = pageResult.rows[0]
  const cacheKey = generateCacheKey(page.url, page.source_name, page.source_category)

  log(`\n✓ Test cache avec page : ${page.url}`, 'blue')
  log(`  Cache key : ${cacheKey}`, 'yellow')

  // Classification 1 (devrait être MISS)
  log('\n  [1/2] Classification 1 (cache MISS attendu)...', 'cyan')
  const start1 = Date.now()
  const result1 = await classifyLegalContent(page.id)
  const time1 = Date.now() - start1

  log(`    ✓ Terminé en ${time1} ms`, 'green')
  log(`    - Catégorie : ${result1.primaryCategory}`, 'yellow')
  log(`    - Confiance : ${(result1.confidenceScore * 100).toFixed(1)}%`, 'yellow')
  log(`    - Source : ${result1.classificationSource}`, 'yellow')

  // Classification 2 (devrait être HIT si confiance > 0.75)
  log('\n  [2/2] Classification 2 (cache HIT attendu si confiance > 75%)...', 'cyan')
  const start2 = Date.now()
  const result2 = await classifyLegalContent(page.id)
  const time2 = Date.now() - start2

  log(`    ✓ Terminé en ${time2} ms`, 'green')
  log(`    - Source : ${result2.classificationSource}`, 'yellow')

  if (result2.classificationSource === 'cache') {
    const speedup = ((time1 - time2) / time1 * 100).toFixed(1)
    log(`    ✓ CACHE HIT ! Accélération : ${speedup}%`, 'green')
  } else if (result1.confidenceScore < 0.75) {
    log(`    ⚠ Cache MISS normal (confiance ${(result1.confidenceScore * 100).toFixed(1)}% < 75%)`, 'yellow')
  } else {
    log(`    ⚠ Cache MISS inattendu (confiance ${(result1.confidenceScore * 100).toFixed(1)}% >= 75%)`, 'yellow')
  }

  // Stats cache après tests
  const cacheStatsAfter = await getCacheStats()
  log(`\n✓ Cache après tests : ${cacheStatsAfter.count} classifications (Δ +${cacheStatsAfter.count - cacheStats.count})`, 'green')
}

async function test4_endToEnd() {
  log('\n=== Test 4 : End-to-End Classification (tracking + cache) ===', 'cyan')

  // Récupérer 5 pages similaires (même source/catégorie)
  const pagesResult = await db.query(`
    SELECT wp.id, wp.url, ws.name as source_name
    FROM web_pages wp
    JOIN web_sources ws ON wp.web_source_id = ws.id
    WHERE wp.extracted_text IS NOT NULL
      AND LENGTH(wp.extracted_text) > 200
    ORDER BY ws.id, wp.created_at DESC
    LIMIT 5
  `)

  if (pagesResult.rows.length < 2) {
    log('⚠ Pas assez de pages pour test end-to-end', 'yellow')
    return
  }

  const pages = pagesResult.rows
  log(`\n✓ Test avec ${pages.length} pages de ${pages[0].source_name}`, 'blue')

  // Compter opérations avant
  const usageCountBefore = await db.query(`
    SELECT COUNT(*) as count
    FROM ai_usage_logs
    WHERE operation_type IN ('classification', 'extraction')
      AND created_at >= NOW() - INTERVAL '1 minute'
  `)
  const countBefore = parseInt(usageCountBefore.rows[0].count)

  // Classifier toutes les pages
  const startTotal = Date.now()
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    log(`\n  [${i + 1}/${pages.length}] Classifying ${page.url.substring(0, 60)}...`, 'cyan')

    const start = Date.now()
    const result = await classifyLegalContent(page.id)
    const time = Date.now() - start

    log(`    ✓ ${time} ms - ${result.classificationSource} - Confiance: ${(result.confidenceScore * 100).toFixed(1)}%`, 'green')
  }
  const timeTotal = Date.now() - startTotal

  // Compter opérations après
  const usageCountAfter = await db.query(`
    SELECT COUNT(*) as count
    FROM ai_usage_logs
    WHERE operation_type IN ('classification', 'extraction')
      AND created_at >= NOW() - INTERVAL '1 minute'
  `)
  const countAfter = parseInt(usageCountAfter.rows[0].count)

  log(`\n✓ Temps total : ${timeTotal} ms (${(timeTotal / pages.length).toFixed(0)} ms/page en moyenne)`, 'green')
  log(`✓ Opérations trackées : +${countAfter - countBefore} nouvelles entrées dans ai_usage_logs`, 'green')
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  log('╔════════════════════════════════════════════════════════════════╗', 'blue')
  log('║  TEST SPRINT 1 - Système de Classification Juridique         ║', 'blue')
  log('║  Observabilité Immédiate + Cache Performance                  ║', 'blue')
  log('╚════════════════════════════════════════════════════════════════╝', 'blue')

  try {
    await test1_trackingOperations()
    await test2_indexDB()
    await test3_cacheClassification()
    await test4_endToEnd()

    log('\n╔════════════════════════════════════════════════════════════════╗', 'green')
    log('║  ✓ TOUS LES TESTS COMPLÉTÉS                                   ║', 'green')
    log('╚════════════════════════════════════════════════════════════════╝', 'green')

    log('\n📊 Vérifier le dashboard:', 'cyan')
    log('   http://localhost:3000/super-admin/provider-usage', 'yellow')
    log('   → Devrait afficher opérations "classification" et "extraction"', 'yellow')

  } catch (error) {
    log('\n✗ ERREUR:', 'red')
    console.error(error)
    process.exit(1)
  } finally {
    // Note: db n'a pas de méthode end() dans notre implémentation
    // La pool est gérée automatiquement
    process.exit(0)
  }
}

main()
