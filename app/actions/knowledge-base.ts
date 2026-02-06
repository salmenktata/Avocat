'use server'

import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// Import dynamique pour éviter les problèmes avec pdf-parse
async function getKnowledgeBaseService() {
  return await import('@/lib/ai/knowledge-base-service')
}

export type KnowledgeBaseCategory =
  | 'jurisprudence'
  | 'code'
  | 'doctrine'
  | 'modele'
  | 'autre'

export type KnowledgeBaseLanguage = 'ar' | 'fr'

// =============================================================================
// VÉRIFICATION ADMIN
// =============================================================================

async function checkAdminAccess(): Promise<{ userId: string } | { error: string }> {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: 'Non authentifié' }
  }

  const result = await query('SELECT role FROM users WHERE id = $1', [session.user.id])
  const role = result.rows[0]?.role

  // Accepter admin ou super_admin
  if (role !== 'admin' && role !== 'super_admin') {
    return { error: 'Accès réservé aux administrateurs' }
  }

  return { userId: session.user.id }
}

// =============================================================================
// ACTIONS
// =============================================================================

/**
 * Upload un document à la base de connaissances
 */
export async function uploadKnowledgeDocumentAction(formData: FormData) {
  try {
    const authCheck = await checkAdminAccess()
    if ('error' in authCheck) {
      return { error: authCheck.error }
    }

    const category = formData.get('category') as KnowledgeBaseCategory
    const language = (formData.get('language') as KnowledgeBaseLanguage) || 'ar'
    const title = formData.get('title') as string
    const description = formData.get('description') as string | null
    const autoIndex = formData.get('autoIndex') !== 'false'
    const metadataStr = formData.get('metadata') as string | null
    const file = formData.get('file') as File | null
    const text = formData.get('text') as string | null

    // Validation
    if (!category || !title) {
      return { error: 'Catégorie et titre requis' }
    }

    const validLanguages: KnowledgeBaseLanguage[] = ['ar', 'fr']
    if (!validLanguages.includes(language)) {
      return { error: 'Langue invalide' }
    }

    const validCategories: KnowledgeBaseCategory[] = [
      'jurisprudence',
      'code',
      'doctrine',
      'modele',
      'autre',
    ]
    if (!validCategories.includes(category)) {
      return { error: `Catégorie invalide` }
    }

    if (!file && !text) {
      return { error: 'Un fichier ou un texte est requis' }
    }

    // Préparer le fichier si présent
    let fileData: { buffer: Buffer; filename: string; mimeType: string } | undefined
    if (file) {
      const arrayBuffer = await file.arrayBuffer()
      fileData = {
        buffer: Buffer.from(arrayBuffer),
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
      }
    }

    // Parser les métadonnées
    let metadata: Record<string, unknown> = {}
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr)
      } catch {
        // Ignorer erreur parsing
      }
    }

    // Upload (import dynamique)
    const { uploadKnowledgeDocument } = await getKnowledgeBaseService()
    const document = await uploadKnowledgeDocument(
      {
        category,
        language,
        title,
        description: description || undefined,
        metadata,
        file: fileData,
        text: text || undefined,
        autoIndex,
      },
      authCheck.userId
    )

    revalidatePath('/parametres/base-connaissances')

    return {
      success: true,
      document: {
        id: document.id,
        title: document.title,
        category: document.category,
        isIndexed: document.isIndexed,
      },
    }
  } catch (error) {
    console.error('Erreur upload knowledge document:', error)
    return {
      error: error instanceof Error ? error.message : 'Erreur lors de l\'upload',
    }
  }
}

/**
 * Indexer un document
 */
export async function indexKnowledgeDocumentAction(documentId: string) {
  try {
    const authCheck = await checkAdminAccess()
    if ('error' in authCheck) {
      return { error: authCheck.error }
    }

    const { indexKnowledgeDocument } = await getKnowledgeBaseService()
    const result = await indexKnowledgeDocument(documentId)

    if (!result.success) {
      return { error: result.error || 'Erreur indexation' }
    }

    revalidatePath('/parametres/base-connaissances')

    return {
      success: true,
      chunksCreated: result.chunksCreated,
    }
  } catch (error) {
    console.error('Erreur indexation:', error)
    return {
      error: error instanceof Error ? error.message : 'Erreur indexation',
    }
  }
}

/**
 * Supprimer un document
 */
export async function deleteKnowledgeDocumentAction(documentId: string) {
  try {
    const authCheck = await checkAdminAccess()
    if ('error' in authCheck) {
      return { error: authCheck.error }
    }

    const { deleteKnowledgeDocument } = await getKnowledgeBaseService()
    const deleted = await deleteKnowledgeDocument(documentId)

    if (!deleted) {
      return { error: 'Document non trouvé' }
    }

    revalidatePath('/parametres/base-connaissances')

    return { success: true }
  } catch (error) {
    console.error('Erreur suppression:', error)
    return {
      error: error instanceof Error ? error.message : 'Erreur suppression',
    }
  }
}

/**
 * Mettre à jour un document
 */
export async function updateKnowledgeDocumentAction(
  documentId: string,
  data: {
    title?: string
    description?: string
    category?: KnowledgeBaseCategory
    metadata?: Record<string, unknown>
  }
) {
  try {
    const authCheck = await checkAdminAccess()
    if ('error' in authCheck) {
      return { error: authCheck.error }
    }

    const { updateKnowledgeDocument } = await getKnowledgeBaseService()
    const document = await updateKnowledgeDocument(documentId, data)

    if (!document) {
      return { error: 'Document non trouvé' }
    }

    revalidatePath('/parametres/base-connaissances')

    return { success: true, document }
  } catch (error) {
    console.error('Erreur mise à jour:', error)
    return {
      error: error instanceof Error ? error.message : 'Erreur mise à jour',
    }
  }
}

/**
 * Récupérer les statistiques
 */
export async function getKnowledgeBaseStatsAction() {
  try {
    const authCheck = await checkAdminAccess()
    if ('error' in authCheck) {
      return { error: authCheck.error }
    }

    const { getKnowledgeBaseStats } = await getKnowledgeBaseService()
    const stats = await getKnowledgeBaseStats()

    return { success: true, stats }
  } catch (error) {
    console.error('Erreur stats:', error)
    return {
      error: error instanceof Error ? error.message : 'Erreur récupération stats',
    }
  }
}

/**
 * Lister les documents
 */
export async function listKnowledgeDocumentsAction(options: {
  category?: KnowledgeBaseCategory
  isIndexed?: boolean
  search?: string
  limit?: number
  offset?: number
}) {
  try {
    const authCheck = await checkAdminAccess()
    if ('error' in authCheck) {
      return { error: authCheck.error }
    }

    const { listKnowledgeDocuments } = await getKnowledgeBaseService()
    const result = await listKnowledgeDocuments(options)

    return {
      success: true,
      documents: result.documents,
      total: result.total,
    }
  } catch (error) {
    console.error('Erreur liste:', error)
    return {
      error: error instanceof Error ? error.message : 'Erreur récupération liste',
    }
  }
}
