'use server'

import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'
import { revalidatePath } from 'next/cache'

async function checkAdminAccess(): Promise<{ userId: string } | { error: string }> {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: 'Non authentifié' }
  }

  const result = await db.query('SELECT role FROM users WHERE id = $1', [session.user.id])
  const role = result.rows[0]?.role

  if (role !== 'admin' && role !== 'super_admin') {
    return { error: 'Accès réservé aux administrateurs' }
  }

  return { userId: session.user.id }
}

export async function bulkApproveLegalDocuments(
  action: 'approve' | 'revoke',
  documentIds: string[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const authCheck = await checkAdminAccess()
    if ('error' in authCheck) {
      return { success: false, count: 0, error: authCheck.error }
    }

    if (!documentIds.length) {
      return { success: false, count: 0, error: 'Aucun document sélectionné' }
    }

    let result
    if (action === 'approve') {
      result = await db.query(
        `UPDATE legal_documents
         SET is_approved = true, approved_at = NOW(), approved_by = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[]) AND consolidation_status = 'complete'`,
        [authCheck.userId, documentIds]
      )
    } else {
      result = await db.query(
        `UPDATE legal_documents
         SET is_approved = false, approved_at = NULL, approved_by = NULL, updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [documentIds]
      )
    }

    revalidatePath('/super-admin/legal-documents')

    return { success: true, count: result.rowCount ?? 0 }
  } catch (error) {
    console.error('Erreur bulk approve legal documents:', error)
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}
