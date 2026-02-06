/**
 * Client Brevo (ex-Sendinblue) pour l'envoi d'emails transactionnels
 * Utilisé pour les notifications quotidiennes et autres emails système
 */

import * as Brevo from '@getbrevo/brevo'

// =============================================================================
// CONFIGURATION
// =============================================================================

const BREVO_API_KEY = process.env.BREVO_API_KEY || ''
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'notifications@moncabinet.tn'
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'MonCabinet'

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
// CLIENT SINGLETON
// =============================================================================

let apiInstance: Brevo.TransactionalEmailsApi | null = null

function getApiInstance(): Brevo.TransactionalEmailsApi {
  if (!apiInstance) {
    if (!BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY non configuré')
    }
    apiInstance = new Brevo.TransactionalEmailsApi()
    apiInstance.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      BREVO_API_KEY
    )
  }
  return apiInstance
}

// =============================================================================
// FONCTIONS D'ENVOI
// =============================================================================

/**
 * Envoie un email transactionnel via Brevo
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, htmlContent, textContent, replyTo, tags } = params

  try {
    const api = getApiInstance()

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
 */
export async function sendTestEmail(to: string): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: '[MonCabinet] Test de configuration Brevo',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a365d;">Configuration Brevo réussie</h2>
        <p>Cet email confirme que votre configuration Brevo fonctionne correctement.</p>
        <p style="color: #666; font-size: 12px;">
          Envoyé depuis MonCabinet - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}
        </p>
      </div>
    `,
    textContent: `Configuration Brevo réussie\n\nCet email confirme que votre configuration Brevo fonctionne correctement.\n\nEnvoyé depuis MonCabinet - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}`,
    tags: ['test'],
  })
}

/**
 * Vérifie si Brevo est configuré
 */
export function isBrevoConfigured(): boolean {
  return !!BREVO_API_KEY
}
