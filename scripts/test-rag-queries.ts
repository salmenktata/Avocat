#!/usr/bin/env tsx
/**
 * Test impact RAG post-reclassification
 *
 * Objectif : Vérifier que la reclassification améliore la recherche sémantique
 *           en testant des queries représentatives
 *
 * Usage : npx tsx scripts/test-rag-queries.ts
 */

import { db } from '@/lib/db/postgres'
import type { LegalCategory } from '@/lib/categories/legal-categories'
import { LEGAL_CATEGORY_TRANSLATIONS } from '@/lib/categories/legal-categories'

// =============================================================================
// CONFIGURATION
// =============================================================================

interface TestQuery {
  query: string
  language: 'ar' | 'fr'
  expectedCategories: LegalCategory[]
  description: string
}

const TEST_QUERIES: TestQuery[] = [
  {
    query: 'القانون الجنائي التونسي',
    language: 'ar',
    expectedCategories: ['codes', 'legislation'],
    description: 'Code pénal tunisien',
  },
  {
    query: 'jurisprudence cassation divorce',
    language: 'fr',
    expectedCategories: ['jurisprudence'],
    description: 'Arrêts de cassation sur le divorce',
  },
  {
    query: 'code des obligations tunisien',
    language: 'fr',
    expectedCategories: ['codes', 'legislation'],
    description: 'Code des obligations et contrats',
  },
  {
    query: 'نماذج عقد العمل',
    language: 'ar',
    expectedCategories: ['modeles', 'formulaires'],
    description: 'Modèles de contrat de travail',
  },
  {
    query: 'الدستور التونسي 2022',
    language: 'ar',
    expectedCategories: ['constitution', 'legislation'],
    description: 'Constitution tunisienne',
  },
  {
    query: 'procédures judiciaires tribunal',
    language: 'fr',
    expectedCategories: ['procedures', 'guides'],
    description: 'Procédures judiciaires',
  },
  {
    query: 'الرائد الرسمي قانون',
    language: 'ar',
    expectedCategories: ['jort', 'legislation'],
    description: 'JORT - Journal Officiel',
  },
  {
    query: 'doctrine droit commercial sociétés',
    language: 'fr',
    expectedCategories: ['doctrine'],
    description: 'Doctrine en droit commercial',
  },
]

// =============================================================================
// TYPES
// =============================================================================

interface SearchResult {
  id: string
  title: string
  category: LegalCategory
  similarity: number
}

interface QueryTestResult {
  query: string
  description: string
  results_count: number
  found_categories: LegalCategory[]
  expected_categories: LegalCategory[]
  matched_categories: LegalCategory[]
  match_rate: number
  avg_similarity: number
  top_results: SearchResult[]
  status: 'success' | 'partial' | 'fail'
}

// =============================================================================
// RECHERCHE RAG
// =============================================================================

async function searchKnowledgeBase(
  query: string,
  language: 'ar' | 'fr',
  limit: number = 10
): Promise<SearchResult[]> {
  // Utilise la fonction PostgreSQL search_knowledge_base si disponible
  // Sinon fallback sur fulltext search
  try {
    const result = await db.query(
      `SELECT * FROM search_knowledge_base($1, $2, $3, 0.0, NULL)`,
      [query, language, limit]
    )
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      category: row.category,
      similarity: row.similarity || 0,
    }))
  } catch (error) {
    // Fallback : fulltext search simple
    console.warn('search_knowledge_base() non disponible, fallback fulltext')

    const result = await db.query(
      `SELECT
         id,
         title,
         category,
         ts_rank(
           to_tsvector($2, COALESCE(full_text, '')),
           plainto_tsquery($2, $1)
         ) as similarity
       FROM knowledge_base
       WHERE is_active = true
         AND source_file IS NOT NULL
         AND to_tsvector($2, COALESCE(full_text, '')) @@ plainto_tsquery($2, $1)
       ORDER BY similarity DESC
       LIMIT $3`,
      [query, language === 'ar' ? 'arabic' : 'french', limit]
    )

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      category: row.category,
      similarity: parseFloat(row.similarity),
    }))
  }
}

// =============================================================================
// TESTS
// =============================================================================

async function testQuery(testCase: TestQuery): Promise<QueryTestResult> {
  const results = await searchKnowledgeBase(testCase.query, testCase.language, 10)

  const foundCategories = [...new Set(results.map(r => r.category))]
  const matchedCategories = foundCategories.filter(cat =>
    testCase.expectedCategories.includes(cat)
  )

  const matchRate = testCase.expectedCategories.length > 0
    ? (matchedCategories.length / testCase.expectedCategories.length) * 100
    : 0

  const avgSimilarity = results.length > 0
    ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length
    : 0

  let status: 'success' | 'partial' | 'fail' = 'fail'
  if (results.length === 0) {
    status = 'fail'
  } else if (matchRate >= 50) {
    status = matchRate === 100 ? 'success' : 'partial'
  }

  return {
    query: testCase.query,
    description: testCase.description,
    results_count: results.length,
    found_categories: foundCategories,
    expected_categories: testCase.expectedCategories,
    matched_categories: matchedCategories,
    match_rate: matchRate,
    avg_similarity: avgSimilarity,
    top_results: results.slice(0, 5),
    status,
  }
}

// =============================================================================
// RAPPORT
// =============================================================================

function printTestReport(results: QueryTestResult[]) {
  console.log('\n' + '═'.repeat(80))
  console.log('  🔍 TEST RAG POST-RECLASSIFICATION')
  console.log('═'.repeat(80) + '\n')

  let totalSuccess = 0
  let totalPartial = 0
  let totalFail = 0

  results.forEach((result, i) => {
    const statusEmoji = result.status === 'success' ? '✅' : result.status === 'partial' ? '⚠️ ' : '❌'

    console.log(`${i + 1}. ${statusEmoji} ${result.description}`)
    console.log(`   Query: "${result.query}"`)
    console.log(`   Résultats: ${result.results_count}`)

    if (result.results_count > 0) {
      console.log(`   Similarité moyenne: ${(result.match_rate * 100).toFixed(1)}%`)

      console.log(`   Catégories trouvées:`)
      result.found_categories.forEach(cat => {
        const label = LEGAL_CATEGORY_TRANSLATIONS[cat]?.fr || cat
        const match = result.matched_categories.includes(cat) ? '✓' : '✗'
        console.log(`      ${match} ${label}`)
      })

      console.log(`   Top 3 résultats:`)
      result.top_results.slice(0, 3).forEach((res, j) => {
        const label = LEGAL_CATEGORY_TRANSLATIONS[res.category]?.fr || res.category
        console.log(`      ${j + 1}. [${label}] ${res.title.substring(0, 60)}...`)
      })
    } else {
      console.log(`   ❌ Aucun résultat trouvé`)
    }

    console.log('')

    if (result.status === 'success') totalSuccess++
    else if (result.status === 'partial') totalPartial++
    else totalFail++
  })

  console.log('═'.repeat(80))
  console.log('  📊 RÉSUMÉ')
  console.log('═'.repeat(80))
  console.log(`  Total queries      : ${results.length}`)
  console.log(`  ✅ Succès           : ${totalSuccess} (${((totalSuccess / results.length) * 100).toFixed(1)}%)`)
  console.log(`  ⚠️  Partiels         : ${totalPartial} (${((totalPartial / results.length) * 100).toFixed(1)}%)`)
  console.log(`  ❌ Échecs           : ${totalFail} (${((totalFail / results.length) * 100).toFixed(1)}%)`)

  const avgResultsCount = results.reduce((sum, r) => sum + r.results_count, 0) / results.length
  const avgMatchRate = results.reduce((sum, r) => sum + r.match_rate, 0) / results.length

  console.log(`  Résultats moyens   : ${avgResultsCount.toFixed(1)} docs/query`)
  console.log(`  Taux match moyen   : ${avgMatchRate.toFixed(1)}%`)
  console.log('═'.repeat(80))

  // Analyse comparative
  console.log('\n💡 ANALYSE :')

  if (totalSuccess >= results.length * 0.75) {
    console.log('   ✅ RAG fonctionne excellemment après reclassification')
  } else if (totalSuccess + totalPartial >= results.length * 0.75) {
    console.log('   ⚠️  RAG fonctionne correctement, quelques ajustements possibles')
  } else {
    console.log('   ❌ RAG nécessite des améliorations')
  }

  if (avgResultsCount === 0) {
    console.log('   🚨 Aucun résultat trouvé → Vérifier embeddings/indexation')
  } else if (avgResultsCount < 3) {
    console.log('   ⚠️  Peu de résultats → Améliorer contenu KB ou queries')
  } else {
    console.log('   ✅ Bon nombre de résultats par query')
  }

  if (avgMatchRate < 50) {
    console.log('   ⚠️  Faible taux match catégories → Vérifier classifications')
  } else {
    console.log('   ✅ Bon alignement catégories trouvées/attendues')
  }

  console.log('\n')
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  try {
    console.log('🚀 Lancement des tests RAG...\n')

    const results: QueryTestResult[] = []

    for (const testCase of TEST_QUERIES) {
      console.log(`Testing: "${testCase.query}"...`)
      const result = await testQuery(testCase)
      results.push(result)
      console.log(`   → ${result.results_count} résultats (${result.status})\n`)
    }

    printTestReport(results)

    const exitCode = results.every(r => r.status === 'success') ? 0 : 1
    process.exit(exitCode)
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  }
}

main()
