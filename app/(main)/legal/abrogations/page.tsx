import { Suspense } from 'react'
import { Metadata } from 'next'
import { AbrogationsList } from '@/components/legal/abrogations/abrogations-list'
import { StatsWidget } from '@/components/legal/abrogations/stats-widget'
import type { AbrogationStats } from '@/types/legal-abrogations'
import { safeParseInt } from '@/lib/utils/safe-number'

export const metadata: Metadata = {
  title: 'Abrogations Juridiques Tunisiennes | Qadhya',
  description:
    'Consultez la base de données complète des abrogations juridiques en Tunisie. Recherchez par domaine, date et référence.',
}

async function getStats(): Promise<AbrogationStats> {
  // En production, utiliser localhost car appel interne depuis Server Component
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? 'http://localhost:3000'
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/legal/abrogations/stats`, {
    next: { revalidate: 3600 }, // Cache 1 heure
    cache: 'force-cache',
  })

  if (!res.ok) {
    console.error('[AbrogationsPage] Failed to fetch stats:', res.status)
    // Return default stats instead of throwing
    return {
      total: 0,
      byDomain: {} as Record<string, number>,
      byScope: {} as Record<string, number>,
      byConfidence: {} as Record<string, number>,
      verified: 0,
      pending: 0,
      disputed: 0,
      recentAbrogations: [],
    }
  }

  return res.json()
}

export default async function AbrogationsPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; page?: string; search?: string }>
}) {
  const params = await searchParams
  const stats = await getStats()

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Abrogations Juridiques</h1>
        <p className="text-muted-foreground">
          Base de données complète des lois abrogées en Tunisie avec fonction de recherche
          avancée
        </p>
      </div>

      {/* Statistiques */}
      <Suspense fallback={<StatsWidgetSkeleton />}>
        <StatsWidget stats={stats} />
      </Suspense>

      {/* Liste des abrogations */}
      <Suspense fallback={<AbrogationsListSkeleton />}>
        <AbrogationsList
          initialDomain={params.domain}
          initialPage={parseInt(params.page || '1', 10)}
          initialSearch={params.search}
        />
      </Suspense>
    </div>
  )
}

function StatsWidgetSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>
  )
}

function AbrogationsListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 bg-muted animate-pulse rounded-lg" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>
  )
}
