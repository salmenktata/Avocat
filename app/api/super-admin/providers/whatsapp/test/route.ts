/**
 * API Route: Test connexion WhatsApp
 *
 * POST /api/super-admin/providers/whatsapp/test
 *
 * Vérifie la connexion WhatsApp (appel API Meta pour validation token)
 * Réservé aux super admins
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'
import { getConfig } from '@/lib/config/platform-config'

/**
 * POST - Tester la connexion WhatsApp
 */
export async function POST() {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier super admin
    const adminCheck = await db.query(
      `SELECT is_super_admin FROM users WHERE id = $1`,
      [session.user.id]
    )

    if (!adminCheck.rows[0]?.is_super_admin) {
      return NextResponse.json(
        { error: 'Accès réservé aux super admins' },
        { status: 403 }
      )
    }

    // Récupérer la configuration WhatsApp
    const [token, phoneNumberId] = await Promise.all([
      getConfig('WHATSAPP_TOKEN'),
      getConfig('WHATSAPP_PHONE_NUMBER_ID'),
    ])

    if (!token || !phoneNumberId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration WhatsApp incomplète',
          details: {
            hasToken: !!token,
            hasPhoneNumberId: !!phoneNumberId,
          },
        },
        { status: 400 }
      )
    }

    // Appel API Meta pour vérifier le token
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const data = await response.json()

    // Logger l'action
    try {
      await db.query(
        `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          session.user.id,
          'test_whatsapp_connection',
          'platform_config',
          'whatsapp',
          JSON.stringify({
            success: response.ok,
            statusCode: response.status,
            phoneNumber: data.display_phone_number,
          }),
        ]
      )
    } catch (logError) {
      console.error('[Test WhatsApp] Erreur log audit:', logError)
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Erreur API Meta: ${data.error?.message || response.statusText}`,
          details: {
            code: data.error?.code,
            type: data.error?.type,
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Connexion WhatsApp validée',
      data: {
        phoneNumber: data.display_phone_number,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating,
        platformType: data.platform_type,
        codeVerificationStatus: data.code_verification_status,
      },
    })
  } catch (error) {
    console.error('[Test WhatsApp] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
