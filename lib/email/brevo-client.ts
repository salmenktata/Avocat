/**
 * Client Brevo (ex-Sendinblue) pour l'envoi d'emails transactionnels
 * Utilisé pour les notifications quotidiennes et autres emails système
 */

import * as Brevo from '@getbrevo/brevo'
import { getConfig } from '@/lib/config/platform-config'

// =============================================================================
// CONFIGURATION (fallback sur env si DB non disponible)
// =============================================================================

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'notifications@moncabinet.tn'
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Qadhya'

// =============================================================================
// TYPES
// =============================================================================

export interface SendEmailParams {
  to: string | string[]
  subject: string
  htmlContent: string
  textContent?: string
  replyTo?: string
  tags?: string[]
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// =============================================================================
// CLIENT FACTORY
// =============================================================================

/**
 * Crée une instance de l'API Brevo avec la clé fournie ou depuis la config
 */
async function createApiInstance(apiKeyOverride?: string): Promise<Brevo.TransactionalEmailsApi> {
  const apiKey = apiKeyOverride || await getConfig('BREVO_API_KEY')

  if (!apiKey) {
    throw new Error('BREVO_API_KEY non configuré')
  }

  const apiInstance = new Brevo.TransactionalEmailsApi()
  apiInstance.setApiKey(
    Brevo.TransactionalEmailsApiApiKeys.apiKey,
    apiKey
  )

  return apiInstance
}

// =============================================================================
// FONCTIONS D'ENVOI
// =============================================================================

/**
 * Envoie un email transactionnel via Brevo
 * @param params Paramètres de l'email
 * @param apiKeyOverride Clé API optionnelle pour override (tests)
 */
export async function sendEmail(
  params: SendEmailParams,
  apiKeyOverride?: string
): Promise<SendEmailResult> {
  const { to, subject, htmlContent, textContent, replyTo, tags } = params

  try {
    const api = await createApiInstance(apiKeyOverride)

    const sendSmtpEmail = new Brevo.SendSmtpEmail()
    sendSmtpEmail.sender = { email: SENDER_EMAIL, name: SENDER_NAME }
    sendSmtpEmail.to = Array.isArray(to)
      ? to.map((email) => ({ email }))
      : [{ email: to }]
    sendSmtpEmail.subject = subject
    sendSmtpEmail.htmlContent = htmlContent

    if (textContent) {
      sendSmtpEmail.textContent = textContent
    }

    if (replyTo) {
      sendSmtpEmail.replyTo = { email: replyTo }
    }

    if (tags && tags.length > 0) {
      sendSmtpEmail.tags = tags
    }

    const response = await api.sendTransacEmail(sendSmtpEmail)

    console.log('[Brevo] Email envoyé:', {
      to: Array.isArray(to) ? to : [to],
      subject,
      messageId: response.body.messageId,
    })

    return {
      success: true,
      messageId: response.body.messageId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[Brevo] Erreur envoi email:', errorMessage)

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Envoie un email de test pour vérifier la configuration
 * @param to Adresse email destinataire
 * @param apiKeyOverride Clé API optionnelle pour tester une nouvelle clé
 */
export async function sendTestEmail(
  to: string,
  apiKeyOverride?: string
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: '[Qadhya] Test de configuration Brevo',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a365d;">Configuration Brevo réussie</h2>
        <p>Cet email confirme que votre configuration Brevo fonctionne correctement.</p>
        <p style="color: #666; font-size: 12px;">
          Envoyé depuis Qadhya - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}
        </p>
      </div>
    `,
    textContent: `Configuration Brevo réussie\n\nCet email confirme que votre configuration Brevo fonctionne correctement.\n\nEnvoyé depuis Qadhya - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}`,
    tags: ['test'],
  }, apiKeyOverride)
}

/**
 * Vérifie si Brevo est configuré (clé API présente)
 * @param apiKeyOverride Clé API optionnelle pour vérifier
 */
export async function isBrevoConfigured(apiKeyOverride?: string): Promise<boolean> {
  if (apiKeyOverride) return true
  const apiKey = await getConfig('BREVO_API_KEY')
  return !!apiKey
}

/**
 * Version synchrone pour compatibilité - utilise fallback env
 * @deprecated Préférer isBrevoConfigured() async
 */
export function isBrevoConfiguredSync(): boolean {
  return !!process.env.BREVO_API_KEY
}
