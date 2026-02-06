'use server'

import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// =============================================================================
// VÉRIFICATION SUPER ADMIN
// =============================================================================

async function checkSuperAdminAccess(): Promise<{ adminId: string } | { error: string }> {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: 'Non authentifié' }
  }

  const result = await query('SELECT id, role FROM users WHERE id = $1', [session.user.id])
  const user = result.rows[0]

  if (!user || user.role !== 'super_admin') {
    return { error: 'Accès réservé aux super administrateurs' }
  }

  return { adminId: user.id }
}

// =============================================================================
// ACTIONS
// =============================================================================

/**
 * Marquer une notification comme lue
 */
export async function markNotificationReadAction(notificationId: string) {
  try {
    const authCheck = await checkSuperAdminAccess()
    if ('error' in authCheck) {
      return { error: authCheck.error }
    }

    await query(
      `UPDATE admin_notifications
       SET is_read = TRUE, read_at = NOW(), read_by = $1
       WHERE id = $2`,
      [authCheck.adminId, notificationId]
    )

    revalidatePath('/super-admin/notifications')
    revalidatePath('/super-admin/dashboard')

    return { success: true }
  } catch (error) {
    console.error('Erreur marquage notification:', error)
    return { error: 'Erreur lors du marquage' }
  }
}

/**
 * Marquer toutes les notifications comme lues
 */
export async function markAllNotificationsReadAction() {
  try {
    const authCheck = await checkSuperAdminAccess()
    if ('error' in authCheck) {
      return { error: authCheck.error }
    }

    const result = await query(
      `UPDATE admin_notifications
       SET is_read = TRUE, read_at = NOW(), read_by = $1
       WHERE is_read = FALSE
       RETURNING id`,
      [authCheck.adminId]
    )

    revalidatePath('/super-admin/notifications')
    revalidatePath('/super-admin/dashboard')

    return { success: true, count: result.rowCount }
  } catch (error) {
    console.error('Erreur marquage notifications:', error)
    return { error: 'Erreur lors du marquage' }
  }
}

/**
 * Supprimer une notification
 */
export async function deleteNotificationAction(notificationId: string) {
  try {
    const authCheck = await checkSuperAdminAccess()
    if ('error' in authCheck) {
      return { error: authCheck.error }
    }

    await query('DELETE FROM admin_notifications WHERE id = $1', [notificationId])

    revalidatePath('/super-admin/notifications')

    return { success: true }
  } catch (error) {
    console.error('Erreur suppression notification:', error)
    return { error: 'Erreur lors de la suppression' }
  }
}

/**
 * Récupérer le nombre de notifications non lues
 */
export async function getUnreadNotificationsCountAction() {
  try {
    const authCheck = await checkSuperAdminAccess()
    if ('error' in authCheck) {
      return { error: authCheck.error }
    }

    const result = await query(
      `SELECT COUNT(*) as count FROM admin_notifications
       WHERE is_read = FALSE AND (expires_at IS NULL OR expires_at > NOW())`
    )

    return { success: true, count: parseInt(result.rows[0]?.count || '0') }
  } catch (error) {
    console.error('Erreur comptage notifications:', error)
    return { error: 'Erreur lors du comptage' }
  }
}
