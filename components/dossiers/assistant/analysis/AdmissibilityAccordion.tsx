'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import type { StructuredDossier, LegalAnalysis } from '@/lib/ai/dossier-structuring-service'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { formatReadingTime } from '@/lib/utils/reading-time'
import { getAdmissibilityChecks } from './helpers'

interface AdmissibilityAccordionProps {
  result: StructuredDossier
  analysis: LegalAnalysis | null | undefined
  readingTime: number
}

export default function AdmissibilityAccordion({ result, analysis, readingTime }: AdmissibilityAccordionProps) {
  const t = useTranslations('assistant')
  const locale = useLocale()

  // Count verified conditions for summary
  const verifiedCount = analysis?.recevabilite
    ? [
        !analysis.recevabilite.prescription.estPrescrit,
        analysis.recevabilite.qualitePourAgir.estVerifiee,
        analysis.recevabilite.interetAAgir.estCaracterise,
      ].filter(Boolean).length
    : 0

  return (
    <AccordionItem value="admissibility" className="rounded-lg border bg-card shadow-sm">
      <AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span className="text-xl">&#128270;</span>
          <h3 className="text-lg font-semibold text-foreground">
            {t('legalAnalysis.admissibility.title')}
          </h3>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            ⏱ {formatReadingTime(readingTime, locale)}
          </span>
        </div>
        {analysis?.recevabilite && (
          <p className="text-xs text-muted-foreground mt-1 text-left">
            {verifiedCount}/3 conditions vérifiées
          </p>
        )}
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        <div className="space-y-4">
          {analysis?.recevabilite ? (
            <>
              {/* Prescription */}
              <div
                className={`flex items-start gap-3 rounded-lg p-4 ${
                  analysis.recevabilite.prescription.estPrescrit
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                }`}
              >
                <span className="text-xl">
                  {analysis.recevabilite.prescription.estPrescrit ? '\u274C' : '\u2705'}
                </span>
                <div>
                  <h4 className={`font-medium ${
                    analysis.recevabilite.prescription.estPrescrit ? 'text-red-900 dark:text-red-300' : 'text-green-900 dark:text-green-300'
                  }`}>
                    {t('legalAnalysis.admissibility.prescription')}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    analysis.recevabilite.prescription.estPrescrit ? 'text-red-800 dark:text-red-400' : 'text-green-800 dark:text-green-400'
                  }`}>
                    {analysis.recevabilite.prescription.analyse}
                  </p>
                  <span className="text-xs mt-1 opacity-75">
                    {t('legalAnalysis.admissibility.delaiApplicable')}: {analysis.recevabilite.prescription.delaiApplicable}
                  </span>
                </div>
              </div>

              {/* Qualité pour agir */}
              <div
                className={`flex items-start gap-3 rounded-lg p-4 ${
                  analysis.recevabilite.qualitePourAgir.estVerifiee
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <span className="text-xl">
                  {analysis.recevabilite.qualitePourAgir.estVerifiee ? '\u2705' : '\u26A0\uFE0F'}
                </span>
                <div>
                  <h4 className={`font-medium ${
                    analysis.recevabilite.qualitePourAgir.estVerifiee ? 'text-green-900 dark:text-green-300' : 'text-amber-900 dark:text-amber-300'
                  }`}>
                    {t('legalAnalysis.admissibility.qualitePourAgir')}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    analysis.recevabilite.qualitePourAgir.estVerifiee ? 'text-green-800 dark:text-green-400' : 'text-amber-800 dark:text-amber-400'
                  }`}>
                    {analysis.recevabilite.qualitePourAgir.analyse}
                  </p>
                  {analysis.recevabilite.qualitePourAgir.documentsRequis.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-medium">{t('legalAnalysis.admissibility.documentsRequis')}:</span>
                      <ul className="list-disc list-inside text-xs mt-1">
                        {analysis.recevabilite.qualitePourAgir.documentsRequis.map((doc, i) => (
                          <li key={i}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Intérêt à agir */}
              <div
                className={`flex items-start gap-3 rounded-lg p-4 ${
                  analysis.recevabilite.interetAAgir.estCaracterise
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <span className="text-xl">
                  {analysis.recevabilite.interetAAgir.estCaracterise ? '\u2705' : '\u26A0\uFE0F'}
                </span>
                <div>
                  <h4 className={`font-medium ${
                    analysis.recevabilite.interetAAgir.estCaracterise ? 'text-green-900 dark:text-green-300' : 'text-amber-900 dark:text-amber-300'
                  }`}>
                    {t('legalAnalysis.admissibility.interetAAgir')}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    analysis.recevabilite.interetAAgir.estCaracterise ? 'text-green-800 dark:text-green-400' : 'text-amber-800 dark:text-amber-400'
                  }`}>
                    {analysis.recevabilite.interetAAgir.analyse}
                  </p>
                </div>
              </div>
            </>
          ) : (
            getAdmissibilityChecks(result).map((check, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 rounded-lg p-4 ${
                  check.status === 'ok'
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : check.status === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}
              >
                <span className="text-xl">
                  {check.status === 'ok'
                    ? '\u2705'
                    : check.status === 'warning'
                      ? '\u26A0\uFE0F'
                      : '\u274C'}
                </span>
                <div>
                  <h4
                    className={`font-medium ${
                      check.status === 'ok'
                        ? 'text-green-900 dark:text-green-300'
                        : check.status === 'warning'
                          ? 'text-amber-900 dark:text-amber-300'
                          : 'text-red-900 dark:text-red-300'
                    }`}
                  >
                    {check.title}
                    {check.titleAr && (
                      <span className="ml-2 text-sm opacity-75" dir="rtl">
                        ({check.titleAr})
                      </span>
                    )}
                  </h4>
                  <p
                    className={`text-sm mt-1 ${
                      check.status === 'ok'
                        ? 'text-green-800 dark:text-green-400'
                        : check.status === 'warning'
                          ? 'text-amber-800 dark:text-amber-400'
                          : 'text-red-800 dark:text-red-400'
                    }`}
                  >
                    {check.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
