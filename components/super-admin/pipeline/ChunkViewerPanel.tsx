'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/lib/icons'

interface ChunkViewerPanelProps {
  documentId: string
  chunksCount: number
  providers: string[]
  isIndexed: boolean
}

interface Chunk {
  id: string
  chunk_index: number
  content: string
  metadata: Record<string, unknown>
  has_embedding: boolean
  has_embedding_openai: boolean
}

export function ChunkViewerPanel({ documentId, chunksCount, providers, isIndexed }: ChunkViewerPanelProps) {
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const fetchChunks = async () => {
    setIsLoading(true)
    try {
      // Use the detail endpoint which includes chunk info
      const res = await fetch(`/api/admin/pipeline/documents/${documentId}`)
      if (res.ok) {
        const data = await res.json()
        // Chunks are not directly in detail response, so we'll show stats
        setChunks([])
      }
    } catch (error) {
      console.error('Erreur fetch chunks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Chunks & Embeddings</h3>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Chunks</p>
          <p className="text-2xl font-bold">{chunksCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Providers</p>
          <div className="flex gap-1 mt-1">
            {providers.length > 0 ? providers.map(p => (
              <Badge key={p} variant="secondary">{p}</Badge>
            )) : (
              <span className="text-sm text-muted-foreground">Aucun</span>
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Indexé</p>
          <p className="text-2xl font-bold">
            {isIndexed ? (
              <Icons.checkCircle className="h-6 w-6 text-green-500" />
            ) : (
              <Icons.xCircle className="h-6 w-6 text-red-500" />
            )}
          </p>
        </div>
      </div>

      {chunksCount === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Icons.layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucun chunk généré.</p>
          <p className="text-sm">L'indexation sera lancée quand vous approuverez cette étape.</p>
        </div>
      )}

      {chunksCount > 0 && (
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            {chunksCount} chunks créés avec le provider{providers.length > 1 ? 's' : ''}{' '}
            {providers.join(', ') || 'inconnu'}.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Vérifiez la qualité du découpage et la couverture des embeddings avant d'approuver.
          </p>
        </div>
      )}
    </div>
  )
}
