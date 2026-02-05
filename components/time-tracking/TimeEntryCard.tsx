'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { deleteTimeEntryAction } from '@/app/actions/time-entries'
import type { TimeEntry } from '@/types/time-tracking'

interface TimeEntryCardProps {
  entry: TimeEntry
  showDossierInfo?: boolean
}

export default function TimeEntryCard({ entry, showDossierInfo = false }: TimeEntryCardProps) {
  const router = useRouter()
  const t = useTranslations('timeTracking')
  const tConfirm = useTranslations('confirmations')
  const tCards = useTranslations('cards')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showActions, setShowActions] = useState(false)

  const handleDelete = async () => {
    if (!confirm(tConfirm('deleteTimeEntry'))) return

    setLoading(true)
    const result = await deleteTimeEntryAction(entry.id)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.refresh()
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours === 0) return `${mins}min`
    if (mins === 0) return `${hours}h`
    return `${hours}h${mins}min`
  }

  const isFacturee = !!entry.facture_id

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {new Date(entry.date).toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </span>

            {entry.heure_debut && (
              <span className="text-xs text-muted-foreground">
                {entry.heure_debut}
                {entry.heure_fin && ` - ${entry.heure_fin}`}
              </span>
            )}

            {!entry.facturable && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {t('notBillable')}
              </span>
            )}

            {isFacturee && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                {t('billed')}
              </span>
            )}
          </div>

          <h3 className="font-medium text-foreground">{entry.description}</h3>

          {showDossierInfo && entry.dossiers && (
            <p className="mt-1 text-sm text-muted-foreground">
              📁 {entry.dossiers.numero}
            </p>
          )}

          {entry.notes && (
            <p className="mt-1 text-sm text-muted-foreground">{entry.notes}</p>
          )}

          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <svg
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-semibold text-foreground">
                {formatDuration(entry.duree_minutes)}
              </span>
            </div>

            {entry.taux_horaire && entry.taux_horaire > 0 && (
              <>
                <div className="text-muted-foreground">•</div>
                <div className="text-muted-foreground">
                  {entry.taux_horaire.toFixed(0)} TND/h
                </div>
                <div className="text-muted-foreground">•</div>
                <div className="font-semibold text-blue-600">
                  {parseFloat(entry.montant_calcule || '0').toFixed(3)} TND
                </div>
              </>
            )}
          </div>
        </div>

        {!isFacturee && (
          <button
            onClick={() => setShowActions(!showActions)}
            disabled={loading}
            className="rounded-md border border bg-card px-3 py-1 text-sm font-medium text-foreground hover:bg-muted"
          >
            {showActions ? 'Fermer' : 'Actions'}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {showActions && !isFacturee && (
        <div className="mt-3 space-y-2 rounded-md bg-muted p-3">
          <button
            onClick={() => router.push(`/time-tracking/${entry.id}/edit`)}
            disabled={loading}
            className="w-full rounded-md border border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            ✏️ Modifier
          </button>

          <button
            onClick={handleDelete}
            disabled={loading}
            className="w-full rounded-md border border-red-300 bg-card px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            🗑️ Supprimer
          </button>
        </div>
      )}
    </div>
  )
}
