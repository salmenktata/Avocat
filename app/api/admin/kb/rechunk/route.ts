import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/postgres'
import { chunkText } from '@/lib/ai/chunking-service'
import { generateEmbedding, formatEmbeddingForPostgres } from '@/lib/ai/embeddings-service'

/**
 * POST /api/admin/kb/rechunk
 *
 * Re-chunke un ou plusieurs documents KB avec la nouvelle configuration
 *
 * Body params:
 * - documentId (optional) - ID d'un document spécifique
 * - minChunkSize (default: 2000) - Re-chunker docs avec chunks > cette taille
 * - limit (default: 999) - Nombre max de documents à traiter
 * - dryRun (default: false) - Simulation sans modification
 *
 * @returns Rapport de re-chunking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const documentId = body.documentId || null
    const minChunkSize = parseInt(body.minChunkSize || '2000', 10)
    const limit = parseInt(body.limit || '999', 10)
    const dryRun = body.dryRun === true

    console.log('[KB Rechunk] Démarrage:', { documentId, minChunkSize, limit, dryRun })

    // Identifier les documents à re-chunker
    let docsToRechunk: Array<{
      id: string
      title: string
      category: string
      full_text: string
      total_chunks: number
      large_chunks: number
      max_chars: number
    }> = []

    if (documentId) {
      // Re-chunker un document spécifique
      const docResult = await db.query<{
        id: string
        title: string
        category: string
        full_text: string
      }>(`
        SELECT id, title, category, full_text
        FROM knowledge_base
        WHERE id = $1 AND is_active = true
      `, [documentId])

      if (docResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Document non trouvé' },
          { status: 404 }
        )
      }

      docsToRechunk = docResult.rows.map(row => ({
        ...row,
        total_chunks: 0,
        large_chunks: 0,
        max_chars: 0,
      }))
    } else {
      // Identifier les documents avec chunks trop grands
      const result = await db.query<{
        id: string
        title: string
        category: string
        full_text: string
        total_chunks: number
        large_chunks: number
        max_chars: number
      }>(`
        SELECT
          kb.id,
          kb.title,
          kb.category,
          kb.full_text,
          COUNT(kbc.id) as total_chunks,
          COUNT(*) FILTER (WHERE LENGTH(kbc.content) > $1) as large_chunks,
          MAX(LENGTH(kbc.content)) as max_chars
        FROM knowledge_base kb
        JOIN knowledge_base_chunks kbc ON kb.id = kbc.knowledge_base_id
        WHERE kb.is_active = true
        GROUP BY kb.id, kb.title, kb.category, kb.full_text
        HAVING COUNT(*) FILTER (WHERE LENGTH(kbc.content) > $1) > 0
        ORDER BY COUNT(*) FILTER (WHERE LENGTH(kbc.content) > $1) DESC,
                 MAX(LENGTH(kbc.content)) DESC
        LIMIT $2
      `, [minChunkSize, limit])

      docsToRechunk = result.rows
    }

    if (docsToRechunk.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun document à re-chunker',
        processed: 0,
        results: [],
      })
    }

    console.log(`[KB Rechunk] ${docsToRechunk.length} documents à traiter`)

    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: `Dry run: ${docsToRechunk.length} documents à re-chunker`,
        dryRun: true,
        documents: docsToRechunk.map(doc => ({
          id: doc.id,
          title: doc.title,
          category: doc.category,
          currentChunks: doc.total_chunks,
          largeChunks: doc.large_chunks,
          maxChars: doc.max_chars,
        })),
      })
    }

    // Re-chunker chaque document
    const results: Array<{
      documentId: string
      title: string
      success: boolean
      oldChunks: number
      newChunks: number
      error?: string
      processingTimeMs: number
    }> = []

    for (const doc of docsToRechunk) {
      const startTime = Date.now()

      try {
        console.log(`[KB Rechunk] Processing "${doc.title}" (${doc.id})...`)

        if (!doc.full_text || doc.full_text.length < 100) {
          results.push({
            documentId: doc.id,
            title: doc.title,
            success: false,
            oldChunks: doc.total_chunks,
            newChunks: 0,
            error: 'Full text trop court ou manquant',
            processingTimeMs: Date.now() - startTime,
          })
          continue
        }

        // 1. Supprimer anciens chunks
        await db.query(`
          DELETE FROM knowledge_base_chunks WHERE knowledge_base_id = $1
        `, [doc.id])

        // 2. Re-chunker avec nouvelle config
        const newChunks = chunkText(doc.full_text, {
          category: doc.category.toLowerCase(),
          preserveParagraphs: true,
          preserveSentences: true,
        })

        console.log(`   ✂️  ${newChunks.length} nouveaux chunks créés`)

        // 3. Insérer nouveaux chunks avec embeddings
        let inserted = 0
        for (const [index, chunk] of newChunks.entries()) {
          try {
            const embeddingResult = await generateEmbedding(chunk.content)

            await db.query(`
              INSERT INTO knowledge_base_chunks (
                knowledge_base_id,
                chunk_index,
                content,
                word_count,
                char_count,
                embedding
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              doc.id,
              index,
              chunk.content,
              chunk.metadata.wordCount,
              chunk.metadata.charCount,
              formatEmbeddingForPostgres(embeddingResult.embedding),
            ])

            inserted++
          } catch (error: any) {
            console.error(`   ❌ Erreur chunk ${index}:`, error.message)
          }
        }

        // 4. Mettre à jour compteur
        await db.query(`
          UPDATE knowledge_base
          SET chunk_count = $1, updated_at = NOW()
          WHERE id = $2
        `, [inserted, doc.id])

        results.push({
          documentId: doc.id,
          title: doc.title,
          success: true,
          oldChunks: doc.total_chunks,
          newChunks: inserted,
          processingTimeMs: Date.now() - startTime,
        })

        console.log(`   ✅ ${inserted} chunks insérés (${Date.now() - startTime}ms)`)
      } catch (error: any) {
        console.error(`[KB Rechunk] ❌ Erreur:`, error.message)

        results.push({
          documentId: doc.id,
          title: doc.title,
          success: false,
          oldChunks: doc.total_chunks,
          newChunks: 0,
          error: error.message,
          processingTimeMs: Date.now() - startTime,
        })
      }
    }

    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Re-chunking terminé: ${succeeded}/${docsToRechunk.length} réussis`,
      processed: docsToRechunk.length,
      succeeded,
      failed,
      results,
    })
  } catch (error: any) {
    console.error('[KB Rechunk] Erreur:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erreur lors du re-chunking',
      },
      { status: 500 }
    )
  }
}
