'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import type { StructuredDossier, LegalAnalysis } from '@/lib/ai/dossier-structuring-service'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { formatReadingTime } from '@/lib/utils/reading-time'
import { getTerritorialJurisdiction, getMaterialJurisdiction } from './helpers'

interface JurisdictionAccordionProps {
  result: StructuredDossier
  analysis: LegalAnalysis | null | undefined
  readingTime: number
}

export default function JurisdictionAccordion({ result, analysis, readingTime }: JurisdictionAccordionProps) {
  const t = useTranslations('assistant')
  const locale = useLocale()

  const territorial = analysis?.competence?.territoriale ||
    result.donneesSpecifiques.tribunal ||
    getTerritorialJurisdiction(result)

  return (
    <AccordionItem value="jurisdiction" className="rounded-lg border bg-card shadow-sm">
      <AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span className="text-xl">&#127963;</span>
          <h3 className="text-lg font-semibold text-foreground">
            {t('legalAnalysis.jurisdiction.title')}
          </h3>
          <span className="text-sm text-muted-foreground" dir="rtl">
            (الاختصاص)
          </span>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            ⏱ {formatReadingTime(readingTime, locale)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-left truncate max-w-[90%]">
          {territorial}
        </p>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              {t('legalAnalysis.jurisdiction.territorial')}
            </h4>
            <p className="font-medium text-foreground">{territorial}</p>
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              {t('legalAnalysis.jurisdiction.material')}
            </h4>
            <p className="font-medium text-foreground">
              {analysis?.competence?.materielle || getMaterialJurisdiction(result)}
            </p>
          </div>
        </div>

        {analysis?.competence?.justification && (
          <p className="mt-3 text-sm text-muted-foreground">
            {analysis.competence.justification}
          </p>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
