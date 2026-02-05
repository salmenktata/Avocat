/**
 * WhatsApp Message Logger
 * Gère l'historique et le cache des messages/médias WhatsApp
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type WhatsAppMessage = Database['public']['Tables']['whatsapp_messages']['Insert']
type WhatsAppMediaCache = Database['public']['Tables']['whatsapp_media_cache']['Insert']

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
  supabase: SupabaseClient<Database>,
  params: LogMessageParams
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert({
        whatsapp_message_id: params.whatsappMessageId,
        from_phone: params.fromPhone,
        to_phone: params.toPhone,
        client_id: params.clientId || null,
        user_id: params.userId || null,
        message_type: params.messageType,
        message_body: params.messageBody || null,
        media_id: params.mediaId || null,
        media_mime_type: params.mediaMimeType || null,
        media_file_name: params.mediaFileName || null,
        media_file_size: params.mediaFileSize || null,
        processing_status: 'received',
      } satisfies WhatsAppMessage)
      .select('id')
      .single()

    if (error) {
      console.error('[WhatsApp Logger] Erreur log message:', error)
      return null
    }

    console.log('[WhatsApp Logger] Message loggé:', data.id)
    return data.id
  } catch (error: any) {
    console.error('[WhatsApp Logger] Erreur inattendue log message:', error)
    return null
  }
}

/**
 * Met à jour le statut d'un message WhatsApp
 */
export async function updateMessageStatus(
  supabase: SupabaseClient<Database>,
  params: UpdateMessageStatusParams
): Promise<boolean> {
  try {
    const updateData: any = {
      processing_status: params.status,
    }

    if (params.mediaUrl) updateData.media_url = params.mediaUrl
    if (params.mediaExpiresAt) updateData.media_expires_at = params.mediaExpiresAt.toISOString()
    if (params.documentId) updateData.document_id = params.documentId
    if (params.pendingDocumentId) updateData.pending_document_id = params.pendingDocumentId
    if (params.errorMessage) updateData.error_message = params.errorMessage
    if (params.processedAt) updateData.processed_at = params.processedAt.toISOString()

    const { error } = await supabase
      .from('whatsapp_messages')
      .update(updateData)
      .eq('whatsapp_message_id', params.whatsappMessageId)

    if (error) {
      console.error('[WhatsApp Logger] Erreur update status:', error)
      return false
    }

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
  supabase: SupabaseClient<Database>,
  params: CheckMediaCacheParams
): Promise<{
  cached: boolean
  storageUrl?: string
  isExpired?: boolean
}> {
  try {
    const { data, error } = await supabase
      .from('whatsapp_media_cache')
      .select('storage_url, is_expired')
      .eq('media_id', params.mediaId)
      .single()

    if (error || !data) {
      return { cached: false }
    }

    // Mettre à jour last_accessed_at
    await supabase
      .from('whatsapp_media_cache')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('media_id', params.mediaId)

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
  supabase: SupabaseClient<Database>,
  params: SaveMediaCacheParams
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('whatsapp_media_cache')
      .insert({
        media_id: params.mediaId,
        whatsapp_message_id: params.whatsappMessageId,
        mime_type: params.mimeType,
        file_name: params.fileName || null,
        file_size: params.fileSize || null,
        storage_bucket: params.storageBucket,
        storage_path: params.storagePath,
        storage_url: params.storageUrl,
        whatsapp_url_expires_at: params.whatsappUrlExpiresAt.toISOString(),
      } satisfies WhatsAppMediaCache)

    if (error) {
      console.error('[WhatsApp Logger] Erreur save cache:', error)
      return false
    }

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
  supabase: SupabaseClient<Database>,
  whatsappMessageId: string,
  clientId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('whatsapp_messages')
      .update({
        client_id: clientId,
        user_id: userId,
      })
      .eq('whatsapp_message_id', whatsappMessageId)

    if (error) {
      console.error('[WhatsApp Logger] Erreur update client:', error)
      return false
    }

    console.log('[WhatsApp Logger] Client associé au message:', clientId)
    return true
  } catch (error: any) {
    console.error('[WhatsApp Logger] Erreur inattendue update client:', error)
    return false
  }
}
