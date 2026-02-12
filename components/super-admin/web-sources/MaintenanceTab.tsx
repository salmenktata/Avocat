/**
 * Onglet Maintenance - Actions de maintenance pour les sources web
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Trash2,
  FileWarning,
  Scissors,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'

interface MaintenanceStats {
  byStatus: Array<{
    status: string
    count: number
    indexed: number
    avg_text_length: number
  }>
  totals: {
    total_pages: number
    total_indexed: number
    total_chunks: number
    total_failed: number
    total_removed: number
    pending_index: number
  }
  actions: {
    cleanup_insufficient: { available: boolean; count: number }
    reindex_long_documents: { available: boolean; count: number }
    cleanup_temp_files: { available: boolean; count: number }
    retry_failed: { available: boolean; count: number }
  }
}

interface MaintenanceTabProps {
  sourceId: string
}

export function MaintenanceTab({ sourceId }: MaintenanceTabProps) {
  const [stats, setStats] = useState<MaintenanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{
    action: string
    success: boolean
    message: string
  } | null>(null)

  // Charger les statistiques
  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/web-sources/maintenance?sourceId=${sourceId}`)
      const data = await response.json()

      if (data.success) {
        setStats(data)
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [sourceId])

  // Exécuter une action de maintenance
  const executeAction = async (
    action: string,
    options: { limit?: number; dryRun?: boolean } = {}
  ) => {
    try {
      setActionLoading(action)
      setLastResult(null)

      const response = await fetch('/api/admin/web-sources/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sourceId, options }),
      })

      const data = await response.json()

      if (data.success) {
        let message = ''
        switch (action) {
          case 'cleanup_insufficient':
            message = `${data.pagesArchived} pages archivées`
            break
          case 'cleanup_temp_files':
            message = `${data.filesArchived} fichiers temporaires archivés`
            break
          case 'reindex_long_documents':
            message = `${data.succeeded}/${data.processed} documents réindexés, ${data.sectionsCreated} sections créées`
            break
          case 'retry_failed':
            message = `${data.pagesReset} pages réinitialisées pour retry`
            break
          default:
            message = 'Action terminée'
        }

        setLastResult({
          action,
          success: true,
          message,
        })

        // Recharger les stats
        await loadStats()
      } else {
        setLastResult({
          action,
          success: false,
          message: data.error || 'Erreur inconnue',
        })
      }
    } catch (error) {
      setLastResult({
        action,
        success: false,
        message: error instanceof Error ? error.message : 'Erreur réseau',
      })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center p-12 text-slate-400">
        Impossible de charger les statistiques
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-800 border-slate-700">
          <div className="text-sm text-slate-400">Total Pages</div>
          <div className="text-2xl font-bold text-white">
            {stats.totals.total_pages}
          </div>
        </Card>

        <Card className="p-4 bg-slate-800 border-slate-700">
          <div className="text-sm text-slate-400">Indexées</div>
          <div className="text-2xl font-bold text-green-500">
            {stats.totals.total_indexed}
            <span className="text-sm text-slate-400 ml-2">
              ({Math.round((stats.totals.total_indexed / stats.totals.total_pages) * 100)}%)
            </span>
          </div>
        </Card>

        <Card className="p-4 bg-slate-800 border-slate-700">
          <div className="text-sm text-slate-400">Chunks Créés</div>
          <div className="text-2xl font-bold text-blue-500">
            {stats.totals.total_chunks?.toLocaleString() || 0}
          </div>
        </Card>

        <Card className="p-4 bg-slate-800 border-slate-700">
          <div className="text-sm text-slate-400">Erreurs</div>
          <div className="text-2xl font-bold text-red-500">
            {stats.totals.total_failed}
          </div>
        </Card>
      </div>

      {/* Résultat dernière action */}
      {lastResult && (
        <Card
          className={`p-4 border ${
            lastResult.success
              ? 'bg-green-900/20 border-green-700'
              : 'bg-red-900/20 border-red-700'
          }`}
        >
          <div className="flex items-center gap-3">
            {lastResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <div className="font-medium text-white">
                {lastResult.success ? 'Succès' : 'Erreur'}
              </div>
              <div className="text-sm text-slate-300">{lastResult.message}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Actions de maintenance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cleanup pages insuffisantes */}
        <Card className="p-6 bg-slate-800 border-slate-700">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-900/30 rounded-lg">
              <Trash2 className="h-6 w-6 text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">
                Archiver Pages Insuffisantes
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Archiver les pages avec contenu &lt;100 caractères (fichiers vides,
                temporaires)
              </p>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-300">
                  {stats.actions.cleanup_insufficient.count} pages concernées
                </div>
                <Button
                  onClick={() => executeAction('cleanup_insufficient')}
                  disabled={
                    !stats.actions.cleanup_insufficient.available ||
                    actionLoading !== null
                  }
                  size="sm"
                  variant="outline"
                  className="border-orange-700 hover:bg-orange-900/20"
                >
                  {actionLoading === 'cleanup_insufficient' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      En cours...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Archiver
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Cleanup fichiers temporaires */}
        <Card className="p-6 bg-slate-800 border-slate-700">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-900/30 rounded-lg">
              <FileWarning className="h-6 w-6 text-yellow-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">
                Nettoyer Fichiers Temporaires
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Archiver les fichiers temporaires Word (~$*.doc) sans contenu utile
              </p>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-300">Détection automatique</div>
                <Button
                  onClick={() => executeAction('cleanup_temp_files')}
                  disabled={actionLoading !== null}
                  size="sm"
                  variant="outline"
                  className="border-yellow-700 hover:bg-yellow-900/20"
                >
                  {actionLoading === 'cleanup_temp_files' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      En cours...
                    </>
                  ) : (
                    <>
                      <FileWarning className="h-4 w-4 mr-2" />
                      Nettoyer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Réindexer documents longs */}
        <Card className="p-6 bg-slate-800 border-slate-700">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-900/30 rounded-lg">
              <Scissors className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">
                Réindexer Documents Longs
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Découper et réindexer les documents &gt;50KB avec sections automatiques
              </p>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-300">
                  {stats.totals.total_failed} documents en erreur
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      executeAction('reindex_long_documents', {
                        limit: 5,
                        dryRun: true,
                      })
                    }
                    disabled={
                      !stats.actions.reindex_long_documents.available ||
                      actionLoading !== null
                    }
                    size="sm"
                    variant="outline"
                    className="border-slate-600 hover:bg-slate-700"
                  >
                    Test (5)
                  </Button>
                  <Button
                    onClick={() =>
                      executeAction('reindex_long_documents', { limit: 10 })
                    }
                    disabled={
                      !stats.actions.reindex_long_documents.available ||
                      actionLoading !== null
                    }
                    size="sm"
                    variant="outline"
                    className="border-blue-700 hover:bg-blue-900/20"
                  >
                    {actionLoading === 'reindex_long_documents' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        En cours...
                      </>
                    ) : (
                      <>
                        <Scissors className="h-4 w-4 mr-2" />
                        Lancer (10)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Retry pages failed */}
        <Card className="p-6 bg-slate-800 border-slate-700">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-900/30 rounded-lg">
              <RefreshCw className="h-6 w-6 text-purple-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">
                Réessayer Pages Échouées
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Réinitialiser les pages en erreur pour un nouveau crawl (max 3 tentatives)
              </p>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-300">
                  {stats.totals.total_failed} pages failed
                </div>
                <Button
                  onClick={() => executeAction('retry_failed', { limit: 20 })}
                  disabled={
                    !stats.actions.retry_failed.available || actionLoading !== null
                  }
                  size="sm"
                  variant="outline"
                  className="border-purple-700 hover:bg-purple-900/20"
                >
                  {actionLoading === 'retry_failed' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      En cours...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry (20)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Répartition par status */}
      <Card className="p-6 bg-slate-800 border-slate-700">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-500" />
          Répartition par Status
        </h3>
        <div className="space-y-2">
          {stats.byStatus.map((item) => (
            <div
              key={item.status}
              className="flex items-center justify-between p-3 bg-slate-900 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="text-sm font-medium text-white min-w-[120px]">
                  {item.status}
                </div>
                <div className="text-sm text-slate-400">
                  {item.count.toLocaleString()} pages
                </div>
                {item.indexed > 0 && (
                  <div className="text-sm text-green-500">
                    {item.indexed} indexées
                  </div>
                )}
              </div>
              <div className="text-sm text-slate-400">
                Moy: {Math.round(item.avg_text_length || 0).toLocaleString()} chars
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
