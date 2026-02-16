'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, CheckCircle, Clock, Loader2, XCircle } from 'lucide-react'

interface DocumentDetailPanelProps {
  documentId: string | null
  documentTitle?: string
  open: boolean
  onClose: () => void
}

interface RetryAttempt {
  id: string
  stage: string
  attempt_number: number
  triggered_by: string | null
  triggered_at: string
  status: 'pending' | 'running' | 'success' | 'failed'
  error_message: string | null
  duration_ms: number | null
  retry_reason: string | null
}

interface StageData {
  stage: string
  total: number
  succeeded: number
  failed: number
  pending: number
  running: number
  lastAttempt: RetryAttempt | null
  attempts: RetryAttempt[]
}

interface AttemptsData {
  documentId: string
  totalAttempts: number
  byStage: StageData[]
  allAttempts: RetryAttempt[]
}

export default function DocumentDetailPanel({
  documentId,
  documentTitle,
  open,
  onClose,
}: DocumentDetailPanelProps) {
  const [attempts, setAttempts] = useState<AttemptsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId || !open) {
      setAttempts(null)
      setLoading(true)
      setError(null)
      return
    }

    async function fetchAttempts() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/admin/pipeline/retry-attempts/${documentId}`)

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Erreur lors de la récupération')
        }

        const data = await res.json()
        setAttempts(data)
      } catch (err) {
        console.error('Erreur fetch attempts:', err)
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    fetchAttempts()
  }, [documentId, open])

  function getStatusIcon(status: string) {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      case 'pending':
        return <Clock className="h-4 w-4 text-orange-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, any> = {
      success: { variant: 'default', label: 'Succès' },
      failed: { variant: 'destructive', label: 'Échec' },
      running: { variant: 'secondary', label: 'En cours' },
      pending: { variant: 'outline', label: 'En attente' },
    }
    const config = variants[status] || { variant: 'outline', label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Historique des Tentatives</SheetTitle>
          <SheetDescription>
            {documentTitle || `Document ID: ${documentId}`}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        ) : !attempts || attempts.totalAttempts === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">Aucune tentative enregistrée</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Stats Globales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Résumé</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold">{attempts.totalAttempts}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {attempts.byStage.reduce((sum, s) => sum + s.succeeded, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Succès</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {attempts.byStage.reduce((sum, s) => sum + s.failed, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Échecs</p>
                </div>
              </CardContent>
            </Card>

            {/* Par Étape */}
            {attempts.byStage.map((stageData) => (
              <Card key={stageData.stage}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <Badge variant="outline">{stageData.stage}</Badge>
                    <span className="text-xs text-muted-foreground font-normal">
                      {stageData.total} tentative{stageData.total > 1 ? 's' : ''}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-64">
                    <div className="space-y-3">
                      {stageData.attempts.map((attempt) => (
                        <div key={attempt.id}>
                          <div
                            className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${
                              attempt.status === 'success'
                                ? 'border-l-green-500 bg-green-50 dark:bg-green-950/20'
                                : attempt.status === 'failed'
                                ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20'
                                : 'border-l-gray-300 bg-gray-50 dark:bg-gray-950/20'
                            }`}
                          >
                            <div className="mt-0.5">{getStatusIcon(attempt.status)}</div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  Tentative #{attempt.attempt_number}
                                </span>
                                {getStatusBadge(attempt.status)}
                                {attempt.duration_ms && (
                                  <Badge variant="outline" className="text-xs">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {attempt.duration_ms}ms
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(attempt.triggered_at).toLocaleString('fr-FR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </p>
                              {attempt.error_message && (
                                <p className="text-xs text-red-600 mt-1">
                                  <strong>Erreur :</strong> {attempt.error_message}
                                </p>
                              )}
                              {attempt.retry_reason && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  <strong>Raison :</strong> {attempt.retry_reason}
                                </p>
                              )}
                            </div>
                          </div>
                          <Separator className="mt-3" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
