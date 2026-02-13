'use client'

/**
 * Onglet Monitoring Cache Redis
 *
 * Affiche les métriques de cache (hits, misses, hit rate) avec graphiques.
 * Auto-refresh toutes les 30s.
 */

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface CacheMetrics {
  hits: number
  misses: number
  sets: number
  hitRate: number
}

interface CacheMonitoringData {
  available: boolean
  today: CacheMetrics
  last7Days: Record<string, CacheMetrics>
  stats: {
    scopeCount?: number
    totalEntries?: number
  }
  recommendations?: string[]
}

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export default function CacheTab() {
  const [data, setData] = useState<CacheMonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch données
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/monitoring/cache', {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`)
      }

      const json = await response.json()
      setData(json)
    } catch (err) {
      console.error('[CacheTab] Erreur fetch:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  // Fetch initial + auto-refresh 30s
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  // État Loading
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Chargement métriques cache...</span>
      </div>
    )
  }

  // État Erreur
  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">❌ Erreur</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Redis indisponible
  if (!data || !data.available) {
    return (
      <Card className="border-yellow-500">
        <CardHeader>
          <CardTitle className="text-yellow-600">⚠️ Redis Indisponible</CardTitle>
          <CardDescription>
            Le cache Redis n'est pas disponible. Vérifiez la connexion Redis.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { today, last7Days, stats, recommendations } = data

  // Calcul tendance hit rate (aujourd'hui vs hier)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)
  const yesterdayMetrics = last7Days[yesterdayKey]
  const hitRateTrend = yesterdayMetrics
    ? today.hitRate - yesterdayMetrics.hitRate
    : 0

  return (
    <div className="space-y-6">
      {/* KPIs Principaux */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Hit Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
            {hitRateTrend > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : hitRateTrend < 0 ? (
              <TrendingDown className="h-4 w-4 text-red-600" />
            ) : (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{today.hitRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {hitRateTrend !== 0 && (
                <span className={hitRateTrend > 0 ? 'text-green-600' : 'text-red-600'}>
                  {hitRateTrend > 0 ? '+' : ''}
                  {hitRateTrend.toFixed(1)}% vs hier
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Hits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hits</CardTitle>
            <Badge variant="default" className="bg-green-600">Trouvés</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{today.hits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Aujourd'hui</p>
          </CardContent>
        </Card>

        {/* Misses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Misses</CardTitle>
            <Badge variant="secondary">Non trouvés</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{today.misses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Aujourd'hui</p>
          </CardContent>
        </Card>

        {/* Entrées Totales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entrées Cache</CardTitle>
            <Badge variant="outline">{stats.scopeCount || 0} scopes</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEntries?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Clés Redis actives</p>
          </CardContent>
        </Card>
      </div>

      {/* Recommandations */}
      {recommendations && recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">💡 Recommandations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Historique 7 jours */}
      <Card>
        <CardHeader>
          <CardTitle>Historique 7 derniers jours</CardTitle>
          <CardDescription>Évolution du hit rate et volume de requêtes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Date</th>
                    <th className="text-right py-2 px-4">Hits</th>
                    <th className="text-right py-2 px-4">Misses</th>
                    <th className="text-right py-2 px-4">Total</th>
                    <th className="text-right py-2 px-4">Hit Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(last7Days)
                    .sort(([a], [b]) => b.localeCompare(a)) // Tri décroissant
                    .map(([day, metrics]) => {
                      const total = metrics.hits + metrics.misses
                      const isToday = day === new Date().toISOString().slice(0, 10)

                      return (
                        <tr
                          key={day}
                          className={`border-b ${isToday ? 'bg-muted/50 font-medium' : ''}`}
                        >
                          <td className="py-2 px-4">
                            {day}
                            {isToday && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Aujourd'hui
                              </Badge>
                            )}
                          </td>
                          <td className="text-right py-2 px-4 text-green-600">
                            {metrics.hits.toLocaleString()}
                          </td>
                          <td className="text-right py-2 px-4 text-muted-foreground">
                            {metrics.misses.toLocaleString()}
                          </td>
                          <td className="text-right py-2 px-4 font-medium">
                            {total.toLocaleString()}
                          </td>
                          <td className="text-right py-2 px-4">
                            <Badge
                              variant={
                                metrics.hitRate >= 70
                                  ? 'default'
                                  : metrics.hitRate >= 50
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {metrics.hitRate.toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {Object.keys(last7Days).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Aucune donnée historique disponible
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Footer Auto-refresh */}
      <div className="flex items-center justify-end text-xs text-muted-foreground">
        <Loader2 className={`mr-2 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        <span>Auto-refresh 30s</span>
      </div>
    </div>
  )
}
