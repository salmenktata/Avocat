'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import type { StructuredDossier, LegalAnalysis } from '@/lib/ai/dossier-structuring-service'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { formatReadingTime } from '@/lib/utils/reading-time'
import { getActionType, getApplicableCode, getLegalBasis } from './helpers'

interface QualificationAccordionProps {
  result: StructuredDossier
  analysis: LegalAnalysis | null | undefined
  readingTime: number
}

export default function QualificationAccordion({ result, analysis, readingTime }: QualificationAccordionProps) {
  const t = useTranslations('assistant')
  const locale = useLocale()

  const natureAction = analysis?.qualification?.natureAction || getActionType(result)
  const codeApplicable = analysis?.qualification?.codeApplicable || getApplicableCode(result)

  return (
    <AccordionItem value="qualification" className="rounded-lg border bg-card shadow-sm">
      <AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span className="text-xl">&#9878;</span>
          <h3 className="text-lg font-semibold text-foreground">
            {t('legalAnalysis.qualification.title')}
          </h3>
          <span className="text-sm text-muted-foreground" dir="rtl">
            (التكييف القانوني)
          </span>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            ⏱ {formatReadingTime(readingTime, locale)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-left truncate max-w-[90%]">
          {natureAction} — {codeApplicable}
        </p>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
              {t('legalAnalysis.qualification.actionType')}
            </h4>
            <p className="text-blue-800 dark:text-blue-300">{natureAction}</p>
          </div>

          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
            <h4 className="font-medium text-emerald-900 dark:text-emerald-200 mb-2">
              {t('legalAnalysis.qualification.applicableCode')}
            </h4>
            <p className="text-emerald-800 dark:text-emerald-300">{codeApplicable}</p>
            {analysis?.qualification?.articlesVises && analysis.qualification.articlesVises.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {analysis.qualification.articlesVises.map((art, i) => (
                  <span key={i} className="rounded-full bg-emerald-200 dark:bg-emerald-800 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200">
                    {art}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 md:col-span-2">
            <h4 className="font-medium text-purple-900 dark:text-purple-200 mb-2">
              {t('legalAnalysis.qualification.legalBasis')}
            </h4>
            <p className="text-purple-800 dark:text-purple-300">
              {analysis?.qualification?.fondementJuridique || getLegalBasis(result)}
            </p>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
