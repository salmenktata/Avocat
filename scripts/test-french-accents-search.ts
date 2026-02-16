#!/usr/bin/env tsx
/**
 * Test de recherche KB pour vérifier que les accents français sont préservés
 * Fix critique (Feb 16, 2026) : LATIN_RANGE doit inclure À-ÿ
 */

import 'dotenv/config'
import { searchKnowledgeBase } from '@/lib/ai/knowledge-base-service'

const QUERIES_FRENCH = [
  'défense légitime',
  'légitime défense',
  'bonne foi',
  'état de nécessité',
]

async function testFrenchAccents() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║   TEST ACCENTS FRANÇAIS - RECHERCHE KB                         ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log()
  console.log('🎯 Objectif: Vérifier que les accents français ne sont pas supprimés')
  console.log('   Fix: lib/ai/language-utils.ts ligne 11 → LATIN_RANGE avec À-ÿ')
  console.log()

  for (const query of QUERIES_FRENCH) {
    console.log('─'.repeat(70))
    console.log(`\n🔍 Query: "${query}"`)
    console.log()

    try {
      const results = await searchKnowledgeBase(query, {
        maxResults: 5,
        includeMetadata: true,
      })

      console.log(`✅ ${results.length} résultats trouvés`)

      if (results.length === 0) {
        console.log('⚠️  Aucun résultat (peut être normal si pas de contenu FR sur ce sujet)')
      } else {
        const topResult = results[0]
        console.log(`   Score top: ${(topResult.similarity * 100).toFixed(1)}%`)
        console.log(`   Catégorie: ${topResult.metadata?.category || 'N/A'}`)
        console.log(`   Source: ${topResult.metadata?.source || 'N/A'}`)

        if (topResult.similarity >= 0.30) {
          console.log('   ✅ Score suffisant (≥30% seuil Ollama)')
        } else {
          console.log('   ⚠️  Score faible (<30%)')
        }
      }
      console.log()

    } catch (error) {
      console.error('❌ ERREUR:', error instanceof Error ? error.message : error)
    }
  }

  console.log('─'.repeat(70))
  console.log()
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                        DIAGNOSTIC                              ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log()
  console.log('✅ Si résultats trouvés → Accents préservés correctement')
  console.log('❌ Si 0 résultats partout → Vérifier LATIN_RANGE dans language-utils.ts')
  console.log('⚠️  Si scores <30% → Normal si peu de contenu FR pénal dans KB')
  console.log()
}

// Exécuter le test
testFrenchAccents()
  .then(() => {
    console.log('✅ Test terminé')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
  })
