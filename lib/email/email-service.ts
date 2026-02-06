/**
 * Service Email Unifié
 * Priorité: Resend -> Brevo (fallback)
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

function getAvailableProvider(): 'resend' | 'brevo' | null {
  if (isResendConfigured()) return 'resend'
  if (isBrevoConfigured()) return 'brevo'
  return null
}

// =============================================================================
// FONCTION PRINCIPALE
// =============================================================================

/**
 * Envoie un email avec failover automatique
 * Priorité: Resend -> Brevo
 */
export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  const { to, subject, html, text, replyTo, tags } = params

  // Vérifier qu'au moins un provider est configuré
  const primaryProvider = getAvailableProvider()
  if (!primaryProvider) {
    console.error('[Email] Aucun provider email configuré (RESEND_API_KEY ou BREVO_API_KEY)')
    return {
      success: false,
      error: 'Aucun provider email configuré',
    }
  }

  // Essayer Resend en premier
  if (isResendConfigured()) {
    console.log('[Email] Tentative envoi via Resend...')
    const resendResult = await sendResendEmail({
      to,
      subject,
      html,
      text,
      replyTo,
    })

    if (resendResult.success) {
      console.log('[Email] Envoyé via Resend:', resendResult.messageId)
      return {
        success: true,
        messageId: resendResult.messageId,
        provider: 'resend',
      }
    }

    // Resend a échoué, essayer Brevo en fallback
    console.warn('[Email] Resend a échoué:', resendResult.error)

    if (isBrevoConfigured()) {
      console.log('[Email] Fallback vers Brevo...')
      const brevoResult = await sendBrevoEmail({
        to,
        subject,
        htmlContent: html,
        textContent: text,
        replyTo,
        tags,
      })

      if (brevoResult.success) {
        console.log('[Email] Envoyé via Brevo (fallback):', brevoResult.messageId)
        return {
          success: true,
          messageId: brevoResult.messageId,
          provider: 'brevo',
          fallbackUsed: true,
        }
      }

      // Les deux ont échoué
      console.error('[Email] Brevo fallback a aussi échoué:', brevoResult.error)
      return {
        success: false,
        error: `Resend: ${resendResult.error} | Brevo: ${brevoResult.error}`,
        fallbackUsed: true,
      }
    }

    // Pas de fallback disponible
    return {
      success: false,
      error: resendResult.error,
    }
  }

  // Resend non configuré, utiliser Brevo directement
  if (isBrevoConfigured()) {
    console.log('[Email] Envoi via Brevo (Resend non configuré)...')
    const brevoResult = await sendBrevoEmail({
      to,
      subject,
      htmlContent: html,
      textContent: text,
      replyTo,
      tags,
    })

    return {
      success: brevoResult.success,
      messageId: brevoResult.messageId,
      provider: 'brevo',
      error: brevoResult.error,
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
    subject: '[MonCabinet] Test de configuration email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a365d;">Configuration Email réussie</h2>
        <p>Cet email confirme que votre configuration email fonctionne correctement.</p>
        <p><strong>Provider utilisé:</strong> sera indiqué dans les logs</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Envoyé depuis MonCabinet - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}
        </p>
      </div>
    `,
    text: `Configuration Email réussie\n\nCet email confirme que votre configuration email fonctionne correctement.\n\nEnvoyé depuis MonCabinet - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}`,
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
