import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FactureForm from '@/components/factures/FactureForm'
import { getTranslations } from 'next-intl/server'

export default async function NewFacturePage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; dossier_id?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  const t = await getTranslations('factures')

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Récupérer tous les clients pour le formulaire
  const clientsResult = await query(
    'SELECT id, type_client, nom, prenom FROM clients WHERE user_id = $1 ORDER BY nom ASC',
    [session.user.id]
  )
  const clients = clientsResult.rows

  // Récupérer tous les dossiers pour le formulaire
  const dossiersResult = await query(
    'SELECT id, numero, objet, client_id FROM dossiers WHERE user_id = $1 AND statut = $2 ORDER BY created_at DESC',
    [session.user.id, 'en_cours']
  )
  const dossiers = dossiersResult.rows

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('newInvoice')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('createInvoice')}
        </p>
      </div>

      {/* Formulaire */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {!clients || clients.length === 0 ? (
          <div className="rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  {t('noClientFound')}
                </h3>
                <p className="mt-2 text-sm text-yellow-700">
                  {t('createClientFirst')}
                </p>
                <div className="mt-4">
                  <Link
                    href="/clients/new"
                    className="text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
                  >
                    {t('createClient')} →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <FactureForm
            clients={clients || []}
            dossiers={dossiers || []}
            preselectedClientId={params.client_id}
            preselectedDossierId={params.dossier_id}
          />
        )}
      </div>
    </div>
  )
}
