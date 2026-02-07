/**
 * API Route: Toggle permission feedback utilisateur
 *
 * PATCH /api/super-admin/users/[id]/feedback-permission
 * Réservé aux super admins
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()

    // Vérifier authentification
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est super admin
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

    const { id: userId } = await params
    const body = await request.json()
    const { canProvideFeedback } = body

    if (typeof canProvideFeedback !== 'boolean') {
      return NextResponse.json(
        { error: 'canProvideFeedback doit être un booléen' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur cible existe
    const userCheck = await db.query(
      `SELECT id, email, can_provide_feedback FROM users WHERE id = $1`,
      [userId]
    )

    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Mettre à jour la permission
    const result = await db.query(
      `UPDATE users
       SET can_provide_feedback = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, can_provide_feedback`,
      [canProvideFeedback, userId]
    )

    const updatedUser = result.rows[0]

    // Logger l'action admin
    try {
      await db.query(
        `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          session.user.id,
          canProvideFeedback ? 'enable_feedback' : 'disable_feedback',
          'user',
          userId,
          JSON.stringify({ email: updatedUser.email }),
        ]
      )
    } catch (logError) {
      console.error('[FeedbackPermission] Erreur log audit:', logError)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        canProvideFeedback: updatedUser.can_provide_feedback,
      },
    })
  } catch (error) {
    console.error('[FeedbackPermission] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: userId } = await params

    const result = await db.query(
      `SELECT id, email, can_provide_feedback, is_super_admin
       FROM users WHERE id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    const user = result.rows[0]

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        canProvideFeedback: user.can_provide_feedback || user.is_super_admin,
        isSuperAdmin: user.is_super_admin,
      },
    })
  } catch (error) {
    console.error('[FeedbackPermission GET] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
