'use server'

import { createClient } from '@/lib/supabase/server'
import { timeEntrySchema, type TimeEntryFormData } from '@/lib/validations/time-entry'
import { revalidatePath } from 'next/cache'

export async function createTimeEntryAction(formData: TimeEntryFormData) {
  try {
    // Validation
    const validatedData = timeEntrySchema.parse(formData)

    // Vérifier l'authentification
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Vérifier que le dossier appartient à l'utilisateur
    const { data: dossier, error: dossierError } = await supabase
      .from('dossiers')
      .select('id')
      .eq('id', validatedData.dossier_id)
      .eq('user_id', user.id)
      .single()

    if (dossierError || !dossier) {
      return { error: 'Dossier introuvable ou accès refusé' }
    }

    // Créer l'entrée de temps
    const timeEntryData = {
      user_id: user.id,
      ...validatedData,
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert(timeEntryData)
      .select()
      .single()

    if (error) {
      console.error('Erreur création entrée temps:', error)
      return { error: 'Erreur lors de la création de l\'entrée de temps' }
    }

    revalidatePath('/dossiers')
    revalidatePath(`/dossiers/${validatedData.dossier_id}`)
    revalidatePath('/time-tracking')
    return { success: true, data }
  } catch (error) {
    console.error('Erreur validation:', error)
    return { error: 'Données invalides' }
  }
}

export async function updateTimeEntryAction(id: string, formData: Partial<TimeEntryFormData>) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Vérifier que l'entrée existe et n'est pas facturée
    const { data: timeEntry, error: checkError } = await supabase
      .from('time_entries')
      .select('id, dossier_id, facture_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (checkError || !timeEntry) {
      return { error: 'Entrée de temps introuvable ou accès refusé' }
    }

    if (timeEntry.facture_id) {
      return { error: 'Impossible de modifier une entrée déjà facturée' }
    }

    const { data, error } = await supabase
      .from('time_entries')
      .update(formData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erreur mise à jour entrée temps:', error)
      return { error: 'Erreur lors de la mise à jour' }
    }

    revalidatePath('/dossiers')
    revalidatePath(`/dossiers/${timeEntry.dossier_id}`)
    revalidatePath('/time-tracking')
    return { success: true, data }
  } catch (error) {
    console.error('Erreur mise à jour:', error)
    return { error: 'Erreur lors de la mise à jour' }
  }
}

export async function deleteTimeEntryAction(id: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Récupérer l'entrée pour vérifier qu'elle n'est pas facturée
    const { data: timeEntry } = await supabase
      .from('time_entries')
      .select('dossier_id, facture_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (timeEntry?.facture_id) {
      return { error: 'Impossible de supprimer une entrée déjà facturée' }
    }

    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Erreur suppression entrée temps:', error)
      return { error: 'Erreur lors de la suppression' }
    }

    if (timeEntry) {
      revalidatePath('/dossiers')
      revalidatePath(`/dossiers/${timeEntry.dossier_id}`)
      revalidatePath('/time-tracking')
    }

    return { success: true }
  } catch (error) {
    console.error('Erreur suppression:', error)
    return { error: 'Erreur lors de la suppression' }
  }
}

export async function startTimerAction(dossierId: string, description: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Vérifier s'il y a déjà un timer en cours
    const { data: activeTimer } = await supabase
      .from('time_entries')
      .select('id')
      .eq('user_id', user.id)
      .is('heure_fin', null)
      .single()

    if (activeTimer) {
      return { error: 'Un timer est déjà en cours. Arrêtez-le d\'abord.' }
    }

    // Créer une nouvelle entrée avec timer
    const now = new Date()
    const timeEntryData = {
      user_id: user.id,
      dossier_id: dossierId,
      description,
      date: now.toISOString().split('T')[0],
      heure_debut: now.toTimeString().split(' ')[0].substring(0, 5), // HH:MM
      duree_minutes: 0, // Sera mis à jour à l'arrêt
      facturable: true,
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert(timeEntryData)
      .select()
      .single()

    if (error) {
      console.error('Erreur démarrage timer:', error)
      return { error: 'Erreur lors du démarrage du timer' }
    }

    revalidatePath('/time-tracking')
    revalidatePath(`/dossiers/${dossierId}`)
    return { success: true, data }
  } catch (error) {
    console.error('Erreur démarrage timer:', error)
    return { error: 'Erreur lors du démarrage du timer' }
  }
}

export async function stopTimerAction(id: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Récupérer l'entrée
    const { data: timeEntry, error: fetchError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !timeEntry) {
      return { error: 'Timer introuvable' }
    }

    if (timeEntry.heure_fin) {
      return { error: 'Ce timer est déjà arrêté' }
    }

    // Calculer la durée
    const now = new Date()
    const heureDebut = new Date(`${timeEntry.date}T${timeEntry.heure_debut}`)
    const dureeMs = now.getTime() - heureDebut.getTime()
    const dureeMinutes = Math.max(1, Math.round(dureeMs / 60000))

    const heureFin = now.toTimeString().split(' ')[0].substring(0, 5) // HH:MM

    const { data, error } = await supabase
      .from('time_entries')
      .update({
        heure_fin: heureFin,
        duree_minutes: dureeMinutes,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erreur arrêt timer:', error)
      return { error: 'Erreur lors de l\'arrêt du timer' }
    }

    revalidatePath('/time-tracking')
    revalidatePath(`/dossiers/${timeEntry.dossier_id}`)
    return { success: true, data }
  } catch (error) {
    console.error('Erreur arrêt timer:', error)
    return { error: 'Erreur lors de l\'arrêt du timer' }
  }
}

export async function getActiveTimerAction() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        *,
        dossiers (
          numero_dossier,
          objet,
          clients (
            nom,
            prenom,
            denomination,
            type
          )
        )
      `)
      .eq('user_id', user.id)
      .is('heure_fin', null)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      console.error('Erreur récupération timer actif:', error)
      return { error: 'Erreur lors de la récupération du timer' }
    }

    return { success: true, data: data || null }
  } catch (error) {
    console.error('Erreur:', error)
    return { error: 'Erreur lors de la récupération du timer' }
  }
}

export async function getTimeEntriesByDossierAction(dossierId: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('dossier_id', dossierId)
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('heure_debut', { ascending: false })

    if (error) {
      console.error('Erreur récupération entrées temps:', error)
      return { error: 'Erreur lors de la récupération des entrées' }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Erreur:', error)
    return { error: 'Erreur lors de la récupération des entrées' }
  }
}
