/**
 * Test live de la recherche Knowledge Base en production
 *
 * Ce script teste directement la fonction searchKnowledgeBase()
 * pour vérifier que OLLAMA_ENABLED=true fonctionne correctement.
 *
 * Usage: npx tsx scripts/test-kb-search-live.ts
 */

import { searchKnowledgeBase } from '../lib/ai/knowledge-base-service'
import { isSemanticSearchEnabled } from '../lib/ai/config'

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(emoji: string, message: string, color: string = COLORS.reset) {
  console.log(`${emoji}  ${color}${message}${COLORS.reset}`)
}

async function main() {
  console.log('\n🔍 Test Live Recherche Knowledge Base Production')
  console.log('='.repeat(60))
  console.log('')

  // 1. Vérifier que la recherche sémantique est activée
  log('1️⃣', 'Vérification configuration Ollama...', COLORS.cyan)
  const isEnabled = isSemanticSearchEnabled()

  if (!isEnabled) {
    log('❌', 'ERREUR: Recherche sémantique DÉSACTIVÉE !', COLORS.red)
    log('💡', 'Fix: Vérifier OLLAMA_ENABLED et RAG_ENABLED dans .env', COLORS.yellow)
    process.exit(1)
  }

  log('✅', 'Recherche sémantique ACTIVÉE', COLORS.green)
  console.log('')

  // 2. Test recherche avec question juridique en arabe
  log('2️⃣', 'Test recherche avec question juridique (arabe)...', COLORS.cyan)

  const testQueries = [
    {
      lang: 'ar',
      query: 'ما هي شروط الدفاع الشرعي في القانون التونسي؟',
      description: 'Conditions légitime défense (arabe)'
    },
    {
      lang: 'fr',
      query: 'Quelles sont les conditions du divorce pour préjudice en Tunisie ?',
      description: 'Conditions divorce préjudice (français)'
    }
  ]

  let totalSuccess = 0
  let totalFailed = 0

  for (const test of testQueries) {
    console.log('')
    log('🧪', `Test: ${test.description}`, COLORS.blue)
    console.log(`   Query: "${test.query}"`)

    const startTime = Date.now()

    try {
      const results = await searchKnowledgeBase(test.query, {
        limit: 5,
        threshold: 0.5,
      })

      const duration = Date.now() - startTime

      if (results.length === 0) {
        log('❌', `ÉCHEC: Aucun résultat trouvé (${duration}ms)`, COLORS.red)
        log('💡', 'Possible: Seuil trop élevé ou embeddings manquants', COLORS.yellow)
        totalFailed++
        continue
      }

      log('✅', `SUCCÈS: ${results.length} documents trouvés (${duration}ms)`, COLORS.green)

      // Afficher les résultats
      console.log('')
      console.log('   📚 Résultats:')
      results.forEach((result, i) => {
        const similarity = (result.similarity * 100).toFixed(1)
        const preview = result.chunkContent.substring(0, 80).replace(/\n/g, ' ')
        console.log(`   ${i + 1}. [${similarity}%] ${result.category} - ${result.title}`)
        console.log(`      "${preview}..."`)
      })

      // Vérifications qualité
      console.log('')
      console.log('   🔬 Analyse qualité:')

      const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length
      console.log(`   - Similarité moyenne: ${(avgSimilarity * 100).toFixed(1)}%`)

      const categories = new Set(results.map(r => r.category))
      console.log(`   - Catégories: ${Array.from(categories).join(', ')}`)

      const topScore = results[0].similarity
      if (topScore < 0.6) {
        log('⚠️', `Score faible: ${(topScore * 100).toFixed(1)}% (objectif >60%)`, COLORS.yellow)
      } else {
        log('✅', `Score excellent: ${(topScore * 100).toFixed(1)}%`, COLORS.green)
      }

      totalSuccess++

    } catch (error) {
      const duration = Date.now() - startTime
      log('❌', `ERREUR: ${error instanceof Error ? error.message : 'Erreur inconnue'} (${duration}ms)`, COLORS.red)
      console.error(error)
      totalFailed++
    }
  }

  // 3. Résumé final
  console.log('')
  console.log('='.repeat(60))
  console.log('')

  const totalTests = testQueries.length
  const successRate = (totalSuccess / totalTests * 100).toFixed(0)

  if (totalFailed === 0) {
    log('🎉', `TOUS LES TESTS RÉUSSIS ! (${totalSuccess}/${totalTests})`, COLORS.green)
    log('✅', 'La recherche Knowledge Base fonctionne correctement', COLORS.green)
  } else {
    log('⚠️', `Tests: ${totalSuccess} réussis, ${totalFailed} échoués (${successRate}%)`, COLORS.yellow)

    if (totalSuccess === 0) {
      log('❌', 'ÉCHEC CRITIQUE: Aucune recherche ne fonctionne', COLORS.red)
      log('💡', 'Vérifier:', COLORS.yellow)
      console.log('     1. OLLAMA_ENABLED=true dans conteneur')
      console.log('     2. Service Ollama accessible (http://host.docker.internal:11434)')
      console.log('     3. Embeddings présents dans knowledge_base_chunks')
      process.exit(1)
    }
  }

  console.log('')
  log('📝', 'Test manuel recommandé:', COLORS.cyan)
  console.log('   1. Aller sur https://qadhya.tn/assistant-ia')
  console.log('   2. Tester avec: "ما هي شروط الدفاع الشرعي؟"')
  console.log('   3. Vérifier présence sources [KB-1], [KB-2], etc.')
  console.log('')
}

main().catch(error => {
  console.error('\n❌ Erreur fatale:', error)
  process.exit(1)
})
