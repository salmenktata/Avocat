'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import type { Argumentation } from '@/lib/ai/dossier-structuring-service'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { formatReadingTime } from '@/lib/utils/reading-time'

interface ArgumentationAccordionProps {
  argumentation: Argumentation
  readingTime: number
}

export default function ArgumentationAccordion({ argumentation, readingTime }: ArgumentationAccordionProps) {
  const t = useTranslations('assistant')
  const locale = useLocale()

  const moyensCount = argumentation.moyensHierarchises?.length || 0

  return (
    <AccordionItem value="argumentation" className="rounded-lg border-2 border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 shadow-sm">
      <AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span className="text-xl">&#128172;</span>
          <h3 className="text-lg font-semibold text-teal-900 dark:text-teal-200">
            {t('legalAnalysis.argumentation.title')}
          </h3>
          <span className="text-sm text-teal-600 dark:text-teal-400" dir="rtl">
            (بناء الحجة)
          </span>
          <span className="ml-auto text-xs text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/30 px-2 py-1 rounded-full">
            ⏱ {formatReadingTime(readingTime, locale)}
          </span>
        </div>
        {moyensCount > 0 && (
          <p className="text-xs text-teal-600 dark:text-teal-400 mt-1 text-left">
            {moyensCount} moyens préparés
          </p>
        )}
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        <div className="space-y-4">
          {argumentation.moyensHierarchises && argumentation.moyensHierarchises.length > 0 && (
            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
              <h4 className="font-medium text-teal-900 dark:text-teal-200 mb-3 flex items-center gap-2">
                <span>&#128203;</span>
                {t('legalAnalysis.argumentation.hierarchizedArguments')}
              </h4>
              <div className="space-y-2">
                {argumentation.moyensHierarchises.map((moyen, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-900/10">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-200 dark:bg-teal-800 flex items-center justify-center font-bold text-teal-800 dark:text-teal-200">
                      {moyen.rang}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded uppercase font-medium ${
                          moyen.type === 'recevabilite' ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' :
                          moyen.type === 'nullite' ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' :
                          moyen.type === 'fond' ? 'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200' :
                          'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                        }`}>
                          {moyen.type}
                        </span>
                      </div>
                      <p className="text-sm">{moyen.moyen}</p>
                      {moyen.piecesSupportant?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {moyen.piecesSupportant.map((piece, j) => (
                            <span key={j} className="text-xs bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded">
                              &#128196; {piece}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {argumentation.objectionsAnticipees && argumentation.objectionsAnticipees.length > 0 && (
            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
              <h4 className="font-medium text-teal-900 dark:text-teal-200 mb-3 flex items-center gap-2">
                <span>&#128172;</span>
                {t('legalAnalysis.argumentation.anticipatedObjections')}
              </h4>
              <div className="space-y-3">
                {argumentation.objectionsAnticipees.map((obj, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="bg-red-50 dark:bg-red-900/20 p-3">
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase">{t('legalAnalysis.argumentation.objection')}</span>
                      <p className="text-sm text-red-800 dark:text-red-300 mt-1">{obj.objection}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase">{t('legalAnalysis.argumentation.response')}</span>
                      <p className="text-sm text-green-800 dark:text-green-300 mt-1">{obj.reponse}</p>
                      {obj.piecesReponse?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {obj.piecesReponse.map((piece, j) => (
                            <span key={j} className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                              &#128196; {piece}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
