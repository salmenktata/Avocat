'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { timeEntrySchema, type TimeEntryFormData } from '@/lib/validations/time-entry'
import { createTimeEntryAction, updateTimeEntryAction } from '@/app/actions/time-entries'

interface TimeEntryFormProps {
  entryId?: string
  initialData?: Partial<TimeEntryFormData>
  isEditing?: boolean
  dossierId: string
  tauxHoraireDefaut?: number
  onSuccess?: () => void
}

export default function TimeEntryForm({
  entryId,
  initialData,
  isEditing = false,
  dossierId,
  tauxHoraireDefaut,
  onSuccess,
}: TimeEntryFormProps) {
  const router = useRouter()
  const t = useTranslations('forms')
  const tErrors = useTranslations('errors')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<TimeEntryFormData>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: initialData || {
      dossier_id: dossierId,
      date: new Date().toISOString().split('T')[0],
      duree_minutes: 60,
      taux_horaire: tauxHoraireDefaut || undefined,
      facturable: true,
    },
  })

  const dureeMinutes = watch('duree_minutes') || 0
  const tauxHoraire = watch('taux_horaire') || 0

  const montantCalcule = (dureeMinutes / 60) * tauxHoraire

  // Conversions pratiques
  const heures = Math.floor(dureeMinutes / 60)
  const minutes = dureeMinutes % 60

  const setDureeFromHeures = (h: number, m: number) => {
    setValue('duree_minutes', h * 60 + m)
  }

  const onSubmit = async (data: TimeEntryFormData) => {
    setError('')
    setLoading(true)

    try {
      const result = isEditing && entryId
        ? await updateTimeEntryAction(entryId, data)
        : await createTimeEntryAction(data)

      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/time-tracking')
        router.refresh()
      }
    } catch {
      setError(tErrors('generic'))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('labels.descriptionRequired')}
        </label>
        <input
          {...register('description')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          placeholder={t('placeholders.enterDescription')}
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700">{t('labels.dateRequired')}</label>
        <input
          type="date"
          {...register('date')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        />
        {errors.date && (
          <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
        )}
      </div>

      {/* Durée */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('labels.durationRequired')}
        </label>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('labels.hours')}</label>
            <input
              type="number"
              value={heures}
              onChange={(e) => setDureeFromHeures(parseInt(e.target.value) || 0, minutes)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              min="0"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('labels.minutes')}</label>
            <input
              type="number"
              value={minutes}
              onChange={(e) => setDureeFromHeures(heures, parseInt(e.target.value) || 0)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              min="0"
              max="59"
            />
          </div>
        </div>

        <input type="hidden" {...register('duree_minutes', { valueAsNumber: true })} />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setValue('duree_minutes', 15)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            15 min
          </button>
          <button
            type="button"
            onClick={() => setValue('duree_minutes', 30)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            30 min
          </button>
          <button
            type="button"
            onClick={() => setValue('duree_minutes', 60)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            1h
          </button>
          <button
            type="button"
            onClick={() => setValue('duree_minutes', 120)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            2h
          </button>
        </div>

        {errors.duree_minutes && (
          <p className="mt-1 text-sm text-red-600">{errors.duree_minutes.message}</p>
        )}
      </div>

      {/* Taux horaire */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('labels.hourlyRate')}
        </label>
        <input
          type="number"
          step="0.001"
          {...register('taux_horaire', { valueAsNumber: true })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          placeholder={t('placeholders.enterHourlyRate')}
        />
        {errors.taux_horaire && (
          <p className="mt-1 text-sm text-red-600">{errors.taux_horaire.message}</p>
        )}
      </div>

      {/* Montant calculé */}
      {tauxHoraire > 0 && (
        <div className="rounded-lg bg-blue-50 p-4">
          <div className="text-sm text-gray-600">{t('helpers.calculatedAmount')}</div>
          <div className="text-2xl font-bold text-blue-600">
            {montantCalcule.toFixed(3)} TND
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {(dureeMinutes / 60).toFixed(2)} h × {tauxHoraire.toFixed(3)} TND/h
          </div>
        </div>
      )}

      {/* Facturable */}
      <div>
        <label className="flex items-center">
          <input type="checkbox" {...register('facturable')} className="rounded" />
          <span className="ml-2 text-sm text-gray-700">{t('labels.billableTime')}</span>
        </label>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700">{t('labels.notes')}</label>
        <textarea
          {...register('notes')}
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          placeholder={t('placeholders.internalNotes')}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-6 py-2 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('buttons.saving') : isEditing ? t('buttons.edit') : t('buttons.add')}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 bg-white px-6 py-2 text-gray-700 font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {t('buttons.cancel')}
        </button>
      </div>
    </form>
  )
}
