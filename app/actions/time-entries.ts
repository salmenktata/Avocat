'use server'

import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { timeEntrySchema, type TimeEntryFormData } from '@/lib/validations/time-entry'
import { revalidatePath } from 'next/cache'

export async function createTimeEntryAction(formData: TimeEntryFormData) {
  try {
    // Validation
    const validatedData = timeEntrySchema.parse(formData)

    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Vérifier que le dossier appartient à l'utilisateur
    const dossierResult = await query(
      'SELECT id FROM dossiers WHERE id = $1 AND user_id = $2',
      [validatedData.dossier_id, userId]
    )

    if (dossierResult.rows.length === 0) {
      return { error: 'Dossier introuvable ou accès refusé' }
    }

    // Créer l'entrée de temps
    const timeEntryData = {
      user_id: userId,
      ...validatedData,
    }

    const columns = Object.keys(timeEntryData).join(', ')
    const values = Object.values(timeEntryData)
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')

    const result = await query(
      `INSERT INTO time_entries (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    )

    revalidatePath('/dossiers')
    revalidatePath(`/dossiers/${validatedData.dossier_id}`)
    revalidatePath('/time-tracking')
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur validation:', error)
    return { error: 'Données invalides' }
  }
}

export async function updateTimeEntryAction(id: string, formData: Partial<TimeEntryFormData>) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Vérifier que l'entrée existe et n'est pas facturée
    const checkResult = await query(
      'SELECT id, dossier_id, facture_id FROM time_entries WHERE id = $1 AND user_id = $2',
      [id, userId]
    )

    if (checkResult.rows.length === 0) {
      return { error: 'Entrée de temps introuvable ou accès refusé' }
    }

    const timeEntry = checkResult.rows[0]

    if (timeEntry.facture_id) {
      return { error: 'Impossible de modifier une entrée déjà facturée' }
    }

    const setClause = Object.keys(formData)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ')
    const values = [...Object.values(formData), id, userId]

    const result = await query(
      `UPDATE time_entries SET ${setClause} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`,
      values
    )

    revalidatePath('/dossiers')
    revalidatePath(`/dossiers/${timeEntry.dossier_id}`)
    revalidatePath('/time-tracking')
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur mise à jour:', error)
    return { error: 'Erreur lors de la mise à jour' }
  }
}

export async function deleteTimeEntryAction(id: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Récupérer l'entrée pour vérifier qu'elle n'est pas facturée
    const checkResult = await query(
      'SELECT dossier_id, facture_id FROM time_entries WHERE id = $1 AND user_id = $2',
      [id, userId]
    )

    if (checkResult.rows.length === 0) {
      return { error: 'Entrée introuvable ou accès refusé' }
    }

    const timeEntry = checkResult.rows[0]

    if (timeEntry.facture_id) {
      return { error: 'Impossible de supprimer une entrée déjà facturée' }
    }

    await query('DELETE FROM time_entries WHERE id = $1 AND user_id = $2', [id, userId])

    revalidatePath('/dossiers')
    revalidatePath(`/dossiers/${timeEntry.dossier_id}`)
    revalidatePath('/time-tracking')

    return { success: true }
  } catch (error) {
    console.error('Erreur suppression:', error)
    return { error: 'Erreur lors de la suppression' }
  }
}

export async function startTimerAction(dossierId: string, description: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Vérifier s'il y a déjà un timer en cours
    const activeResult = await query(
      'SELECT id FROM time_entries WHERE user_id = $1 AND heure_fin IS NULL',
      [userId]
    )

    if (activeResult.rows.length > 0) {
      return { error: 'Un timer est déjà en cours. Arrêtez-le d\'abord.' }
    }

    // Créer une nouvelle entrée avec timer
    const now = new Date()
    const timeEntryData = {
      user_id: userId,
      dossier_id: dossierId,
      description,
      date: now.toISOString().split('T')[0],
      heure_debut: now.toTimeString().split(' ')[0].substring(0, 5), // HH:MM
      duree_minutes: 0, // Sera mis à jour à l'arrêt
      facturable: true,
    }

    const columns = Object.keys(timeEntryData).join(', ')
    const values = Object.values(timeEntryData)
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')

    const result = await query(
      `INSERT INTO time_entries (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    )

    revalidatePath('/time-tracking')
    revalidatePath(`/dossiers/${dossierId}`)
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur démarrage timer:', error)
    return { error: 'Erreur lors du démarrage du timer' }
  }
}

export async function stopTimerAction(id: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Récupérer l'entrée
    const fetchResult = await query(
      'SELECT * FROM time_entries WHERE id = $1 AND user_id = $2',
      [id, userId]
    )

    if (fetchResult.rows.length === 0) {
      return { error: 'Timer introuvable' }
    }

    const timeEntry = fetchResult.rows[0]

    if (timeEntry.heure_fin) {
      return { error: 'Ce timer est déjà arrêté' }
    }

    // Calculer la durée
    const now = new Date()
    const heureDebut = new Date(`${timeEntry.date}T${timeEntry.heure_debut}`)
    const dureeMs = now.getTime() - heureDebut.getTime()
    const dureeMinutes = Math.max(1, Math.round(dureeMs / 60000))

    const heureFin = now.toTimeString().split(' ')[0].substring(0, 5) // HH:MM

    const result = await query(
      'UPDATE time_entries SET heure_fin = $1, duree_minutes = $2 WHERE id = $3 RETURNING *',
      [heureFin, dureeMinutes, id]
    )

    revalidatePath('/time-tracking')
    revalidatePath(`/dossiers/${timeEntry.dossier_id}`)
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur arrêt timer:', error)
    return { error: 'Erreur lors de l\'arrêt du timer' }
  }
}

export async function getActiveTimerAction() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    const result = await query(
      `SELECT te.*,
        json_build_object(
          'numero', d.numero,
          'objet', d.objet,
          'clients', json_build_object(
            'nom', c.nom,
            'prenom', c.prenom,
            'type_client', c.type_client
          )
        ) as dossiers
      FROM time_entries te
      LEFT JOIN dossiers d ON te.dossier_id = d.id
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE te.user_id = $1 AND te.heure_fin IS NULL`,
      [userId]
    )

    return { success: true, data: result.rows[0] || null }
  } catch (error) {
    console.error('Erreur:', error)
    return { error: 'Erreur lors de la récupération du timer' }
  }
}

export async function getTimeEntriesByDossierAction(dossierId: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    const result = await query(
      `SELECT * FROM time_entries
       WHERE dossier_id = $1 AND user_id = $2
       ORDER BY date DESC, heure_debut DESC`,
      [dossierId, userId]
    )

    return { success: true, data: result.rows }
  } catch (error) {
    console.error('Erreur:', error)
    return { error: 'Erreur lors de la récupération des entrées' }
  }
}
