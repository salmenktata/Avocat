import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TimeEntryForm from '@/components/time-tracking/TimeEntryForm'
import { getTranslations } from 'next-intl/server'

export default async function NewTimeEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ dossier_id?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const t = await getTranslations('timeTracking')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Récupérer le dossier présélectionné si fourni
  let dossierId = params.dossier_id || ''
  let tauxHoraire: number | undefined

  if (dossierId) {
    // Vérifier que le dossier appartient à l'utilisateur
    const { data: dossier } = await supabase
      .from('dossiers')
      .select('id')
      .eq('id', dossierId)
      .eq('user_id', user.id)
      .single()

    if (!dossier) {
      dossierId = ''
    }
  }

  // Récupérer le taux horaire par défaut du profil
  const { data: _profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

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
        <h1 className="mt-2 text-3xl font-bold text-gray-900">
          {t('addTimeEntry')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
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
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        {dossierId ? (
          <TimeEntryForm
            dossierId={dossierId}
            tauxHoraireDefaut={tauxHoraire}
          />
        ) : (
          <div>
            <p className="text-sm text-gray-700 mb-4">
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
