/**
 * Script one-shot : Migrer les URLs KB des documents juridiques
 *
 * Met à jour les metadata JSONB des entrées knowledge_base et
 * knowledge_base_chunks pour pointer vers les pages Qadhya
 * au lieu des sources externes (9anoun.tn, etc.)
 *
 * Usage : npx tsx scripts/migrate-kb-legal-doc-urls.ts [--dry-run]
 */

import { db } from '@/lib/db/postgres'
import { getDocumentAbsoluteUrl } from '@/lib/legal-documents/document-service'

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(`\n=== Migration URLs KB → Qadhya ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`)

  // 1. Récupérer tous les legal_documents avec knowledge_base_id
  const docs = await db.query<{
    id: string
    citation_key: string
    knowledge_base_id: string
  }>(
    `SELECT id, citation_key, knowledge_base_id
     FROM legal_documents
     WHERE knowledge_base_id IS NOT NULL
       AND consolidation_status = 'complete'`
  )

  console.log(`Documents à migrer: ${docs.rows.length}\n`)

  let kbUpdated = 0
  let chunksUpdated = 0

  for (const doc of docs.rows) {
    const qadhyaUrl = getDocumentAbsoluteUrl(doc.citation_key)
    console.log(`📄 ${doc.citation_key} → ${qadhyaUrl}`)

    if (!DRY_RUN) {
      // 2. Mettre à jour metadata KB entry + source_file
      await db.query(
        `UPDATE knowledge_base
         SET metadata = metadata || jsonb_build_object('sourceUrl', $2::text),
             source_file = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [doc.knowledge_base_id, qadhyaUrl]
      )
      kbUpdated++

      // 3. Mettre à jour chaque chunk avec sourceUrl basé sur citationKey + articleNumber
      const result = await db.query(
        `UPDATE knowledge_base_chunks
         SET metadata = metadata || jsonb_build_object(
           'sourceUrl',
           CASE
             WHEN metadata->>'articleNumber' IS NOT NULL
             THEN $2 || '#article-' || (metadata->>'articleNumber')
             ELSE $2
           END
         )
         WHERE knowledge_base_id = $1
           AND metadata->>'citationKey' IS NOT NULL`,
        [doc.knowledge_base_id, qadhyaUrl]
      )
      chunksUpdated += result.rowCount || 0
      console.log(`   ✅ ${result.rowCount} chunks mis à jour`)
    } else {
      // Dry run: compter les chunks
      const countResult = await db.query(
        `SELECT COUNT(*) as cnt FROM knowledge_base_chunks
         WHERE knowledge_base_id = $1
           AND metadata->>'citationKey' IS NOT NULL`,
        [doc.knowledge_base_id]
      )
      console.log(`   🔍 ${countResult.rows[0].cnt} chunks à mettre à jour`)
    }
  }

  console.log(`\n=== Résultats ===`)
  console.log(`KB entries: ${kbUpdated}`)
  console.log(`Chunks: ${chunksUpdated}`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (rien modifié)' : 'APPLIQUÉ'}`)

  await db.end()
}

main().catch((err) => {
  console.error('Erreur migration:', err)
  process.exit(1)
})
