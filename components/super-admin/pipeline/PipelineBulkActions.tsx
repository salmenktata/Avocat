'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/lib/icons'
import { LEGAL_CATEGORY_TRANSLATIONS, type LegalCategory } from '@/lib/categories/legal-categories'

interface PipelineBulkActionsProps {
  selectedCount: number
  selectedIds: string[]
  currentStage: string
  onBulkAdvance: (ids: string[], notes?: string) => Promise<void>
  onBulkReject: (ids: string[], reason: string) => Promise<void>
  onBulkReclassify?: (ids: string[], category: string) => Promise<void>
  onClearSelection: () => void
  isLoading: boolean
}

const RECLASSIFY_CATEGORIES = Object.entries(LEGAL_CATEGORY_TRANSLATIONS)
  .map(([key, val]) => ({ value: key, label: `${val.fr} - ${val.ar}` }))

export function PipelineBulkActions({
  selectedCount,
  selectedIds,
  currentStage,
  onBulkAdvance,
  onBulkReject,
  onBulkReclassify,
  onClearSelection,
  isLoading,
}: PipelineBulkActionsProps) {
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [showReclassify, setShowReclassify] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')

  if (selectedCount === 0) return null

  const canAdvance = currentStage !== 'rag_active' && currentStage !== 'rejected'

  return (
    <div className="sticky bottom-0 z-10 flex items-center gap-3 rounded-lg border bg-card p-3 shadow-lg">
      <span className="text-sm font-medium">
        {selectedCount} document{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
      </span>

      {canAdvance && (
        <Button
          size="sm"
          onClick={() => onBulkAdvance(selectedIds)}
          disabled={isLoading}
        >
          {isLoading ? <Icons.loader className="h-4 w-4 animate-spin mr-1" /> : <Icons.checkCircle className="h-4 w-4 mr-1" />}
          Approuver
        </Button>
      )}

      {!showRejectInput ? (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setShowRejectInput(true)}
          disabled={isLoading}
        >
          <Icons.xCircle className="h-4 w-4 mr-1" />
          Rejeter
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Raison du rejet..."
            className="rounded-md border px-2 py-1 text-sm w-64"
            autoFocus
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (rejectReason.trim()) {
                onBulkReject(selectedIds, rejectReason.trim())
                setRejectReason('')
                setShowRejectInput(false)
              }
            }}
            disabled={isLoading || !rejectReason.trim()}
          >
            Confirmer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setShowRejectInput(false); setRejectReason('') }}
          >
            Annuler
          </Button>
        </div>
      )}

      {/* Reclassifier */}
      {onBulkReclassify && !showReclassify ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowReclassify(true)}
          disabled={isLoading}
        >
          <Icons.tag className="h-4 w-4 mr-1" />
          Reclassifier
        </Button>
      ) : onBulkReclassify && showReclassify ? (
        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-md border px-2 py-1 text-sm w-48"
          >
            <option value="">Choisir catégorie...</option>
            {RECLASSIFY_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={() => {
              if (selectedCategory) {
                onBulkReclassify(selectedIds, selectedCategory)
                setSelectedCategory('')
                setShowReclassify(false)
              }
            }}
            disabled={isLoading || !selectedCategory}
          >
            Appliquer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setShowReclassify(false); setSelectedCategory('') }}
          >
            Annuler
          </Button>
        </div>
      ) : null}

      <Button
        size="sm"
        variant="ghost"
        onClick={onClearSelection}
        className="ml-auto"
      >
        <Icons.close className="h-4 w-4 mr-1" />
        Désélectionner
      </Button>
    </div>
  )
}
