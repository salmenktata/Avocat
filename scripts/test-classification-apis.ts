#!/usr/bin/env ts-node

/**
 * Script de test des APIs de classification
 *
 * Usage:
 *   npm run test:classification-apis
 *
 * Tests:
 * 1. GET /api/super-admin/classification/queue - Récupération queue avec filtres
 * 2. GET /api/super-admin/classification/corrections - Historique corrections
 * 3. POST /api/super-admin/classification/corrections - Enregistrement correction
 * 4. GET /api/super-admin/classification/analytics/top-errors - Analytics
 * 5. GET /api/admin/web-pages/[id]/classification - Détails classification page
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

interface TestResult {
  name: string
  passed: boolean
  duration: number
  error?: string
  data?: any
}

const results: TestResult[] = []

async function testAPI(
  name: string,
  url: string,
  options?: RequestInit
): Promise<TestResult> {
  const startTime = Date.now()

  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    const duration = Date.now() - startTime

    if (!response.ok) {
      const error = await response.text()
      return {
        name,
        passed: false,
        duration,
        error: `HTTP ${response.status}: ${error}`,
      }
    }

    const data = await response.json()

    return {
      name,
      passed: true,
      duration,
      data,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    return {
      name,
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function runTests() {
  console.log('🧪 Démarrage des tests des APIs de classification...\n')

  // Test 1: Queue avec tous les filtres
  console.log('Test 1: GET /api/super-admin/classification/queue')
  const test1 = await testAPI(
    'Queue - Sans filtres',
    '/api/super-admin/classification/queue?limit=10'
  )
  results.push(test1)
  console.log(
    `  ${test1.passed ? '✅' : '❌'} ${test1.name} (${test1.duration}ms)`
  )
  if (test1.passed) {
    console.log(`     - ${test1.data.total} pages à revoir`)
    console.log(`     - Stats: ${JSON.stringify(test1.data.stats)}`)
  } else {
    console.log(`     ❌ ${test1.error}`)
  }

  // Test 2: Queue avec filtre priorité
  console.log('\nTest 2: GET /api/super-admin/classification/queue (urgent)')
  const test2 = await testAPI(
    'Queue - Priorité urgente',
    '/api/super-admin/classification/queue?priority[]=urgent&limit=5'
  )
  results.push(test2)
  console.log(
    `  ${test2.passed ? '✅' : '❌'} ${test2.name} (${test2.duration}ms)`
  )
  if (test2.passed) {
    console.log(`     - ${test2.data.items.length} pages urgentes`)
  } else {
    console.log(`     ❌ ${test2.error}`)
  }

  // Test 3: Historique corrections
  console.log('\nTest 3: GET /api/super-admin/classification/corrections')
  const test3 = await testAPI(
    'Historique corrections',
    '/api/super-admin/classification/corrections?limit=10'
  )
  results.push(test3)
  console.log(
    `  ${test3.passed ? '✅' : '❌'} ${test3.name} (${test3.duration}ms)`
  )
  if (test3.passed) {
    console.log(`     - ${test3.data.total} corrections enregistrées`)
  } else {
    console.log(`     ❌ ${test3.error}`)
  }

  // Test 4: Historique corrections avec règles générées
  console.log('\nTest 4: GET /api/super-admin/classification/corrections (avec règles)')
  const test4 = await testAPI(
    'Corrections avec règles générées',
    '/api/super-admin/classification/corrections?hasRule=true&limit=10'
  )
  results.push(test4)
  console.log(
    `  ${test4.passed ? '✅' : '❌'} ${test4.name} (${test4.duration}ms)`
  )
  if (test4.passed) {
    const withRules = test4.data.items.filter(
      (item: any) => item.has_generated_rule
    ).length
    console.log(`     - ${withRules}/${test4.data.items.length} avec règle générée`)
  } else {
    console.log(`     ❌ ${test4.error}`)
  }

  // Test 5: Analytics - par domaine
  console.log('\nTest 5: GET /api/super-admin/classification/analytics/top-errors (domain)')
  const test5 = await testAPI(
    'Analytics - Par domaine',
    '/api/super-admin/classification/analytics/top-errors?groupBy=domain&limit=10'
  )
  results.push(test5)
  console.log(
    `  ${test5.passed ? '✅' : '❌'} ${test5.name} (${test5.duration}ms)`
  )
  if (test5.passed) {
    console.log(`     - ${test5.data.errors.length} domaines avec erreurs`)
    console.log(`     - Total: ${test5.data.totalPagesRequiringReview} pages`)
  } else {
    console.log(`     ❌ ${test5.error}`)
  }

  // Test 6: Analytics - par source
  console.log('\nTest 6: GET /api/super-admin/classification/analytics/top-errors (source)')
  const test6 = await testAPI(
    'Analytics - Par source',
    '/api/super-admin/classification/analytics/top-errors?groupBy=source&limit=10'
  )
  results.push(test6)
  console.log(
    `  ${test6.passed ? '✅' : '❌'} ${test6.name} (${test6.duration}ms)`
  )
  if (test6.passed) {
    console.log(`     - ${test6.data.errors.length} sources avec erreurs`)
  } else {
    console.log(`     ❌ ${test6.error}`)
  }

  // Test 7: Détails classification page (nécessite un pageId existant)
  // On récupère un pageId depuis la queue
  if (test1.passed && test1.data.items.length > 0) {
    const pageId = test1.data.items[0].web_page_id
    console.log('\nTest 7: GET /api/admin/web-pages/[id]/classification')
    const test7 = await testAPI(
      'Détails classification page',
      `/api/admin/web-pages/${pageId}/classification`
    )
    results.push(test7)
    console.log(
      `  ${test7.passed ? '✅' : '❌'} ${test7.name} (${test7.duration}ms)`
    )
    if (test7.passed) {
      console.log(`     - Page: ${test7.data.page.title || 'Sans titre'}`)
      console.log(
        `     - Classification: ${test7.data.classification?.primaryCategory || 'Non classifiée'}`
      )
      console.log(
        `     - Signaux: ${test7.data.classification?.signalsUsed?.length || 0}`
      )
      console.log(
        `     - Alternatives: ${test7.data.classification?.alternatives?.length || 0}`
      )
    } else {
      console.log(`     ❌ ${test7.error}`)
    }
  } else {
    console.log('\nTest 7: SKIPPED (pas de page dans la queue)')
  }

  // Test 8: Enregistrement correction (test d'intégration - nécessite données réelles)
  // On skip ce test car il modifie la DB
  console.log('\nTest 8: POST /api/super-admin/classification/corrections')
  console.log('  ⏭️  SKIPPED (test destructif - à faire manuellement)')

  // Résumé
  console.log('\n' + '='.repeat(60))
  console.log('📊 RÉSUMÉ DES TESTS\n')

  const passed = results.filter((r) => r.passed).length
  const total = results.length
  const avgDuration =
    results.reduce((sum, r) => sum + r.duration, 0) / results.length

  console.log(`Tests réussis: ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)`)
  console.log(`Temps moyen: ${avgDuration.toFixed(0)}ms`)
  console.log(
    `Temps total: ${results.reduce((sum, r) => sum + r.duration, 0)}ms`
  )

  if (passed < total) {
    console.log('\n❌ ÉCHECS:')
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`)
      })
  }

  console.log('='.repeat(60))

  // Exit code
  process.exit(passed === total ? 0 : 1)
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Erreur fatale:', error)
  process.exit(1)
})
