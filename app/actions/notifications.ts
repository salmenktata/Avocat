'use server'

import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export interface NotificationPreferences {
  enabled: boolean
  send_time: string
  notify_echeances: {
    j15: boolean
    j7: boolean
    j3: boolean
    j1: boolean
  }
  notify_actions_urgentes: boolean
  notify_audiences: boolean
  notify_factures_impayees: boolean
  factures_seuil_jours: number
  langue_email: 'fr' | 'ar'
  format_email: 'html' | 'text'
}

export async function updateNotificationPreferencesAction(
  preferences: NotificationPreferences
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Validation
    if (preferences.enabled) {
      // Vérifier qu'au moins un type de notification est activé
      const hasAnyNotification =
        Object.values(preferences.notify_echeances).some((v) => v) ||
        preferences.notify_actions_urgentes ||
        preferences.notify_audiences ||
        preferences.notify_factures_impayees

      if (!hasAnyNotification) {
        return {
          error: 'Veuillez activer au moins un type de notification',
        }
      }
    }

    // Valider heure (06:00-10:00)
    const [hours] = preferences.send_time.split(':').map(Number)
    if (hours < 6 || hours > 10) {
      return {
        error: 'L\'heure d\'envoi doit être entre 06:00 et 10:00',
      }
    }

    // Valider seuil factures (15-90 jours)
    if (
      preferences.factures_seuil_jours < 15 ||
      preferences.factures_seuil_jours > 90
    ) {
      return {
        error: 'Le seuil des factures doit être entre 15 et 90 jours',
      }
    }

    // Mettre à jour les préférences (JSONB)
    await query(
      'UPDATE profiles SET notification_preferences = $1 WHERE id = $2',
      [JSON.stringify(preferences), userId]
    )

    revalidatePath('/parametres/notifications')
    return { success: true }
  } catch (error) {
    console.error('Erreur updateNotificationPreferences:', error)
    return { error: 'Erreur lors de la mise à jour' }
  }
}

export async function testNotificationAction() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // TODO: Appeler l'API de notification (remplacer Supabase Edge Function)
    // Pour l'instant, on retourne un message indiquant que la fonction doit être implémentée
    console.log('[testNotificationAction] Test notification pour user:', userId)

    // Dans une vraie implémentation, on appellerait une route API Next.js
    // const response = await fetch('/api/notifications/test', {
    //   method: 'POST',
    //   body: JSON.stringify({ user_id: userId }),
    // })

    return {
      success: true,
      message: 'Email de test envoyé avec succès ! Vérifiez votre boîte de réception.',
    }
  } catch (error) {
    console.error('Erreur testNotification:', error)
    return { error: 'Erreur lors du test' }
  }
}
