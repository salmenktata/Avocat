/**
 * API Route: Indexation de document pour recherche sémantique
 *
 * POST /api/documents/[id]/index
 * - Télécharge le document depuis MinIO
 * - Extrait le texte (PDF/DOCX)
 * - Découpe en chunks
 * - Génère les embeddings
 * - Stocke dans document_embeddings
 */

import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - pas de prérendu statique
export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'
import { downloadFile } from '@/lib/storage/minio'
import { extractText, isSupportedMimeType } from '@/lib/ai/document-parser'
import { chunkText } from '@/lib/ai/chunking-service'
import {
  generateEmbeddingsBatch,
  formatEmbeddingForPostgres,
  isEmbeddingsServiceAvailable,
} from '@/lib/ai/embeddings-service'
import { aiConfig, isSemanticSearchEnabled } from '@/lib/ai/config'

// =============================================================================
// TYPES
// =============================================================================

interface IndexResult {
  success: boolean
  documentId: string
  chunksIndexed: number
  totalTokens: number
  error?: string
}

// =============================================================================
// POST: Indexer un document
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<IndexResult>> {
  try {
    // Vérifier authentification
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, documentId: '', chunksIndexed: 0, totalTokens: 0, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const { id: documentId } = await params
    const userId = session.user.id

    // Vérifier que le service est activé
    if (!isSemanticSearchEnabled()) {
      return NextResponse.json(
        {
          success: false,
          documentId,
          chunksIndexed: 0,
          totalTokens: 0,
          error: 'Recherche sémantique désactivée (RAG_ENABLED=false ou OPENAI_API_KEY manquant)',
        },
        { status: 503 }
      )
    }

    // Récupérer le document
    const docResult = await db.query(
      `SELECT id, nom, chemin_fichier, type, dossier_id
       FROM documents
       WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    )

    if (docResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, documentId, chunksIndexed: 0, totalTokens: 0, error: 'Document non trouvé' },
        { status: 404 }
      )
    }

    const document = docResult.rows[0]

    // Vérifier le type de fichier
    const mimeType = getMimeTypeFromPath(document.chemin_fichier)
    if (!isSupportedMimeType(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          documentId,
          chunksIndexed: 0,
          totalTokens: 0,
          error: `Type de fichier non supporté pour indexation: ${mimeType}`,
        },
        { status: 400 }
      )
    }

    // Vérifier si déjà indexé
    const existingResult = await db.query(
      `SELECT COUNT(*) as count FROM document_embeddings WHERE document_id = $1`,
      [documentId]
    )

    if (parseInt(existingResult.rows[0].count) > 0) {
      // Supprimer les anciennes embeddings pour ré-indexer
      await db.query(
        `DELETE FROM document_embeddings WHERE document_id = $1`,
        [documentId]
      )
    }

    // Télécharger le fichier depuis MinIO
    const fileBuffer = await downloadFile(document.chemin_fichier)

    // Extraire le texte
    const parseResult = await extractText(fileBuffer, mimeType)

    if (!parseResult.text || parseResult.text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          documentId,
          chunksIndexed: 0,
          totalTokens: 0,
          error: 'Aucun texte extrait du document',
        },
        { status: 400 }
      )
    }

    // Découper en chunks
    const chunks = chunkText(parseResult.text, {
      chunkSize: aiConfig.rag.chunkSize,
      overlap: aiConfig.rag.chunkOverlap,
      preserveParagraphs: true,
      preserveSentences: true,
    })

    if (chunks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          documentId,
          chunksIndexed: 0,
          totalTokens: 0,
          error: 'Aucun chunk généré',
        },
        { status: 400 }
      )
    }

    // Générer les embeddings en batch
    const chunkContents = chunks.map((c) => c.content)
    const embeddingsResult = await generateEmbeddingsBatch(chunkContents)

    // Insérer les embeddings en base
    const client = await db.getClient()

    try {
      await client.query('BEGIN')

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = embeddingsResult.embeddings[i]

        await client.query(
          `INSERT INTO document_embeddings
           (document_id, user_id, content_chunk, chunk_index, embedding, metadata)
           VALUES ($1, $2, $3, $4, $5::vector, $6)`,
          [
            documentId,
            userId,
            chunk.content,
            chunk.index,
            formatEmbeddingForPostgres(embedding),
            JSON.stringify({
              wordCount: chunk.metadata.wordCount,
              charCount: chunk.metadata.charCount,
              documentName: document.nom,
              dossierId: document.dossier_id,
            }),
          ]
        )
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return NextResponse.json({
      success: true,
      documentId,
      chunksIndexed: chunks.length,
      totalTokens: embeddingsResult.totalTokens,
    })
  } catch (error) {
    console.error('Erreur indexation document:', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'

    return NextResponse.json(
      {
        success: false,
        documentId: '',
        chunksIndexed: 0,
        totalTokens: 0,
        error: message,
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// DELETE: Supprimer l'indexation d'un document
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { id: documentId } = await params
    const userId = session.user.id

    // Vérifier propriété du document
    const docResult = await db.query(
      `SELECT id FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    )

    if (docResult.rows.length === 0) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 })
    }

    // Supprimer les embeddings
    const deleteResult = await db.query(
      `DELETE FROM document_embeddings WHERE document_id = $1 RETURNING id`,
      [documentId]
    )

    return NextResponse.json({
      success: true,
      deletedChunks: deleteResult.rowCount,
    })
  } catch (error) {
    console.error('Erreur suppression indexation:', error)
    return NextResponse.json(
      { error: 'Erreur suppression indexation' },
      { status: 500 }
    )
  }
}

// =============================================================================
// GET: Vérifier le statut d'indexation
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { id: documentId } = await params
    const userId = session.user.id

    // Vérifier propriété du document
    const docResult = await db.query(
      `SELECT id, nom FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    )

    if (docResult.rows.length === 0) {
      return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 })
    }

    // Compter les chunks indexés
    const countResult = await db.query(
      `SELECT COUNT(*) as count, MAX(created_at) as last_indexed
       FROM document_embeddings
       WHERE document_id = $1`,
      [documentId]
    )

    const count = parseInt(countResult.rows[0].count)

    return NextResponse.json({
      documentId,
      documentName: docResult.rows[0].nom,
      indexed: count > 0,
      chunksCount: count,
      lastIndexed: countResult.rows[0].last_indexed,
    })
  } catch (error) {
    console.error('Erreur vérification indexation:', error)
    return NextResponse.json(
      { error: 'Erreur vérification indexation' },
      { status: 500 }
    )
  }
}

// =============================================================================
// UTILITAIRES
// =============================================================================

function getMimeTypeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()

  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    html: 'text/html',
    md: 'text/markdown',
    json: 'application/json',
  }

  return mimeTypes[ext || ''] || 'application/octet-stream'
}
