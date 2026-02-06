/**
 * Activity Logger - Conformité INPDP
 *
 * Enregistre les accès aux données personnelles pour l'audit.
 * Utilisation: await logActivity({ ... })
 */

import { query } from '@/lib/db/postgres'
import { headers } from 'next/headers'

export type ActivityAction =
  // Sessions
  | 'login'
  | 'logout'
  | 'login_failed'
  // Clients
  | 'client_view'
  | 'client_create'
  | 'client_update'
  | 'client_delete'
  // Dossiers
  | 'dossier_view'
  | 'dossier_create'
  | 'dossier_update'
  | 'dossier_delete'
  // Documents
  | 'document_view'
  | 'document_upload'
  | 'document_download'
  | 'document_delete'
  // Factures
  | 'facture_view'
  | 'facture_create'
  | 'facture_update'
  | 'facture_pdf_generate'
  // Exports
  | 'export_clients'
  | 'export_dossiers'
  | 'export_factures'

export type ResourceType =
  | 'client'
  | 'dossier'
  | 'document'
  | 'facture'
  | 'session'
  | 'export'

export interface ActivityLogParams {
  userId: string
  userEmail: string
  action: ActivityAction
  resourceType: ResourceType
  resourceId?: string
  resourceLabel?: string
  details?: Record<string, unknown>
}

/**
 * Enregistre une activité utilisateur pour l'audit INPDP
 */
export async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    // Récupérer les infos de connexion (peut échouer pendant le build)
    let ipAddress = 'unknown'
    let userAgent = 'unknown'

    try {
      const headersList = await headers()
      ipAddress =
        headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headersList.get('x-real-ip') ||
        'unknown'
      userAgent = headersList.get('user-agent') || 'unknown'
    } catch {
      // headers() indisponible (build statique ou contexte non-request)
    }

    await query(
      `INSERT INTO user_activity_logs (
        user_id, user_email, action, resource_type,
        resource_id, resource_label, details,
        ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        params.userId,
        params.userEmail,
        params.action,
        params.resourceType,
        params.resourceId || null,
        params.resourceLabel || null,
        params.details ? JSON.stringify(params.details) : null,
        ipAddress,
        userAgent,
      ]
    )
  } catch (error) {
    // Ne pas bloquer l'action principale si le log échoue
    console.error('[ActivityLogger] Erreur:', error)
  }
}

/**
 * Enregistre un accès à un client (INPDP - données personnelles)
 */
export async function logClientAccess(
  userId: string,
  userEmail: string,
  action: 'client_view' | 'client_create' | 'client_update' | 'client_delete',
  clientId: string,
  clientName: string
): Promise<void> {
  await logActivity({
    userId,
    userEmail,
    action,
    resourceType: 'client',
    resourceId: clientId,
    resourceLabel: clientName,
  })
}

/**
 * Enregistre un accès à un dossier
 */
export async function logDossierAccess(
  userId: string,
  userEmail: string,
  action: 'dossier_view' | 'dossier_create' | 'dossier_update' | 'dossier_delete',
  dossierId: string,
  dossierRef: string
): Promise<void> {
  await logActivity({
    userId,
    userEmail,
    action,
    resourceType: 'dossier',
    resourceId: dossierId,
    resourceLabel: dossierRef,
  })
}

/**
 * Enregistre une connexion réussie
 */
export async function logLogin(userId: string, userEmail: string): Promise<void> {
  await logActivity({
    userId,
    userEmail,
    action: 'login',
    resourceType: 'session',
  })
}

/**
 * Enregistre une tentative de connexion échouée
 */
export async function logLoginFailed(email: string): Promise<void> {
  await logActivity({
    userId: '00000000-0000-0000-0000-000000000000', // UUID fictif pour les échecs
    userEmail: email,
    action: 'login_failed',
    resourceType: 'session',
  })
}

/**
 * Enregistre un export de données (INPDP - traçabilité)
 */
export async function logExport(
  userId: string,
  userEmail: string,
  exportType: 'export_clients' | 'export_dossiers' | 'export_factures',
  count: number
): Promise<void> {
  await logActivity({
    userId,
    userEmail,
    action: exportType,
    resourceType: 'export',
    details: { count, timestamp: new Date().toISOString() },
  })
}
