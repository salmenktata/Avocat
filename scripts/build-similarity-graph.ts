#!/usr/bin/env tsx
/**
 * Script de construction du graphe similar_to (Phase 4)
 *
 * Détecte automatiquement documents similaires et crée relations bidirectionnelles.
 *
 * Usage:
 *   # Dry-run (affichage sans création)
 *   npx tsx scripts/build-similarity-graph.ts --dry-run
 *
 *   # Construction complète
 *   npx tsx scripts/build-similarity-graph.ts
 *
 *   # Par catégorie
 *   npx tsx scripts/build-similarity-graph.ts --category=codes
 *
 *   # Batch limité
 *   npx tsx scripts/build-similarity-graph.ts --batch-size=50
 *
 *   # Avec auto-validation
 *   npx tsx scripts/build-similarity-graph.ts --auto-validate
 */

import {
  buildSimilarityGraph,
  getSimilarityGraphStats,
} from '../lib/ai/document-similarity-service'

// =============================================================================
// ARGUMENTS CLI
// =============================================================================

const args = process.argv.slice(2)
const flags = {
  dryRun: args.includes('--dry-run'),
  autoValidate: args.includes('--auto-validate'),
  category: args.find((a) => a.startsWith('--category='))?.split('=')[1],
  batchSize: parseInt(
    args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] || '100'
  ),
  minSimilarity: parseFloat(
    args.find((a) => a.startsWith('--min-similarity='))?.split('=')[1] || '0.85'
  ),
  maxResults: parseInt(
    args.find((a) => a.startsWith('--max-results='))?.split('=')[1] || '10'
  ),
}

console.log('🔗 Construction du Graphe Juridique similar_to (Phase 4)\n')
console.log('Paramètres:', flags, '\n')

// =============================================================================
// FONCTION PRINCIPALE
// =============================================================================

async function main() {
  try {
    const startTime = Date.now()

    // Afficher stats avant construction
    console.log('📊 État actuel du graphe:')
    const statsBefore = await getSimilarityGraphStats()
    console.log(`   Relations similar_to : ${statsBefore.totalRelations}`)
    console.log(`   Relations validées : ${statsBefore.validatedRelations}`)
    console.log(`   Force moyenne : ${(statsBefore.avgStrength * 100).toFixed(1)}%`)

    if (statsBefore.topDocuments.length > 0) {
      console.log(`\n   Top 3 documents avec le plus de relations:`)
      statsBefore.topDocuments.slice(0, 3).forEach((doc, i) => {
        console.log(
          `     ${i + 1}. ${doc.title.slice(0, 50)}... (${doc.similarCount} docs, avg: ${(doc.avgStrength * 100).toFixed(1)}%)`
        )
      })
    }

    console.log('\n' + '='.repeat(70))

    if (flags.dryRun) {
      console.log('⚠️  MODE DRY-RUN : Aucune relation ne sera créée')
      console.log('    Pour créer les relations, relancez sans --dry-run')
    }

    console.log('\n🚀 Démarrage construction graphe...\n')

    // Construire graphe
    const result = await buildSimilarityGraph({
      batchSize: flags.batchSize,
      categories: flags.category ? [flags.category] : undefined,
      dryRun: flags.dryRun,
      minSimilarity: flags.minSimilarity,
      maxResults: flags.maxResults,
      autoValidate: flags.autoValidate,
      sameCategoryOnly: true,
      sameLanguageOnly: true,
    })

    // Afficher résultats
    console.log('\n' + '='.repeat(70))
    console.log('📊 RÉSULTATS CONSTRUCTION')
    console.log('='.repeat(70))
    console.log(`Documents traités : ${result.documentsProcessed}`)
    console.log(`Relations créées : ${result.totalRelationsCreated}`)

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Erreurs rencontrées : ${result.errors.length}`)
      result.errors.slice(0, 5).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`)
      })
      if (result.errors.length > 5) {
        console.log(`  ... et ${result.errors.length - 5} autres erreurs`)
      }
    }

    // Afficher stats après construction
    if (!flags.dryRun) {
      console.log('\n📊 État final du graphe:')
      const statsAfter = await getSimilarityGraphStats()
      console.log(`   Relations similar_to : ${statsAfter.totalRelations} (+${statsAfter.totalRelations - statsBefore.totalRelations})`)
      console.log(`   Relations validées : ${statsAfter.validatedRelations}`)
      console.log(`   Force moyenne : ${(statsAfter.avgStrength * 100).toFixed(1)}%`)

      if (statsAfter.topDocuments.length > 0) {
        console.log(`\n   Top 3 documents avec le plus de relations:`)
        statsAfter.topDocuments.slice(0, 3).forEach((doc, i) => {
          console.log(
            `     ${i + 1}. ${doc.title.slice(0, 50)}... (${doc.similarCount} docs, avg: ${(doc.avgStrength * 100).toFixed(1)}%)`
          )
        })
      }
    }

    const duration = Date.now() - startTime
    console.log(`\n⏱️  Durée totale: ${(duration / 1000).toFixed(1)}s`)

    if (flags.dryRun) {
      console.log('\n💡 Pour appliquer les modifications, relancez sans --dry-run')
    }

    if (!flags.autoValidate && result.totalRelationsCreated > 0) {
      console.log('\n💡 Relations créées nécessitent validation humaine (validated=false)')
      console.log('   Pour auto-valider, utilisez --auto-validate')
    }

    console.log('='.repeat(70))

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Erreur:', error)
    process.exit(1)
  }
}

main()
