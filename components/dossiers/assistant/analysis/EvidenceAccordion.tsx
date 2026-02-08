'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import type { StructuredDossier, LegalAnalysis } from '@/lib/ai/dossier-structuring-service'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { formatReadingTime } from '@/lib/utils/reading-time'
import { getEvidenceStrategy } from './helpers'

interface EvidenceAccordionProps {
  result: StructuredDossier
  analysis: LegalAnalysis | null | undefined
  readingTime: number
}

export default function EvidenceAccordion({ result, analysis, readingTime }: EvidenceAccordionProps) {
  const t = useTranslations('assistant')
  const locale = useLocale()

  const availableCount = analysis?.strategiePreuve?.preuvesDisponibles?.length || 0
  const missingCount = analysis?.strategiePreuve?.preuvesManquantes?.length || 0

  return (
    <AccordionItem value="evidence" className="rounded-lg border bg-card shadow-sm">
      <AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span className="text-xl">&#128206;</span>
          <h3 className="text-lg font-semibold text-foreground">
            {t('legalAnalysis.evidence.title')}
          </h3>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            ⏱ {formatReadingTime(readingTime, locale)}
          </span>
        </div>
        {analysis?.strategiePreuve && (
          <p className="text-xs text-muted-foreground mt-1 text-left">
            {availableCount} preuves disponibles / {missingCount} manquantes
          </p>
        )}
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        {analysis?.strategiePreuve ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-1">Charge de la preuve</h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">{analysis.strategiePreuve.chargeDeLaPreuve}</p>
            </div>

            {analysis.strategiePreuve.preuvesDisponibles.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                  &#9989; Preuves identifiées dans le récit
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.strategiePreuve.preuvesDisponibles.map((p, i) => (
                    <span key={i} className="rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-sm text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {analysis.strategiePreuve.preuvesManquantes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                  &#9888; Preuves à collecter
                </h4>
                <div className="space-y-2">
                  {analysis.strategiePreuve.preuvesManquantes.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                      <span className="text-amber-600 dark:text-amber-400">&#128196;</span>
                      <span className="text-sm text-amber-800 dark:text-amber-300">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              <strong>Mode de preuve privilégié:</strong> {analysis.strategiePreuve.modeDePreuve}
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {t('legalAnalysis.evidence.description')}
            </p>
            <div className="space-y-3">
              {getEvidenceStrategy(result).map((item, index) => (
                <div key={index} className="flex items-start gap-3 rounded-lg border p-3">
                  <span
                    className={`flex-shrink-0 rounded-full p-1.5 ${
                      item.priority === 'essential'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : item.priority === 'important'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    <span className="text-sm" dangerouslySetInnerHTML={{ __html: item.icon }} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{item.document}</span>
                      {item.priority === 'essential' && (
                        <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                          {t('legalAnalysis.evidence.essential')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.purpose}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}
