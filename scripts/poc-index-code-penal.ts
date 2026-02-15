#!/usr/bin/env npx tsx
/**
 * POC - Indexer le Code Pénal consolidé dans la KB
 *
 * Utilise le chunking par article (document-aware) au lieu du chunking classique.
 *
 * Prérequis: avoir exécuté poc-consolidate-code-penal.ts
 *
 * Usage: npx tsx scripts/poc-index-code-penal.ts
 */

import { db } from '@/lib/db/postgres'
import { getDocumentByCitationKey } from '@/lib/legal-documents/document-service'
import { indexLegalDocument } from '@/lib/web-scraper/web-indexer-service'

const CITATION_KEY = 'code-penal-tunisien'

async function main() {
  console.log('=== POC Code Pénal - Indexation Document-Aware ===\n')

  // 1. Trouver le document
  const document = await getDocumentByCitationKey(CITATION_KEY)
  if (!document) {
    console.error(`❌ Document ${CITATION_KEY} non trouvé`)
    process.exit(1)
  }

  if (document.consolidationStatus !== 'complete') {
    console.error(`❌ Document pas encore consolidé (status: ${document.consolidationStatus})`)
    process.exit(1)
  }

  console.log(`📋 Document: ${document.citationKey}`)
  console.log(`   ID: ${document.id}`)
  console.log(`   Pages: ${document.pageCount}`)
  console.log(`   Texte consolidé: ${document.consolidatedText?.length || 0} chars`)
  console.log()

  // 2. Indexer
  console.log('🔄 Indexation document-aware en cours...')
  console.log('   (chunking par article + embeddings Ollama)')
  console.log()

  const startTime = Date.now()
  const result = await indexLegalDocument(document.id)
  const duration = Date.now() - startTime

  if (!result.success) {
    console.error(`❌ Échec indexation: ${result.error}`)
    process.exit(1)
  }

  console.log(`\n✅ Indexation réussie:`)
  console.log(`   Chunks créés: ${result.chunksCreated}`)
  console.log(`   KB ID: ${result.knowledgeBaseId}`)
  console.log(`   Durée: ${(duration / 1000).toFixed(1)}s`)
  console.log()

  // 3. Vérification
  const verification = await db.query<any>(
    `SELECT
      kb.id, kb.title, kb.category, kb.is_indexed,
      COUNT(kbc.id) as chunks_count,
      AVG(kbc.metadata->>'wordCount')::INTEGER as avg_words,
      MIN(kbc.metadata->>'articleNumber') as first_article,
      MAX(kbc.metadata->>'articleNumber') as last_article
    FROM knowledge_base kb
    LEFT JOIN knowledge_base_chunks kbc ON kb.id = kbc.knowledge_base_id
    WHERE kb.id = $1
    GROUP BY kb.id`,
    [result.knowledgeBaseId]
  )

  if (verification.rows.length > 0) {
    const v = verification.rows[0]
    console.log('📋 Vérification KB:')
    console.log(`   Titre: ${v.title}`)
    console.log(`   Catégorie: ${v.category}`)
    console.log(`   Indexé: ${v.is_indexed ? '✅' : '❌'}`)
    console.log(`   Chunks: ${v.chunks_count}`)
    console.log(`   Mots/chunk moyen: ${v.avg_words}`)
    console.log(`   Articles: ${v.first_article} → ${v.last_article}`)
  }

  // 4. Vérifier document juridique
  const docCheck = await db.query<any>(
    `SELECT knowledge_base_id, is_canonical FROM legal_documents WHERE id = $1`,
    [document.id]
  )
  if (docCheck.rows.length > 0) {
    const d = docCheck.rows[0]
    console.log(`\n📌 Lien Legal Document → KB:`)
    console.log(`   KB ID: ${d.knowledge_base_id}`)
    console.log(`   Canonical: ${d.is_canonical ? '✅' : '❌'}`)
  }

  console.log('\n=== Indexation terminée ===')
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Erreur:', err)
  process.exit(1)
})
