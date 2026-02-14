/**
 * Page Admin : Dashboard Usage IA
 *
 * Affiche les statistiques d'utilisation des providers IA en temps réel.
 */

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, TrendingUp, Zap, DollarSign, RefreshCw } from 'lucide-react'

// =============================================================================
// TYPES & HELPERS
// =============================================================================

/**
 * Ordre d'affichage des providers (Février 2026)
 * Reflète la configuration réelle: primaires en premier, Anthropic dernier
 */
const PROVIDER_DISPLAY_ORDER = ['groq', 'gemini', 'openai', 'deepseek', 'ollama', 'anthropic'] as const

/**
 * Détermine le rôle du provider selon configuration Février 2026
 */
function getProviderRole(provider: string): { badge: string; variant: 'default' | 'secondary' | 'outline' } {
  switch (provider.toLowerCase()) {
    case 'groq':
      return { badge: '🟢 Primary (Chat)', variant: 'default' }
    case 'gemini':
      return { badge: '🟢 Primary (Analyse)', variant: 'default' }
    case 'openai':
      return { badge: '🟢 Primary (Embeddings)', variant: 'default' }
    case 'deepseek':
      return { badge: '🟡 Fallback', variant: 'secondary' }
    case 'ollama':
      return { badge: '🟡 Fallback Local', variant: 'secondary' }
    case 'anthropic':
      return { badge: '⚠️ Marginal', variant: 'outline' }
    default:
      return { badge: 'Actif', variant: 'secondary' }
  }
}

interface AIUsageStats {
  providers: {
    gemini: ProviderStats
    deepseek: ProviderStats
    groq: ProviderStats
    anthropic: ProviderStats
    ollama: ProviderStats
  }
  totalCost: number
  alerts: AlertData[]
  period: {
    start: string
    end: string
  }
}

interface ProviderStats {
  enabled: boolean
  tokensInput: number
  tokensOutput: number
  tokensTotal: number
  requestCount: number
  errorCount: number
  avgLatencyMs: number
  costEstimated: number
  tierInfo?: {
    type: 'free' | 'paid'
    limit?: number
    used?: number
    remaining?: number
  }
}

interface AlertData {
  type: 'warning' | 'error' | 'info'
  provider: string
  message: string
  threshold?: number
  current?: number
}

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export default function AIUsagePage() {
  const [stats, setStats] = useState<AIUsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/admin/ai-usage?days=7')
      if (!response.ok) throw new Error('Erreur chargement stats')
      const data = await response.json()
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats()
    // Auto-refresh toutes les 30 secondes
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!stats) return null

  // Filtrer et trier les providers selon l'ordre défini
  const providers = PROVIDER_DISPLAY_ORDER
    .map((name) => [name, stats.providers[name as keyof typeof stats.providers]] as const)
    .filter(([_, data]) => data?.enabled)

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usage IA</h1>
          <p className="text-muted-foreground">
            Statistiques des 7 derniers jours •{' '}
            {new Date(stats.period.start).toLocaleDateString()} -{' '}
            {new Date(stats.period.end).toLocaleDateString()}
          </p>
        </div>
        <Button onClick={fetchStats} disabled={refreshing} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Alertes */}
      {stats.alerts.length > 0 && (
        <div className="space-y-2">
          {stats.alerts.map((alert, idx) => (
            <Alert
              key={idx}
              variant={alert.type === 'error' ? 'destructive' : 'default'}
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="capitalize">{alert.provider}</AlertTitle>
              <AlertDescription>
                {alert.message}
                {alert.current !== undefined && alert.threshold !== undefined && (
                  <span className="ml-2 font-mono">
                    ({alert.current}% / {alert.threshold}%)
                  </span>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Coût Total */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Coût Total Estimé
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">
            ${stats.totalCost.toFixed(4)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.totalCost === 0 ? 'Tier gratuit uniquement' : 'Sur 7 jours'}
          </p>
        </CardContent>
      </Card>

      {/* Stats par Provider */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {providers.map(([name, data]) => (
          <ProviderCard key={name} name={name} data={data} />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// COMPOSANT CARTE PROVIDER
// =============================================================================

function ProviderCard({ name, data }: { name: string; data: ProviderStats }) {
  const errorRate = data.requestCount > 0 ? (data.errorCount / data.requestCount) * 100 : 0
  const isFree = data.costEstimated === 0
  const role = getProviderRole(name)
  const isMarginal = name.toLowerCase() === 'anthropic'

  return (
    <Card className={isMarginal ? 'opacity-60 border-muted' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="capitalize">{name}</CardTitle>
          <div className="flex gap-1">
            <Badge variant={role.variant}>{role.badge}</Badge>
            {data.tierInfo?.type === 'free' && (
              <Badge variant="secondary">Gratuit</Badge>
            )}
          </div>
        </div>
        <CardDescription>
          {data.requestCount.toLocaleString()} requêtes
          {isMarginal && ' • Dernier recours, rarement utilisé'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tokens */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tokens</span>
            <span className="font-mono font-medium">
              {(data.tokensTotal / 1000).toFixed(1)}K
            </span>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground mt-1">
            <span>↓ {(data.tokensInput / 1000).toFixed(1)}K</span>
            <span>↑ {(data.tokensOutput / 1000).toFixed(1)}K</span>
          </div>
        </div>

        {/* Latence */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Latence moyenne
          </span>
          <span className="font-mono font-medium">
            {data.avgLatencyMs > 0 ? `${data.avgLatencyMs.toFixed(0)}ms` : '-'}
          </span>
        </div>

        {/* Taux d'erreur */}
        {data.requestCount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Erreurs</span>
            <span
              className={`font-medium ${
                errorRate > 10 ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {errorRate.toFixed(1)}%
            </span>
          </div>
        )}

        {/* Coût */}
        <div className="flex items-center justify-between text-sm pt-2 border-t">
          <span className="text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Coût estimé
          </span>
          <span className="font-mono font-medium">
            {isFree ? (
              <span className="text-green-600">$0</span>
            ) : (
              `$${data.costEstimated.toFixed(4)}`
            )}
          </span>
        </div>

        {/* Tier info (Gemini) */}
        {data.tierInfo && data.tierInfo.limit !== undefined && (
          <div className="mt-2 p-2 bg-muted rounded-md">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">RPM</span>
              <span className="font-mono">
                {data.tierInfo.used} / {data.tierInfo.limit}
              </span>
            </div>
            <div className="mt-1 h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${((data.tierInfo.used || 0) / data.tierInfo.limit) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
