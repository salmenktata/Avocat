'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Smartphone, QrCode, ExternalLink, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { FlouciUtils } from '@/lib/integrations/flouci'

interface FlouciPaymentButtonProps {
  factureId: string
  montantTTC: number
  numeroFacture: string
  clientNom: string
  clientTelephone?: string
  disabled?: boolean
}

export default function FlouciPaymentButton({
  factureId,
  montantTTC,
  numeroFacture,
  clientNom,
  clientTelephone,
  disabled = false,
}: FlouciPaymentButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentData, setPaymentData] = useState<{
    payment_id: string
    qr_code_url: string
    payment_url: string
    deep_link: string
    montant: number
    commission: number
  } | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | 'expired'>('pending')

  /**
   * Créer paiement Flouci et générer QR code
   */
  const creerPaiement = async () => {
    setLoading(true)
    setError(null)

    try {
      // Appeler API backend pour créer paiement Flouci
      const response = await fetch('/api/factures/flouci/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facture_id: factureId,
          montant_ttc: montantTTC,
          client_telephone: clientTelephone,
          client_nom: clientNom,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur création paiement')
      }

      const data = await response.json()

      setPaymentData({
        payment_id: data.payment_id,
        qr_code_url: data.qr_code_url,
        payment_url: data.payment_url,
        deep_link: data.deep_link,
        montant: data.montant,
        commission: data.commission,
      })

      // Démarrer polling statut paiement
      demarrerPollingStatut(data.payment_id)
    } catch (err) {
      console.error('Erreur création paiement Flouci:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Polling du statut paiement (vérifier toutes les 3 secondes)
   */
  const demarrerPollingStatut = (paymentId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/factures/flouci/status?payment_id=${encodeURIComponent(paymentId)}`)

        if (!response.ok) {
          throw new Error('Erreur récupération statut')
        }

        const data = await response.json()

        if (data.status === 'completed') {
          setPaymentStatus('success')
          clearInterval(interval)
        } else if (data.status === 'failed') {
          setPaymentStatus('failed')
          clearInterval(interval)
        } else if (data.status === 'expired') {
          setPaymentStatus('expired')
          clearInterval(interval)
        }
      } catch (err) {
        console.error('Erreur polling statut:', err)
      }
    }, 3000) // 3 secondes

    // Arrêter polling après 15 minutes (expiration)
    setTimeout(() => clearInterval(interval), 15 * 60 * 1000)
  }

  /**
   * Ouvrir dialog et créer paiement
   */
  const handleOpenDialog = (open: boolean) => {
    setIsOpen(open)
    if (open && !paymentData && !loading) {
      creerPaiement()
    }
  }

  const commission = FlouciUtils.calculerCommission(montantTTC)
  const montantNet = FlouciUtils.calculerMontantNet(montantTTC)

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenDialog}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" disabled={disabled} className="gap-2">
          <Smartphone className="h-4 w-4" />
          Payer par Flouci
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Paiement mobile Flouci
          </DialogTitle>
          <DialogDescription>
            Facture {numeroFacture} - {FlouciUtils.formaterMontant(montantTTC)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Génération du QR code Flouci...</p>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* QR Code et instructions */}
          {paymentData && paymentStatus === 'pending' && (
            <div className="space-y-4">
              <Alert>
                <QrCode className="h-4 w-4" />
                <AlertDescription>
                  <strong>Comment payer :</strong>
                  <ol className="mt-2 space-y-1 text-sm list-decimal list-inside">
                    <li>Ouvrez l'application Flouci sur votre mobile</li>
                    <li>Scannez le QR code ci-dessous</li>
                    <li>Confirmez le paiement dans l'app</li>
                  </ol>
                </AlertDescription>
              </Alert>

              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg border-2">
                <img
                  src={paymentData.qr_code_url}
                  alt="QR Code Flouci"
                  className="w-64 h-64"
                  onError={(e) => {
                    console.error('Erreur chargement QR code')
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'
                  }}
                />
              </div>

              {/* Informations montant */}
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant facture</span>
                  <span className="font-semibold">{FlouciUtils.formaterMontant(montantTTC)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Commission Flouci (1.5%)</span>
                  <span>-{FlouciUtils.formaterMontant(commission)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Vous recevrez</span>
                  <span className="font-bold text-green-600">{FlouciUtils.formaterMontant(montantNet)}</span>
                </div>
              </div>

              {/* Liens alternatifs */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <a href={paymentData.deep_link} target="_blank" rel="noopener noreferrer">
                    <Smartphone className="h-4 w-4 mr-2" />
                    Ouvrir app Flouci
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <a href={paymentData.payment_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Payer en ligne
                  </a>
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Ce QR code expire dans 15 minutes
              </p>
            </div>
          )}

          {/* Paiement réussi */}
          {paymentStatus === 'success' && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>Paiement réussi !</strong>
                <p className="mt-1 text-sm">
                  La facture {numeroFacture} a été marquée comme payée. Un reçu vous a été envoyé par email.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Paiement échoué */}
          {paymentStatus === 'failed' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Paiement échoué</strong>
                <p className="mt-1 text-sm">
                  Le paiement n'a pas pu être complété. Veuillez réessayer ou contacter le support Flouci.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Paiement expiré */}
          {paymentStatus === 'expired' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Paiement expiré</strong>
                <p className="mt-1 text-sm">Le QR code a expiré. Veuillez générer un nouveau paiement.</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Bouton fermer */}
          {(paymentStatus !== 'pending' || error) && (
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false)
                setPaymentData(null)
                setPaymentStatus('pending')
                setError(null)
              }}
              className="w-full"
            >
              Fermer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
