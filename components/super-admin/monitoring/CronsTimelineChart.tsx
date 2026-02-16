'use client'

/**
 * Timeline Chart - Exécutions crons sur 7 derniers jours
 * Stacked bar chart (completed vs failed)
 * QW4: Filtres rapides (24h | 3j | 7j) + filtre par cron
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from '@/components/charts/LazyCharts'

interface CronsTimelineChartProps {
  data: Array<{
    date: string
    completed: number
    failed: number
    running: number
    total: number
    cron_name?: string
  }>
}

type TimeRange = '24h' | '3j' | '7j'

export function CronsTimelineChart({ data }: CronsTimelineChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7j')
  const [cronFilter, setCronFilter] = useState<string>('all')

  if (!data || data.length === 0) {
    return null
  }

  // QW4: Filtrer par période
  const filterByTimeRange = (items: typeof data): typeof data => {
    const now = new Date()
    const cutoffDate = new Date()

    if (timeRange === '24h') {
      cutoffDate.setDate(cutoffDate.getDate() - 1)
    } else if (timeRange === '3j') {
      cutoffDate.setDate(cutoffDate.getDate() - 3)
    } else {
      cutoffDate.setDate(cutoffDate.getDate() - 7)
    }

    return items.filter((d) => new Date(d.date) >= cutoffDate)
  }

  // QW4: Filtrer par cron (si les données contiennent cron_name)
  const filterByCron = (items: typeof data): typeof data => {
    if (cronFilter === 'all') return items
    return items.filter((d) => d.cron_name === cronFilter)
  }

  // Appliquer les filtres
  let filteredData = filterByTimeRange(data)
  filteredData = filterByCron(filteredData)

  // Liste unique des crons
  const uniqueCrons = Array.from(new Set(data.map((d) => d.cron_name).filter(Boolean)))

  // Formater les données pour Recharts
  const chartData = filteredData.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    }),
  }))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle>Timeline Exécutions</CardTitle>
            <CardDescription>
              Historique des exécutions sur les derniers jours
            </CardDescription>
          </div>
        </div>

        {/* QW4: Filtres rapides */}
        <div className="flex gap-4 items-center">
          {/* Pills période */}
          <div className="flex gap-2">
            <Button
              variant={timeRange === '24h' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('24h')}
            >
              24h
            </Button>
            <Button
              variant={timeRange === '3j' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('3j')}
            >
              3j
            </Button>
            <Button
              variant={timeRange === '7j' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('7j')}
            >
              7j
            </Button>
          </div>

          {/* Filtre par cron */}
          {uniqueCrons.length > 0 && (
            <Select value={cronFilter} onValueChange={setCronFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tous les crons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les crons</SelectItem>
                {uniqueCrons.map((name) => (
                  <SelectItem key={name} value={name!}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="rect"
            />
            <Bar
              dataKey="completed"
              name="Succès"
              stackId="a"
              fill="hsl(142, 76%, 36%)"
              radius={[0, 0, 4, 4]}
            />
            <Bar
              dataKey="failed"
              name="Échecs"
              stackId="a"
              fill="hsl(0, 84%, 60%)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Stats rapides sous le graphique */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {filteredData.reduce((sum, d) => sum + d.completed, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total Succès</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {filteredData.reduce((sum, d) => sum + d.failed, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total Échecs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {filteredData.reduce((sum, d) => sum + d.total, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total Exécutions</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
