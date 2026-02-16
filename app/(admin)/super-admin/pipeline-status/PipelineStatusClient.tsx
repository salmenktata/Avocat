'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PipelineFunnelSection from '@/components/super-admin/pipeline/PipelineFunnelSection'
import PipelineDocumentsTable from '@/components/super-admin/pipeline/PipelineDocumentsTable'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PipelineStatusClient() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchStats() {
    try {
      setRefreshing(true)
      const res = await fetch('/api/admin/pipeline/status')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      } else {
        console.error('Erreur récupération stats:', res.statusText)
      }
    } catch (error) {
      console.error('Erreur fetch stats:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats()

    // Auto-refresh toutes les 30s
    const interval = setInterval(fetchStats, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Chargement du pipeline...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline Documents</h1>
          <p className="text-muted-foreground mt-1">
            Tracking et re-trigger du pipeline de traitement KB
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats globales */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Documents</CardDescription>
              <CardTitle className="text-3xl">{stats.funnel.total.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>En Validation</CardDescription>
              <CardTitle className="text-3xl">{stats.funnel.pendingValidation.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>RAG Actif</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {stats.funnel.stages.find((s: any) => s.stage === 'rag_active')?.count.toLocaleString() || '0'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Retries 24h</CardDescription>
              <CardTitle className="text-3xl">{stats.retry.last24h.total.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="funnel">Vue Funnel</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="space-y-4">
          <PipelineFunnelSection stats={stats} />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <PipelineDocumentsTable />
        </TabsContent>

        <TabsContent value="bottlenecks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bottlenecks Détectés</CardTitle>
              <CardDescription>
                Étapes avec le plus de documents en attente
              </CardDescription>
            </CardHeader>
            {stats && stats.bottlenecks && stats.bottlenecks.length > 0 ? (
              <div className="p-6 space-y-3">
                {stats.bottlenecks.map((bottleneck: any) => (
                  <div
                    key={bottleneck.stage}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{bottleneck.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {bottleneck.count} documents • Moyenne {bottleneck.avgDaysInStage.toFixed(1)} jours
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Plus ancien :{' '}
                        {bottleneck.oldestDocDate
                          ? new Date(bottleneck.oldestDocDate).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                Aucun bottleneck détecté
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
