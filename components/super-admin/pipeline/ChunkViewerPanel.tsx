'use client'

import { useState } from 'react'
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
  content_length: number
  has_embedding: boolean
  has_embedding_openai: boolean
}

interface EmbeddingStats {
  total: number
  with_ollama: number
  with_openai: number
  without_embedding: number
}

export function ChunkViewerPanel({ documentId, chunksCount, providers, isIndexed }: ChunkViewerPanelProps) {
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [stats, setStats] = useState<EmbeddingStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const fetchChunks = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/pipeline/documents/${documentId}/chunks`)
      if (res.ok) {
        const data = await res.json()
        setChunks(data.chunks || [])
        setStats(data.stats || null)
        setIsLoaded(true)
      }
    } catch (error) {
      console.error('Erreur fetch chunks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleExpand = (index: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpanded(new Set(chunks.map(c => c.chunk_index)))
  }

  const collapseAll = () => {
    setExpanded(new Set())
  }

  function getEmbeddingBadge(chunk: Chunk) {
    if (chunk.has_embedding_openai && chunk.has_embedding) {
      return <Badge variant="default" className="text-xs">OpenAI + Ollama</Badge>
    }
    if (chunk.has_embedding_openai) {
      return <Badge variant="default" className="text-xs">OpenAI</Badge>
    }
    if (chunk.has_embedding) {
      return <Badge variant="secondary" className="text-xs">Ollama</Badge>
    }
    return <Badge variant="destructive" className="text-xs">Aucun</Badge>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Chunks & Embeddings</h3>
        {chunksCount > 0 && !isLoaded && (
          <Button variant="outline" size="sm" onClick={fetchChunks} disabled={isLoading}>
            {isLoading ? <Icons.loader className="h-4 w-4 animate-spin mr-2" /> : <Icons.layers className="h-4 w-4 mr-2" />}
            Charger les chunks
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Chunks</p>
          <p className="text-2xl font-bold">{stats?.total ?? chunksCount}</p>
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

      {/* Couverture embeddings */}
      {stats && stats.total > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium mb-2">Couverture embeddings</p>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">{stats.with_openai} OpenAI</span>
            <span className="text-blue-600">{stats.with_ollama} Ollama</span>
            {stats.without_embedding > 0 && (
              <span className="text-red-600">{stats.without_embedding} sans embedding</span>
            )}
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden flex">
            {stats.with_openai > 0 && (
              <div
                className="h-full bg-green-500"
                style={{ width: `${(stats.with_openai / stats.total) * 100}%` }}
              />
            )}
            {stats.with_ollama > 0 && (
              <div
                className="h-full bg-blue-500"
                style={{ width: `${(stats.with_ollama / stats.total) * 100}%` }}
              />
            )}
            {stats.without_embedding > 0 && (
              <div
                className="h-full bg-red-300"
                style={{ width: `${(stats.without_embedding / stats.total) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}

      {chunksCount === 0 && !isLoaded && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Icons.layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Aucun chunk généré.</p>
          <p className="text-sm">{"L'indexation sera lancée quand vous approuverez cette étape."}</p>
        </div>
      )}

      {/* Liste des chunks */}
      {isLoaded && chunks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {chunks.length} chunks chargés
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll}>Tout ouvrir</Button>
              <Button variant="ghost" size="sm" onClick={collapseAll}>Tout fermer</Button>
            </div>
          </div>
          {chunks.map(chunk => (
            <div key={chunk.id} className="rounded-lg border">
              <button
                className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50"
                onClick={() => toggleExpand(chunk.chunk_index)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-8">
                    #{chunk.chunk_index}
                  </span>
                  <span className="text-sm truncate max-w-md">
                    {chunk.content.substring(0, 80)}...
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{chunk.content_length} chars</span>
                  {getEmbeddingBadge(chunk)}
                  {expanded.has(chunk.chunk_index) ? (
                    <Icons.chevronUp className="h-4 w-4" />
                  ) : (
                    <Icons.chevronDown className="h-4 w-4" />
                  )}
                </div>
              </button>
              {expanded.has(chunk.chunk_index) && (
                <div className="border-t p-3 bg-muted/30">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                    {chunk.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isLoaded && chunks.length === 0 && chunksCount > 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>Erreur lors du chargement des chunks.</p>
        </div>
      )}
    </div>
  )
}
