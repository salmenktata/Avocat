/**
 * WhatsApp Message Logger
 * Gère l'historique et le cache des messages/médias WhatsApp
 */

import { query } from '@/lib/db/postgres'

export interface LogMessageParams {
  whatsappMessageId: string
  fromPhone: string
  toPhone: string
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document'
  messageBody?: string
  mediaId?: string
  mediaMimeType?: string
  mediaFileName?: string
  mediaFileSize?: number
  clientId?: string
  userId?: string
}

export interface UpdateMessageStatusParams {
  whatsappMessageId: string
  status: 'received' | 'media_downloaded' | 'document_created' | 'client_not_found' | 'error'
  mediaUrl?: string
  mediaExpiresAt?: Date
  documentId?: string
  pendingDocumentId?: string
  errorMessage?: string
  processedAt?: Date
}

export interface CheckMediaCacheParams {
  mediaId: string
}

export interface SaveMediaCacheParams {
  mediaId: string
  whatsappMessageId: string
  mimeType: string
  fileName?: string
  fileSize?: number
  storageBucket: string
  storagePath: string
  storageUrl: string
  whatsappUrlExpiresAt: Date
}

/**
 * Crée une entrée initiale dans whatsapp_messages
 */
export async function logIncomingMessage(
  params: LogMessageParams
): Promise<string | null> {
  try {
    const result = await query(
      `INSERT INTO whatsapp_messages (
        whatsapp_message_id, from_phone, to_phone, client_id, user_id,
        message_type, message_body, media_id, media_mime_type,
        media_file_name, media_file_size, processing_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        params.whatsappMessageId,
        params.fromPhone,
        params.toPhone,
        params.clientId || null,
        params.userId || null,
        params.messageType,
        params.messageBody || null,
        params.mediaId || null,
        params.mediaMimeType || null,
        params.mediaFileName || null,
        params.mediaFileSize || null,
        'received'
      ]
    )

    const messageId = result.rows[0]?.id
    console.log('[WhatsApp Logger] Message loggé:', messageId)
    return messageId || null
  } catch (error: any) {
    console.error('[WhatsApp Logger] Erreur inattendue log message:', error)
    return null
  }
}

/**
 * Met à jour le statut d'un message WhatsApp
 */
export async function updateMessageStatus(
  params: UpdateMessageStatusParams
): Promise<boolean> {
  try {
    const updates: string[] = ['processing_status = $1']
    const values: any[] = [params.status]
    let paramIndex = 2

    if (params.mediaUrl) {
      updates.push(`media_url = $${paramIndex}`)
      values.push(params.mediaUrl)
      paramIndex++
    }
    if (params.mediaExpiresAt) {
      updates.push(`media_expires_at = $${paramIndex}`)
      values.push(params.mediaExpiresAt)
      paramIndex++
    }
    if (params.documentId) {
      updates.push(`document_id = $${paramIndex}`)
      values.push(params.documentId)
      paramIndex++
    }
    if (params.pendingDocumentId) {
      updates.push(`pending_document_id = $${paramIndex}`)
      values.push(params.pendingDocumentId)
      paramIndex++
    }
    if (params.errorMessage) {
      updates.push(`error_message = $${paramIndex}`)
      values.push(params.errorMessage)
      paramIndex++
    }
    if (params.processedAt) {
      updates.push(`processed_at = $${paramIndex}`)
      values.push(params.processedAt)
      paramIndex++
    }

    values.push(params.whatsappMessageId)

    await query(
      `UPDATE whatsapp_messages SET ${updates.join(', ')}
       WHERE whatsapp_message_id = $${paramIndex}`,
      values
    )

    console.log('[WhatsApp Logger] Status mis à jour:', params.status)
    return true
  } catch (error: any) {
    console.error('[WhatsApp Logger] Erreur inattendue update status:', error)
    return false
  }
}

/**
 * Vérifie si un média est déjà en cache
 */
export async function checkMediaCache(
  params: CheckMediaCacheParams
): Promise<{
  cached: boolean
  storageUrl?: string
  isExpired?: boolean
}> {
  try {
    const result = await query(
      'SELECT storage_url, is_expired FROM whatsapp_media_cache WHERE media_id = $1',
      [params.mediaId]
    )

    if (result.rows.length === 0) {
      return { cached: false }
    }

    const data = result.rows[0]

    // Mettre à jour last_accessed_at
    await query(
      'UPDATE whatsapp_media_cache SET last_accessed_at = NOW() WHERE media_id = $1',
      [params.mediaId]
    )

    console.log('[WhatsApp Logger] Média trouvé en cache:', {
      mediaId: params.mediaId,
      isExpired: data.is_expired,
    })

    return {
      cached: true,
      storageUrl: data.storage_url,
      isExpired: data.is_expired,
    }
  } catch (error: any) {
    console.error('[WhatsApp Logger] Erreur check cache:', error)
    return { cached: false }
  }
}

/**
 * Sauvegarde un média dans le cache
 */
export async function saveMediaCache(
  params: SaveMediaCacheParams
): Promise<boolean> {
  try {
    await query(
      `INSERT INTO whatsapp_media_cache (
        media_id, whatsapp_message_id, mime_type, file_name, file_size,
        storage_bucket, storage_path, storage_url, whatsapp_url_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        params.mediaId,
        params.whatsappMessageId,
        params.mimeType,
        params.fileName || null,
        params.fileSize || null,
        params.storageBucket,
        params.storagePath,
        params.storageUrl,
        params.whatsappUrlExpiresAt
      ]
    )

    console.log('[WhatsApp Logger] Média sauvegardé en cache:', params.mediaId)
    return true
  } catch (error: any) {
    console.error('[WhatsApp Logger] Erreur inattendue save cache:', error)
    return false
  }
}

/**
 * Met à jour le client_id et user_id d'un message après identification
 */
export async function updateMessageClient(
  whatsappMessageId: string,
  clientId: string,
  userId: string
): Promise<boolean> {
  try {
    await query(
      `UPDATE whatsapp_messages SET client_id = $1, user_id = $2
       WHERE whatsapp_message_id = $3`,
      [clientId, userId, whatsappMessageId]
    )

    console.log('[WhatsApp Logger] Client associé au message:', clientId)
    return true
  } catch (error: any) {
    console.error('[WhatsApp Logger] Erreur inattendue update client:', error)
    return false
  }
}
