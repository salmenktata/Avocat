/**
 * Page : /client/jurisprudence-timeline
 *
 * Timeline interactive de l'évolution de la jurisprudence tunisienne
 * avec détection des revirements, confirmations et distinctions.
 *
 * Sprint 4 - Fonctionnalités Client
 * Sprint 6 - Migration React Query
 */

'use client'

import { useState } from 'react'
import { TimelineViewer } from '@/components/client/jurisprudence/TimelineViewer'
import type { TimelineFilters } from '@/components/client/jurisprudence/TimelineViewer'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useJurisprudenceTimeline } from '@/lib/hooks/useJurisprudenceTimeline'

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function JurisprudenceTimelinePage() {
  const [filters, setFilters] = useState<TimelineFilters | undefined>(undefined)

  // React Query hook - Cache automatique 5min
  const { data, isLoading, isError, error, refetch } = useJurisprudenceTimeline(
    {
      filters,
      limit: 200,
      includeStats: true,
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
    }
  )

  const handleFilter = (newFilters: TimelineFilters) => {
    setFilters(newFilters)
  }

  // État de chargement
  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-2 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Timeline Jurisprudence Tunisienne
          </h1>
          <p className="text-muted-foreground">
            Visualisez l'évolution de la jurisprudence tunisienne dans le temps
          </p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">
              Chargement de la timeline...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // État d'erreur
  if (isError) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-2 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Timeline Jurisprudence Tunisienne
          </h1>
          <p className="text-muted-foreground">
            Visualisez l'évolution de la jurisprudence tunisienne dans le temps
          </p>
        </div>

        <Card className="border-destructive">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="font-semibold mb-2">Erreur de chargement</p>
            <p className="text-sm text-muted-foreground mb-4">
              {error?.message || 'Une erreur est survenue'}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              Réessayer
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // État normal
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Timeline Jurisprudence Tunisienne
        </h1>
        <p className="text-muted-foreground">
          Visualisez l'évolution de la jurisprudence tunisienne dans le temps avec
          détection automatique des revirements, confirmations et distinctions.
        </p>
      </div>

      {/* Timeline */}
      {data?.stats && (
        <TimelineViewer
          events={data.events}
          stats={data.stats}
          onFilter={handleFilter}
        />
      )}

      {/* Info section */}
      <div className="bg-muted/30 rounded-lg p-6 border">
        <h3 className="font-semibold mb-3">Comprendre la timeline</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
              R
            </div>
            <div>
              <strong className="text-red-600 dark:text-red-400">Revirement Jurisprudentiel :</strong>{' '}
              Décision qui renverse ou modifie substantiellement une jurisprudence
              établie. Marque un tournant important dans l'interprétation du droit.
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
              C
            </div>
            <div>
              <strong className="text-green-600 dark:text-green-400">Confirmation :</strong>{' '}
              Décision qui confirme et consolide une jurisprudence existante.
              Renforce l'autorité des précédents.
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
              D
            </div>
            <div>
              <strong className="text-amber-600 dark:text-amber-400">Distinction/Précision :</strong>{' '}
              Décision qui précise ou distingue l'application d'une règle juridique
              dans un contexte spécifique.
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
              S
            </div>
            <div>
              <strong className="text-blue-600 dark:text-blue-400">Arrêt Standard :</strong>{' '}
              Décision importante mais sans impact majeur sur l'évolution de la
              jurisprudence.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
