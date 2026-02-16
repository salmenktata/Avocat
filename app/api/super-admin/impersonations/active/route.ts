import { NextResponse } from 'next/server'
import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'

/**
 * GET /api/super-admin/impersonations/active
 * Liste toutes les impersonnalisations actives
 */
export async function GET() {
  try {
    // Vérifier que l'utilisateur est super_admin
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userResult = await query(
      'SELECT role FROM users WHERE id = $1',
      [session.user.id]
    )
    if (!userResult.rows[0] || userResult.rows[0].role !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Récupérer toutes les sessions actives avec infos admin et utilisateur cible
    const result = await query(`
      SELECT
        ai.id,
        ai.admin_id,
        ai.target_user_id,
        ai.reason,
        ai.started_at,
        ai.expires_at,
        ai.ip_address,
        ai.user_agent,
        u1.email as admin_email,
        u1.nom || ' ' || u1.prenom as admin_name,
        u2.email as target_email,
        u2.nom || ' ' || u2.prenom as target_name,
        u2.role as target_role
      FROM active_impersonations ai
      JOIN users u1 ON ai.admin_id = u1.id
      JOIN users u2 ON ai.target_user_id = u2.id
      WHERE ai.is_active = true
      ORDER BY ai.started_at DESC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error('[Impersonations Active API] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/super-admin/impersonations/active
 * Force l'arrêt d'une impersonnalisation
 */
export async function DELETE(request: Request) {
  try {
    // Vérifier que l'utilisateur est super_admin
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userResult = await query(
      'SELECT role FROM users WHERE id = $1',
      [session.user.id]
    )
    if (!userResult.rows[0] || userResult.rows[0].role !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Désactiver la session
    await query(
      'UPDATE active_impersonations SET is_active = false WHERE id = $1',
      [id]
    )

    // Note: On ne peut pas invalider le cookie JWT côté serveur
    // L'admin devra recharger la page pour que le middleware détecte l'expiration

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Impersonations Active API] Erreur DELETE:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
