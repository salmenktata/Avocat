'use client'

import { Badge } from '@/components/ui/badge'
import { Icons } from '@/lib/icons'

interface FinalApprovalPanelProps {
  document: {
    id: string
    title: string
    category: string
    subcategory: string | null
    language: string
    quality_score: number | null
    is_indexed: boolean
    is_approved: boolean
    source_file: string | null
    created_at: string
  }
  chunksCount: number
  providers: string[]
}

export function FinalApprovalPanel({ document: doc, chunksCount, providers }: FinalApprovalPanelProps) {
  const checks = [
    { label: 'Contenu extrait', ok: true, info: 'Validé à l\'étape 2' },
    { label: 'Classification', ok: doc.category !== 'autre', info: doc.category },
    { label: 'Indexation', ok: doc.is_indexed && chunksCount > 0, info: `${chunksCount} chunks` },
    { label: 'Qualité analysée', ok: doc.quality_score !== null, info: doc.quality_score !== null ? `${doc.quality_score}/100` : 'Non analysé' },
    { label: 'Score suffisant', ok: (doc.quality_score ?? 0) >= 50, info: (doc.quality_score ?? 0) >= 50 ? 'OK' : 'Score < 50' },
  ]

  const allChecksPass = checks.every(c => c.ok)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Approbation Finale</h3>

      {/* Summary card */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">{doc.title}</span>
          <Badge variant="outline">{doc.category}</Badge>
        </div>
        {doc.source_file && (
          <a href={doc.source_file} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
            {doc.source_file}
            <Icons.externalLink className="h-3 w-3 inline ml-1" />
          </a>
        )}
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Vérifications</h4>
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-3 rounded-md border p-3">
            {check.ok ? (
              <Icons.checkCircle className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <Icons.xCircle className="h-5 w-5 text-red-500 shrink-0" />
            )}
            <div className="flex-1">
              <span className="text-sm font-medium">{check.label}</span>
              <span className="text-sm text-muted-foreground ml-2">{check.info}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Status */}
      <div className={`rounded-lg p-4 text-center ${allChecksPass ? 'bg-green-50 border-green-200 border' : 'bg-amber-50 border-amber-200 border'}`}>
        {allChecksPass ? (
          <>
            <Icons.checkCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="font-medium text-green-700">Prêt pour le RAG</p>
            <p className="text-sm text-green-600 mt-1">
              Ce document passera à "RAG Actif" et sera visible par les utilisateurs.
            </p>
          </>
        ) : (
          <>
            <Icons.alertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="font-medium text-amber-700">Vérifications incomplètes</p>
            <p className="text-sm text-amber-600 mt-1">
              Certaines vérifications n'ont pas passé. Vous pouvez quand même approuver si justifié.
            </p>
          </>
        )}
      </div>

      {doc.is_approved && (
        <div className="rounded-lg bg-green-100 border border-green-300 p-3 text-sm text-green-700">
          Ce document est déjà approuvé et actif dans le RAG.
        </div>
      )}
    </div>
  )
}
