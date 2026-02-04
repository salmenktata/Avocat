'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createTemplateAction, updateTemplateAction } from '@/app/actions/templates'
import { templateSchema, type TemplateFormData, TYPE_DOCUMENT_LABELS } from '@/lib/validations/template'

interface TemplateFormProps {
  initialData?: any
  templateId?: string
}

export default function TemplateForm({ initialData, templateId }: TemplateFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [variables, setVariables] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: initialData || {
      titre: '',
      description: '',
      type_document: 'autre',
      contenu: '',
      est_public: false,
    },
  })

  // Surveiller le contenu pour extraire les variables
  const contenu = watch('contenu')

  // Extraire les variables quand le contenu change
  const extractVariables = (text: string) => {
    const regex = /{{([^}]+)}}/g
    const vars: string[] = []
    let match

    while ((match = regex.exec(text)) !== null) {
      vars.push(match[1])
    }

    // Retourner les variables uniques
    return [...new Set(vars)]
  }

  // Mettre à jour les variables quand le contenu change
  const handleContenuChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVariables = extractVariables(e.target.value)
    setVariables(newVariables)
  }

  const onSubmit = async (data: TemplateFormData) => {
    setLoading(true)
    setError('')

    const result = templateId
      ? await updateTemplateAction(templateId, data)
      : await createTemplateAction(data)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/templates')
    router.refresh()
  }

  // Variables communes pour insertion rapide
  const commonVariables = [
    { label: 'Client - Nom', value: '{{client.nom}}' },
    { label: 'Client - Prénom', value: '{{client.prenom}}' },
    { label: 'Client - CIN', value: '{{client.cin}}' },
    { label: 'Client - Adresse', value: '{{client.adresse}}' },
    { label: 'Avocat - Nom', value: '{{avocat.nom}}' },
    { label: 'Avocat - Prénom', value: '{{avocat.prenom}}' },
    { label: 'Tribunal', value: '{{tribunal}}' },
    { label: 'Date', value: '{{date}}' },
    { label: 'Lieu', value: '{{lieu}}' },
    { label: 'N° Dossier', value: '{{numero_dossier}}' },
  ]

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea[name="contenu"]') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = textarea.value
      const newText = text.substring(0, start) + variable + text.substring(end)
      textarea.value = newText
      textarea.setSelectionRange(start + variable.length, start + variable.length)
      textarea.focus()

      // Trigger change event
      const event = new Event('input', { bubbles: true })
      textarea.dispatchEvent(event)

      // Mettre à jour les variables détectées
      setVariables(extractVariables(newText))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Titre */}
      <div>
        <label htmlFor="titre" className="block text-sm font-medium text-gray-700">
          Titre du template *
        </label>
        <input
          type="text"
          {...register('titre')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Ex: Assignation en matière civile"
        />
        {errors.titre && <p className="mt-1 text-sm text-red-600">{errors.titre.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Description courte du template..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Type de document */}
      <div>
        <label htmlFor="type_document" className="block text-sm font-medium text-gray-700">
          Type de document *
        </label>
        <select
          {...register('type_document')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {Object.entries(TYPE_DOCUMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.type_document && (
          <p className="mt-1 text-sm text-red-600">{errors.type_document.message}</p>
        )}
      </div>

      {/* Variables rapides */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Insérer une variable
        </label>
        <div className="flex flex-wrap gap-2">
          {commonVariables.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => insertVariable(v.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          💡 Utilisez le format {`{{variable}}`} pour les champs dynamiques
        </p>
      </div>

      {/* Contenu */}
      <div>
        <label htmlFor="contenu" className="block text-sm font-medium text-gray-700">
          Contenu du template *
        </label>
        <textarea
          {...register('contenu')}
          rows={16}
          onChange={handleContenuChange}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Saisissez le contenu du document avec les variables {{nom_variable}}..."
        />
        {errors.contenu && <p className="mt-1 text-sm text-red-600">{errors.contenu.message}</p>}

        {/* Afficher les variables détectées */}
        {variables.length > 0 && (
          <div className="mt-2 rounded-md bg-blue-50 p-3">
            <p className="text-xs font-medium text-blue-900">
              {variables.length} variable{variables.length > 1 ? 's' : ''} détectée{variables.length > 1 ? 's' : ''} :
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {variables.map((v) => (
                <code key={v} className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                  {`{{${v}}}`}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Template public */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          {...register('est_public')}
          id="est_public"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="est_public" className="text-sm text-gray-700">
          Rendre ce template public (visible par tous les utilisateurs)
        </label>
      </div>

      {/* Message d'erreur */}
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* Boutons */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '⏳ Enregistrement...' : templateId ? '💾 Mettre à jour' : '✅ Créer le template'}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
