'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertCircle, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface BatchActionsModalProps {
  open: boolean
  onClose: () => void
  selectedDocs: Array<{
    id: string
    title: string
    category: string
    pipeline_stage: string
    quality_score?: number
  }>
  action: 'replay' | 'reset'
  onSuccess?: () => void
}

type Step = 'preview' | 'confirm' | 'processing' | 'results'

interface PreviewData {
  totalMatched: number
  preview: Array<{
    id: string
    title: string
    category: string
    score?: number
  }>
  fullList: Array<{
    id: string
    title: string
  }>
}

interface BatchResult {
  batchId: string
  totalMatched: number
  totalProcessed: number
  succeeded: number
  failed: number
  duration_ms: number
  results: Array<{
    documentId: string
    title: string
    success: boolean
    attemptNumber?: number
    duration_ms?: number
    error?: string
  }>
}

export default function BatchActionsModal({
  open,
  onClose,
  selectedDocs,
  action,
  onSuccess,
}: BatchActionsModalProps) {
  const [step, setStep] = useState<Step>('preview')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [results, setResults] = useState<BatchResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleDryRun() {
    if (selectedDocs.length === 0) {
      toast.error('Aucun document sélectionné')
      return
    }

    try {
      setLoading(true)

      const stage = selectedDocs[0]?.pipeline_stage
      const documentIds = selectedDocs.map(d => d.id)

      const res = await fetch('/api/admin/pipeline/batch-replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage,
          documentIds,
          limit: documentIds.length,
          dryRun: true,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setPreview(data)
        setStep('confirm')
      } else {
        toast.error('Erreur', {
          description: data.error || 'Impossible de prévisualiser',
        })
      }
    } catch (error) {
      console.error('Erreur dry-run:', error)
      toast.error('Erreur', {
        description: 'Impossible de prévisualiser les documents',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleExecute() {
    if (!preview) return

    try {
      setStep('processing')

      const stage = selectedDocs[0]?.pipeline_stage
      const documentIds = selectedDocs.map(d => d.id)

      const res = await fetch('/api/admin/pipeline/batch-replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage,
          documentIds,
          limit: documentIds.length,
          dryRun: false,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResults(data)
        setStep('results')

        if (data.succeeded > 0) {
          toast.success('Batch replay terminé', {
            description: `${data.succeeded} document(s) traité(s) avec succès`,
          })
        }

        if (data.failed > 0) {
          toast.warning('Certains replays ont échoué', {
            description: `${data.failed} échec(s) sur ${data.totalProcessed}`,
          })
        }

        // Appeler le callback de succès
        if (onSuccess) {
          onSuccess()
        }
      } else {
        toast.error('Erreur', {
          description: data.error || 'Échec du batch replay',
        })
        setStep('confirm')
      }
    } catch (error) {
      console.error('Erreur batch execute:', error)
      toast.error('Erreur', {
        description: 'Impossible d\'exécuter le batch replay',
      })
      setStep('confirm')
    }
  }

  function handleClose() {
    setStep('preview')
    setPreview(null)
    setResults(null)
    setLoading(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {action === 'replay' ? 'Rejouer en Batch' : 'Reset en Batch'}
          </DialogTitle>
          <DialogDescription>
            {step === 'preview' && `${selectedDocs.length} document(s) sélectionné(s)`}
            {step === 'confirm' && 'Confirmez l\'exécution du batch'}
            {step === 'processing' && 'Traitement en cours...'}
            {step === 'results' && 'Résultats du batch'}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: PREVIEW */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Action irréversible</p>
                <p className="text-sm text-muted-foreground">
                  Cette opération va rejouer l'étape <Badge variant="outline">{selectedDocs[0]?.pipeline_stage}</Badge> pour tous les documents sélectionnés.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Documents concernés ({selectedDocs.length}) :</p>
              <ScrollArea className="h-40 border rounded-lg p-3">
                <div className="space-y-2">
                  {selectedDocs.map((doc) => (
                    <div key={doc.id} className="flex justify-between items-center text-sm">
                      <span className="flex-1 truncate">{doc.title}</span>
                      <Badge variant="outline" className="ml-2">{doc.category}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handleDryRun} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  'Prévisualiser'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 2: CONFIRM */}
        {step === 'confirm' && preview && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Documents à traiter</span>
                <Badge variant="default">{preview.totalMatched}</Badge>
              </div>

              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {preview.fullList.map((doc) => (
                    <div key={doc.id} className="flex items-center text-sm p-2 hover:bg-muted/50 rounded">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      <span className="flex-1 truncate">{doc.title}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex items-start gap-3 p-4 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                  Temps estimé : {Math.ceil(preview.totalMatched * 0.5)} - {Math.ceil(preview.totalMatched * 2)} secondes
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  Le traitement peut prendre plusieurs minutes. Ne fermez pas cette fenêtre.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handleExecute} variant="default">
                Exécuter ({preview.totalMatched} docs)
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3: PROCESSING */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-medium">Traitement en cours...</p>
              <p className="text-sm text-muted-foreground">
                Veuillez patienter pendant le replay des documents
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: RESULTS */}
        {step === 'results' && results && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{results.totalProcessed}</p>
                <p className="text-xs text-muted-foreground">Traités</p>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{results.succeeded}</p>
                <p className="text-xs text-muted-foreground">Succès</p>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                <p className="text-xs text-muted-foreground">Échecs</p>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{(results.duration_ms / 1000).toFixed(1)}s</p>
                <p className="text-xs text-muted-foreground">Durée</p>
              </div>
            </div>

            <ScrollArea className="h-64 border rounded-lg p-3">
              <div className="space-y-2">
                {results.results.map((r) => (
                  <div
                    key={r.documentId}
                    className={`flex items-start gap-2 p-2 rounded ${
                      r.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'
                    }`}
                  >
                    {r.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      {r.success ? (
                        <p className="text-xs text-muted-foreground">
                          Tentative #{r.attemptNumber} • {r.duration_ms}ms
                        </p>
                      ) : (
                        <p className="text-xs text-red-600">{r.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button onClick={handleClose} variant="default">
                Fermer
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
