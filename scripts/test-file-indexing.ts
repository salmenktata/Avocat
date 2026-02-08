/**
 * Test d'indexation des fichiers PDF
 * Usage: set -a && source .env.local && set +a && npx tsx scripts/test-file-indexing.ts
 */

import { db } from '@/lib/db/postgres'
import { indexPageFiles } from '@/lib/web-scraper/file-indexer-service'

interface WebFileRow {
  id: string
  web_page_id: string
  web_source_id: string
  url: string
  filename: string
  file_type: string
  minio_path: string | null
  file_size: number
  is_downloaded: boolean
  is_indexed: boolean
}

interface WebSourceRow {
  id: string
  name: string
  category: string
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║           TEST INDEXATION FICHIERS PDF                     ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // Stats initiales
  const stats = await db.query<{
    total: number
    downloaded: number
    indexed: number
    size_mb: number
  }>(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN is_downloaded THEN 1 END) as downloaded,
      COUNT(CASE WHEN is_indexed THEN 1 END) as indexed,
      ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) as size_mb
    FROM web_files
    WHERE file_type = 'pdf'
  `)

  const s = stats.rows[0]
  console.log('📊 Stats initiales:')
  console.log(`   Total PDFs: ${s.total}`)
  console.log(`   Téléchargés: ${s.downloaded}`)
  console.log(`   Indexés: ${s.indexed}`)
  console.log(`   Taille: ${s.size_mb} MB\n`)

  // Récupérer les fichiers à indexer (downloaded mais pas indexed)
  const filesToIndex = await db.query<WebFileRow>(`
    SELECT wf.*, ws.name as source_name, ws.category
    FROM web_files wf
    JOIN web_sources ws ON wf.web_source_id = ws.id
    WHERE wf.is_downloaded = true
      AND wf.is_indexed = false
      AND wf.file_type = 'pdf'
      AND wf.minio_path IS NOT NULL
    ORDER BY wf.file_size ASC
    LIMIT 10
  `)

  console.log(`📄 ${filesToIndex.rows.length} fichiers à indexer (limite 10 pour le test)\n`)

  if (filesToIndex.rows.length === 0) {
    console.log('✅ Tous les fichiers téléchargés sont déjà indexés!')
    process.exit(0)
  }

  // Récupérer les infos de source
  const sources = await db.query<WebSourceRow>(`
    SELECT id, name, category FROM web_sources
  `)
  const sourceMap = new Map(sources.rows.map(s => [s.id, s]))

  // Indexer les fichiers
  let indexed = 0
  let failed = 0
  const startTime = Date.now()

  for (const file of filesToIndex.rows) {
    const source = sourceMap.get(file.web_source_id)
    if (!source) {
      console.log(`   ⚠️ Source non trouvée pour ${file.filename}`)
      continue
    }

    console.log(`   🔄 [${source.name}] ${file.filename} (${(file.file_size / 1024).toFixed(1)} KB)`)

    try {
      const result = await indexPageFiles(
        file.web_page_id,
        source.id,
        source.name,
        source.category
      )

      if (result.indexed > 0) {
        indexed += result.indexed
        console.log(`   ✅ ${result.indexed} fichier(s) indexé(s), ${result.chunksCreated || 0} chunks`)
      } else if (result.failed > 0) {
        failed += result.failed
        console.log(`   ❌ Échec: ${result.errors?.join(', ') || 'erreur inconnue'}`)
      }
    } catch (error) {
      failed++
      console.log(`   ❌ Erreur: ${error}`)
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  // Stats finales
  console.log('\n' + '─'.repeat(60))
  console.log('📊 RÉSUMÉ')
  console.log('─'.repeat(60))
  console.log(`   Durée: ${duration}s`)
  console.log(`   Indexés: ${indexed}`)
  console.log(`   Échecs: ${failed}`)
  console.log(`   Vitesse: ${(indexed / parseFloat(duration)).toFixed(2)} fichiers/s`)

  // Stats finales DB
  const finalStats = await db.query<{
    indexed: number
    chunks: number
  }>(`
    SELECT
      COUNT(CASE WHEN wf.is_indexed THEN 1 END) as indexed,
      COALESCE(SUM(wf.chunks_count), 0) as chunks
    FROM web_files wf
    WHERE file_type = 'pdf'
  `)

  const fs = finalStats.rows[0]
  console.log(`\n   Total indexés maintenant: ${fs.indexed}`)
  console.log(`   Total chunks créés: ${fs.chunks}`)

  console.log('\n✨ Test terminé!')
  process.exit(0)
}

main().catch((error) => {
  console.error('💥 Erreur fatale:', error)
  process.exit(1)
})
