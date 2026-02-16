'use server'

import { query } from '@/lib/db/postgres'
import { getSession, startImpersonation, stopImpersonation, getImpersonationStatus } from '@/lib/auth/session'
import { headers } from 'next/headers'

// =============================================================================
// VÉRIFICATION SUPER ADMIN
// =============================================================================

async function checkSuperAdminAccess(): Promise<{ adminId: string; adminEmail: string } | { error: string }> {
  // En impersonation, vérifier l'admin original (pas l'utilisateur impersoné)
  const impersonation = await getImpersonationStatus()
  if (impersonation.isImpersonating && impersonation.originalAdmin) {
    const result = await query('SELECT id, email, role FROM users WHERE email = $1', [impersonation.originalAdmin.email])
    const user = result.rows[0]
    if (user?.role === 'super_admin') {
      return { adminId: user.id, adminEmail: user.email }
    }
  }

  const session = await getSession()
  if (!session?.user?.id) return { error: 'Non authentifié' }

  const result = await query('SELECT id, email, role FROM users WHERE id = $1', [session.user.id])
  const user = result.rows[0]

  if (!user || user.role !== 'super_admin') {
    return { error: 'Accès réservé aux super administrateurs' }
  }

  return { adminId: user.id, adminEmail: user.email }
}

// =============================================================================
// AUDIT LOG
// =============================================================================

async function createAuditLog(
  adminId: string,
  adminEmail: string,
  actionType: string,
  targetType: string,
  targetId: string,
  targetIdentifier: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>
) {
  const headersList = await headers()
  const ipAddress =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown'
  const userAgent = headersList.get('user-agent') || 'unknown'

  // Détection impersonation via headers injectés par middleware
  const impersonationAdmin = headersList.get('x-impersonation-admin')
  const impersonationTarget = headersList.get('x-impersonation-target')
  const isImpersonation = !!impersonationAdmin && !!impersonationTarget

  await query(
    `INSERT INTO admin_audit_logs
     (admin_id, admin_email, action_type, target_type, target_id, target_identifier, old_value, new_value, ip_address, user_agent, is_impersonation, impersonated_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      adminId,
      adminEmail,
      actionType,
      targetType,
      targetId,
      targetIdentifier,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ipAddress,
      userAgent,
      isImpersonation,
      impersonationTarget || null
    ]
  )
}

// =============================================================================
// ACTIONS
// =============================================================================

export async function startImpersonationAction(
  targetUserId: string,
  reason: string
): Promise<{ error?: string }> {
  const authCheck = await checkSuperAdminAccess()
  if ('error' in authCheck) return { error: authCheck.error }

  // Validation raison obligatoire
  if (!reason || reason.trim().length < 10) {
    return { error: 'Raison obligatoire (minimum 10 caractères)' }
  }

  // Vérifier que la cible existe, est approuvée, et n'est pas super_admin
  const targetResult = await query(
    'SELECT id, email, nom, prenom, role, status FROM users WHERE id = $1',
    [targetUserId]
  )
  const target = targetResult.rows[0]

  if (!target) return { error: 'Utilisateur introuvable' }
  if (target.status !== 'approved') return { error: 'L\'utilisateur n\'est pas approuvé' }
  if (target.role === 'super_admin') return { error: 'Impossible d\'impersonner un super administrateur' }
  if (target.id === authCheck.adminId) return { error: 'Impossible de s\'impersonner soi-même' }

  const result = await startImpersonation(targetUserId)
  if (!result.success) return { error: result.error || 'Erreur lors de l\'impersonation' }

  const targetName = target.nom && target.prenom ? `${target.prenom} ${target.nom}` : target.email

  // Récupérer IP et User-Agent
  const headersList = await headers()
  const ipAddress =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown'
  const userAgent = headersList.get('user-agent') || 'unknown'

  // Créer l'entrée dans active_impersonations
  await query(`
    INSERT INTO active_impersonations
    (admin_id, target_user_id, reason, started_at, expires_at, ip_address, user_agent, is_active)
    VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '2 hours', $4, $5, true)
  `, [
    authCheck.adminId,
    targetUserId,
    reason.trim(),
    ipAddress,
    userAgent
  ])

  // Créer l'audit log
  await createAuditLog(
    authCheck.adminId,
    authCheck.adminEmail,
    'impersonation_start',
    'user',
    targetUserId,
    target.email,
    undefined,
    {
      targetName,
      targetEmail: target.email,
      targetRole: target.role,
      reason: reason.trim()
    }
  )

  return {}
}

export async function stopImpersonationAction(): Promise<{ error?: string }> {
  const impersonation = await getImpersonationStatus()
  if (!impersonation.isImpersonating) return { error: 'Pas d\'impersonation en cours' }

  // Récupérer l'admin ID depuis le cookie original avant de le supprimer
  const adminResult = await query('SELECT id, email FROM users WHERE email = $1', [impersonation.originalAdmin!.email])
  const admin = adminResult.rows[0]

  const result = await stopImpersonation()
  if (!result.success) return { error: result.error || 'Erreur lors de l\'arrêt' }

  if (admin && impersonation.targetUser) {
    // Désactiver la session dans active_impersonations
    await query(`
      UPDATE active_impersonations
      SET is_active = false
      WHERE admin_id = $1 AND target_user_id = $2 AND is_active = true
    `, [admin.id, impersonation.targetUser.id])

    // Créer l'audit log
    await createAuditLog(
      admin.id,
      admin.email,
      'impersonation_stop',
      'user',
      '',
      impersonation.targetUser.email,
      { targetName: impersonation.targetUser.name, targetEmail: impersonation.targetUser.email },
      undefined
    )
  }

  return {}
}
