'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import type { StructuredDossier, LegalAnalysis } from '@/lib/ai/dossier-structuring-service'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { formatReadingTime } from '@/lib/utils/reading-time'
import { getRisks } from './helpers'

interface RisksAccordionProps {
  result: StructuredDossier
  analysis: LegalAnalysis | null | undefined
  readingTime: number
}

export default function RisksAccordion({ result, analysis, readingTime }: RisksAccordionProps) {
  const t = useTranslations('assistant')
  const locale = useLocale()

  const allRisks = analysis?.risques || getRisks(result)
  const highRiskCount = allRisks.filter(r => {
    const level = 'niveau' in r ? r.niveau : (r as { level: string }).level
    return level === 'eleve' || level === 'high'
  }).length

  return (
    <AccordionItem value="risks" className="rounded-lg border bg-card shadow-sm">
      <AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span className="text-xl">&#9888;</span>
          <h3 className="text-lg font-semibold text-foreground">
            {t('legalAnalysis.risks.title')}
          </h3>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            ⏱ {formatReadingTime(readingTime, locale)}
          </span>
        </div>
        {highRiskCount > 0 && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1 text-left">
            {highRiskCount} risque(s) élevé(s)
          </p>
        )}
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        <div className="grid gap-3">
          {allRisks.map((risk, index) => {
            const level = 'niveau' in risk ? risk.niveau : (risk as { level: string }).level
            const levelLabel = level === 'eleve' || level === 'high'
              ? t('legalAnalysis.risks.high')
              : level === 'moyen' || level === 'medium'
                ? t('legalAnalysis.risks.medium')
                : t('legalAnalysis.risks.low')
            const isHigh = level === 'eleve' || level === 'high'
            const isMedium = level === 'moyen' || level === 'medium'

            return (
              <div
                key={index}
                className={`rounded-lg border p-4 ${
                  isHigh
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                    : isMedium
                      ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h4
                    className={`font-medium ${
                      isHigh
                        ? 'text-red-900 dark:text-red-300'
                        : isMedium
                          ? 'text-amber-900 dark:text-amber-300'
                          : 'text-blue-900 dark:text-blue-300'
                    }`}
                  >
                    {'nature' in risk ? risk.nature : (risk as { title: string }).title}
                  </h4>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      isHigh
                        ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                        : isMedium
                          ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                          : 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                    }`}
                  >
                    {levelLabel}
                  </span>
                </div>
                <p
                  className={`text-sm mt-1 ${
                    isHigh
                      ? 'text-red-800 dark:text-red-400'
                      : isMedium
                        ? 'text-amber-800 dark:text-amber-400'
                        : 'text-blue-800 dark:text-blue-400'
                  }`}
                >
                  {risk.description}
                </p>
                {risk.mitigation && (
                  <p className="text-sm mt-2 font-medium text-foreground">
                    &#128161; {risk.mitigation}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
