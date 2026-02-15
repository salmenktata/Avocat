'use client'

import { Badge } from '@/components/ui/badge'
import { Icons } from '@/lib/icons'

interface QualityReportPanelProps {
  document: {
    quality_score: number | null
    quality_clarity?: number | null
    quality_structure?: number | null
    quality_completeness?: number | null
    quality_reliability?: number | null
    quality_analysis_summary?: string | null
    quality_detected_issues?: unknown[] | null
    quality_recommendations?: unknown[] | null
    quality_llm_provider?: string | null
    quality_llm_model?: string | null
    quality_assessed_at?: string | null
  }
}

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score === null || score === undefined) return null
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{score}/100</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

export function QualityReportPanel({ document: doc }: QualityReportPanelProps) {
  if (doc.quality_score === null || doc.quality_score === undefined) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Rapport Qualité</h3>
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Icons.sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Analyse qualité non effectuée.</p>
          <p className="text-sm">L'analyse sera lancée quand vous approuverez l'étape d'indexation.</p>
        </div>
      </div>
    )
  }

  const overallColor = doc.quality_score >= 80 ? 'text-green-600' : doc.quality_score >= 60 ? 'text-amber-600' : 'text-red-600'
  const issues = (doc.quality_detected_issues || []) as string[]
  const recommendations = (doc.quality_recommendations || []) as string[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Rapport Qualité</h3>
        {doc.quality_llm_provider && (
          <Badge variant="secondary">
            {doc.quality_llm_provider} / {doc.quality_llm_model || '?'}
          </Badge>
        )}
      </div>

      {/* Overall score */}
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Score global</p>
        <p className={`text-5xl font-bold ${overallColor}`}>{doc.quality_score}</p>
        <p className="text-sm text-muted-foreground">/100</p>
        {doc.quality_score < 50 && (
          <Badge variant="destructive" className="mt-2">Qualité insuffisante</Badge>
        )}
      </div>

      {/* Sub-scores */}
      <div className="space-y-3">
        <ScoreBar label="Clarté" score={doc.quality_clarity ?? null} />
        <ScoreBar label="Structure" score={doc.quality_structure ?? null} />
        <ScoreBar label="Complétude" score={doc.quality_completeness ?? null} />
        <ScoreBar label="Fiabilité" score={doc.quality_reliability ?? null} />
      </div>

      {/* Summary */}
      {doc.quality_analysis_summary && (
        <div>
          <h4 className="text-sm font-medium mb-1">Résumé</h4>
          <p className="text-sm text-muted-foreground">{doc.quality_analysis_summary}</p>
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">Problèmes détectés</h4>
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                <Icons.alertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {typeof issue === 'string' ? issue : JSON.stringify(issue)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">Recommandations</h4>
          <ul className="space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-600">
                <Icons.lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
                {typeof rec === 'string' ? rec : JSON.stringify(rec)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.quality_assessed_at && (
        <p className="text-xs text-muted-foreground">
          Analysé le {new Date(doc.quality_assessed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
