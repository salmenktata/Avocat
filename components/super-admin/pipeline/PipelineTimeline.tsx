'use client'

import { Icons } from '@/lib/icons'

interface HistoryEntry {
  id: string
  from_stage: string | null
  to_stage: string
  action: string
  performer_name?: string
  notes: string | null
  quality_score_at_transition: number | null
  created_at: string
}

interface PipelineTimelineProps {
  history: HistoryEntry[]
}

const ACTION_ICONS: Record<string, keyof typeof Icons> = {
  admin_approve: 'checkCircle',
  admin_reject: 'xCircle',
  admin_edit: 'edit',
  admin_replay: 'refresh',
  admin_override: 'shield',
  auto_advance: 'zap',
  system_error: 'alertTriangle',
  backfill: 'database',
}

const ACTION_COLORS: Record<string, string> = {
  admin_approve: 'text-green-500',
  admin_reject: 'text-red-500',
  admin_edit: 'text-blue-500',
  admin_replay: 'text-amber-500',
  admin_override: 'text-purple-500',
  auto_advance: 'text-cyan-500',
  system_error: 'text-red-600',
  backfill: 'text-gray-500',
}

const ACTION_LABELS: Record<string, string> = {
  admin_approve: 'Approuvé',
  admin_reject: 'Rejeté',
  admin_edit: 'Modifié',
  admin_replay: 'Rejoué',
  admin_override: 'Override',
  auto_advance: 'Auto',
  system_error: 'Erreur',
  backfill: 'Migration',
}

const STAGE_LABELS: Record<string, string> = {
  source_configured: 'Source configurée',
  crawled: 'Crawlé',
  content_reviewed: 'Contenu validé',
  classified: 'Classifié',
  indexed: 'Indexé',
  quality_analyzed: 'Qualité analysée',
  rag_active: 'RAG Actif',
  rejected: 'Rejeté',
  needs_revision: 'À réviser',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PipelineTimeline({ history }: PipelineTimelineProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Aucun historique pipeline
      </p>
    )
  }

  return (
    <div className="space-y-0">
      {history.map((entry, idx) => {
        const iconName = ACTION_ICONS[entry.action] || 'info'
        const Icon = Icons[iconName]
        const colorClass = ACTION_COLORS[entry.action] || 'text-gray-500'

        return (
          <div key={entry.id} className="relative flex gap-3 pb-4">
            {/* Vertical line */}
            {idx < history.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
            )}

            {/* Icon */}
            <div className={`shrink-0 mt-0.5 ${colorClass}`}>
              <Icon className="h-[22px] w-[22px]" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">
                  {ACTION_LABELS[entry.action] || entry.action}
                </span>
                {entry.from_stage && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {STAGE_LABELS[entry.from_stage] || entry.from_stage}
                    </span>
                    <Icons.arrowRight className="h-3 w-3 text-muted-foreground" />
                  </>
                )}
                <span className="text-xs font-medium">
                  {STAGE_LABELS[entry.to_stage] || entry.to_stage}
                </span>
              </div>

              {entry.notes && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {entry.notes}
                </p>
              )}

              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{formatDate(entry.created_at)}</span>
                {entry.performer_name && (
                  <span>par {entry.performer_name}</span>
                )}
                {entry.quality_score_at_transition !== null && (
                  <span>Score: {entry.quality_score_at_transition}/100</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
