/**
 * Service Base de Connaissances - Gestion des documents de référence juridique
 *
 * Ce service gère:
 * - Upload et extraction de texte des documents de référence
 * - Indexation sémantique (chunking + embeddings)
 * - Recherche sémantique dans la base de connaissances
 * - Statistiques et gestion CRUD
 */

import { db } from '@/lib/db/postgres'
import { uploadFile, deleteFile } from '@/lib/storage/minio'
import { aiConfig, isSemanticSearchEnabled } from './config'

// Import dynamique pour éviter les problèmes avec pdf-parse en RSC
async function getDocumentParser() {
  const { extractText, isSupportedMimeType } = await import('./document-parser')
  return { extractText, isSupportedMimeType }
}

async function getChunkingService() {
  const { chunkText } = await import('./chunking-service')
  return { chunkText }
}

async function getEmbeddingsService() {
  const { generateEmbedding, generateEmbeddingsBatch, formatEmbeddingForPostgres } = await import('./embeddings-service')
  return { generateEmbedding, generateEmbeddingsBatch, formatEmbeddingForPostgres }
}

// =============================================================================
// TYPES
// =============================================================================

export type KnowledgeBaseCategory =
  | 'jurisprudence'
  | 'code'
  | 'doctrine'
  | 'modele'
  | 'autre'

export type KnowledgeBaseLanguage = 'ar' | 'fr'

export interface KnowledgeBaseDocument {
  id: string
  category: KnowledgeBaseCategory
  language: KnowledgeBaseLanguage
  title: string
  description: string | null
  metadata: Record<string, unknown>
  sourceFile: string | null
  fullText: string | null
  isIndexed: boolean
  chunkCount?: number
  uploadedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface KnowledgeBaseUploadInput {
  category: KnowledgeBaseCategory
  language: KnowledgeBaseLanguage
  title: string
  description?: string
  metadata?: Record<string, unknown>
  file?: {
    buffer: Buffer
    filename: string
    mimeType: string
  }
  text?: string // Alternative: texte direct
  autoIndex?: boolean
}

export interface KnowledgeBaseSearchResult {
  knowledgeBaseId: string
  chunkId: string
  title: string
  category: KnowledgeBaseCategory
  chunkContent: string
  chunkIndex: number
  similarity: number
  metadata: Record<string, unknown>
}

export interface KnowledgeBaseStats {
  totalDocuments: number
  indexedDocuments: number
  pendingDocuments: number
  totalChunks: number
  byCategory: Record<KnowledgeBaseCategory, number>
}

// =============================================================================
// CONSTANTES
// =============================================================================

export const CATEGORY_LABELS: Record<KnowledgeBaseCategory, string> = {
  jurisprudence: 'Jurisprudence',
  code: 'Code juridique',
  doctrine: 'Doctrine',
  modele: 'Modèle de document',
  autre: 'Autre',
}

const KNOWLEDGE_BASE_BUCKET = 'knowledge-base'

// =============================================================================
// UPLOAD ET CRÉATION
// =============================================================================

/**
 * Uploade un nouveau document dans la base de connaissances
 */
export async function uploadKnowledgeDocument(
  input: KnowledgeBaseUploadInput,
  uploadedBy: string
): Promise<KnowledgeBaseDocument> {
  const {
    category,
    language,
    title,
    description,
    metadata = {},
    file,
    text,
    autoIndex = true,
  } = input

  let fullText: string | null = null
  let sourceFile: string | null = null

  // Extraction du texte
  if (file) {
    const { extractText, isSupportedMimeType } = await getDocumentParser()

    if (!isSupportedMimeType(file.mimeType)) {
      throw new Error(`Type de fichier non supporté: ${file.mimeType}`)
    }

    // Upload vers MinIO
    const filePath = `${category}/${Date.now()}_${file.filename}`
    const uploadResult = await uploadFile(
      file.buffer,
      filePath,
      { category, title },
      KNOWLEDGE_BASE_BUCKET
    )
    sourceFile = uploadResult.path

    // Extraire le texte
    const parseResult = await extractText(file.buffer, file.mimeType)
    fullText = parseResult.text
  } else if (text) {
    fullText = text.trim()
  } else {
    throw new Error('Un fichier ou un texte est requis')
  }

  if (!fullText || fullText.length < 50) {
    throw new Error('Le contenu extrait est trop court (minimum 50 caractères)')
  }

  // Insertion en base
  const result = await db.query(
    `INSERT INTO knowledge_base
     (category, language, title, description, metadata, source_file, full_text, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      category,
      language,
      title,
      description || null,
      JSON.stringify(metadata),
      sourceFile,
      fullText,
      uploadedBy,
    ]
  )

  const doc = mapRowToKnowledgeBase(result.rows[0])

  // Auto-indexation si demandée et service disponible
  if (autoIndex && isSemanticSearchEnabled()) {
    try {
      await indexKnowledgeDocument(doc.id)
    } catch (error) {
      console.error(`Erreur auto-indexation document ${doc.id}:`, error)
      // Continue sans échouer - le document est créé mais pas indexé
    }
  }

  return doc
}

// =============================================================================
// INDEXATION
// =============================================================================

/**
 * Indexe un document de la base de connaissances (génère chunks + embeddings)
 */
export async function indexKnowledgeDocument(documentId: string): Promise<{
  success: boolean
  chunksCreated: number
  error?: string
}> {
  if (!isSemanticSearchEnabled()) {
    return { success: false, chunksCreated: 0, error: 'Service RAG désactivé' }
  }

  // Récupérer le document
  const docResult = await db.query(
    'SELECT * FROM knowledge_base WHERE id = $1',
    [documentId]
  )

  if (docResult.rows.length === 0) {
    return { success: false, chunksCreated: 0, error: 'Document non trouvé' }
  }

  const doc = docResult.rows[0]

  if (!doc.full_text) {
    return { success: false, chunksCreated: 0, error: 'Document sans contenu texte' }
  }

  // Import dynamique des services
  const { chunkText } = await getChunkingService()
  const { generateEmbedding, generateEmbeddingsBatch, formatEmbeddingForPostgres } = await getEmbeddingsService()

  // Découper en chunks
  const chunks = chunkText(doc.full_text, {
    chunkSize: aiConfig.rag.chunkSize,
    overlap: aiConfig.rag.chunkOverlap,
    preserveParagraphs: true,
    preserveSentences: true,
  })

  if (chunks.length === 0) {
    return { success: false, chunksCreated: 0, error: 'Aucun chunk généré' }
  }

  // Générer les embeddings en batch
  const embeddingsResult = await generateEmbeddingsBatch(
    chunks.map((c) => c.content)
  )

  // Générer un embedding pour le document entier (titre + description)
  const docSummary = `${doc.title}. ${doc.description || ''}`
  const docEmbeddingResult = await generateEmbedding(docSummary)

  // Transaction pour insertion
  const client = await db.getClient()

  try {
    await client.query('BEGIN')

    // Supprimer les anciens chunks
    await client.query(
      'DELETE FROM knowledge_base_chunks WHERE knowledge_base_id = $1',
      [documentId]
    )

    // Insérer les nouveaux chunks
    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        `INSERT INTO knowledge_base_chunks
         (knowledge_base_id, chunk_index, content, embedding, metadata)
         VALUES ($1, $2, $3, $4::vector, $5)`,
        [
          documentId,
          chunks[i].index,
          chunks[i].content,
          formatEmbeddingForPostgres(embeddingsResult.embeddings[i]),
          JSON.stringify({
            wordCount: chunks[i].metadata.wordCount,
            charCount: chunks[i].metadata.charCount,
          }),
        ]
      )
    }

    // Mettre à jour le document avec son embedding et marquer comme indexé
    await client.query(
      `UPDATE knowledge_base
       SET embedding = $1::vector, is_indexed = true, updated_at = NOW()
       WHERE id = $2`,
      [formatEmbeddingForPostgres(docEmbeddingResult.embedding), documentId]
    )

    await client.query('COMMIT')

    return { success: true, chunksCreated: chunks.length }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Réindexe tous les documents non indexés
 */
export async function indexPendingDocuments(limit: number = 10): Promise<{
  processed: number
  succeeded: number
  failed: number
  results: Array<{ id: string; title: string; success: boolean; error?: string }>
}> {
  const pendingResult = await db.query(
    `SELECT id, title FROM knowledge_base
     WHERE is_indexed = false AND full_text IS NOT NULL
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  )

  const results: Array<{ id: string; title: string; success: boolean; error?: string }> = []

  for (const row of pendingResult.rows) {
    try {
      const indexResult = await indexKnowledgeDocument(row.id)
      results.push({
        id: row.id,
        title: row.title,
        success: indexResult.success,
        error: indexResult.error,
      })
    } catch (error) {
      results.push({
        id: row.id,
        title: row.title,
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      })
    }
  }

  return {
    processed: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  }
}

// =============================================================================
// RECHERCHE
// =============================================================================

/**
 * Recherche sémantique dans la base de connaissances
 */
export async function searchKnowledgeBase(
  query: string,
  options: {
    category?: KnowledgeBaseCategory
    limit?: number
    threshold?: number
  } = {}
): Promise<KnowledgeBaseSearchResult[]> {
  if (!isSemanticSearchEnabled()) {
    return []
  }

  const {
    category,
    limit = aiConfig.rag.maxResults,
    threshold = aiConfig.rag.similarityThreshold - 0.05, // Seuil légèrement plus bas
  } = options

  // Import dynamique des services
  const { generateEmbedding, formatEmbeddingForPostgres } = await getEmbeddingsService()

  // Générer l'embedding de la requête
  const queryEmbedding = await generateEmbedding(query)
  const embeddingStr = formatEmbeddingForPostgres(queryEmbedding.embedding)

  // Recherche via la fonction SQL
  const result = await db.query(
    `SELECT * FROM search_knowledge_base($1::vector, $2, $3, $4)`,
    [embeddingStr, category || null, limit, threshold]
  )

  return result.rows.map((row) => ({
    knowledgeBaseId: row.knowledge_base_id,
    chunkId: row.chunk_id,
    title: row.title,
    category: row.category as KnowledgeBaseCategory,
    chunkContent: row.chunk_content,
    chunkIndex: row.chunk_index,
    similarity: parseFloat(row.similarity),
    metadata: row.metadata || {},
  }))
}

/**
 * Recherche full-text simple (fallback sans embeddings)
 */
export async function searchKnowledgeBaseFulltext(
  query: string,
  options: {
    category?: KnowledgeBaseCategory
    limit?: number
  } = {}
): Promise<KnowledgeBaseDocument[]> {
  const { category, limit = 10 } = options

  let sql = `
    SELECT kb.*, COUNT(kbc.id) as chunk_count
    FROM knowledge_base kb
    LEFT JOIN knowledge_base_chunks kbc ON kb.id = kbc.knowledge_base_id
    WHERE to_tsvector('french', COALESCE(kb.title, '') || ' ' || COALESCE(kb.description, '') || ' ' || COALESCE(kb.full_text, ''))
          @@ plainto_tsquery('french', $1)
  `
  const params: (string | number)[] = [query]

  if (category) {
    sql += ` AND kb.category = $2`
    params.push(category)
  }

  sql += ` GROUP BY kb.id ORDER BY kb.created_at DESC LIMIT $${params.length + 1}`
  params.push(limit)

  const result = await db.query(sql, params)
  return result.rows.map(mapRowToKnowledgeBase)
}

// =============================================================================
// CRUD
// =============================================================================

/**
 * Liste tous les documents de la base de connaissances
 */
export async function listKnowledgeDocuments(options: {
  category?: KnowledgeBaseCategory
  isIndexed?: boolean
  search?: string
  limit?: number
  offset?: number
}): Promise<{ documents: KnowledgeBaseDocument[]; total: number }> {
  const { category, isIndexed, search, limit = 50, offset = 0 } = options

  let whereClause = 'WHERE 1=1'
  const params: (string | number | boolean)[] = []
  let paramIndex = 1

  if (category) {
    whereClause += ` AND kb.category = $${paramIndex++}`
    params.push(category)
  }

  if (isIndexed !== undefined) {
    whereClause += ` AND kb.is_indexed = $${paramIndex++}`
    params.push(isIndexed)
  }

  if (search) {
    whereClause += ` AND (
      kb.title ILIKE $${paramIndex} OR
      kb.description ILIKE $${paramIndex}
    )`
    params.push(`%${search}%`)
    paramIndex++
  }

  // Compter le total
  const countResult = await db.query(
    `SELECT COUNT(*) FROM knowledge_base kb ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0].count)

  // Récupérer les documents avec chunk_count
  const sql = `
    SELECT kb.*, COUNT(kbc.id) as chunk_count
    FROM knowledge_base kb
    LEFT JOIN knowledge_base_chunks kbc ON kb.id = kbc.knowledge_base_id
    ${whereClause}
    GROUP BY kb.id
    ORDER BY kb.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `
  params.push(limit, offset)

  const result = await db.query(sql, params)

  return {
    documents: result.rows.map(mapRowToKnowledgeBase),
    total,
  }
}

/**
 * Récupère un document par son ID
 */
export async function getKnowledgeDocument(
  documentId: string
): Promise<KnowledgeBaseDocument | null> {
  const result = await db.query(
    `SELECT kb.*, COUNT(kbc.id) as chunk_count
     FROM knowledge_base kb
     LEFT JOIN knowledge_base_chunks kbc ON kb.id = kbc.knowledge_base_id
     WHERE kb.id = $1
     GROUP BY kb.id`,
    [documentId]
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToKnowledgeBase(result.rows[0])
}

/**
 * Met à jour un document
 */
export async function updateKnowledgeDocument(
  documentId: string,
  updates: {
    title?: string
    description?: string
    category?: KnowledgeBaseCategory
    metadata?: Record<string, unknown>
  }
): Promise<KnowledgeBaseDocument | null> {
  const setClauses: string[] = []
  const params: (string | Record<string, unknown>)[] = []
  let paramIndex = 1

  if (updates.title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`)
    params.push(updates.title)
  }

  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`)
    params.push(updates.description)
  }

  if (updates.category !== undefined) {
    setClauses.push(`category = $${paramIndex++}`)
    params.push(updates.category)
  }

  if (updates.metadata !== undefined) {
    setClauses.push(`metadata = $${paramIndex++}`)
    params.push(JSON.stringify(updates.metadata))
  }

  if (setClauses.length === 0) {
    return getKnowledgeDocument(documentId)
  }

  setClauses.push('updated_at = NOW()')
  params.push(documentId)

  const result = await db.query(
    `UPDATE knowledge_base SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRowToKnowledgeBase(result.rows[0])
}

/**
 * Supprime un document et ses chunks
 */
export async function deleteKnowledgeDocument(documentId: string): Promise<boolean> {
  // Récupérer le chemin du fichier pour le supprimer de MinIO
  const docResult = await db.query(
    'SELECT source_file FROM knowledge_base WHERE id = $1',
    [documentId]
  )

  if (docResult.rows.length === 0) {
    return false
  }

  const sourceFile = docResult.rows[0].source_file

  // Supprimer en base (les chunks seront supprimés par CASCADE)
  const deleteResult = await db.query(
    'DELETE FROM knowledge_base WHERE id = $1',
    [documentId]
  )

  if ((deleteResult.rowCount || 0) === 0) {
    return false
  }

  // Supprimer le fichier de MinIO si présent
  if (sourceFile) {
    try {
      await deleteFile(sourceFile, KNOWLEDGE_BASE_BUCKET)
    } catch (error) {
      console.error(`Erreur suppression fichier MinIO ${sourceFile}:`, error)
      // Continue sans échouer
    }
  }

  return true
}

// =============================================================================
// STATISTIQUES
// =============================================================================

/**
 * Récupère les statistiques de la base de connaissances
 */
export async function getKnowledgeBaseStats(): Promise<KnowledgeBaseStats> {
  const result = await db.query('SELECT * FROM get_knowledge_base_stats()')
  const row = result.rows[0]

  return {
    totalDocuments: parseInt(row.total_documents) || 0,
    indexedDocuments: parseInt(row.indexed_documents) || 0,
    pendingDocuments:
      (parseInt(row.total_documents) || 0) - (parseInt(row.indexed_documents) || 0),
    totalChunks: parseInt(row.total_chunks) || 0,
    byCategory: row.by_category || {
      jurisprudence: 0,
      code: 0,
      doctrine: 0,
      modele: 0,
      autre: 0,
    },
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function mapRowToKnowledgeBase(row: Record<string, unknown>): KnowledgeBaseDocument {
  return {
    id: row.id as string,
    category: row.category as KnowledgeBaseCategory,
    language: (row.language as KnowledgeBaseLanguage) || 'ar',
    title: row.title as string,
    description: row.description as string | null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    sourceFile: row.source_file as string | null,
    fullText: row.full_text as string | null,
    isIndexed: row.is_indexed as boolean,
    chunkCount: row.chunk_count ? parseInt(row.chunk_count as string) : undefined,
    uploadedBy: row.uploaded_by as string | null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}
