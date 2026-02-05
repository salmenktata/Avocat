'use server'

import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { dossierSchema, type DossierFormData } from '@/lib/validations/dossier'
import { revalidatePath } from 'next/cache'

export async function createDossierAction(formData: DossierFormData) {
  try {
    // Validation
    const validatedData = dossierSchema.parse(formData)

    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Préparer les données
    const dossierData = {
      user_id: userId,
      ...validatedData,
      montant_litige: validatedData.montant_litige || null,
      date_ouverture: validatedData.date_ouverture || new Date().toISOString().split('T')[0],
      workflow_etape_actuelle: validatedData.workflow_etape_actuelle || 'ASSIGNATION',
    }

    const columns = Object.keys(dossierData).join(', ')
    const values = Object.values(dossierData)
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')

    const result = await query(
      `INSERT INTO dossiers (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    )

    revalidatePath('/dossiers')
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur validation:', error)
    return { error: 'Données invalides' }
  }
}

export async function updateDossierAction(id: string, formData: DossierFormData) {
  try {
    // Validation
    const validatedData = dossierSchema.parse(formData)

    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    const updateData = {
      ...validatedData,
      montant_litige: validatedData.montant_litige || null,
    }

    const setClause = Object.keys(updateData)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ')
    const values = [...Object.values(updateData), id, userId]

    const result = await query(
      `UPDATE dossiers SET ${setClause} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return { error: 'Dossier introuvable' }
    }

    revalidatePath('/dossiers')
    revalidatePath(`/dossiers/${id}`)
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur validation:', error)
    return { error: 'Données invalides' }
  }
}

export async function updateDossierEtapeAction(id: string, etapeId: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    const result = await query(
      'UPDATE dossiers SET workflow_etape_actuelle = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [etapeId, id, userId]
    )

    if (result.rows.length === 0) {
      return { error: 'Dossier introuvable' }
    }

    revalidatePath(`/dossiers/${id}`)
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur mise à jour:', error)
    return { error: 'Erreur lors de la mise à jour' }
  }
}

export async function deleteDossierAction(id: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Supprimer le dossier (cascade supprime actions, documents, etc.)
    await query('DELETE FROM dossiers WHERE id = $1 AND user_id = $2', [id, userId])

    revalidatePath('/dossiers')
    return { success: true }
  } catch (error) {
    console.error('Erreur suppression:', error)
    return { error: 'Erreur lors de la suppression' }
  }
}

export async function getDossierAction(id: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    const result = await query(
      `SELECT d.*, json_build_object(
        'id', c.id, 'nom', c.nom, 'prenom', c.prenom,
        'type_client', c.type_client, 'cin', c.cin, 'adresse', c.adresse,
        'telephone', c.telephone, 'email', c.email
      ) as clients
      FROM dossiers d
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE d.id = $1 AND d.user_id = $2`,
      [id, userId]
    )

    if (result.rows.length === 0) {
      return { error: 'Dossier non trouvé' }
    }

    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur récupération:', error)
    return { error: 'Erreur lors de la récupération du dossier' }
  }
}
