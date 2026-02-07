/**
 * API Route: Test provider email
 *
 * POST /api/super-admin/providers/email/test
 * Body: { provider: 'brevo' | 'resend', email?: string }
 *
 * Envoie un email de test via le provider spécifié
 * Réservé aux super admins
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'
import { testEmailProvider } from '@/lib/email/email-service'

/**
 * POST - Tester un provider email
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier super admin
    const adminCheck = await db.query(
      `SELECT is_super_admin, email FROM users WHERE id = $1`,
      [session.user.id]
    )

    if (!adminCheck.rows[0]?.is_super_admin) {
      return NextResponse.json(
        { error: 'Accès réservé aux super admins' },
        { status: 403 }
      )
    }

    const adminEmail = adminCheck.rows[0].email
    const body = await request.json()
    const { provider, email } = body

    // Valider le provider
    if (!provider || !['brevo', 'resend'].includes(provider)) {
      return NextResponse.json(
        { error: 'Provider invalide. Valeurs acceptées: brevo, resend' },
        { status: 400 }
      )
    }

    // Utiliser l'email fourni ou celui de l'admin
    const testEmail = email || adminEmail

    if (!testEmail) {
      return NextResponse.json(
        { error: 'Adresse email de test requise' },
        { status: 400 }
      )
    }

    // Envoyer l'email de test
    const result = await testEmailProvider(provider as 'brevo' | 'resend', testEmail)

    // Logger l'action
    try {
      await db.query(
        `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          session.user.id,
          'test_email_provider',
          'platform_config',
          provider,
          JSON.stringify({
            testEmail,
            success: result.success,
            error: result.error,
            messageId: result.messageId,
          }),
        ]
      )
    } catch (logError) {
      console.error('[Test Email] Erreur log audit:', logError)
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Email de test envoyé via ${provider} à ${testEmail}`,
        messageId: result.messageId,
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error || `Échec envoi via ${provider}`,
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Test Email] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
