'use client'

import { getWorkflowById } from '@/lib/workflows/workflows-config'

interface DossiersParWorkflowWidgetProps {
  dossiers: any[]
}

export default function DossiersParWorkflowWidget({ dossiers }: DossiersParWorkflowWidgetProps) {
  // Regrouper par type de procédure
  const parWorkflow = dossiers.reduce((acc: Record<string, number>, d) => {
    const type = d.type_procedure || 'autre'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  const workflows = Object.entries(parWorkflow)
    .map(([id, count]) => {
      const workflow = getWorkflowById(id)
      return {
        id,
        nom: workflow?.nom || id,
        count: count as number,
        couleur: getCouleur(id),
      }
    })
    .sort((a, b) => b.count - a.count)

  const total = dossiers.length

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Dossiers par procédure</h2>

      {workflows.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">Aucun dossier actif</p>
      ) : (
        <div className="space-y-4">
          {workflows.map((w) => {
            const pourcentage = total > 0 ? (w.count / total) * 100 : 0

            return (
              <div key={w.id}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700">{w.nom}</span>
                  <span className="font-semibold text-gray-900">
                    {w.count} ({pourcentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${w.couleur} transition-all duration-300`}
                    style={{ width: `${pourcentage}%` }}
                  />
                </div>
              </div>
            )
          })}

          {/* Total */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Total dossiers actifs</span>
              <span className="text-2xl font-bold text-blue-600">{total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getCouleur(workflowId: string): string {
  const couleurs: Record<string, string> = {
    civil_premiere_instance: 'bg-blue-500',
    divorce: 'bg-purple-500',
    commercial: 'bg-green-500',
    refere: 'bg-orange-500',
    autre: 'bg-gray-500',
  }
  return couleurs[workflowId] || 'bg-gray-500'
}
