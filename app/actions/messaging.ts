/**
 * Actions Serveur - Configuration Messagerie & Documents en Attente
 *
 * Gestion configuration WhatsApp Business et traitement documents en attente
 */

'use server'

import { revalidatePath } from 'next/cache'
import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { z } from 'zod'
import { createStorageManager } from '@/lib/integrations/storage-manager'

// ============================================================================
// HELPER - VÉRIFICATION SUPER ADMIN
// ============================================================================

async function checkSuperAdminAccess() {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: 'Non authentifié' }
  }

  const result = await query('SELECT role FROM users WHERE id = $1', [session.user.id])
  if (result.rows[0]?.role !== 'super_admin') {
    return { error: 'Accès réservé aux super administrateurs' }
  }

  return { userId: session.user.id }
}

// ============================================================================
// SCHEMAS VALIDATION
// ============================================================================

const whatsappConfigSchema = z.object({
  phoneNumber: z.string().min(1, 'Numéro de téléphone requis'),
  phoneNumberId: z.string().min(1, 'Phone Number ID requis'),
  businessAccountId: z.string().min(1, 'Business Account ID requis'),
  accessToken: z.string().min(1, 'Access Token requis'),
  webhookVerifyToken: z.string().min(20, 'Webhook Verify Token doit contenir au moins 20 caractères'),
  autoAttachDocuments: z.boolean().default(true),
  requireConfirmation: z.boolean().default(false),
  sendConfirmation: z.boolean().default(true),
  enabled: z.boolean().default(true),
})

type WhatsAppConfigInput = z.infer<typeof whatsappConfigSchema>

const attachPendingDocumentSchema = z.object({
  pendingDocumentId: z.string().uuid('ID document invalide'),
  dossierId: z.string().uuid('ID dossier invalide'),
})

const rejectPendingDocumentSchema = z.object({
  pendingDocumentId: z.string().uuid('ID document invalide'),
})

// ============================================================================
// ACTIONS CONFIGURATION WHATSAPP
// ============================================================================

/**
 * Récupérer configuration messagerie (super admin only)
 */
export async function getMessagingConfigAction() {
  try {
    const access = await checkSuperAdminAccess()
    if ('error' in access) {
      return { error: access.error }
    }
    const userId = access.userId

    const result = await query(
      `SELECT * FROM messaging_webhooks_config
       WHERE user_id = $1 AND platform = $2
       LIMIT 1`,
      [userId, 'whatsapp']
    )

    return { data: result.rows[0] || null }
  } catch (error: any) {
    console.error('[getMessagingConfigAction] Exception:', error)
    return { error: error.message || 'Erreur interne serveur' }
  }
}

/**
 * Sauvegarder/Mettre à jour configuration WhatsApp Business (super admin only)
 */
export async function saveWhatsAppConfigAction(input: WhatsAppConfigInput) {
  try {
    const access = await checkSuperAdminAccess()
    if ('error' in access) {
      return { error: access.error }
    }
    const userId = access.userId

    // Valider input
    const validated = whatsappConfigSchema.parse(input)

    // Vérifier si config existe déjà
    const existing = await query(
      `SELECT id FROM messaging_webhooks_config
       WHERE user_id = $1 AND platform = $2
       LIMIT 1`,
      [userId, 'whatsapp']
    )

    if (existing.rows.length > 0) {
      // Mettre à jour config existante
      const result = await query(
        `UPDATE messaging_webhooks_config SET
          phone_number = $1,
          business_account_id = $2,
          phone_number_id = $3,
          access_token = $4,
          webhook_verify_token = $5,
          auto_attach_documents = $6,
          require_confirmation = $7,
          send_confirmation = $8,
          enabled = $9,
          updated_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [
          validated.phoneNumber,
          validated.businessAccountId,
          validated.phoneNumberId,
          validated.accessToken,
          validated.webhookVerifyToken,
          validated.autoAttachDocuments,
          validated.requireConfirmation,
          validated.sendConfirmation,
          validated.enabled,
          existing.rows[0].id,
        ]
      )

      revalidatePath('/super-admin/settings/messagerie')

      return {
        success: true,
        data: result.rows[0],
        message: 'Configuration mise à jour avec succès',
      }
    } else {
      // Créer nouvelle config
      const result = await query(
        `INSERT INTO messaging_webhooks_config (
          user_id, platform, phone_number, phone_number_id,
          business_account_id, access_token, webhook_verify_token,
          auto_attach_documents, require_confirmation, send_confirmation, enabled
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          userId,
          'whatsapp',
          validated.phoneNumber,
          validated.phoneNumberId,
          validated.businessAccountId,
          validated.accessToken,
          validated.webhookVerifyToken,
          validated.autoAttachDocuments,
          validated.requireConfirmation,
          validated.sendConfirmation,
          validated.enabled,
        ]
      )

      revalidatePath('/super-admin/settings/messagerie')

      return {
        success: true,
        data: result.rows[0],
        message: 'Configuration créée avec succès',
      }
    }
  } catch (error: any) {
    console.error('[saveWhatsAppConfigAction] Exception:', error)

    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message }
    }

    return { error: error.message || 'Erreur interne serveur' }
  }
}

/**
 * Désactiver configuration WhatsApp (super admin only)
 */
export async function disableWhatsAppConfigAction() {
  try {
    const access = await checkSuperAdminAccess()
    if ('error' in access) {
      return { error: access.error }
    }
    const userId = access.userId

    await query(
      `UPDATE messaging_webhooks_config SET
        enabled = false,
        updated_at = NOW()
       WHERE user_id = $1 AND platform = $2`,
      [userId, 'whatsapp']
    )

    revalidatePath('/super-admin/settings/messagerie')

    return {
      success: true,
      message: 'Configuration désactivée avec succès',
    }
  } catch (error: any) {
    console.error('[disableWhatsAppConfigAction] Exception:', error)
    return { error: error.message || 'Erreur interne serveur' }
  }
}

/**
 * Supprimer configuration WhatsApp
 */
export async function deleteWhatsAppConfigAction() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }
    const userId = session.user.id

    await query(
      `DELETE FROM messaging_webhooks_config
       WHERE user_id = $1 AND platform = $2`,
      [userId, 'whatsapp']
    )

    revalidatePath('/parametres/messagerie')

    return {
      success: true,
      message: 'Configuration supprimée avec succès',
    }
  } catch (error: any) {
    console.error('[deleteWhatsAppConfigAction] Exception:', error)
    return { error: error.message || 'Erreur interne serveur' }
  }
}

// ============================================================================
// ACTIONS DOCUMENTS EN ATTENTE
// ============================================================================

/**
 * Récupérer tous les documents en attente de rattachement
 */
export async function getPendingDocumentsAction() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }
    const userId = session.user.id

    const result = await query(
      `SELECT pd.*,
              json_build_object(
                'id', c.id,
                'type_client', c.type_client,
                'nom', c.nom,
                'prenom', c.prenom,
                'telephone', c.telephone
              ) as clients
       FROM pending_documents pd
       LEFT JOIN clients c ON pd.client_id = c.id
       WHERE pd.user_id = $1 AND pd.status = $2
       ORDER BY pd.received_at DESC`,
      [userId, 'pending']
    )

    return { data: result.rows }
  } catch (error: any) {
    console.error('[getPendingDocumentsAction] Exception:', error)
    return { error: error.message || 'Erreur interne serveur' }
  }
}

/**
 * Rattacher un document en attente à un dossier
 * Upload vers Google Drive et création entrée dans documents
 */
export async function attachPendingDocumentAction(
  pendingDocumentId: string,
  dossierId: string
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }
    const userId = session.user.id

    // Valider input
    const validated = attachPendingDocumentSchema.parse({
      pendingDocumentId,
      dossierId,
    })

    // Récupérer document en attente
    const pendingDocResult = await query(
      `SELECT * FROM pending_documents
       WHERE id = $1 AND user_id = $2 AND status = $3
       LIMIT 1`,
      [validated.pendingDocumentId, userId, 'pending']
    )

    if (pendingDocResult.rows.length === 0) {
      console.error('[attachPendingDocumentAction] Document non trouvé')
      return { error: 'Document en attente non trouvé' }
    }

    const pendingDoc = pendingDocResult.rows[0]

    // Vérifier que le dossier appartient à l'utilisateur
    const dossierResult = await query(
      `SELECT id, client_id, numero FROM dossiers
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [validated.dossierId, userId]
    )

    if (dossierResult.rows.length === 0) {
      console.error('[attachPendingDocumentAction] Dossier non trouvé')
      return { error: 'Dossier non trouvé' }
    }

    const dossier = dossierResult.rows[0]

    // Vérifier cohérence client (si pending_doc a un client_id)
    if (pendingDoc.client_id && pendingDoc.client_id !== dossier.client_id) {
      return {
        error: 'Ce dossier n\'appartient pas au client associé au document',
      }
    }

    if (!pendingDoc.external_file_id) {
      return {
        error: 'Le fichier n\'est plus disponible (média WhatsApp expiré). Demandez au client de renvoyer le document.',
      }
    }

    // Créer entrée dans documents (le fichier est déjà sur Google Drive)
    const documentResult = await query(
      `INSERT INTO documents (
        user_id, dossier_id, nom_fichier, type_fichier, taille_fichier,
        storage_provider, external_file_id, external_sharing_link,
        source_type, source_metadata, needs_classification, classified_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING *`,
      [
        userId,
        validated.dossierId,
        pendingDoc.file_name,
        pendingDoc.file_type,
        pendingDoc.file_size,
        pendingDoc.storage_provider,
        pendingDoc.external_file_id,
        '',
        pendingDoc.source_type,
        JSON.stringify({
          sender_phone: pendingDoc.sender_phone,
          sender_name: pendingDoc.sender_name,
          message_id: pendingDoc.message_id,
          received_at: pendingDoc.received_at,
        }),
        false,
      ]
    )

    const document = documentResult.rows[0]

    // Marquer pending_document comme attached
    await query(
      `UPDATE pending_documents SET
        status = $1,
        attached_to_dossier_id = $2,
        resolved_at = NOW(),
        updated_at = NOW()
       WHERE id = $3`,
      ['attached', validated.dossierId, validated.pendingDocumentId]
    )

    revalidatePath('/dashboard')
    revalidatePath(`/dossiers/${validated.dossierId}`)

    return {
      success: true,
      data: document,
      message: `Document rattaché au dossier ${dossier.numero} avec succès`,
    }
  } catch (error: any) {
    console.error('[attachPendingDocumentAction] Exception:', error)

    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message }
    }

    return { error: error.message || 'Erreur interne serveur' }
  }
}

/**
 * Rejeter un document en attente (marquer comme rejeté)
 */
export async function rejectPendingDocumentAction(pendingDocumentId: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }
    const userId = session.user.id

    // Valider input
    const validated = rejectPendingDocumentSchema.parse({ pendingDocumentId })

    // Marquer comme rejected
    await query(
      `UPDATE pending_documents SET
        status = $1,
        resolved_at = NOW(),
        updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      ['rejected', validated.pendingDocumentId, userId]
    )

    // TODO : Supprimer fichier temporaire de Google Drive si external_file_id existe

    revalidatePath('/dashboard')

    return {
      success: true,
      message: 'Document rejeté avec succès',
    }
  } catch (error: any) {
    console.error('[rejectPendingDocumentAction] Exception:', error)

    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message }
    }

    return { error: error.message || 'Erreur interne serveur' }
  }
}

/**
 * Obtenir statistiques documents en attente
 */
export async function getPendingDocumentsStatsAction() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }
    const userId = session.user.id

    // Compter documents en attente
    const pendingResult = await query(
      `SELECT COUNT(*) as count FROM pending_documents
       WHERE user_id = $1 AND status = $2`,
      [userId, 'pending']
    )

    // Compter documents attachés cette semaine
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const attachedResult = await query(
      `SELECT COUNT(*) as count FROM pending_documents
       WHERE user_id = $1 AND status = $2 AND resolved_at >= $3`,
      [userId, 'attached', oneWeekAgo.toISOString()]
    )

    return {
      data: {
        pending: parseInt(pendingResult.rows[0]?.count || '0'),
        attachedThisWeek: parseInt(attachedResult.rows[0]?.count || '0'),
      },
    }
  } catch (error: any) {
    console.error('[getPendingDocumentsStatsAction] Exception:', error)
    return { error: error.message || 'Erreur interne serveur' }
  }
}

/**
 * Récupérer statistiques WhatsApp sur 30 jours
 */
export async function getWhatsAppStatsAction() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // TODO: Implémenter quand la table whatsapp_messages existera
    // Pour l'instant, retourner des stats vides
    return {
      data: {
        total_messages: 0,
        media_messages: 0,
        documents_created: 0,
        unknown_clients: 0,
        errors: 0,
        last_message_at: null,
      },
    }
  } catch (error: any) {
    console.error('[getWhatsAppStatsAction] Exception:', error)
    return { error: error.message || 'Erreur interne serveur' }
  }
}

/**
 * Récupérer documents WhatsApp en attente de rattachement
 */
export async function getWhatsAppPendingDocsAction() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    const result = await query(
      `SELECT
        pd.id,
        pd.nom_fichier as file_name,
        pd.source as sender_phone,
        pd.statut as status,
        pd.created_at,
        c.id as client_id,
        c.nom as client_nom,
        c.prenom as client_prenom
       FROM pending_documents pd
       LEFT JOIN clients c ON pd.user_id = c.user_id
       WHERE pd.user_id = $1
         AND pd.source = 'whatsapp'
         AND pd.statut = 'pending'
       ORDER BY pd.created_at DESC
       LIMIT 5`,
      [userId]
    )

    return { data: result.rows }
  } catch (error: any) {
    console.error('[getWhatsAppPendingDocsAction] Exception:', error)
    return { error: error.message || 'Erreur interne serveur' }
  }
}
