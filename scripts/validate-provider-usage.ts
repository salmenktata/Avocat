#!/usr/bin/env tsx

/**
 * Script de validation du dashboard provider usage
 * - Vérifier que tous les providers ont des données
 * - Vérifier que toutes les opérations sont présentes
 * - Vérifier cohérence des totaux (matrice vs sommes SQL)
 * - Performance : mesurer temps de réponse API
 */

import { db } from '../lib/db/index.js'

async function main() {
  console.log('🔍 Validation Dashboard Provider Usage\n')

  // Test 1: Vérifier présence de données pour chaque provider
  console.log('1️⃣  Test: Providers avec données (7 derniers jours)')
  const providerQuery = `
    SELECT provider, COUNT(*) as count, SUM(cost_usd) as total_cost
    FROM ai_usage_logs
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND provider IS NOT NULL
    GROUP BY provider
    ORDER BY total_cost DESC
  `
  const providers = await db.query(providerQuery)
  console.table(providers.rows)

  if (providers.rows.length === 0) {
    console.log('⚠️  Aucune donnée trouvée pour les providers')
  }

  // Test 2: Vérifier présence de données pour chaque opération
  console.log('\n2️⃣  Test: Opérations avec données (7 derniers jours)')
  const operationQuery = `
    SELECT operation_type, COUNT(*) as count, SUM(cost_usd) as total_cost
    FROM ai_usage_logs
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND operation_type IS NOT NULL
    GROUP BY operation_type
    ORDER BY total_cost DESC
  `
  const operations = await db.query(operationQuery)
  console.table(operations.rows)

  if (operations.rows.length === 0) {
    console.log('⚠️  Aucune donnée trouvée pour les opérations')
  }

  // Test 3: Performance query matrice
  console.log('\n3️⃣  Test: Performance query matrice')
  const start = Date.now()
  const matrixQuery = `
    SELECT provider, operation_type, COUNT(*), SUM(input_tokens + output_tokens), SUM(cost_usd)
    FROM ai_usage_logs
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND provider IS NOT NULL
      AND operation_type IS NOT NULL
    GROUP BY provider, operation_type
  `
  const matrix = await db.query(matrixQuery)
  const duration = Date.now() - start

  console.log(`⏱️  Temps d'exécution: ${duration}ms`)
  console.log(`📊 Lignes retournées: ${matrix.rows.length}`)
  console.log(duration < 500 ? '✅ Performance OK (<500ms)' : '⚠️  Performance dégradée (>500ms), vérifier indexes')

  // Test 4: Cohérence totaux
  console.log('\n4️⃣  Test: Cohérence des totaux')
  const totalQuery = `
    SELECT SUM(cost_usd) as total
    FROM ai_usage_logs
    WHERE created_at >= NOW() - INTERVAL '7 days'
  `
  const total = await db.query(totalQuery)
  const matrixSum = matrix.rows.reduce((sum, row) => sum + parseFloat(row.sum || '0'), 0)
  const directTotal = parseFloat(total.rows[0]?.total || '0')

  console.log(`💰 Total DB direct:    $${directTotal.toFixed(4)}`)
  console.log(`💰 Total matrice:      $${matrixSum.toFixed(4)}`)
  console.log(`💰 Différence:         $${Math.abs(directTotal - matrixSum).toFixed(4)}`)

  const isCoherent = Math.abs(directTotal - matrixSum) < 0.01
  console.log(isCoherent ? '✅ Totaux cohérents' : '❌ Incohérence détectée!')

  // Test 5: Vérifier index
  console.log('\n5️⃣  Test: Vérification de l\'index')
  const indexQuery = `
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'ai_usage_logs'
      AND indexname = 'idx_ai_usage_logs_provider_operation_date'
  `
  const indexCheck = await db.query(indexQuery)

  if (indexCheck.rows.length > 0) {
    console.log('✅ Index composite existe:', indexCheck.rows[0].indexname)
  } else {
    console.log('⚠️  Index composite manquant - exécuter apply-migration-provider-usage-indexes.ts')
  }

  // Test 6: Statistiques index
  console.log('\n6️⃣  Test: Statistiques d\'utilisation des index')
  const statsQuery = `
    SELECT
      indexname,
      idx_scan as scans,
      idx_tup_read as tuples_read,
      idx_tup_fetch as tuples_fetched
    FROM pg_stat_user_indexes
    WHERE tablename = 'ai_usage_logs'
    ORDER BY idx_scan DESC
    LIMIT 5
  `
  const stats = await db.query(statsQuery)
  console.table(stats.rows)

  // Résumé final
  console.log('\n' + '='.repeat(60))
  console.log('📊 RÉSUMÉ VALIDATION')
  console.log('='.repeat(60))
  console.log(`✅ Providers avec données:     ${providers.rows.length}`)
  console.log(`✅ Opérations avec données:    ${operations.rows.length}`)
  console.log(`✅ Performance matrice:        ${duration}ms`)
  console.log(`✅ Cohérence totaux:           ${isCoherent ? 'OK' : 'KO'}`)
  console.log(`✅ Index composite:            ${indexCheck.rows.length > 0 ? 'Présent' : 'Manquant'}`)
  console.log('='.repeat(60))
}

main()
  .then(() => {
    console.log('\n✅ Validation terminée')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Erreur:', error)
    process.exit(1)
  })
