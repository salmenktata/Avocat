import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import FactureDetailClient from '@/components/factures/FactureDetailClient'
import { getTranslations } from 'next-intl/server'

export default async function FactureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  const t = await getTranslations('factures')
  const _tCommon = await getTranslations('common')
  const tClients = await getTranslations('clients')

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Récupérer la facture avec toutes les relations
  const factureResult = await query(
    `SELECT f.*,
      json_build_object(
        'id', c.id,
        'type_client', c.type_client,
        'nom', c.nom,
        'prenom', c.prenom,
        'email', c.email,
        'telephone', c.telephone,
        'adresse', c.adresse,
        'cin', c.cin
      ) as clients,
      json_build_object(
        'id', d.id,
        'numero', d.numero,
        'objet', d.objet,
        'type_dossier', d.type_dossier
      ) as dossiers
    FROM factures f
    LEFT JOIN clients c ON f.client_id = c.id
    LEFT JOIN dossiers d ON f.dossier_id = d.id
    WHERE f.id = $1 AND f.user_id = $2`,
    [id, session.user.id]
  )
  const facture = factureResult.rows[0]

  if (!facture) {
    notFound()
  }

  // Récupérer le profil de l'avocat pour le PDF
  const profileResult = await query(
    'SELECT * FROM profiles WHERE id = $1',
    [session.user.id]
  )
  const profile = profileResult.rows[0]

  const clientName = facture.clients
    ? facture.clients.type_client === 'personne_physique'
      ? `${facture.clients.nom} ${facture.clients.prenom || ''}`.trim()
      : facture.clients.nom
    : t('clientDeleted')

  const isRetard =
    facture.statut === 'envoyee' &&
    facture.date_echeance &&
    new Date(facture.date_echeance) < new Date()

  const statutColors: Record<string, string> = {
    brouillon: 'bg-muted text-foreground',
    envoyee: 'bg-blue-100 text-blue-700',
    payee: 'bg-green-100 text-green-700',
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/factures"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ← {t('backToInvoices')}
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-foreground">
            {t('invoice')} {facture.numero}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
              statutColors[facture.statut]
            }`}
          >
            {facture.statut}
          </span>
          {isRetard && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              ⚠️ {t('lateWarning')}
            </span>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale - Détails de la facture */}
        <div className="lg:col-span-2 space-y-6">
          {/* Carte principale */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {t('invoiceInfo')}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('number')}</p>
                  <p className="font-medium text-foreground">{facture.numero}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('issueDate')}</p>
                  <p className="font-medium text-foreground">
                    {new Date(facture.date_emission).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              {facture.date_echeance && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('dueDate')}</p>
                    <p className="font-medium text-foreground">
                      {new Date(facture.date_echeance).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  {facture.date_paiement && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t('paymentDate')}</p>
                      <p className="font-medium text-green-600">
                        {new Date(facture.date_paiement).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground">{t('object')}</p>
                <p className="font-medium text-foreground">{facture.objet}</p>
              </div>

              {facture.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">{tClients('notes')}</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {facture.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Montants */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t('amounts')}</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-foreground">
                <span>{t('amountHT')}</span>
                <span className="font-medium">
                  {parseFloat(facture.montant_ht).toFixed(3)} TND
                </span>
              </div>
              <div className="flex justify-between text-foreground">
                <span>{t('tva')} ({facture.taux_tva}%)</span>
                <span className="font-medium">
                  {parseFloat(facture.montant_tva).toFixed(3)} TND
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="text-lg font-semibold text-foreground">
                  {t('amountTTC')}
                </span>
                <span className="text-2xl font-bold text-blue-600">
                  {parseFloat(facture.montant_ttc).toFixed(3)} TND
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Informations client */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">{tClients('client')}</h2>
            {facture.clients ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">{tClients('name')}</p>
                  <p className="font-medium text-foreground">{clientName}</p>
                </div>
                {facture.clients.email && (
                  <div>
                    <p className="text-sm text-muted-foreground">{tClients('email')}</p>
                    <a
                      href={`mailto:${facture.clients.email}`}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {facture.clients.email}
                    </a>
                  </div>
                )}
                {facture.clients.telephone && (
                  <div>
                    <p className="text-sm text-muted-foreground">{tClients('phone')}</p>
                    <a
                      href={`tel:${facture.clients.telephone}`}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {facture.clients.telephone}
                    </a>
                  </div>
                )}
                {facture.clients.adresse && (
                  <div>
                    <p className="text-sm text-muted-foreground">{tClients('address')}</p>
                    <p className="text-sm text-foreground">
                      {facture.clients.adresse}
                    </p>
                  </div>
                )}
                <div className="pt-3">
                  <Link
                    href={`/clients/${facture.clients.id}`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {t('viewClientFile')} →
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('clientDeleted')}</p>
            )}
          </div>

          {/* Dossier lié */}
          {facture.dossiers && (
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {t('linkedDossier')}
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">{t('number')}</p>
                  <p className="font-medium text-foreground">
                    {facture.dossiers.numero}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('object')}</p>
                  <p className="text-sm text-foreground">{facture.dossiers.objet}</p>
                </div>
                <div className="pt-3">
                  <Link
                    href={`/dossiers/${facture.dossiers.id}`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {t('viewDossier')} →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <FactureDetailClient facture={facture} profile={profile} />
        </div>
      </div>
    </div>
  )
}
