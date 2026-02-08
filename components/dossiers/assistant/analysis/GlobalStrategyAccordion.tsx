'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import type { StrategieGlobale } from '@/lib/ai/dossier-structuring-service'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { formatReadingTime } from '@/lib/utils/reading-time'

interface GlobalStrategyAccordionProps {
  strategieGlobale: StrategieGlobale
  readingTime: number
}

export default function GlobalStrategyAccordion({ strategieGlobale, readingTime }: GlobalStrategyAccordionProps) {
  const t = useTranslations('assistant')
  const locale = useLocale()

  const recommendedScenario = strategieGlobale.scenarios?.find(
    s => s.option === strategieGlobale.scenarioRecommande
  )

  return (
    <AccordionItem value="strategy" className="rounded-lg border-2 border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 shadow-sm">
      <AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span className="text-xl">&#127919;</span>
          <h3 className="text-lg font-semibold text-violet-900 dark:text-violet-200">
            {t('legalAnalysis.strategy.title')}
          </h3>
          <span className="text-sm text-violet-600 dark:text-violet-400" dir="rtl">
            (الاستراتيجية العامة)
          </span>
          <span className="ml-auto text-xs text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30 px-2 py-1 rounded-full">
            ⏱ {formatReadingTime(readingTime, locale)}
          </span>
        </div>
        {recommendedScenario && (
          <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 text-left">
            {t('legalAnalysis.strategy.recommended')}: {strategieGlobale.scenarioRecommande} ({recommendedScenario.probabiliteSucces}%)
          </p>
        )}
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        <div className="space-y-4">
          {/* Scénarios */}
          <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
            <h4 className="font-medium text-violet-900 dark:text-violet-200 mb-3 flex items-center gap-2">
              <span>&#128202;</span>
              {t('legalAnalysis.strategy.scenarios')}
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              {strategieGlobale.scenarios?.map((scenario, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-4 border ${
                    scenario.option === strategieGlobale.scenarioRecommande
                      ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500/50'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium">{scenario.option}</h5>
                    {scenario.option === strategieGlobale.scenarioRecommande && (
                      <span className="text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full">
                        {t('legalAnalysis.strategy.recommended')}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{t('legalAnalysis.strategy.successRate')}:</span>
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            scenario.probabiliteSucces >= 70 ? 'bg-green-500' : scenario.probabiliteSucces >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${scenario.probabiliteSucces}%` }}
                        />
                      </div>
                      <span className="font-medium">{scenario.probabiliteSucces}%</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>&#128176; {scenario.coutEstime}</span>
                      <span>&#128197; {scenario.delaiEstime}</span>
                    </div>
                    {scenario.avantages?.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-green-600 dark:text-green-400">{t('legalAnalysis.strategy.advantages')}:</span>
                        <ul className="list-disc list-inside text-xs text-green-700 dark:text-green-300">
                          {scenario.avantages.slice(0, 2).map((a, j) => <li key={j}>{a}</li>)}
                        </ul>
                      </div>
                    )}
                    {scenario.risques?.length > 0 && (
                      <div className="mt-1">
                        <span className="text-xs text-red-600 dark:text-red-400">{t('legalAnalysis.strategy.risks')}:</span>
                        <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-300">
                          {scenario.risques.slice(0, 2).map((r, j) => <li key={j}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tempo */}
          <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
            <h4 className="font-medium text-violet-900 dark:text-violet-200 mb-2 flex items-center gap-2">
              <span>&#9200;</span>
              {t('legalAnalysis.strategy.tempo')}
            </h4>
            <div className="flex items-center gap-4">
              <span className={`px-4 py-2 rounded-full font-medium ${
                strategieGlobale.tempo === 'urgent'
                  ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                  : strategieGlobale.tempo === 'rapide'
                  ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                  : strategieGlobale.tempo === 'temporiser'
                  ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
              }`}>
                {strategieGlobale.tempo === 'urgent' ? '&#128680; Urgent' :
                 strategieGlobale.tempo === 'rapide' ? '&#9889; Rapide' :
                 strategieGlobale.tempo === 'temporiser' ? '&#128260; Temporiser' : '&#128336; Normal'}
              </span>
              <p className="text-sm text-muted-foreground">{strategieGlobale.justificationTempo}</p>
            </div>
          </div>

          {/* Plan B */}
          {strategieGlobale.planB && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
              <h4 className="font-medium text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
                <span>&#128260;</span>
                {t('legalAnalysis.strategy.planB')}
              </h4>
              <div className="text-sm space-y-1">
                <p><strong>{t('legalAnalysis.strategy.condition')}:</strong> {strategieGlobale.planB.condition}</p>
                <p><strong>{t('legalAnalysis.strategy.action')}:</strong> {strategieGlobale.planB.action}</p>
              </div>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
