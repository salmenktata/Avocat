'use client'

import { WORKFLOW_CIVIL, getWorkflowProgress } from '@/lib/workflows/civil'

interface WorkflowStepsProps {
  currentEtapeId: string
  onEtapeClick?: (etapeId: string) => void
}

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 border-blue-300',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  purple: 'bg-purple-100 text-purple-700 border-purple-300',
  pink: 'bg-pink-100 text-pink-700 border-pink-300',
  orange: 'bg-orange-100 text-orange-700 border-orange-300',
  green: 'bg-green-100 text-green-700 border-green-300',
  teal: 'bg-teal-100 text-teal-700 border-teal-300',
}

export default function WorkflowSteps({
  currentEtapeId,
  onEtapeClick,
}: WorkflowStepsProps) {
  const progress = getWorkflowProgress(currentEtapeId)
  const currentEtape = WORKFLOW_CIVIL.etapes.find((e) => e.id === currentEtapeId)

  return (
    <div className="space-y-4">
      {/* Barre de progression */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            Progression du dossier
          </span>
          <span className="text-sm font-medium text-blue-600">{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Étapes */}
      <div className="space-y-2">
        {WORKFLOW_CIVIL.etapes.map((etape, index) => {
          const isActive = etape.id === currentEtapeId
          const isPassed = currentEtape ? etape.ordre < currentEtape.ordre : false
          const colorClass = colorClasses[etape.couleur] || colorClasses.blue

          return (
            <button
              key={etape.id}
              onClick={() => onEtapeClick?.(etape.id)}
              disabled={!onEtapeClick}
              className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                isActive
                  ? `${colorClass} border-current shadow-md scale-105`
                  : isPassed
                  ? 'bg-muted text-muted-foreground border'
                  : 'bg-card text-foreground border hover:border-accent'
              } ${onEtapeClick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    isActive
                      ? 'bg-card text-blue-600'
                      : isPassed
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {isPassed ? (
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{etape.nom}</h4>
                    {isActive && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                        En cours
                      </span>
                    )}
                  </div>
                  <p className="text-sm opacity-80 mt-0.5">
                    {etape.description}
                  </p>
                </div>

                {onEtapeClick && (
                  <svg
                    className="h-5 w-5 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
