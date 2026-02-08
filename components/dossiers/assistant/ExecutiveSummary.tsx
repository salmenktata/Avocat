'use client'

import { useTranslations } from 'next-intl'
import type { StructuredDossier } from '@/lib/ai/dossier-structuring-service'

interface ExecutiveSummaryProps {
  result: StructuredDossier
}

export default function ExecutiveSummary({ result }: ExecutiveSummaryProps) {
  const t = useTranslations('assistant')

  const confidence = result.confidence || 0
  const analysis = result.analyseJuridique

  // Derive outcome indicator from recommended scenario
  const recommendedScenario = analysis?.strategieGlobale?.scenarios?.find(
    s => s.option === analysis?.strategieGlobale?.scenarioRecommande
  )
  const successRate = recommendedScenario?.probabiliteSucces ?? null

  const outcomeLabel = successRate !== null
    ? successRate >= 65
      ? t('executiveSummary.favorable')
      : successRate >= 35
        ? t('executiveSummary.mixed')
        : t('executiveSummary.unfavorable')
    : null

  const outcomeColor = successRate !== null
    ? successRate >= 65
      ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
      : successRate >= 35
        ? 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30'
        : 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
    : ''

  // Tempo badge
  const tempo = analysis?.strategieGlobale?.tempo
  const tempoConfig: Record<string, { label: string; color: string }> = {
    urgent: { label: t('executiveSummary.tempoUrgent'), color: 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30' },
    rapide: { label: t('executiveSummary.tempoRapide'), color: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30' },
    normal: { label: t('executiveSummary.tempoNormal'), color: 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30' },
    temporiser: { label: t('executiveSummary.tempoTemporiser'), color: 'text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30' },
  }

  // High risk count
  const highRiskCount = (analysis?.risques || []).filter(r => r.niveau === 'eleve').length

  // Evidence counts
  const availableEvidence = analysis?.strategiePreuve?.preuvesDisponibles?.length || 0
  const missingEvidence = analysis?.strategiePreuve?.preuvesManquantes?.length || 0

  // Recommendation text (truncated)
  const recommendation = analysis?.recommandationStrategique || ''
  const truncatedRecommendation = recommendation.length > 200
    ? recommendation.slice(0, 200) + '...'
    : recommendation

  // SVG circular gauge
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - confidence / 100)
  const gaugeColor = confidence >= 80
    ? 'text-green-500'
    : confidence >= 60
      ? 'text-blue-500'
      : confidence >= 40
        ? 'text-amber-500'
        : 'text-red-500'

  return (
    <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 p-5 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Mini circular gauge */}
        <div className="flex-shrink-0">
          <svg width="48" height="48" className="transform -rotate-90">
            <circle
              cx="24" cy="24" r={radius}
              stroke="currentColor" strokeWidth="5" fill="none"
              className="text-blue-200 dark:text-blue-800"
            />
            <circle
              cx="24" cy="24" r={radius}
              stroke="currentColor" strokeWidth="5" fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`transition-all duration-700 ${gaugeColor}`}
              strokeLinecap="round"
            />
          </svg>
          <p className="text-center text-xs font-bold mt-0.5">{confidence}%</p>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row: badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {outcomeLabel && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${outcomeColor}`}>
                {outcomeLabel}
              </span>
            )}
            {tempo && tempoConfig[tempo] && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${tempoConfig[tempo].color}`}>
                {tempoConfig[tempo].label}
              </span>
            )}
          </div>

          {/* Recommendation text */}
          {truncatedRecommendation && (
            <p className="text-sm text-foreground/90 mb-3 leading-relaxed">
              {truncatedRecommendation}
              {recommendation.length > 200 && (
                <a
                  href="#recommendation"
                  className="ml-1 text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium"
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById('recommendation')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                >
                  {t('executiveSummary.readMore')}
                </a>
              )}
            </p>
          )}

          {/* Mini stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {successRate !== null && (
              <div className="rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2 text-center">
                <p className="text-lg font-bold text-foreground">{successRate}%</p>
                <p className="text-[10px] text-muted-foreground uppercase">{t('executiveSummary.successRate')}</p>
              </div>
            )}
            {tempo && tempoConfig[tempo] && (
              <div className="rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2 text-center">
                <p className="text-lg font-bold text-foreground">{tempoConfig[tempo].label}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{t('executiveSummary.urgency')}</p>
              </div>
            )}
            <div className="rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2 text-center">
              <p className="text-lg font-bold text-foreground">{highRiskCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{t('executiveSummary.highRisks')}</p>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2 text-center">
              <p className="text-lg font-bold text-foreground">{availableEvidence}/{availableEvidence + missingEvidence}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{t('executiveSummary.evidence')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
