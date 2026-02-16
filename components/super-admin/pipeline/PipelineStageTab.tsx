'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Icons } from '@/lib/icons'
import { PipelineDocumentRow } from './PipelineDocumentRow'
import { PipelineBulkActions } from './PipelineBulkActions'

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
  web_source_id: string | null
  source_name: string | null
}

interface PipelineSource {
  id: string
  name: string
  base_url: string
  category: string
}

interface PipelineStageTabProps {
  stage: string
  stageLabel: string
  documents: DocumentSummary[]
  total: number
  page: number
  totalPages: number
  isLoading: boolean
  onPageChange: (page: number) => void
  onRefresh: () => void
  onBulkAdvance: (ids: string[], notes?: string) => Promise<void>
  onBulkReject: (ids: string[], reason: string) => Promise<void>
  searchValue: string
  onSearchChange: (value: string) => void
  sourceId: string
  onSourceChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  language: string
  onLanguageChange: (value: string) => void
  sources: PipelineSource[]
  categories: string[]
}

export function PipelineStageTab({
  stage,
  stageLabel,
  documents,
  total,
  page,
  totalPages,
  isLoading,
  onPageChange,
  onRefresh,
  onBulkAdvance,
  onBulkReject,
  searchValue,
  onSearchChange,
  sourceId,
  onSourceChange,
  category,
  onCategoryChange,
  language,
  onLanguageChange,
  sources,
  categories,
}: PipelineStageTabProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(documents.map(d => d.id)))
    } else {
      setSelectedIds(new Set())
    }
  }, [documents])

  const handleBulkAdvance = async (ids: string[], notes?: string) => {
    setBulkLoading(true)
    try {
      await onBulkAdvance(ids, notes)
      setSelectedIds(new Set())
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkReject = async (ids: string[], reason: string) => {
    setBulkLoading(true)
    try {
      await onBulkReject(ids, reason)
      setSelectedIds(new Set())
    } finally {
      setBulkLoading(false)
    }
  }

  const allSelected = documents.length > 0 && documents.every(d => selectedIds.has(d.id))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{stageLabel}</h3>
          <p className="text-sm text-muted-foreground">{total} document{total > 1 ? 's' : ''}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <Icons.refresh className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icons.search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher..."
            className="rounded-md border pl-8 pr-3 py-2 text-sm w-56"
          />
        </div>
        <select
          value={sourceId}
          onChange={(e) => onSourceChange(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm bg-background"
        >
          <option value="">Toutes les sources</option>
          {sources.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm bg-background"
        >
          <option value="">Toutes catégories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm bg-background"
        >
          <option value="">Toutes langues</option>
          <option value="ar">Arabe</option>
          <option value="fr">Français</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                />
              </th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase">Titre</th>
              <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase">Catégorie</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground uppercase">Langue</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground uppercase">Qualité</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground uppercase">Indexé</th>
              <th className="p-3 text-center text-xs font-medium text-muted-foreground uppercase">Attente</th>
              <th className="p-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map(doc => (
              <PipelineDocumentRow
                key={doc.id}
                doc={doc}
                isSelected={selectedIds.has(doc.id)}
                onSelect={handleSelect}
              />
            ))}
            {documents.length === 0 && !isLoading && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Aucun document à cette étape
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={8} className="p-8 text-center">
                  <Icons.loader className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <Icons.chevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <Icons.chevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      <PipelineBulkActions
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        currentStage={stage}
        onBulkAdvance={handleBulkAdvance}
        onBulkReject={handleBulkReject}
        onClearSelection={() => setSelectedIds(new Set())}
        isLoading={bulkLoading}
      />
    </div>
  )
}
