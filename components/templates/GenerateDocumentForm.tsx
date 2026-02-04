'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { generateDocumentAction } from '@/app/actions/templates'

interface GenerateDocumentFormProps {
  template: any
  dossiers: any[]
}

export default function GenerateDocumentForm({ template, dossiers }: GenerateDocumentFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [selectedDossier, setSelectedDossier] = useState<any>(null)
  const [variablesValues, setVariablesValues] = useState<Record<string, string>>({})

  const variables = Array.isArray(template.variables) ? template.variables : []

  // Quand un dossier est sélectionné, pré-remplir les variables
  const handleDossierChange = (dossierId: string) => {
    const dossier = dossiers.find((d) => d.id === dossierId)
    setSelectedDossier(dossier)

    if (dossier && dossier.clients) {
      const client = dossier.clients
      const newValues: Record<string, string> = {}

      // Pré-remplir les variables communes
      variables.forEach((v: string) => {
        if (v === 'client.nom') newValues[v] = client.nom || ''
        else if (v === 'client.prenom') newValues[v] = client.prenom || ''
        else if (v === 'client.cin') newValues[v] = client.cin || ''
        else if (v === 'client.adresse') newValues[v] = client.adresse || ''
        else if (v === 'client.email') newValues[v] = client.email || ''
        else if (v === 'client.telephone') newValues[v] = client.telephone || ''
        else if (v === 'client.civilite')
          newValues[v] = client.type === 'PERSONNE_PHYSIQUE' ? 'M./Mme' : ''
        else if (v === 'client.denomination') newValues[v] = client.denomination || ''
        else if (v === 'numero_dossier') newValues[v] = dossier.numero_dossier || ''
        else if (v === 'tribunal') newValues[v] = dossier.tribunal || ''
        else if (v === 'objet') newValues[v] = dossier.objet || ''
        else if (v === 'date')
          newValues[v] = new Date().toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        else if (v === 'annee') newValues[v] = new Date().getFullYear().toString()
        else newValues[v] = variablesValues[v] || ''
      })

      setVariablesValues(newValues)
    }
  }

  const handleVariableChange = (variable: string, value: string) => {
    setVariablesValues((prev) => ({ ...prev, [variable]: value }))
  }

  const handleGenerate = async () => {
    if (!selectedDossier) {
      setError('Veuillez sélectionner un dossier')
      return
    }

    setLoading(true)
    setError('')

    const result = await generateDocumentAction({
      template_id: template.id,
      dossier_id: selectedDossier.id,
      variables_values: variablesValues,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.success) {
      setGeneratedContent(result.contenu)

      // Afficher un warning si des variables n'ont pas été remplacées
      if (result.variables_manquantes && result.variables_manquantes.length > 0) {
        setError(
          `⚠️ Certaines variables n'ont pas été remplies : ${result.variables_manquantes.join(', ')}`
        )
      }
    }

    setLoading(false)
  }

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent)
    alert('✅ Document copié dans le presse-papiers !')
  }

  const handleDownloadTxt = () => {
    const blob = new Blob([generatedContent], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${template.titre} - ${selectedDossier?.numero_dossier || 'document'}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Sélection du dossier */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">1. Sélectionner un dossier</h2>

        {dossiers.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucun dossier disponible. Créez d'abord un dossier.
          </p>
        ) : (
          <select
            value={selectedDossier?.id || ''}
            onChange={(e) => handleDossierChange(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">-- Sélectionnez un dossier --</option>
            {dossiers.map((dossier) => (
              <option key={dossier.id} value={dossier.id}>
                {dossier.numero_dossier} -{' '}
                {dossier.clients?.type === 'PERSONNE_PHYSIQUE'
                  ? `${dossier.clients.nom} ${dossier.clients.prenom || ''}`.trim()
                  : dossier.clients?.denomination}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Remplissage des variables */}
      {selectedDossier && variables.length > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            2. Remplir les variables ({variables.length})
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {variables.map((variable: string) => (
              <div key={variable}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {variable}
                </label>
                <input
                  type="text"
                  value={variablesValues[variable] || ''}
                  onChange={(e) => handleVariableChange(variable, e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={`Valeur pour {{${variable}}}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bouton de génération */}
      {selectedDossier && (
        <div className="flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '⏳ Génération...' : '⚡ Générer le document'}
          </button>
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">{error}</div>
      )}

      {/* Document généré */}
      {generatedContent && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Document généré</h2>

            <div className="flex gap-2">
              <button
                onClick={handleCopyToClipboard}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                📋 Copier
              </button>

              <button
                onClick={handleDownloadTxt}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                📥 Télécharger (.txt)
              </button>
            </div>
          </div>

          <div className="rounded-md bg-gray-50 p-4 max-h-[600px] overflow-y-auto">
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-900">
              {generatedContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
