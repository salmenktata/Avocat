import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - pas de prérendu statique
export const dynamic = 'force-dynamic'

import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const paymentId = searchParams.get('payment_id')

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID requis' }, { status: 400 })
    }

    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id

    // Récupérer le statut de la transaction
    const result = await query(
      `SELECT status
       FROM flouci_transactions
       WHERE flouci_payment_id = $1 AND user_id = $2
       LIMIT 1`,
      [paymentId, userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Transaction introuvable' }, { status: 404 })
    }

    return NextResponse.json({
      status: result.rows[0].status
    })
  } catch (error) {
    console.error('Erreur récupération statut Flouci:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
