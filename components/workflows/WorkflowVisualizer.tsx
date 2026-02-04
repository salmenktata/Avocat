'use client'

import { getWorkflowById, calculerProgression, type WorkflowTemplate } from '@/lib/workflows/workflows-config'

interface WorkflowVisualizerProps {
  workflowId: string
  etapeActuelleId: string
}

export default function WorkflowVisualizer({ workflowId, etapeActuelleId }: WorkflowVisualizerProps) {
  const workflow = getWorkflowById(workflowId)

  if (!workflow) {
    return (
      <div className="text-sm text-gray-500">
        Workflow introuvable
      </div>
    )
  }

  const progression = calculerProgression(workflowId, etapeActuelleId)
  const etapeActuelleIndex = workflow.etapes.findIndex((e) => e.id === etapeActuelleId)

  return (
    <div className="space-y-4">
      {/* En-tête avec progression */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-900">{workflow.nom}</h3>
          <span className="text-sm font-semibold text-blue-600">{progression}%</span>
        </div>

        {/* Barre de progression */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progression}%` }}
          />
        </div>
      </div>

      {/* Liste des étapes */}
      <div className="space-y-3">
        {workflow.etapes.map((etape, index) => {
          const estActuelle = etape.id === etapeActuelleId
          const estTerminee = index < etapeActuelleIndex
          const estFuture = index > etapeActuelleIndex

          return (
            <div
              key={etape.id}
              className={`relative pl-8 ${
                estActuelle
                  ? 'opacity-100'
                  : estTerminee
                  ? 'opacity-75'
                  : 'opacity-50'
              }`}
            >
              {/* Ligne de connexion */}
              {index < workflow.etapes.length - 1 && (
                <div
                  className={`absolute left-3 top-6 w-0.5 h-full ${
                    estTerminee ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              )}

              {/* Icône d'étape */}
              <div className="absolute left-0 top-0">
                {estTerminee ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
                    <svg
                      className="h-4 w-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                ) : estActuelle ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 ring-4 ring-blue-100">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-gray-300 bg-white" />
                )}
              </div>

              {/* Contenu de l'étape */}
              <div className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        estActuelle
                          ? 'text-blue-900'
                          : estTerminee
                          ? 'text-gray-900'
                          : 'text-gray-500'
                      }`}
                    >
                      {etape.libelle}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{etape.description}</p>

                    {/* Documents requis */}
                    {etape.documents_requis && etape.documents_requis.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {etape.documents_requis.map((doc) => (
                          <span
                            key={doc}
                            className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            📄 {doc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Délai moyen */}
                  {etape.delai_moyen_jours && etape.delai_moyen_jours > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      ~{etape.delai_moyen_jours}j
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
