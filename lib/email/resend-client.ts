/**
 * Client Resend - Service Email
 * Gestion envoi emails via Resend API
 */

import { Resend } from 'resend'
import { getConfig } from '@/lib/config/platform-config'

// Configuration email (fallback sur env)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notifications@qadhya.tn'
const FROM_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Qadhya'

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// Timeout pour éviter les blocages (3 secondes max)
const RESEND_TIMEOUT_MS = 3000

/**
 * Crée une instance Resend avec la clé fournie ou depuis la config
 */
async function createResendClient(apiKeyOverride?: string): Promise<Resend> {
  const apiKey = apiKeyOverride || await getConfig('RESEND_API_KEY')

  if (!apiKey) {
    throw new Error('RESEND_API_KEY non configurée')
  }

  return new Resend(apiKey)
}

/**
 * Envoyer un email via Resend avec timeout
 * @param params Paramètres de l'email
 * @param apiKeyOverride Clé API optionnelle pour override (tests)
 */
export async function sendEmail(
  params: SendEmailParams,
  apiKeyOverride?: string
): Promise<SendEmailResult> {
  try {
    const resend = await createResendClient(apiKeyOverride)

    // Créer une promesse avec timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout Resend')), RESEND_TIMEOUT_MS)
    })

    const sendPromise = resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    })

    const { data, error } = await Promise.race([sendPromise, timeoutPromise])

    if (error) {
      console.error('[Resend] Erreur envoi email:', error)
      return {
        success: false,
        error: error.message || 'Erreur envoi email',
      }
    }

    console.log('[Resend] Email envoyé avec succès:', data?.id)

    return {
      success: true,
      messageId: data?.id,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Exception inconnue'
    console.error('[Resend] Exception envoi email:', errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Envoyer un email de test (développement)
 * @param to Adresse email destinataire
 * @param apiKeyOverride Clé API optionnelle pour tester une nouvelle clé
 */
export async function sendTestEmail(
  to: string,
  apiKeyOverride?: string
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: '[Qadhya] Test de configuration Resend',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #1a365d;">Configuration Resend réussie</h1>
        <p>Cet email confirme que votre configuration Resend fonctionne correctement.</p>
        <p style="color: #666; font-size: 12px;">
          Envoyé depuis Qadhya - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}
        </p>
      </div>
    `,
    text: `Configuration Resend réussie\n\nCet email confirme que votre configuration Resend fonctionne correctement.\n\nEnvoyé depuis Qadhya - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}`,
  }, apiKeyOverride)
}

/**
 * Vérifie si Resend est configuré (clé API présente)
 * @param apiKeyOverride Clé API optionnelle pour vérifier
 */
export async function isResendConfigured(apiKeyOverride?: string): Promise<boolean> {
  if (apiKeyOverride) return true
  const apiKey = await getConfig('RESEND_API_KEY')
  return !!apiKey
}

/**
 * Version synchrone pour compatibilité - utilise fallback env
 * @deprecated Préférer isResendConfigured() async
 */
export function isResendConfiguredSync(): boolean {
  return !!process.env.RESEND_API_KEY
}
