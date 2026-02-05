/**
 * Webhook Flouci - Notifications paiements
 *
 * URL webhook à configurer dans dashboard Flouci:
 * https://votre-domaine.tn/api/webhooks/flouci
 *
 * Événements reçus:
 * - Payment SUCCESS → Marquer facture PAYÉE (trigger auto DB)
 * - Payment FAILED → Log échec
 * - Payment EXPIRED → Log expiration
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/postgres'
import { flouciClient, mapperStatutFlouci, FlouciUtils, type FlouciWebhookPayload } from '@/lib/integrations/flouci'

/**
 * POST /api/webhooks/flouci
 *
 * Webhook appelé par Flouci après changement statut paiement
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Lire payload
    const body = await request.text()
    const payload: FlouciWebhookPayload = JSON.parse(body)

    console.log('[Flouci Webhook] Payload reçu:', payload)

    // 2. Valider signature (OBLIGATOIRE)
    const signature = request.headers.get('x-flouci-signature')

    if (!signature) {
      console.error('[Flouci Webhook] Signature manquante')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    if (!flouciClient.validateWebhookSignature(body, signature)) {
      console.error('[Flouci Webhook] Signature invalide')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 3. Vérifier champs requis
    if (!payload.payment_id || !payload.status) {
      console.error('[Flouci Webhook] Champs manquants:', payload)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 4. Récupérer transaction Flouci existante avec facture
    const transactionResult = await query(
      `SELECT ft.*, f.numero, f.statut as facture_statut, f.montant_ttc
       FROM flouci_transactions ft
       LEFT JOIN factures f ON ft.facture_id = f.id
       WHERE ft.flouci_payment_id = $1`,
      [payload.payment_id]
    )

    if (transactionResult.rows.length === 0) {
      console.error('[Flouci Webhook] Transaction introuvable:', payload.payment_id)
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const transaction = transactionResult.rows[0]

    // 5. Valider le montant du paiement
    if (payload.amount !== undefined && transaction.montant) {
      const expectedAmount = parseFloat(transaction.montant)
      const receivedAmount = parseFloat(payload.amount.toString())

      // Tolérance de 0.01 TND pour gérer les arrondis
      if (Math.abs(expectedAmount - receivedAmount) > 0.01) {
        console.error('[Flouci Webhook] Montant invalide:', {
          expected: expectedAmount,
          received: receivedAmount,
          payment_id: payload.payment_id
        })
        return NextResponse.json({
          error: 'Amount mismatch',
          expected: expectedAmount,
          received: receivedAmount
        }, { status: 400 })
      }
    }

    // 6. Mapper statut Flouci
    const nouveauStatut = mapperStatutFlouci(payload.status)

    // 7. Mettre à jour transaction
    if (nouveauStatut === 'completed') {
      await query(
        `UPDATE flouci_transactions
         SET status = $1,
             flouci_transaction_id = $2,
             flouci_response = $3,
             webhook_received_at = NOW(),
             completed_at = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [
          nouveauStatut,
          payload.transaction_id || null,
          JSON.stringify(payload),
          payload.created_at || new Date(),
          transaction.id
        ]
      )
    } else {
      await query(
        `UPDATE flouci_transactions
         SET status = $1,
             flouci_transaction_id = $2,
             flouci_response = $3,
             webhook_received_at = NOW(),
             updated_at = NOW()
         WHERE id = $4`,
        [
          nouveauStatut,
          payload.transaction_id || null,
          JSON.stringify(payload),
          transaction.id
        ]
      )
    }

    console.log(`[Flouci Webhook] Transaction ${payload.payment_id} → ${nouveauStatut}`)

    // 8. Si SUCCESS, trigger DB marquera automatiquement facture comme PAYÉE
    if (nouveauStatut === 'completed') {
      console.log(`[Flouci Webhook] ✅ Paiement réussi - Facture ${transaction.numero} marquée PAYÉE (trigger auto)`)

      // Optionnel: Envoyer email confirmation au client
      // await envoyerEmailConfirmationPaiement(transaction.facture_id)
    }

    // 9. Retourner succès à Flouci
    return NextResponse.json({
      success: true,
      message: 'Webhook processed',
      payment_id: payload.payment_id,
      status: nouveauStatut,
    })
  } catch (error) {
    console.error('[Flouci Webhook] Erreur:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/flouci
 *
 * Endpoint de test pour vérifier que le webhook est accessible
 */
export async function GET() {
  return NextResponse.json({
    service: 'Flouci Webhook',
    status: 'active',
    url: '/api/webhooks/flouci',
    methods: ['POST'],
  })
}
