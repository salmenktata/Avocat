'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { PipelineFunnel } from './PipelineFunnel'
import { PipelineStageTab } from './PipelineStageTab'

interface FunnelStage {
  stage: string
  label: string
  count: number
  percentage: number
}

interface FunnelData {
  funnel: {
    stages: FunnelStage[]
    total: number
    pendingValidation: number
    rejected: number
    needsRevision: number
  }
  bottlenecks: Array<{
    stage: string
    label: string
    count: number
    avgDaysInStage: number
  }>
}

interface DocumentSummary {
  id: string
  title: string
  category: string
  language: string
  pipeline_stage: string
  quality_score: number | null
  is_indexed: boolean
  source_file: string | null
  days_in_stage: number
  created_at: string
}

interface DocsResult {
  documents: DocumentSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const STAGES = [
  { value: 'crawled', label: 'Crawlé' },
  { value: 'content_reviewed', label: 'Contenu validé' },
  { value: 'classified', label: 'Classifié' },
  { value: 'indexed', label: 'Indexé' },
  { value: 'quality_analyzed', label: 'Qualité' },
  { value: 'rag_active', label: 'RAG Actif' },
  { value: 'rejected', label: 'Rejeté' },
  { value: 'needs_revision', label: 'À réviser' },
] as const

export function PipelineDashboard() {
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null)
  const [activeTab, setActiveTab] = useState('crawled')
  const [docs, setDocs] = useState<DocsResult | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isLoadingFunnel, setIsLoadingFunnel] = useState(true)
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)

  // Fetch funnel stats
  const fetchFunnel = useCallback(async () => {
    setIsLoadingFunnel(true)
    try {
      const res = await fetch('/api/admin/pipeline/stats')
      if (res.ok) {
        const data = await res.json()
        setFunnelData(data)
      }
    } catch (error) {
      console.error('Erreur fetch funnel:', error)
    } finally {
      setIsLoadingFunnel(false)
    }
  }, [])

  // Fetch documents for active tab
  const fetchDocs = useCallback(async () => {
    setIsLoadingDocs(true)
    try {
      const params = new URLSearchParams({
        stage: activeTab,
        page: page.toString(),
        limit: '20',
      })
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/pipeline/documents?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDocs(data)
      }
    } catch (error) {
      console.error('Erreur fetch docs:', error)
    } finally {
      setIsLoadingDocs(false)
    }
  }, [activeTab, page, search])

  useEffect(() => {
    fetchFunnel()
  }, [fetchFunnel])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  // Reset page when changing tab or search
  useEffect(() => {
    setPage(1)
  }, [activeTab, search])

  const handleStageClick = (stage: string) => {
    setActiveTab(stage)
    setPage(1)
  }

  const handleBulkAdvance = async (ids: string[], notes?: string) => {
    const res = await fetch('/api/admin/pipeline/bulk/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docIds: ids, notes }),
    })
    if (res.ok) {
      await fetchDocs()
      await fetchFunnel()
    }
  }

  const handleBulkReject = async (ids: string[], reason: string) => {
    const res = await fetch('/api/admin/pipeline/bulk/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docIds: ids, reason }),
    })
    if (res.ok) {
      await fetchDocs()
      await fetchFunnel()
    }
  }

  // Debounce search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold">Pipeline KB</h1>
        <p className="text-muted-foreground">
          Validation supervisée des documents de la base de connaissances
        </p>
      </div>

      {/* Funnel */}
      {funnelData && (
        <PipelineFunnel
          stages={funnelData.funnel.stages}
          total={funnelData.funnel.total}
          pendingValidation={funnelData.funnel.pendingValidation}
          rejected={funnelData.funnel.rejected}
          needsRevision={funnelData.funnel.needsRevision}
          onStageClick={handleStageClick}
        />
      )}

      {/* Tabs par étape */}
      <Tabs value={activeTab} onValueChange={handleStageClick}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {STAGES.map(s => {
            const count = funnelData?.funnel.stages.find(fs => fs.stage === s.value)?.count
              ?? (s.value === 'rejected' ? funnelData?.funnel.rejected : undefined)
              ?? (s.value === 'needs_revision' ? funnelData?.funnel.needsRevision : undefined)
              ?? 0
            return (
              <TabsTrigger key={s.value} value={s.value} className="gap-1.5">
                {s.label}
                {count > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {STAGES.map(s => (
          <TabsContent key={s.value} value={s.value}>
            <PipelineStageTab
              stage={s.value}
              stageLabel={s.label}
              documents={docs?.documents || []}
              total={docs?.total || 0}
              page={page}
              totalPages={docs?.totalPages || 1}
              isLoading={isLoadingDocs}
              onPageChange={setPage}
              onRefresh={() => { fetchDocs(); fetchFunnel() }}
              onBulkAdvance={handleBulkAdvance}
              onBulkReject={handleBulkReject}
              searchValue={searchInput}
              onSearchChange={setSearchInput}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
