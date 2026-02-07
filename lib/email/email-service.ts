/**
 * Service Email Unifié
 * Supporte 3 modes: brevo (seul), resend (seul), auto (failover)
 *
 * Ce service gère l'envoi d'emails avec failover automatique.
 * La configuration est lue depuis la base de données.
 */

import { sendEmail as sendResendEmail, isResendConfigured } from './resend-client'
import { sendEmail as sendBrevoEmail, isBrevoConfigured } from './brevo-client'
import {
  getEmailProviderMode,
  getEmailFailoverOrder,
  type EmailProviderMode,
} from '@/lib/config/provider-config'

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

/**
 * Détermine le provider disponible selon le mode et la configuration
 */
async function getAvailableProvider(
  mode: EmailProviderMode,
  failoverOrder: ('brevo' | 'resend')[]
): Promise<'brevo' | 'resend' | null> {
  const [brevoOk, resendOk] = await Promise.all([
    isBrevoConfigured(),
    isResendConfigured(),
  ])

  if (mode === 'brevo') {
    return brevoOk ? 'brevo' : null
  }

  if (mode === 'resend') {
    return resendOk ? 'resend' : null
  }

  // Mode auto: utiliser l'ordre de failover
  for (const provider of failoverOrder) {
    if (provider === 'brevo' && brevoOk) return 'brevo'
    if (provider === 'resend' && resendOk) return 'resend'
  }

  return null
}

/**
 * Envoie via un provider spécifique
 */
async function sendViaProvider(
  provider: 'brevo' | 'resend',
  params: EmailParams
): Promise<EmailResult> {
  if (provider === 'brevo') {
    const result = await sendBrevoEmail({
      to: params.to,
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
      replyTo: params.replyTo,
      tags: params.tags,
    })
    return {
      success: result.success,
      messageId: result.messageId,
      provider: 'brevo',
      error: result.error,
    }
  }

  const result = await sendResendEmail({
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
  })
  return {
    success: result.success,
    messageId: result.messageId,
    provider: 'resend',
    error: result.error,
  }
}

// =============================================================================
// FONCTION PRINCIPALE
// =============================================================================

/**
 * Envoie un email selon le mode configuré
 * - brevo: utilise uniquement Brevo
 * - resend: utilise uniquement Resend
 * - auto: failover automatique selon l'ordre configuré
 */
export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  const [mode, failoverOrder] = await Promise.all([
    getEmailProviderMode(),
    getEmailFailoverOrder(),
  ])

  // Vérifier qu'au moins un provider est configuré
  const primaryProvider = await getAvailableProvider(mode, failoverOrder)
  if (!primaryProvider) {
    console.error('[Email] Aucun provider email configuré pour le mode:', mode)
    return {
      success: false,
      error: `Aucun provider email configuré (mode: ${mode})`,
    }
  }

  // Mode spécifique (brevo ou resend seul)
  if (mode === 'brevo' || mode === 'resend') {
    console.log(`[Email] Envoi via ${mode} (mode spécifique)...`)
    return sendViaProvider(mode, params)
  }

  // Mode auto avec failover
  const [brevoOk, resendOk] = await Promise.all([
    isBrevoConfigured(),
    isResendConfigured(),
  ])

  for (let i = 0; i < failoverOrder.length; i++) {
    const provider = failoverOrder[i]
    const isConfigured = provider === 'brevo' ? brevoOk : resendOk

    if (!isConfigured) continue

    console.log(`[Email] Tentative envoi via ${provider}...`)
    const result = await sendViaProvider(provider, params)

    if (result.success) {
      console.log(`[Email] Envoyé via ${provider}:`, result.messageId)
      return {
        ...result,
        fallbackUsed: i > 0,
      }
    }

    // Échec, on log et on continue avec le suivant
    console.warn(`[Email] ${provider} a échoué:`, result.error)

    // Si c'est le dernier, on retourne l'erreur
    if (i === failoverOrder.length - 1) {
      return {
        success: false,
        error: result.error,
        fallbackUsed: i > 0,
      }
    }
  }

  // Aucun provider disponible (ne devrait pas arriver)
  return {
    success: false,
    error: 'Aucun provider email disponible',
  }
}

/**
 * Teste un provider spécifique avec une adresse email
 * @param provider Le provider à tester
 * @param to Adresse email destinataire du test
 */
export async function testEmailProvider(
  provider: 'brevo' | 'resend',
  to: string
): Promise<EmailResult> {
  const isConfigured = provider === 'brevo'
    ? await isBrevoConfigured()
    : await isResendConfigured()

  if (!isConfigured) {
    return {
      success: false,
      provider,
      error: `${provider} n'est pas configuré (clé API manquante)`,
    }
  }

  console.log(`[Email] Test du provider ${provider}...`)

  return sendViaProvider(provider, {
    to,
    subject: `[Qadhya] Test de configuration ${provider}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a365d;">Configuration ${provider} réussie</h2>
        <p>Cet email confirme que votre configuration ${provider} fonctionne correctement.</p>
        <p><strong>Provider testé:</strong> ${provider}</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Envoyé depuis Qadhya - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}
        </p>
      </div>
    `,
    text: `Configuration ${provider} réussie\n\nCet email confirme que votre configuration ${provider} fonctionne correctement.\n\nProvider testé: ${provider}\n\nEnvoyé depuis Qadhya - ${new Date().toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}`,
    tags: ['test'],
  })
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
export async function getEmailProvidersStatus(): Promise<{
  resend: boolean
  brevo: boolean
  mode: EmailProviderMode
  primary: 'resend' | 'brevo' | null
}> {
  const [brevoOk, resendOk, mode, failoverOrder] = await Promise.all([
    isBrevoConfigured(),
    isResendConfigured(),
    getEmailProviderMode(),
    getEmailFailoverOrder(),
  ])

  const primary = await getAvailableProvider(mode, failoverOrder)

  return {
    resend: resendOk,
    brevo: brevoOk,
    mode,
    primary,
  }
}
