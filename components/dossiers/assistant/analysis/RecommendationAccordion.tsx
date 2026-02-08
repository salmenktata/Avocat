'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import type { StructuredDossier, LegalAnalysis } from '@/lib/ai/dossier-structuring-service'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { formatReadingTime } from '@/lib/utils/reading-time'
import { getStrategicRecommendation, getNextSteps } from './helpers'

interface RecommendationAccordionProps {
  result: StructuredDossier
  analysis: LegalAnalysis | null | undefined
  readingTime: number
}

export default function RecommendationAccordion({ result, analysis, readingTime }: RecommendationAccordionProps) {
  const t = useTranslations('assistant')
  const locale = useLocale()

  return (
    <AccordionItem value="recommendation" className="rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-sm">
      <AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span className="text-2xl">&#128161;</span>
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">
            {t('legalAnalysis.recommendation.title')}
          </h3>
          <span className="ml-auto text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
            ⏱ {formatReadingTime(readingTime, locale)}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        <div className="space-y-4">
          <p className="text-blue-900 dark:text-blue-200">
            {analysis?.recommandationStrategique || getStrategicRecommendation(result)}
          </p>

          <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
              {t('legalAnalysis.recommendation.nextSteps')}
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
              {(analysis?.prochainesEtapes || getNextSteps(result)).map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
