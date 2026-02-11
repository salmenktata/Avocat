/**
 * Lazy Loaded TimelineViewer
 *
 * Sprint 5 - Performance & Lazy Loading
 *
 * Charge TimelineViewer de manière asynchrone pour réduire le bundle initial.
 * Gain estimé : -150KB à -250KB
 */

'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { TimelineViewerProps } from './TimelineViewer'

// =============================================================================
// LOADING COMPONENT
// =============================================================================

function TimelineLoadingFallback() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">
                Chargement de la timeline jurisprudentielle...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-8 w-16 bg-muted rounded mx-auto mb-2" />
                <div className="h-4 w-24 bg-muted rounded mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legend skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2 animate-pulse">
                <div className="h-4 w-4 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// LAZY LOADED COMPONENT
// =============================================================================

/**
 * TimelineViewer chargé de manière asynchrone avec Next.js dynamic()
 *
 * Options :
 * - ssr: false → Ne pas charger côté serveur (économie SSR bundle)
 * - loading → Composant affiché pendant chargement
 */
const TimelineViewerLazy = dynamic<TimelineViewerProps>(
  () => import('./TimelineViewer').then((mod) => mod.TimelineViewer),
  {
    loading: () => <TimelineLoadingFallback />,
    ssr: false, // Désactiver SSR pour économiser bundle serveur
  }
)

// =============================================================================
// EXPORT
// =============================================================================

export default TimelineViewerLazy

/**
 * Export type pour compatibilité
 */
export type { TimelineViewerProps }

/**
 * Re-export types utilisés par TimelineViewer
 */
export type { TimelineEvent, TimelineStats, TimelineFilters, EventType } from './TimelineViewer'
