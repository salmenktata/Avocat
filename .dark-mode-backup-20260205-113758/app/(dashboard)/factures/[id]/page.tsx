import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import FactureDetailClient from '@/components/factures/FactureDetailClient'
import { getTranslations } from 'next-intl/server'

export default async function FactureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { id } = await params
  const t = await getTranslations('factures')
  const tCommon = await getTranslations('common')
  const tClients = await getTranslations('clients')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Récupérer la facture avec toutes les relations
  const { data: facture, error } = await supabase
    .from('factures')
    .select(`
      *,
      clients (
        id,
        type,
        nom,
        prenom,
        denomination,
        email,
        telephone,
        adresse,
        code_postal,
        ville,
        cin,
        registre_commerce
      ),
      dossiers (
        id,
        numero_dossier,
        objet,
        type_dossier
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !facture) {
    console.error('Erreur chargement facture:', error)
    notFound()
  }

  // Récupérer le profil de l'avocat pour le PDF
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const clientName = facture.clients
    ? facture.clients.type === 'PERSONNE_PHYSIQUE'
      ? `${facture.clients.nom} ${facture.clients.prenom || ''}`.trim()
      : facture.clients.denomination
    : t('clientDeleted')

  const isRetard =
    facture.statut === 'IMPAYEE' &&
    facture.date_echeance &&
    new Date(facture.date_echeance) < new Date()

  const statutColors: Record<string, string> = {
    BROUILLON: 'bg-gray-100 text-gray-700',
    ENVOYEE: 'bg-blue-100 text-blue-700',
    PAYEE: 'bg-green-100 text-green-700',
    IMPAYEE: 'bg-red-100 text-red-700',
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
            {t('invoice')} {facture.numero_facture}
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
                  <p className="font-medium text-foreground">{facture.numero_facture}</p>
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
                      {facture.clients.code_postal && `, ${facture.clients.code_postal}`}
                      {facture.clients.ville && ` ${facture.clients.ville}`}
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
                    {facture.dossiers.numero_dossier}
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
