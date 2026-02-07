/**
 * Service Email Unifié
 * Priorité: Brevo (rapide) -> Resend (fallback)
 *
 * Ce service gère l'envoi d'emails avec failover automatique.
 */

import { sendEmail as sendResendEmail, SendEmailParams as ResendParams, SendEmailResult } from './resend-client'
import { sendEmail as sendBrevoEmail, isBrevoConfigured } from './brevo-client'

// =============================================================================
// CONFIGURATION
// =============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const BREVO_API_KEY = process.env.BREVO_API_KEY || ''

// =============================================================================
// TYPES
// =============================================================================

export interface EmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  tags?: string[]
}

export interface EmailResult {
  success: boolean
  messageId?: string
  provider?: 'resend' | 'brevo'
  error?: string
  fallbackUsed?: boolean
}

// =============================================================================
// HELPERS
// =============================================================================

function isResendConfigured(): boolean {
  return !!RESEND_API_KEY
}

function getAvailableProvider(): 'brevo' | 'resend' | null {
  // Priorité Brevo (plus rapide et fiable)
  if (isBrevoConfigured()) return 'brevo'
  if (isResendConfigured()) return 'resend'
  return null
}

// =============================================================================
// FONCTION PRINCIPALE
// =============================================================================

/**
 * Envoie un email avec failover automatique
 * Priorité: Brevo (rapide) -> Resend (fallback)
 */
export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  const { to, subject, html, text, replyTo, tags } = params

  // Vérifier qu'au moins un provider est configuré
  const primaryProvider = getAvailableProvider()
  if (!primaryProvider) {
    console.error('[Email] Aucun provider email configuré (BREVO_API_KEY ou RESEND_API_KEY)')
    return {
      success: false,
      error: 'Aucun provider email configuré',
    }
  }

  // Essayer Brevo en premier (plus rapide et fiable)
  if (isBrevoConfigured()) {
    console.log('[Email] Tentative envoi via Brevo...')
    const brevoResult = await sendBrevoEmail({
      to,
      subject,
      htmlContent: html,
      textContent: text,
      replyTo,
      tags,
    })

    if (brevoResult.success) {
      console.log('[Email] Envoyé via Brevo:', brevoResult.messageId)
      return {
        success: true,
        messageId: brevoResult.messageId,
        provider: 'brevo',
      }
    }

    // Brevo a échoué, essayer Resend en fallback
    console.warn('[Email] Brevo a échoué:', brevoResult.error)

    if (isResendConfigured()) {
      console.log('[Email] Fallback vers Resend...')
      const resendResult = await sendResendEmail({
        to,
        subject,
        html,
        text,
        replyTo,
      })

      if (resendResult.success) {
        console.log('[Email] Envoyé via Resend (fallback):', resendResult.messageId)
        return {
          success: true,
          messageId: resendResult.messageId,
          provider: 'resend',
          fallbackUsed: true,
        }
      }

      // Les deux ont échoué
      console.error('[Email] Resend fallback a aussi échoué:', resendResult.error)
      return {
        success: false,
        error: `Brevo: ${brevoResult.error} | Resend: ${resendResult.error}`,
        fallbackUsed: true,
      }
    }

    // Pas de fallback disponible
    return {
      success: false,
      error: brevoResult.error,
    }
  }

  // Brevo non configuré, utiliser Resend directement
  if (isResendConfigured()) {
    console.log('[Email] Envoi via Resend (Brevo non configuré)...')
    const resendResult = await sendResendEmail({
      to,
      subject,
      html,
      text,
      replyTo,
    })

    return {
      success: resendResult.success,
      messageId: resendResult.messageId,
      provider: 'resend',
      error: resendResult.error,
    }
  }

  // Aucun provider disponible (ne devrait pas arriver)
  return {
    success: false,
    error: 'Aucun provider email disponible',
  }
}

/**
 * Envoie un email de test pour vérifier la configuration
 */
export async function sendTestEmail(to: string): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: '[Qadhya] Test de configuration email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a365d;">Configuration Email réussie</h2>
        <p>Cet email confirme que votre configuration email fonctionne correctement.</p>
        <p><strong>Provider utilisé:</strong> sera indiqué dans les logs</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Envoyé depuis Qadhya - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}
        </p>
      </div>
    `,
    text: `Configuration Email réussie\n\nCet email confirme que votre configuration email fonctionne correctement.\n\nEnvoyé depuis Qadhya - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}`,
    tags: ['test'],
  })
}

/**
 * Retourne le status de configuration des providers email
 */
export function getEmailProvidersStatus(): {
  resend: boolean
  brevo: boolean
  primary: 'resend' | 'brevo' | null
} {
  return {
    resend: isResendConfigured(),
    brevo: isBrevoConfigured(),
    primary: getAvailableProvider(),
  }
}
