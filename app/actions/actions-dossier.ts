'use server'

import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { actionSchema, type ActionFormData } from '@/lib/validations/dossier'
import { revalidatePath } from 'next/cache'

export async function createActionDossierAction(formData: ActionFormData) {
  try {
    const validatedData = actionSchema.parse(formData)

    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    const actionData = {
      user_id: userId,
      ...validatedData,
      date_limite: validatedData.date_limite || null,
    }

    const columns = Object.keys(actionData).join(', ')
    const values = Object.values(actionData)
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')

    const result = await query(
      `INSERT INTO actions (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    )

    revalidatePath(`/dossiers/${validatedData.dossier_id}`)
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur validation:', error)
    return { error: 'Données invalides' }
  }
}

export async function updateActionDossierAction(
  id: string,
  formData: Partial<ActionFormData>
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    const setClause = Object.keys(formData)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ')
    const values = [...Object.values(formData), id, userId]

    const result = await query(
      `UPDATE actions SET ${setClause} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return { error: 'Action introuvable' }
    }

    revalidatePath(`/dossiers/${result.rows[0].dossier_id}`)
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur mise à jour:', error)
    return { error: 'Erreur lors de la mise à jour' }
  }
}

export async function deleteActionDossierAction(id: string, dossierId: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    await query('DELETE FROM actions WHERE id = $1 AND user_id = $2', [id, userId])

    revalidatePath(`/dossiers/${dossierId}`)
    return { success: true }
  } catch (error) {
    console.error('Erreur suppression:', error)
    return { error: 'Erreur lors de la suppression' }
  }
}

export async function toggleActionStatutAction(id: string, dossierId: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Récupérer l'action actuelle
    const actionResult = await query(
      'SELECT statut FROM actions WHERE id = $1 AND user_id = $2',
      [id, userId]
    )

    if (actionResult.rows.length === 0) {
      return { error: 'Action non trouvée' }
    }

    // Toggle statut
    const newStatut = actionResult.rows[0].statut === 'terminee' ? 'a_faire' : 'terminee'

    const result = await query(
      'UPDATE actions SET statut = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [newStatut, id, userId]
    )

    revalidatePath(`/dossiers/${dossierId}`)
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur toggle:', error)
    return { error: 'Erreur lors de la mise à jour' }
  }
}
