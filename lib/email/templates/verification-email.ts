/**
 * Template Email de Vérification
 * Envoyé lors de l'inscription pour confirmer l'email
 */

import { sendEmail, type SendEmailResult } from '../resend-client'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'MonCabinet'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7002'

interface VerificationEmailParams {
  to: string
  userName: string
  verificationUrl: string
}

// Compatibilité avec l'ancienne signature
interface LegacyVerificationEmailParams {
  to: string
  nom: string
  prenom: string
  verificationToken: string
}

/**
 * Générer le HTML du template de vérification
 */
function generateVerificationEmailHtml(userName: string, verificationUrl: string, email: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vérifiez votre email - ${APP_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #1e40af; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">${APP_NAME}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 24px;">
                Bienvenue, ${userName} !
              </h2>

              <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.6;">
                Merci de vous être inscrit sur ${APP_NAME}. Pour activer votre compte et commencer à utiliser nos services, veuillez vérifier votre adresse email.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${verificationUrl}"
                       style="display: inline-block; padding: 16px 32px; background-color: #1e40af; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px;">
                      Vérifier mon email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
              </p>
              <p style="margin: 10px 0 0; color: #1e40af; font-size: 14px; word-break: break-all;">
                ${verificationUrl}
              </p>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

              <p style="margin: 0; color: #64748b; font-size: 14px;">
                Ce lien expire dans 24 heures.
              </p>
              <p style="margin: 10px 0 0; color: #64748b; font-size: 14px;">
                Si vous n'avez pas demandé cette vérification, vous pouvez ignorer cet email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8fafc; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                ${APP_NAME} - Logiciel de gestion de cabinet d'avocat
              </p>
              <p style="margin: 10px 0 0; color: #94a3b8; font-size: 12px;">
                Cet email a été envoyé à ${email}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * Générer le texte brut pour les clients email ne supportant pas HTML
 */
function generateVerificationEmailText(userName: string, verificationUrl: string): string {
  return `
Bienvenue sur ${APP_NAME}, ${userName} !

Merci de vous être inscrit. Pour activer votre compte, veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous :

${verificationUrl}

Ce lien expire dans 24 heures.

Si vous n'avez pas demandé cette vérification, vous pouvez ignorer cet email.

---
${APP_NAME} - Logiciel de gestion de cabinet d'avocat
  `.trim()
}

/**
 * Envoyer l'email de vérification
 *
 * @example
 * await sendVerificationEmail({
 *   to: 'user@example.com',
 *   userName: 'Jean Dupont',
 *   verificationUrl: 'https://app.com/api/auth/verify-email?token=xxx'
 * })
 */
export async function sendVerificationEmail(params: VerificationEmailParams): Promise<SendEmailResult> {
  return sendEmail({
    to: params.to,
    subject: `Vérifiez votre email - ${APP_NAME}`,
    html: generateVerificationEmailHtml(params.userName, params.verificationUrl, params.to),
    text: generateVerificationEmailText(params.userName, params.verificationUrl),
  })
}

/**
 * Version legacy avec l'ancienne signature
 * @deprecated Utilisez sendVerificationEmail avec userName et verificationUrl
 */
export async function sendVerificationEmailLegacy(params: LegacyVerificationEmailParams): Promise<SendEmailResult> {
  const verificationUrl = `${APP_URL}/verify-email?token=${params.verificationToken}`
  const userName = `${params.prenom} ${params.nom}`.trim()

  return sendVerificationEmail({
    to: params.to,
    userName,
    verificationUrl,
  })
}
