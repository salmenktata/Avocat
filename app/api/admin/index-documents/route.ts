/**
 * API Route: Administration - Indexation batch des documents
 *
 * POST /api/admin/index-documents
 * - Déclenche l'indexation de tous les documents non indexés
 * - Réservé aux administrateurs
 *
 * GET /api/admin/index-documents
 * - Retourne les statistiques d'indexation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'
import { downloadFile } from '@/lib/storage/minio'
import { extractText, isSupportedMimeType } from '@/lib/ai/document-parser'
import { chunkText } from '@/lib/ai/chunking-service'
import {
  generateEmbeddingsBatch,
  formatEmbeddingForPostgres,
} from '@/lib/ai/embeddings-service'
import { aiConfig, isSemanticSearchEnabled } from '@/lib/ai/config'

// =============================================================================
// GET: Statistiques d'indexation
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id

    // Statistiques globales pour l'utilisateur
    const statsResult = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM documents WHERE user_id = $1) as total_documents,
        (SELECT COUNT(DISTINCT document_id) FROM document_embeddings WHERE user_id = $1) as indexed_documents,
        (SELECT COUNT(*) FROM document_embeddings WHERE user_id = $1) as total_chunks
      `,
      [userId]
    )

    const stats = statsResult.rows[0]

    // Documents non indexés
    const pendingResult = await db.query(
      `SELECT d.id, d.nom, d.type, d.created_at
       FROM documents d
       LEFT JOIN (
         SELECT document_id, COUNT(*) as chunk_count
         FROM document_embeddings
         WHERE user_id = $1
         GROUP BY document_id
       ) de ON d.id = de.document_id
       WHERE d.user_id = $1 AND de.chunk_count IS NULL
       ORDER BY d.created_at DESC
       LIMIT 100`,
      [userId]
    )

    return NextResponse.json({
      stats: {
        totalDocuments: parseInt(stats.total_documents),
        indexedDocuments: parseInt(stats.indexed_documents),
        pendingDocuments:
          parseInt(stats.total_documents) - parseInt(stats.indexed_documents),
        totalChunks: parseInt(stats.total_chunks),
        coveragePercent:
          parseInt(stats.total_documents) > 0
            ? Math.round(
                (parseInt(stats.indexed_documents) / parseInt(stats.total_documents)) *
                  100
              )
            : 0,
      },
      pendingDocuments: pendingResult.rows,
      ragEnabled: isSemanticSearchEnabled(),
    })
  } catch (error) {
    console.error('Erreur stats indexation:', error)
    return NextResponse.json(
      { error: 'Erreur récupération statistiques' },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST: Lancer indexation batch
// =============================================================================

interface IndexBatchBody {
  documentIds?: string[]
  limit?: number
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id

    if (!isSemanticSearchEnabled()) {
      return NextResponse.json(
        { error: 'Recherche sémantique désactivée' },
        { status: 503 }
      )
    }

    const body: IndexBatchBody = await request.json().catch(() => ({}))
    const { documentIds, limit = 20 } = body

    // Récupérer les documents à indexer
    let documents
    if (documentIds && documentIds.length > 0) {
      // Documents spécifiques
      const result = await db.query(
        `SELECT id, nom, chemin_fichier, type, dossier_id
         FROM documents
         WHERE id = ANY($1) AND user_id = $2`,
        [documentIds, userId]
      )
      documents = result.rows
    } else {
      // Documents non indexés
      const result = await db.query(
        `SELECT d.id, d.nom, d.chemin_fichier, d.type, d.dossier_id
         FROM documents d
         LEFT JOIN (
           SELECT document_id
           FROM document_embeddings
           WHERE user_id = $1
           GROUP BY document_id
         ) de ON d.id = de.document_id
         WHERE d.user_id = $1 AND de.document_id IS NULL
         ORDER BY d.created_at DESC
         LIMIT $2`,
        [userId, Math.min(limit, 50)]
      )
      documents = result.rows
    }

    if (documents.length === 0) {
      return NextResponse.json({
        message: 'Aucun document à indexer',
        indexed: 0,
        failed: 0,
        results: [],
      })
    }

    // Indexer chaque document
    const results: Array<{
      documentId: string
      documentName: string
      success: boolean
      chunks?: number
      error?: string
    }> = []

    for (const doc of documents) {
      try {
        const result = await indexSingleDocument(doc, userId)
        results.push({
          documentId: doc.id,
          documentName: doc.nom,
          success: result.success,
          chunks: result.chunks,
          error: result.error,
        })
      } catch (error) {
        results.push({
          documentId: doc.id,
          documentName: doc.nom,
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        })
      }
    }

    const indexed = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      message: `Indexation terminée: ${indexed} succès, ${failed} échecs`,
      indexed,
      failed,
      results,
    })
  } catch (error) {
    console.error('Erreur indexation batch:', error)
    return NextResponse.json(
      { error: 'Erreur indexation batch' },
      { status: 500 }
    )
  }
}

// =============================================================================
// HELPER: Indexer un document
// =============================================================================

async function indexSingleDocument(
  doc: { id: string; nom: string; chemin_fichier: string; type: string; dossier_id: string | null },
  userId: string
): Promise<{ success: boolean; chunks?: number; error?: string }> {
  const mimeType = getMimeTypeFromPath(doc.chemin_fichier)

  if (!isSupportedMimeType(mimeType)) {
    return { success: false, error: `Type non supporté: ${mimeType}` }
  }

  // Télécharger le fichier
  const buffer = await downloadFile(doc.chemin_fichier)

  // Extraire le texte
  const parseResult = await extractText(buffer, mimeType)

  if (!parseResult.text || parseResult.text.trim().length < 50) {
    return { success: false, error: 'Texte extrait trop court' }
  }

  // Découper en chunks
  const chunks = chunkText(parseResult.text, {
    chunkSize: aiConfig.rag.chunkSize,
    overlap: aiConfig.rag.chunkOverlap,
  })

  if (chunks.length === 0) {
    return { success: false, error: 'Aucun chunk généré' }
  }

  // Générer les embeddings
  const embeddingsResult = await generateEmbeddingsBatch(
    chunks.map((c) => c.content)
  )

  // Transaction pour insertion
  const client = await db.getClient()

  try {
    await client.query('BEGIN')

    // Supprimer les anciens embeddings
    await client.query(
      `DELETE FROM document_embeddings WHERE document_id = $1`,
      [doc.id]
    )

    // Insérer les nouveaux
    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        `INSERT INTO document_embeddings
         (document_id, user_id, content_chunk, chunk_index, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5::vector, $6)`,
        [
          doc.id,
          userId,
          chunks[i].content,
          chunks[i].index,
          formatEmbeddingForPostgres(embeddingsResult.embeddings[i]),
          JSON.stringify({
            documentName: doc.nom,
            dossierId: doc.dossier_id,
            wordCount: chunks[i].metadata.wordCount,
          }),
        ]
      )
    }

    await client.query('COMMIT')

    return { success: true, chunks: chunks.length }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function getMimeTypeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    html: 'text/html',
    md: 'text/markdown',
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}
