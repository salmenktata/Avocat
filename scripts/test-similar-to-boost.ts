#!/usr/bin/env tsx
/**
 * Tests Phase 4 : Graphe similar_to et Boost Re-ranking
 *
 * Valide la détection de similarité et le boost dans re-ranking
 */

import { db } from '../lib/db/postgres'
import {
  detectSimilarDocuments,
  createSimilarToRelations,
  getSimilarityGraphStats,
} from '../lib/ai/document-similarity-service'
import {
  boostSimilarDocuments,
  rerankWithSimilarToBoost,
  type DocumentWithKBId,
  type RerankerResult,
} from '../lib/ai/reranker-service'

console.log('🧪 Tests Phase 4 : Graphe similar_to et Boost Re-ranking\n')

// =============================================================================
// TYPES TEST
// =============================================================================

interface TestResult {
  name: string
  success: boolean
  error?: string
}

const results: TestResult[] = []

function test(name: string, fn: () => Promise<void>) {
  return async () => {
    try {
      await fn()
      results.push({ name, success: true })
      console.log(`✅ ${name}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({ name, success: false, error: message })
      console.log(`❌ ${name}`)
      console.log(`   Erreur: ${message}`)
    }
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message || `Attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`
    )
  }
}

function assertGreaterThan(actual: number, expected: number, message?: string) {
  if (actual <= expected) {
    throw new Error(message || `Attendu > ${expected}, obtenu ${actual}`)
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Condition attendue: true')
  }
}

// =============================================================================
// SETUP TEST DATA
// =============================================================================

let testDoc1Id: string
let testDoc2Id: string
let testDoc3Id: string

async function setupTestData() {
  console.log('🔧 Préparation données de test...\n')

  // Récupérer 3 documents de test de la même catégorie
  const result = await db.query(`
    SELECT id, title, category
    FROM knowledge_base
    WHERE is_active = true
      AND embedding IS NOT NULL
      AND category = 'codes'
    LIMIT 3
  `)

  if (result.rows.length < 3) {
    throw new Error('Pas assez de documents codes avec embeddings pour les tests')
  }

  testDoc1Id = result.rows[0].id
  testDoc2Id = result.rows[1].id
  testDoc3Id = result.rows[2].id

  console.log(`Doc1: ${result.rows[0].title.slice(0, 40)}...`)
  console.log(`Doc2: ${result.rows[1].title.slice(0, 40)}...`)
  console.log(`Doc3: ${result.rows[2].title.slice(0, 40)}...`)

  // Nettoyer relations test précédentes
  await db.query(`
    DELETE FROM kb_legal_relations
    WHERE (source_kb_id IN ($1, $2, $3) OR target_kb_id IN ($1, $2, $3))
      AND relation_type = 'similar_to'
  `, [testDoc1Id, testDoc2Id, testDoc3Id])

  console.log('\n✅ Données de test préparées\n')
}

// =============================================================================
// TESTS
// =============================================================================

console.log('='.repeat(70))
console.log('Test 1: Détection documents similaires')
console.log('='.repeat(70))

const testDetection = test('Détecte documents similaires', async () => {
  const similarDocs = await detectSimilarDocuments(testDoc1Id, {
    minSimilarity: 0.7, // Seuil plus bas pour tests
    maxResults: 5,
    sameCategoryOnly: true,
  })

  console.log(`   → ${similarDocs.length} documents similaires détectés`)

  // Au moins 1 document similaire attendu
  assertGreaterThan(similarDocs.length, 0, 'Aucun document similaire détecté')

  // Vérifier structure
  const firstSimilar = similarDocs[0]
  assertTrue(!!firstSimilar.id, 'ID manquant')
  assertTrue(!!firstSimilar.title, 'Titre manquant')
  assertTrue(firstSimilar.similarity >= 0.7, `Similarité trop faible: ${firstSimilar.similarity}`)
  assertTrue(firstSimilar.similarity <= 1, `Similarité invalide: ${firstSimilar.similarity}`)
})

console.log('\n' + '='.repeat(70))
console.log('Test 2: Création relations similar_to')
console.log('='.repeat(70))

const testCreation = test('Crée relations bidirectionnelles', async () => {
  // Créer relation manuelle entre doc1 et doc2
  const result = await db.query(
    `SELECT create_similar_to_relation($1, $2, $3, true)`,
    [testDoc1Id, testDoc2Id, 0.88]
  )

  const created = result.rows[0].create_similar_to_relation
  assertTrue(created, 'Relation non créée')

  // Vérifier relation existe dans les 2 sens
  const checkResult = await db.query(`
    SELECT COUNT(*) as count
    FROM kb_legal_relations
    WHERE ((source_kb_id = $1 AND target_kb_id = $2)
       OR (source_kb_id = $2 AND target_kb_id = $1))
      AND relation_type = 'similar_to'
  `, [testDoc1Id, testDoc2Id])

  const count = parseInt(checkResult.rows[0].count)
  assertEqual(count, 2, `Attendu 2 relations bidirectionnelles, obtenu ${count}`)

  console.log('   → Relation bidirectionnelle créée avec succès')
})

console.log('\n' + '='.repeat(70))
console.log('Test 3: Service création automatique')
console.log('='.repeat(70))

const testAutoCreation = test('Crée relations via service', async () => {
  // Détecter similaires pour doc1
  const similarDocs = await detectSimilarDocuments(testDoc1Id, {
    minSimilarity: 0.7,
    maxResults: 2,
  })

  if (similarDocs.length === 0) {
    console.log('   ⚠️  Aucun document similaire, skip test création')
    return
  }

  // Filtrer doc2 (déjà en relation)
  const newSimilarDocs = similarDocs.filter((d) => d.id !== testDoc2Id)

  if (newSimilarDocs.length === 0) {
    console.log('   ⚠️  Tous les similaires déjà en relation, skip')
    return
  }

  // Créer relations
  const creationResult = await createSimilarToRelations(
    testDoc1Id,
    newSimilarDocs.slice(0, 1),
    { autoValidate: true }
  )

  assertTrue(creationResult.success, 'Création échouée')
  assertEqual(
    creationResult.relationsCreated,
    1,
    `Attendu 1 relation créée, obtenu ${creationResult.relationsCreated}`
  )

  console.log(`   → ${creationResult.relationsCreated} relation(s) créée(s)`)
})

console.log('\n' + '='.repeat(70))
console.log('Test 4: Boost re-ranking similar_to')
console.log('='.repeat(70))

const testBoost = test('Booste documents similaires au top résultat', async () => {
  // Créer résultats simulés où doc1 est top, doc2 est 3ème
  const mockResults: RerankerResult[] = [
    { index: 0, score: 0.85, originalScore: 0.85 }, // doc1 (top)
    { index: 2, score: 0.75, originalScore: 0.75 }, // doc3
    { index: 1, score: 0.70, originalScore: 0.70 }, // doc2 (lié à doc1)
  ]

  const mockDocuments: DocumentWithKBId[] = [
    {
      content: 'Document 1',
      originalScore: 0.85,
      knowledgeBaseId: testDoc1Id,
      metadata: { title: 'Doc 1' },
    },
    {
      content: 'Document 2',
      originalScore: 0.70,
      knowledgeBaseId: testDoc2Id,
      metadata: { title: 'Doc 2' },
    },
    {
      content: 'Document 3',
      originalScore: 0.75,
      knowledgeBaseId: testDoc3Id,
      metadata: { title: 'Doc 3' },
    },
  ]

  // Appliquer boost
  const boostedResults = await boostSimilarDocuments(mockResults, mockDocuments)

  // Vérifier que doc2 a été boosté (lié à doc1 via relation similar_to)
  const doc2Result = boostedResults.find((r) => r.index === 1)

  if (!doc2Result) {
    throw new Error('Doc2 manquant dans résultats')
  }

  // Score doc2 devrait être > score original (boost appliqué)
  assertGreaterThan(
    doc2Result.score,
    0.70,
    `Doc2 devrait être boosté (attendu >0.70, obtenu ${doc2Result.score})`
  )

  console.log(`   → Doc2 boosté : 0.70 → ${doc2Result.score.toFixed(3)}`)

  // Vérifier metadata boost
  assertTrue(
    !!doc2Result.metadata?.boostedBySimilarTo,
    'Metadata boostedBySimilarTo manquant'
  )
})

console.log('\n' + '='.repeat(70))
console.log('Test 5: Statistiques graphe')
console.log('='.repeat(70))

const testStats = test('Récupère statistiques graphe', async () => {
  const stats = await getSimilarityGraphStats()

  assertTrue(stats.totalRelations >= 0, 'Total relations invalide')
  assertTrue(stats.validatedRelations >= 0, 'Relations validées invalide')
  assertTrue(stats.avgStrength >= 0 && stats.avgStrength <= 1, 'Force moyenne invalide')
  assertTrue(Array.isArray(stats.topDocuments), 'topDocuments pas un array')

  console.log(`   → Total relations: ${stats.totalRelations}`)
  console.log(`   → Relations validées: ${stats.validatedRelations}`)
  console.log(`   → Force moyenne: ${(stats.avgStrength * 100).toFixed(1)}%`)
  console.log(`   → Top documents: ${stats.topDocuments.length}`)
})

console.log('\n' + '='.repeat(70))
console.log('Test 6: Fonction SQL get_similar_documents')
console.log('='.repeat(70))

const testSqlFunction = test('Fonction SQL retourne documents similaires', async () => {
  const result = await db.query(
    `SELECT * FROM get_similar_documents($1, 0.7, 10)`,
    [testDoc1Id]
  )

  // Devrait avoir au moins doc2 (relation créée dans tests précédents)
  assertGreaterThan(result.rows.length, 0, 'Aucun document similaire retourné')

  const firstSimilar = result.rows[0]
  assertTrue(!!firstSimilar.similar_doc_id, 'similar_doc_id manquant')
  assertTrue(!!firstSimilar.title, 'title manquant')
  assertTrue(
    firstSimilar.relation_strength >= 0.7,
    `relation_strength trop faible: ${firstSimilar.relation_strength}`
  )

  console.log(`   → ${result.rows.length} document(s) similaire(s) retourné(s)`)
})

// =============================================================================
// EXÉCUTION TESTS
// =============================================================================

async function runTests() {
  try {
    await setupTestData()

    await testDetection()
    await testCreation()
    await testAutoCreation()
    await testBoost()
    await testStats()
    await testSqlFunction()

    // Résumé
    console.log('\n' + '='.repeat(70))
    console.log('📊 RÉSULTATS DES TESTS')
    console.log('='.repeat(70))

    const totalTests = results.length
    const successfulTests = results.filter((r) => r.success).length
    const failedTests = results.filter((r) => !r.success).length

    console.log(`\nTotal tests: ${totalTests}`)
    console.log(`  ✅ Succès: ${successfulTests}`)
    console.log(`  ❌ Échecs: ${failedTests}`)

    if (failedTests > 0) {
      console.log('\n❌ Tests en échec:')
      results
        .filter((r) => !r.success)
        .forEach((r, i) => {
          console.log(`  ${i + 1}. ${r.name}`)
          console.log(`     ${r.error}`)
        })
    }

    console.log('\n' + '='.repeat(70))

    // Cleanup relations test
    console.log('\n🧹 Nettoyage relations test...')
    await db.query(`
      DELETE FROM kb_legal_relations
      WHERE (source_kb_id IN ($1, $2, $3) OR target_kb_id IN ($1, $2, $3))
        AND relation_type = 'similar_to'
    `, [testDoc1Id, testDoc2Id, testDoc3Id])
    console.log('✅ Nettoyage terminé')

    if (failedTests > 0) {
      console.log('\n❌ ÉCHEC : Certains tests ont échoué')
      process.exit(1)
    } else {
      console.log('\n✅ SUCCÈS : Tous les tests passent')
      console.log('\n💡 Prochaine étape: Construire le graphe similarity complet')
      console.log('   npx tsx scripts/build-similarity-graph.ts --batch-size=50 --dry-run')
      process.exit(0)
    }
  } catch (error) {
    console.error('\n❌ Erreur setup/teardown:', error)
    process.exit(1)
  }
}

runTests()
