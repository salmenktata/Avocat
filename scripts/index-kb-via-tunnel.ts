/**
 * Script pour indexer les documents knowledge_base en production via tunnel SSH
 *
 * Prérequis: Tunnel SSH actif sur port 5433
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Charger les variables d'environnement AVANT les imports
config({ path: resolve(__dirname, '../.env.local') })

// Override DATABASE_URL pour pointer vers le tunnel
process.env.DATABASE_URL = 'postgresql://moncabinet:moncabinet_secure_password_2026@localhost:5433/moncabinet'

// Maintenant on peut importer les modules
import { closePool } from '../lib/db/postgres'
import { indexPendingDocuments } from '../lib/ai/knowledge-base-service'

async function main() {
  console.log('=== Indexation Knowledge Base (Production via Tunnel) ===\n')

  let totalIndexed = 0
  let totalFailed = 0
  let round = 0
  const batchSize = 5 // Petit batch pour éviter les timeouts

  try {
    while (true) {
      round++
      console.log(`\n--- Batch ${round} (taille: ${batchSize}) ---`)

      const result = await indexPendingDocuments(batchSize)

      totalIndexed += result.succeeded
      totalFailed += result.failed

      console.log(`✓ Indexés: ${result.succeeded}`)
      console.log(`✗ Échoués: ${result.failed}`)

      if (result.results.length > 0) {
        console.log('\nDétail:')
        result.results.forEach((r, i) => {
          const status = r.success ? '✓' : '✗'
          console.log(`  ${status} ${i + 1}. ${r.title?.substring(0, 60) || r.id}`)
          if (r.error) {
            console.log(`     Erreur: ${r.error}`)
          }
        })
      }

      // Si aucun document traité, on a terminé
      if (result.processed === 0) {
        console.log('\n✅ Plus de documents à indexer.')
        break
      }

      // Pause de 2 secondes entre chaque batch
      console.log('\nPause de 2 secondes...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.log('\n=== Résumé Final ===')
    console.log(`Total indexés: ${totalIndexed}`)
    console.log(`Total échoués: ${totalFailed}`)
    console.log(`Batches traités: ${round}`)

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  } finally {
    await closePool()
    process.exit(0)
  }
}

main()
