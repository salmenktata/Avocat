'use server'

import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// Interface pour les préférences de notifications
export interface NotificationPreferences {
  enabled: boolean
  daily_digest_enabled: boolean
  daily_digest_time: string
  alerte_j15_enabled: boolean
  alerte_j7_enabled: boolean
  alerte_j3_enabled: boolean
  alerte_j1_enabled: boolean
  alerte_actions_urgentes: boolean
  alerte_actions_priorite_haute: boolean
  alerte_audiences_semaine: boolean
  alerte_audiences_veille: boolean
  alerte_factures_impayees: boolean
  alerte_factures_impayees_delai_jours: number
  alerte_delais_appel: boolean
  alerte_delais_cassation: boolean
  alerte_delais_opposition: boolean
  email_format: 'html' | 'text'
  langue_email: 'fr' | 'ar'
}

export async function updateCabinetInfoAction(formData: FormData) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Extraire les données du formulaire
    const cabinet_nom = formData.get('cabinet_nom') as string
    const cabinet_adresse = formData.get('cabinet_adresse') as string
    const cabinet_ville = formData.get('cabinet_ville') as string
    const cabinet_code_postal = formData.get('cabinet_code_postal') as string
    const rne = formData.get('rne') as string
    const logoFile = formData.get('logo') as File | null

    let logo_url = null

    // Upload du logo si présent (Google Drive ou stockage local)
    if (logoFile && logoFile.size > 0) {
      // TODO: Implémenter upload vers Google Drive via storage-manager
      // Pour l'instant, on conserve l'ancienne logique mais adaptée
      console.warn('[updateCabinetInfoAction] Logo upload non implémenté pour Google Drive')
      // On pourrait stocker temporairement en base64 ou dans un dossier public
    }

    // Préparer les données à mettre à jour
    const updateData: any = {
      cabinet_nom: cabinet_nom || null,
      cabinet_adresse: cabinet_adresse || null,
      cabinet_ville: cabinet_ville || null,
      cabinet_code_postal: cabinet_code_postal || null,
      rne: rne || null,
    }

    // Ajouter logo_url seulement si un nouveau logo a été uploadé
    if (logo_url) {
      updateData.logo_url = logo_url
    }

    // Construire la requête UPDATE dynamiquement
    const keys = Object.keys(updateData)
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')
    const values = [...Object.values(updateData), userId]

    await query(
      `UPDATE profiles SET ${setClause} WHERE id = $${values.length}`,
      values
    )

    revalidatePath('/parametres/cabinet')
    revalidatePath('/factures')

    return { success: true }
  } catch (error) {
    console.error('Erreur updateCabinetInfo:', error)
    return { error: 'Erreur lors de la mise à jour des informations' }
  }
}

/**
 * Sauvegarder préférences de notifications
 */
export async function saveNotificationPreferencesAction(preferences: NotificationPreferences) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Validation des données
    if (preferences.alerte_factures_impayees_delai_jours < 1 || preferences.alerte_factures_impayees_delai_jours > 365) {
      return { error: 'Le délai des factures impayées doit être entre 1 et 365 jours' }
    }

    if (!['html', 'text'].includes(preferences.email_format)) {
      return { error: 'Format email invalide' }
    }

    if (!['fr', 'ar'].includes(preferences.langue_email)) {
      return { error: 'Langue email invalide' }
    }

    // Valider le format de l'heure (HH:MM:SS)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/
    if (!timeRegex.test(preferences.daily_digest_time)) {
      return { error: 'Format d\'heure invalide (attendu: HH:MM:SS)' }
    }

    // Vérifier si des préférences existent déjà
    const existingResult = await query(
      'SELECT id FROM notification_preferences WHERE user_id = $1',
      [userId]
    )

    if (existingResult.rows.length > 0) {
      // Mise à jour
      const keys = Object.keys(preferences)
      const values = Object.values(preferences)
      const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ')

      await query(
        `UPDATE notification_preferences SET ${setClause}, updated_at = now() WHERE user_id = $${keys.length + 1}`,
        [...values, userId]
      )
    } else {
      // Création
      const keys = Object.keys(preferences)
      const values = Object.values(preferences)
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')

      await query(
        `INSERT INTO notification_preferences (${keys.join(', ')}, user_id) VALUES (${placeholders}, $${keys.length + 1})`,
        [...values, userId]
      )
    }

    revalidatePath('/parametres/notifications')
    return { success: true }
  } catch (error) {
    console.error('Erreur saveNotificationPreferences:', error)
    return { error: 'Erreur lors de la sauvegarde des préférences' }
  }
}
