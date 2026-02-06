/**
 * Template Email de Vérification
 * Design professionnel, simple et bilingue (FR/AR)
 */

import { sendEmail, type EmailResult } from '../email-service'
import {
  generateBaseTemplate,
  generateBaseTextTemplate,
  generateButton,
  generateFallbackLink,
  generateDivider,
  generateNote,
  type EmailLocale,
  APP_NAME,
  APP_URL,
  COLORS,
} from './base-template'

interface VerificationEmailParams {
  to: string
  userName: string
  verificationUrl: string
  locale?: EmailLocale
}

// Traductions
const TRANSLATIONS = {
  fr: {
    subject: `Confirmez votre email - ${APP_NAME}`,
    preheader: 'Cliquez pour activer votre compte',
    greeting: (name: string) => `Bonjour ${name},`,
    welcome: `Bienvenue sur ${APP_NAME} !`,
    message: 'Merci de votre inscription. Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.',
    button: 'Confirmer mon email',
    expiry: 'Ce lien expire dans 24 heures.',
    ignore: "Si vous n'avez pas créé de compte, ignorez simplement cet email.",
  },
  ar: {
    subject: `تأكيد بريدك الإلكتروني - ${APP_NAME}`,
    preheader: 'انقر لتفعيل حسابك',
    greeting: (name: string) => `مرحباً ${name}،`,
    welcome: `!${APP_NAME} مرحباً بك في`,
    message: 'شكراً على تسجيلك. لتفعيل حسابك، يرجى تأكيد عنوان بريدك الإلكتروني بالنقر على الزر أدناه.',
    button: 'تأكيد بريدي الإلكتروني',
    expiry: 'ينتهي هذا الرابط خلال 24 ساعة.',
    ignore: 'إذا لم تقم بإنشاء حساب، تجاهل هذا البريد ببساطة.',
  },
}

/**
 * Générer le contenu HTML de l'email
 */
function generateContent(params: {
  userName: string
  verificationUrl: string
  locale: EmailLocale
}): string {
  const { userName, verificationUrl, locale } = params
  const t = TRANSLATIONS[locale]
  const isRTL = locale === 'ar'
  const textAlign = isRTL ? 'right' : 'left'

  return `
    <h1 style="margin: 0 0 8px; color: ${COLORS.textDark}; font-size: 22px; font-weight: 600; text-align: ${textAlign};">
      ${t.welcome}
    </h1>

    <p style="margin: 0 0 24px; color: ${COLORS.textMuted}; font-size: 15px; line-height: 1.6; text-align: ${textAlign};">
      ${t.greeting(userName)}
    </p>

    <p style="margin: 0 0 8px; color: ${COLORS.textDark}; font-size: 15px; line-height: 1.6; text-align: ${textAlign};">
      ${t.message}
    </p>

    ${generateButton({ text: t.button, url: verificationUrl, locale })}

    ${generateFallbackLink({ url: verificationUrl, locale })}

    ${generateDivider()}

    ${generateNote({ text: `${t.expiry} ${t.ignore}`, locale })}
  `
}

/**
 * Générer le contenu texte de l'email
 */
function generateTextContent(params: {
  userName: string
  verificationUrl: string
  locale: EmailLocale
}): string {
  const { userName, verificationUrl, locale } = params
  const t = TRANSLATIONS[locale]

  return `
${t.welcome}

${t.greeting(userName)}

${t.message}

${t.button}: ${verificationUrl}

${t.expiry}
${t.ignore}
  `.trim()
}

/**
 * Envoyer l'email de vérification
 */
export async function sendVerificationEmail(params: VerificationEmailParams): Promise<EmailResult> {
  const { to, userName, verificationUrl, locale = 'fr' } = params
  const t = TRANSLATIONS[locale]

  const html = generateBaseTemplate({
    locale,
    content: generateContent({ userName, verificationUrl, locale }),
    recipientEmail: to,
    preheader: t.preheader,
  })

  const text = generateBaseTextTemplate({
    locale,
    content: generateTextContent({ userName, verificationUrl, locale }),
    recipientEmail: to,
  })

  return sendEmail({
    to,
    subject: t.subject,
    html,
    text,
  })
}

/**
 * Version legacy pour compatibilité
 * @deprecated Utilisez sendVerificationEmail
 */
interface LegacyParams {
  to: string
  nom: string
  prenom: string
  verificationToken: string
  locale?: EmailLocale
}

export async function sendVerificationEmailLegacy(params: LegacyParams): Promise<EmailResult> {
  const { to, nom, prenom, verificationToken, locale = 'fr' } = params
  const verificationUrl = `${APP_URL}/api/auth/verify-email?token=${verificationToken}`
  const userName = `${prenom} ${nom}`.trim() || to.split('@')[0]

  return sendVerificationEmail({
    to,
    userName,
    verificationUrl,
    locale,
  })
}
