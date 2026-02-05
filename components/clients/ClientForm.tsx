'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { clientSchema, type ClientFormData } from '@/lib/validations/client'
import { createClientAction, updateClientAction } from '@/app/actions/clients'

interface ClientFormProps {
  initialData?: any
  isEditing?: boolean
}

export default function ClientForm({ initialData, isEditing = false }: ClientFormProps) {
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
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: initialData
      ? {
          type: initialData.type,
          nom: initialData.type === 'PERSONNE_PHYSIQUE' ? initialData.nom : initialData.denomination,
          prenom: initialData.prenom || '',
          denomination: initialData.denomination || '',
          cin: initialData.cin || '',
          registre_commerce: initialData.registre_commerce || '',
          email: initialData.email || '',
          telephone: initialData.telephone || '',
          adresse: initialData.adresse || '',
          ville: initialData.ville || '',
          notes: initialData.notes || '',
        }
      : {
          type: 'PERSONNE_PHYSIQUE',
        },
  })

  const clientType = watch('type')

  const onSubmit = async (data: ClientFormData) => {
    setError('')
    setLoading(true)

    try {
      const result = isEditing
        ? await updateClientAction(initialData.id, data)
        : await createClientAction(data)

      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      router.push('/clients')
      router.refresh()
    } catch (err) {
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

      {/* Type de client */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('labels.clientTypeRequired')}
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="PERSONNE_PHYSIQUE"
              {...register('type')}
              className="mr-2"
            />
            {t('options.naturalPerson')}
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="PERSONNE_MORALE"
              {...register('type')}
              className="mr-2"
            />
            {t('options.legalPerson')}
          </label>
        </div>
        {errors.type && (
          <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
        )}
      </div>

      {/* Champs selon le type */}
      {clientType === 'PERSONNE_PHYSIQUE' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('labels.nameRequired')}
              </label>
              <input
                {...register('nom')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder={t('placeholders.enterName')}
              />
              {errors.nom && (
                <p className="mt-1 text-sm text-red-600">{errors.nom.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t('labels.firstName')}
              </label>
              <input
                {...register('prenom')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder={t('placeholders.enterFirstName')}
              />
              {errors.prenom && (
                <p className="mt-1 text-sm text-red-600">{errors.prenom.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('labels.cin')}
            </label>
            <input
              {...register('cin')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder={t('placeholders.enterCIN')}
            />
            {errors.cin && (
              <p className="mt-1 text-sm text-red-600">{errors.cin.message}</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('labels.companyNameRequired')}
            </label>
            <input
              {...register('nom')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder={t('placeholders.enterCompanyName')}
            />
            {errors.nom && (
              <p className="mt-1 text-sm text-red-600">{errors.nom.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('labels.registreCommerce')}
            </label>
            <input
              {...register('registre_commerce')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder={t('placeholders.enterRegistreCommerce')}
            />
            {errors.registre_commerce && (
              <p className="mt-1 text-sm text-red-600">
                {errors.registre_commerce.message}
              </p>
            )}
          </div>
        </>
      )}

      {/* Coordonnées */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('labels.email')}
          </label>
          <input
            type="email"
            {...register('email')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            placeholder={t('placeholders.enterEmail')}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('labels.phone')}
          </label>
          <input
            {...register('telephone')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            placeholder={t('placeholders.enterPhone')}
          />
          {errors.telephone && (
            <p className="mt-1 text-sm text-red-600">{errors.telephone.message}</p>
          )}
        </div>
      </div>

      {/* Adresse */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('labels.address')}
        </label>
        <input
          {...register('adresse')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          placeholder={t('placeholders.enterAddress')}
        />
        {errors.adresse && (
          <p className="mt-1 text-sm text-red-600">{errors.adresse.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('labels.city')}
        </label>
        <input
          {...register('ville')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          placeholder={t('placeholders.enterCity')}
        />
        {errors.ville && (
          <p className="mt-1 text-sm text-red-600">{errors.ville.message}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('labels.notes')}
        </label>
        <textarea
          {...register('notes')}
          rows={4}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          placeholder={t('placeholders.privateNotes')}
        />
        {errors.notes && (
          <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-6 py-2 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('buttons.saving') : isEditing ? t('buttons.edit') : t('buttons.create')}
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
