/**
 * API Route: Configuration des providers email
 *
 * GET  /api/super-admin/providers/email - Récupérer la config actuelle
 * POST /api/super-admin/providers/email - Mettre à jour mode et/ou clés API
 *
 * Réservé aux super admins
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'
import {
  getEmailProviderConfig,
  setEmailProviderMode,
  setEmailApiKey,
  type EmailProviderMode,
} from '@/lib/config/provider-config'

/**
 * Vérifie que l'utilisateur est super admin
 */
async function requireSuperAdmin(session: { user?: { id?: string } } | null) {
  if (!session?.user?.id) {
    return { error: 'Non authentifié', status: 401 }
  }

  const adminCheck = await db.query(
    `SELECT is_super_admin FROM users WHERE id = $1`,
    [session.user.id]
  )

  if (!adminCheck.rows[0]?.is_super_admin) {
    return { error: 'Accès réservé aux super admins', status: 403 }
  }

  return null
}

/**
 * GET - Récupérer la configuration email actuelle
 */
export async function GET() {
  try {
    const session = await getSession()
    const authError = await requireSuperAdmin(session)
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status })
    }

    const config = await getEmailProviderConfig()

    return NextResponse.json({
      success: true,
      data: config,
    })
  } catch (error) {
    console.error('[Providers Email GET] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * POST - Mettre à jour la configuration email
 * Body: { mode?: 'brevo' | 'resend' | 'auto', brevoApiKey?: string, resendApiKey?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const authError = await requireSuperAdmin(session)
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status })
    }

    const body = await request.json()
    const { mode, brevoApiKey, resendApiKey } = body

    const results: string[] = []

    // Valider et mettre à jour le mode
    if (mode !== undefined) {
      if (!['brevo', 'resend', 'auto'].includes(mode)) {
        return NextResponse.json(
          { error: 'Mode invalide. Valeurs acceptées: brevo, resend, auto' },
          { status: 400 }
        )
      }

      const success = await setEmailProviderMode(mode as EmailProviderMode)
      if (!success) {
        return NextResponse.json(
          { error: 'Échec mise à jour du mode email' },
          { status: 500 }
        )
      }
      results.push(`Mode: ${mode}`)
    }

    // Mettre à jour la clé Brevo
    if (brevoApiKey !== undefined) {
      if (typeof brevoApiKey !== 'string' || brevoApiKey.length < 10) {
        return NextResponse.json(
          { error: 'Clé API Brevo invalide' },
          { status: 400 }
        )
      }

      const success = await setEmailApiKey('brevo', brevoApiKey)
      if (!success) {
        return NextResponse.json(
          { error: 'Échec mise à jour clé Brevo' },
          { status: 500 }
        )
      }
      results.push('Clé Brevo mise à jour')
    }

    // Mettre à jour la clé Resend
    if (resendApiKey !== undefined) {
      if (typeof resendApiKey !== 'string' || resendApiKey.length < 10) {
        return NextResponse.json(
          { error: 'Clé API Resend invalide' },
          { status: 400 }
        )
      }

      const success = await setEmailApiKey('resend', resendApiKey)
      if (!success) {
        return NextResponse.json(
          { error: 'Échec mise à jour clé Resend' },
          { status: 500 }
        )
      }
      results.push('Clé Resend mise à jour')
    }

    // Logger l'action
    try {
      await db.query(
        `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          session!.user!.id,
          'update_email_provider_config',
          'platform_config',
          'email',
          JSON.stringify({ changes: results }),
        ]
      )
    } catch (logError) {
      console.error('[Providers Email] Erreur log audit:', logError)
    }

    // Récupérer la nouvelle config
    const newConfig = await getEmailProviderConfig()

    return NextResponse.json({
      success: true,
      message: results.length > 0 ? results.join(', ') : 'Aucune modification',
      data: newConfig,
    })
  } catch (error) {
    console.error('[Providers Email POST] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
