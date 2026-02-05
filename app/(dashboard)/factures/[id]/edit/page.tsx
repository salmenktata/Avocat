import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import FactureForm from '@/components/factures/FactureForm'
import { getTranslations } from 'next-intl/server'

export default async function EditFacturePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  const t = await getTranslations('factures')

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Récupérer la facture
  const factureResult = await query(
    'SELECT * FROM factures WHERE id = $1 AND user_id = $2',
    [id, session.user.id]
  )
  const facture = factureResult.rows[0]

  if (!facture) {
    notFound()
  }

  // Récupérer tous les clients
  const clientsResult = await query(
    'SELECT id, type_client, nom, prenom FROM clients WHERE user_id = $1 ORDER BY nom ASC',
    [session.user.id]
  )
  const clients = clientsResult.rows

  // Récupérer tous les dossiers
  const dossiersResult = await query(
    'SELECT id, numero, objet, client_id FROM dossiers WHERE user_id = $1 ORDER BY created_at DESC',
    [session.user.id]
  )
  const dossiers = dossiersResult.rows

  // Préparer les données pour le formulaire
  const initialData = {
    client_id: facture.client_id,
    dossier_id: facture.dossier_id || '',
    montant_ht: facture.montant_ht,
    taux_tva: facture.taux_tva,
    date_emission: facture.date_emission,
    date_echeance: facture.date_echeance || '',
    statut: facture.statut,
    objet: facture.objet,
    notes: facture.notes || '',
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* En-tête */}
      <div>
        <Link
          href={`/factures/${id}`}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          ← {t('backToInvoice')}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          {t('editInvoice')} {facture.numero}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('editInvoiceInfo')}
        </p>
      </div>

      {/* Formulaire */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <FactureForm
          factureId={id}
          initialData={initialData}
          isEditing={true}
          clients={clients || []}
          dossiers={dossiers || []}
        />
      </div>
    </div>
  )
}
