import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TimeEntryForm from '@/components/time-tracking/TimeEntryForm'
import { getTranslations } from 'next-intl/server'

export default async function NewTimeEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ dossier_id?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  const t = await getTranslations('timeTracking')

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Récupérer le dossier présélectionné si fourni
  let dossierId = params.dossier_id || ''
  let tauxHoraire: number | undefined

  if (dossierId) {
    // Vérifier que le dossier appartient à l'utilisateur
    const dossierResult = await query(
      'SELECT id FROM dossiers WHERE id = $1 AND user_id = $2',
      [dossierId, session.user.id]
    )
    const dossier = dossierResult.rows[0]

    if (!dossier) {
      dossierId = ''
    }
  }

  // Récupérer le taux horaire par défaut du profil
  const profileResult = await query(
    'SELECT * FROM profiles WHERE id = $1',
    [session.user.id]
  )
  const _profile = profileResult.rows[0]

  // Si le profil a un taux horaire par défaut, l'utiliser (à ajouter au schéma profiles plus tard)
  // Pour l'instant, on utilise undefined

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* En-tête */}
      <div>
        <Link
          href="/time-tracking"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          ← {t('backToTimeTracking')}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          {t('addTimeEntry')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('recordTime')}
        </p>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-2">
          <svg
            className="h-5 w-5 text-blue-600 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900">
              {t('timerTip')}
            </p>
            <p className="mt-1 text-sm text-blue-700">
              {t('timerTipDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {dossierId ? (
          <TimeEntryForm
            dossierId={dossierId}
            tauxHoraireDefaut={tauxHoraire}
          />
        ) : (
          <div>
            <p className="text-sm text-foreground mb-4">
              {t('selectDossierFirst')}
            </p>
            <Link
              href="/dossiers"
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t('viewMyDossiers')} →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
