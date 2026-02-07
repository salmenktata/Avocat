'use server'

import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'
import {
  getEmailProviderConfig,
  setEmailProviderMode,
  setEmailApiKey,
  isWhatsAppEnabled,
  setWhatsAppEnabled,
  getWhatsAppConfig,
  type EmailProviderMode,
} from '@/lib/config/provider-config'
import { testEmailProvider } from '@/lib/email/email-service'
import { getConfig } from '@/lib/config/platform-config'

// =============================================================================
// HELPERS
// =============================================================================

async function requireSuperAdmin() {
  const session = await getSession()

  if (!session?.user?.id) {
    throw new Error('Non authentifié')
  }

  const adminCheck = await db.query(
    `SELECT is_super_admin, email FROM users WHERE id = $1`,
    [session.user.id]
  )

  if (!adminCheck.rows[0]?.is_super_admin) {
    throw new Error('Accès réservé aux super admins')
  }

  return {
    id: session.user.id,
    email: adminCheck.rows[0].email,
  }
}

// =============================================================================
// LECTURE - EMAIL
// =============================================================================

/**
 * Récupère la configuration complète des providers email
 */
export async function getEmailProvidersConfigAction() {
  try {
    await requireSuperAdmin()
    const config = await getEmailProviderConfig()
    return { success: true, data: config }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return { success: false, error: message }
  }
}

// =============================================================================
// LECTURE - WHATSAPP
// =============================================================================

/**
 * Récupère le statut WhatsApp
 */
export async function getWhatsAppStatusAction() {
  try {
    await requireSuperAdmin()
    const config = await getWhatsAppConfig()
    return { success: true, data: config }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return { success: false, error: message }
  }
}

// =============================================================================
// ÉCRITURE - EMAIL
// =============================================================================

/**
 * Met à jour la configuration du provider email
 */
export async function updateEmailProviderAction(params: {
  mode?: EmailProviderMode
  brevoApiKey?: string
  resendApiKey?: string
}) {
  try {
    await requireSuperAdmin()

    const results: string[] = []

    // Mettre à jour le mode si fourni
    if (params.mode) {
      const success = await setEmailProviderMode(params.mode)
      if (success) {
        results.push(`Mode email mis à jour: ${params.mode}`)
      } else {
        return { success: false, error: 'Échec mise à jour du mode email' }
      }
    }

    // Mettre à jour la clé Brevo si fournie
    if (params.brevoApiKey) {
      const success = await setEmailApiKey('brevo', params.brevoApiKey)
      if (success) {
        results.push('Clé API Brevo mise à jour')
      } else {
        return { success: false, error: 'Échec mise à jour clé Brevo' }
      }
    }

    // Mettre à jour la clé Resend si fournie
    if (params.resendApiKey) {
      const success = await setEmailApiKey('resend', params.resendApiKey)
      if (success) {
        results.push('Clé API Resend mise à jour')
      } else {
        return { success: false, error: 'Échec mise à jour clé Resend' }
      }
    }

    return {
      success: true,
      message: results.length > 0 ? results.join(', ') : 'Aucune modification',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return { success: false, error: message }
  }
}

// =============================================================================
// ÉCRITURE - WHATSAPP
// =============================================================================

/**
 * Active ou désactive WhatsApp globalement
 */
export async function updateWhatsAppEnabledAction(enabled: boolean) {
  try {
    await requireSuperAdmin()

    const success = await setWhatsAppEnabled(enabled)
    if (!success) {
      return { success: false, error: 'Échec mise à jour WhatsApp' }
    }

    return {
      success: true,
      message: enabled ? 'WhatsApp activé' : 'WhatsApp désactivé',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return { success: false, error: message }
  }
}

// =============================================================================
// TESTS
// =============================================================================

/**
 * Teste un provider email spécifique
 */
export async function testEmailProviderAction(
  provider: 'brevo' | 'resend',
  testEmail: string
) {
  try {
    const admin = await requireSuperAdmin()

    // Utiliser l'email de test fourni ou celui de l'admin
    const to = testEmail || admin.email

    if (!to) {
      return { success: false, error: 'Adresse email de test requise' }
    }

    const result = await testEmailProvider(provider, to)

    if (result.success) {
      return {
        success: true,
        message: `Email de test envoyé via ${provider} à ${to}`,
        messageId: result.messageId,
      }
    }

    return {
      success: false,
      error: result.error || `Échec envoi via ${provider}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return { success: false, error: message }
  }
}

/**
 * Teste la connexion WhatsApp (vérifie le token)
 */
export async function testWhatsAppConnectionAction() {
  try {
    await requireSuperAdmin()

    const [token, phoneNumberId] = await Promise.all([
      getConfig('WHATSAPP_TOKEN'),
      getConfig('WHATSAPP_PHONE_NUMBER_ID'),
    ])

    if (!token || !phoneNumberId) {
      return {
        success: false,
        error: 'Configuration WhatsApp incomplète (token ou phoneNumberId manquant)',
      }
    }

    // Appel API Meta pour vérifier le token
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: `Erreur API Meta: ${errorData.error?.message || response.statusText}`,
      }
    }

    const data = await response.json()

    return {
      success: true,
      message: 'Connexion WhatsApp validée',
      data: {
        phoneNumber: data.display_phone_number,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return { success: false, error: message }
  }
}
