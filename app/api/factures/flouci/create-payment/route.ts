/**
 * API: Créer paiement Flouci pour une facture
 *
 * POST /api/factures/flouci/create-payment
 *
 * Body:
 * - facture_id: UUID de la facture
 * - montant_ttc: Montant TTC en TND
 * - client_telephone: Téléphone client (optionnel)
 * - client_nom: Nom client
 *
 * Retourne:
 * - payment_id: ID unique paiement Flouci
 * - qr_code_url: URL image QR code
 * - payment_url: URL paiement web
 * - deep_link: Deep link app Flouci
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { flouciClient, FlouciUtils } from '@/lib/integrations/flouci'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Vérifier authentification
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // 2. Lire body
    const body = await request.json()
    const { facture_id, montant_ttc, client_telephone, client_nom } = body

    if (!facture_id || !montant_ttc) {
      return NextResponse.json({ error: 'facture_id et montant_ttc requis' }, { status: 400 })
    }

    // 3. Vérifier que la facture existe et n'est pas déjà payée
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .select('id, numero_facture, montant_ttc, statut')
      .eq('id', facture_id)
      .single()

    if (factureError || !facture) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
    }

    if (facture.statut === 'PAYEE') {
      return NextResponse.json({ error: 'Facture déjà payée' }, { status: 400 })
    }

    // 4. Vérifier si un paiement Flouci existe déjà pour cette facture (non expiré)
    const { data: existingTransaction } = await supabase
      .from('flouci_transactions')
      .select('flouci_payment_id, qr_code_url, payment_url, deep_link, status, expired_at')
      .eq('facture_id', facture_id)
      .in('status', ['pending', 'initiated'])
      .gt('expired_at', new Date().toISOString())
      .single()

    if (existingTransaction) {
      // Retourner paiement existant
      const commission = FlouciUtils.calculerCommission(montant_ttc)

      return NextResponse.json({
        payment_id: existingTransaction.flouci_payment_id,
        qr_code_url: existingTransaction.qr_code_url,
        payment_url: existingTransaction.payment_url,
        deep_link: existingTransaction.deep_link,
        montant: montant_ttc,
        commission,
        status: existingTransaction.status,
        message: 'Paiement existant retourné',
      })
    }

    // 5. Créer nouveau paiement Flouci
    const montantMillimes = FlouciUtils.tndToMillimes(montant_ttc)
    const commission = FlouciUtils.calculerCommission(montant_ttc)

    const paymentResponse = await flouciClient.createPayment({
      amount: montantMillimes,
      developer_tracking_id: facture_id,
      session_timeout_secs: 900, // 15 minutes
      success_link: `${process.env.NEXT_PUBLIC_APP_URL}/factures/${facture_id}?payment=success`,
      fail_link: `${process.env.NEXT_PUBLIC_APP_URL}/factures/${facture_id}?payment=failed`,
    })

    if (!paymentResponse.result?.success || !paymentResponse.result?.payment_id) {
      throw new Error('Échec création paiement Flouci: ' + (paymentResponse.result?.message || 'Erreur inconnue'))
    }

    const paymentId = paymentResponse.result.payment_id
    const qrCodeURL = flouciClient.getQRCodeURL(paymentId)
    const deepLink = flouciClient.getDeepLink(paymentId)
    const paymentURL = paymentResponse.result._link || `${process.env.FLOUCI_API_URL}/payment/${paymentId}`

    // 6. Enregistrer transaction dans la base de données
    const { error: insertError } = await supabase.from('flouci_transactions').insert({
      facture_id,
      flouci_payment_id: paymentId,
      montant: montant_ttc,
      commission_flouci: commission,
      status: 'pending',
      client_telephone,
      client_nom,
      qr_code_url: qrCodeURL,
      payment_url: paymentURL,
      deep_link: deepLink,
      flouci_response: paymentResponse.result,
      initiated_at: new Date().toISOString(),
      expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
    })

    if (insertError) {
      console.error('Erreur insertion transaction Flouci:', insertError)
      throw new Error('Erreur enregistrement transaction')
    }

    // 7. Retourner données paiement
    return NextResponse.json({
      success: true,
      payment_id: paymentId,
      qr_code_url: qrCodeURL,
      payment_url: paymentURL,
      deep_link: deepLink,
      montant: montant_ttc,
      commission,
      expires_in_minutes: 15,
    })
  } catch (error) {
    console.error('Erreur création paiement Flouci:', error)
    return NextResponse.json(
      {
        error: 'Erreur serveur',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    )
  }
}
