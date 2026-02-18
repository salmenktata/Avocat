/**
 * API Route - Résoudre un feedback RAG
 *
 * PATCH /api/admin/feedback/resolve
 * Body: { feedbackId, resolved, resolutionNotes? }
 *
 * @module app/api/admin/feedback/resolve/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userRole = session.user.role
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { feedbackId, resolved, resolutionNotes } = body

    if (!feedbackId) {
      return NextResponse.json({ error: 'feedbackId requis' }, { status: 400 })
    }

    if (typeof resolved !== 'boolean') {
      return NextResponse.json({ error: 'resolved doit être un booléen' }, { status: 400 })
    }

    const result = await db.query(
      `UPDATE rag_feedback SET
        is_resolved = $1,
        resolved_by = $2,
        resolved_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
        resolution_notes = $3
       WHERE id = $4
       RETURNING id, is_resolved, resolved_by, resolved_at, resolution_notes`,
      [resolved, resolved ? session.user.id : null, resolutionNotes || null, feedbackId]
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Feedback non trouvé' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      feedback: result.rows[0],
    })
  } catch (error) {
    console.error('[Feedback Resolve] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
