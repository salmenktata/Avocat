'use client'

/**
 * Tab AI Costs - Statistiques coûts IA
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/lib/icons'
import { Skeleton } from '@/components/ui/skeleton'

// Taux de change USD -> TND (approximatif)
const USD_TO_TND = 3.1

function formatTND(usdAmount: number): string {
  return (usdAmount * USD_TO_TND).toFixed(3)
}

interface CostsStats {
  total_cost: number
  total_operations: number
  unique_users: number
  total_tokens: number
  daily_costs: Array<{
    date: string
    cost: number
    operations: number
  }>
  top_users: Array<{
    user_id: string
    user_email: string
    total_cost: number
    operations: number
  }>
  costs_by_provider: Array<{
    provider: string
    total_cost: number
    operations: number
  }>
}

export function AICostsTab() {
  const [stats, setStats] = useState<CostsStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCosts()
  }, [])

  async function fetchCosts() {
    try {
      const response = await fetch('/api/admin/ai-costs/summary')
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching AI costs:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucune donnée disponible
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Coûts IA</h2>
        <p className="text-sm text-muted-foreground">
          Analyse des coûts d'utilisation des providers IA (30 derniers jours)
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coût Total (30j)</CardTitle>
            <Icons.dollar className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTND(stats.total_cost)} TND
            </div>
            <p className="text-xs text-muted-foreground">
              ${stats.total_cost.toFixed(2)} USD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opérations</CardTitle>
            <Icons.zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_operations.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs IA</CardTitle>
            <Icons.users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unique_users}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Utilisés</CardTitle>
            <Icons.activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.total_tokens.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Costs */}
      <Card>
        <CardHeader>
          <CardTitle>Coûts des 7 derniers jours</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.daily_costs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune donnée disponible
            </div>
          ) : (
            <div className="space-y-2">
              {stats.daily_costs.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <span className="text-sm font-medium">
                    {new Date(day.date).toLocaleDateString('fr-FR')}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {day.operations} ops
                    </span>
                    <Badge variant="secondary">
                      {formatTND(day.cost)} TND
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Users & Providers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle>Top Utilisateurs</CardTitle>
            <CardDescription>Par coût total (30j)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.top_users.slice(0, 5).map((user, idx) => (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <span className="text-sm">{user.user_email}</span>
                  </div>
                  <Badge variant="outline">
                    {formatTND(user.total_cost)} TND
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Costs by Provider */}
        <Card>
          <CardHeader>
            <CardTitle>Coûts par Provider</CardTitle>
            <CardDescription>Répartition (30j)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.costs_by_provider.map((provider) => (
                <div
                  key={provider.provider}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <span className="text-sm font-medium capitalize">
                    {provider.provider}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {provider.operations} ops
                    </span>
                    <Badge>
                      {formatTND(provider.total_cost)} TND
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
