'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Play, History, Search, ChevronLeft, ChevronRight, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'
import BatchActionsModal from './BatchActionsModal'
import DocumentDetailPanel from './DocumentDetailPanel'

const STAGES = [
  { value: 'indexed', label: 'Indexé' },
  { value: 'crawled', label: 'Crawlé & Extrait' },
  { value: 'content_reviewed', label: 'Contenu validé' },
  { value: 'classified', label: 'Classifié' },
  { value: 'quality_analyzed', label: 'Qualité analysée' },
  { value: 'rag_active', label: 'RAG Actif' },
  { value: 'rejected', label: 'Rejeté' },
  { value: 'needs_revision', label: 'À réviser' },
]

export default function PipelineDocumentsTable() {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [replayingDocId, setReplayingDocId] = useState<string | null>(null)
  const [selectedStage, setSelectedStage] = useState('indexed')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedDocs, setSelectedDocs] = useState<any[]>([])
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<{ id: string; title: string } | null>(null)
  // Dialog de confirmation pour replay individuel
  const [replayConfirmDoc, setReplayConfirmDoc] = useState<{ id: string; stage: string; title: string } | null>(null)

  function toggleDocSelection(doc: any) {
    setSelectedDocs(prev => {
      const isSelected = prev.find(d => d.id === doc.id)
      if (isSelected) {
        return prev.filter(d => d.id !== doc.id)
      } else {
        return [...prev, doc]
      }
    })
  }

  function toggleAllSelection() {
    if (selectedDocs.length === documents.length) {
      setSelectedDocs([])
    } else {
      setSelectedDocs([...documents])
    }
  }

  function isDocSelected(docId: string) {
    return selectedDocs.some(d => d.id === docId)
  }

  async function fetchDocs() {
    try {
      setLoading(true)
      setSelectedDocs([])
      const params = new URLSearchParams({
        stage: selectedStage,
        page: page.toString(),
        limit: '20',
      })

      if (search) {
        params.append('search', search)
      }

      const res = await fetch(`/api/admin/pipeline/documents?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      } else {
        console.error('Erreur récupération documents:', res.statusText)
      }
    } catch (error) {
      console.error('Erreur fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocs()
  }, [selectedStage, page])

  function handleSearch() {
    setPage(1)
    fetchDocs()
  }

  async function confirmAndReplay() {
    if (!replayConfirmDoc) return
    const { id: docId, stage, title } = replayConfirmDoc
    setReplayConfirmDoc(null)

    try {
      setReplayingDocId(docId)

      const res = await fetch('/api/admin/pipeline/replay-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: docId,
          stage,
          reason: 'Manual replay from Pipeline Dashboard'
        })
      })

      const result = await res.json()

      if (res.ok && result.success) {
        toast.success('Replay réussi', {
          description: `Étape "${stage}" rejouée avec succès (tentative #${result.attemptNumber})`,
        })
        fetchDocs()
      } else {
        toast.error('Échec du replay', {
          description: result.error || 'Une erreur est survenue',
        })
      }
    } catch (error) {
      console.error('Erreur replay:', error)
      toast.error('Erreur', {
        description: "Impossible de rejouer l'étape",
      })
    } finally {
      setReplayingDocId(null)
    }
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Documents par Étape</CardTitle>
          <CardDescription>
            Filtrez et visualisez les documents à chaque étape du pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtres + Actions Batch */}
          <div className="flex gap-4 items-center">
            <Select value={selectedStage} onValueChange={(val) => {
              setSelectedStage(val)
              setPage(1)
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sélectionner étape" />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((stage) => (
                  <SelectItem key={stage.value} value={stage.value}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Rechercher par titre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {selectedDocs.length > 0 && (
              <Button
                variant="default"
                onClick={() => setBatchModalOpen(true)}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Actions Batch ({selectedDocs.length})
              </Button>
            )}
          </div>

          {/* Total */}
          <div className="text-sm text-muted-foreground">
            {total.toLocaleString()} document{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun document trouvé
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedDocs.length === documents.length && documents.length > 0}
                        onCheckedChange={toggleAllSelection}
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Jours</TableHead>
                    <TableHead>Dernière MAJ</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Checkbox
                          checked={isDocSelected(doc.id)}
                          onCheckedChange={() => toggleDocSelection(doc)}
                          aria-label={`Sélectionner ${doc.title}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-md truncate">
                        {doc.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{doc.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {doc.quality_score ? (
                          <Badge
                            variant={doc.quality_score >= 70 ? 'default' : 'secondary'}
                          >
                            {doc.quality_score}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {doc.days_in_stage.toFixed(1)}j
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(doc.pipeline_stage_updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReplayConfirmDoc({ id: doc.id, stage: doc.pipeline_stage, title: doc.title })}
                            disabled={replayingDocId === doc.id}
                          >
                            {replayingDocId === doc.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4 mr-1" />
                            )}
                            Rejouer
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedDocForDetail({ id: doc.id, title: doc.title })
                                  setDetailPanelOpen(true)
                                }}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Historique des tentatives</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {page} sur {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        {/* Modal Batch Actions */}
        <BatchActionsModal
          open={batchModalOpen}
          onClose={() => setBatchModalOpen(false)}
          selectedDocs={selectedDocs}
          action="replay"
          onSuccess={() => {
            fetchDocs()
            setSelectedDocs([])
          }}
        />

        {/* Panneau Détails Document */}
        <DocumentDetailPanel
          documentId={selectedDocForDetail?.id || null}
          documentTitle={selectedDocForDetail?.title}
          open={detailPanelOpen}
          onClose={() => {
            setDetailPanelOpen(false)
            setSelectedDocForDetail(null)
          }}
        />
      </Card>

      {/* Dialog confirmation Replay individuel */}
      <Dialog open={!!replayConfirmDoc} onOpenChange={() => setReplayConfirmDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le replay</DialogTitle>
            <DialogDescription>
              Rejouer l'étape <strong>{replayConfirmDoc?.stage}</strong> pour :
              <br />
              <span className="font-medium text-foreground">{replayConfirmDoc?.title}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplayConfirmDoc(null)}>
              Annuler
            </Button>
            <Button onClick={confirmAndReplay}>
              <Play className="h-4 w-4 mr-2" />
              Rejouer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
