/**
 * Script temporaire pour indexer les documents knowledge_base en production
 */

const { db, closePool } = require('./lib/db/postgres')
const { indexPendingDocuments } = require('./lib/ai/knowledge-base-service')

async function main() {
  console.log('=== Indexation des documents knowledge_base ===\n')

  try {
    let totalIndexed = 0
    let totalFailed = 0
    let round = 0

    // Indexer par batches de 10
    while (true) {
      round++
      console.log(`\n--- Batch ${round} ---`)

      try {
        const result = await indexPendingDocuments(10)

        totalIndexed += result.indexed
        totalFailed += result.failed

        console.log(`✓ Indexés: ${result.indexed}`)
        console.log(`✗ Échoués: ${result.failed}`)

        // Si aucun document indexé, on a terminé
        if (result.indexed === 0) {
          console.log('\nPlus de documents à indexer.')
          break
        }

        // Pause de 2 secondes entre chaque batch
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        console.error(`Erreur batch ${round}:`, error.message)
        break
      }
    }

    // Statistiques finales
    console.log('\n=== Résumé final ===')
    console.log(`Total indexés: ${totalIndexed}`)
    console.log(`Total échoués: ${totalFailed}`)

    const stats = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_indexed THEN 1 END) as indexed,
        COUNT(CASE WHEN NOT is_indexed THEN 1 END) as remaining
      FROM knowledge_base
    `)

    console.log('\n=== État de la base ===')
    console.log(`Total documents: ${stats.rows[0].total}`)
    console.log(`Indexés: ${stats.rows[0].indexed}`)
    console.log(`Restants: ${stats.rows[0].remaining}`)

    const chunks = await db.query('SELECT COUNT(*) as count FROM knowledge_base_chunks')
    const embeddings = await db.query('SELECT COUNT(*) as count FROM knowledge_base_chunks WHERE embedding IS NOT NULL')

    console.log(`\n=== Chunks générés ===`)
    console.log(`Total chunks: ${chunks.rows[0].count}`)
    console.log(`Avec embeddings: ${embeddings.rows[0].count}`)

  } catch (error) {
    console.error('Erreur fatale:', error)
    process.exit(1)
  } finally {
    await closePool()
  }
}

main()
