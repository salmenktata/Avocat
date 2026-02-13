/**
 * Script de test pour diagnostiquer le problème de suppression de source web
 *
 * Usage:
 *   npx tsx scripts/test-delete-web-source.ts <sourceId> [--dry-run]
 */

import { db } from '@/lib/db/postgres'
import { deleteWebSourceComplete, getDeletePreview } from '@/lib/web-scraper/delete-service'

async function main() {
  const args = process.argv.slice(2)
  const sourceId = args[0]
  const dryRun = args.includes('--dry-run')

  if (!sourceId) {
    console.error('❌ Erreur: sourceId requis')
    console.log('Usage: npx tsx scripts/test-delete-web-source.ts <sourceId> [--dry-run]')
    process.exit(1)
  }

  console.log('🔍 Diagnostic suppression source web')
  console.log('=====================================')
  console.log(`Source ID: ${sourceId}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN (aperçu seulement)' : 'SUPPRESSION RÉELLE'}`)
  console.log()

  try {
    // Étape 1: Vérifier l'existence de la source
    console.log('📌 Étape 1: Vérification existence source...')
    const sourceResult = await db.query(
      'SELECT id, name, base_url, category, is_active FROM web_sources WHERE id = $1',
      [sourceId]
    )

    if (sourceResult.rows.length === 0) {
      console.error('❌ Source non trouvée')
      process.exit(1)
    }

    const source = sourceResult.rows[0]
    console.log('✅ Source trouvée:')
    console.log(`   - Nom: ${source.name}`)
    console.log(`   - URL: ${source.base_url}`)
    console.log(`   - Catégorie: ${source.category}`)
    console.log(`   - Active: ${source.is_active}`)
    console.log()

    // Étape 2: Aperçu de la suppression
    console.log('📊 Étape 2: Aperçu des données à supprimer...')
    const preview = await getDeletePreview(sourceId)

    console.log(`✅ Données à supprimer:`)
    console.log(`   - Documents KB: ${preview.stats.knowledgeBaseDocs}`)
    console.log(`   - Chunks KB: ${preview.stats.knowledgeBaseChunks}`)
    console.log(`   - Pages web: ${preview.stats.webPages}`)
    console.log(`   - Fichiers web: ${preview.stats.webFiles}`)
    console.log(`   - Jobs crawl: ${preview.stats.crawlJobs}`)
    console.log(`   - Logs crawl: ${preview.stats.crawlLogs}`)
    console.log(`   - Fichiers MinIO: ${preview.stats.minioFiles}`)
    console.log(`   - Taille estimée: ${preview.estimatedSize}`)
    console.log()

    // Étape 3: Vérifier les contraintes FK
    console.log('🔗 Étape 3: Vérification contraintes FK...')

    // Vérifier les FK qui pourraient bloquer la suppression
    const fkChecks = [
      {
        table: 'knowledge_base',
        column: "metadata->>'sourceId'",
        label: 'Documents KB',
      },
      {
        table: 'web_pages',
        column: 'web_source_id',
        label: 'Pages web',
      },
      {
        table: 'web_files',
        column: 'web_source_id',
        label: 'Fichiers web',
      },
      {
        table: 'web_crawl_jobs',
        column: 'web_source_id',
        label: 'Jobs crawl',
      },
      {
        table: 'web_crawl_logs',
        column: 'web_source_id',
        label: 'Logs crawl',
      },
      {
        table: 'indexing_jobs',
        column: "source_metadata->>'sourceId'",
        label: 'Jobs indexation',
      },
    ]

    for (const check of fkChecks) {
      const result = await db.query(
        `SELECT COUNT(*) as count FROM ${check.table} WHERE ${check.column} = $1`,
        [sourceId]
      )
      const count = parseInt(result.rows[0].count)
      console.log(`   ${count > 0 ? '⚠️' : '✅'} ${check.label}: ${count} enregistrement(s)`)
    }
    console.log()

    // Étape 4: Vérifier les jobs en cours
    console.log('⏳ Étape 4: Vérification jobs en cours...')
    const runningJobsResult = await db.query(
      `SELECT id, job_type, status, started_at
       FROM web_crawl_jobs
       WHERE web_source_id = $1 AND status IN ('queued', 'running')`,
      [sourceId]
    )

    if (runningJobsResult.rows.length > 0) {
      console.log('⚠️  ATTENTION: Jobs en cours détectés:')
      runningJobsResult.rows.forEach(job => {
        console.log(`   - Job ${job.id} (${job.job_type}): ${job.status} depuis ${job.started_at}`)
      })
      console.log('   Recommandation: Attendre la fin des jobs avant suppression')
    } else {
      console.log('✅ Aucun job en cours')
    }
    console.log()

    if (dryRun) {
      console.log('🔍 Mode DRY RUN: Aperçu seulement, aucune suppression effectuée')
      process.exit(0)
    }

    // Étape 5: Suppression réelle
    console.log('🗑️  Étape 5: Suppression en cours...')
    console.log('⚠️  Cette opération est IRRÉVERSIBLE!')

    const result = await deleteWebSourceComplete(sourceId)

    console.log()
    console.log('📊 Résultat de la suppression:')
    console.log(`   - Succès: ${result.success ? '✅ OUI' : '❌ NON'}`)
    console.log(`   - Source supprimée: ${result.sourceDeleted ? '✅ OUI' : '❌ NON'}`)
    console.log()
    console.log('📈 Statistiques:')
    console.log(`   - Documents KB: ${result.stats.knowledgeBaseDocs}`)
    console.log(`   - Chunks KB: ${result.stats.knowledgeBaseChunks}`)
    console.log(`   - Pages web: ${result.stats.webPages}`)
    console.log(`   - Fichiers web: ${result.stats.webFiles}`)
    console.log(`   - Jobs crawl: ${result.stats.crawlJobs}`)
    console.log(`   - Logs crawl: ${result.stats.crawlLogs}`)
    console.log(`   - Fichiers MinIO: ${result.stats.minioFiles}`)

    if (result.errors.length > 0) {
      console.log()
      console.log('⚠️  Erreurs rencontrées:')
      result.errors.forEach(error => {
        console.log(`   - ${error}`)
      })
    }

    console.log()
    if (result.success) {
      console.log('✅ Suppression terminée avec succès!')
    } else {
      console.error('❌ La suppression a échoué')
      process.exit(1)
    }

  } catch (error) {
    console.error()
    console.error('❌ Erreur lors de la suppression:')
    console.error(error)
    process.exit(1)
  } finally {
    await db.end()
  }
}

main()
