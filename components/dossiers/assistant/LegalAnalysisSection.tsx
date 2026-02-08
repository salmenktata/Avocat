'use client'

import { useTranslations } from 'next-intl'
import type { StructuredDossier } from '@/lib/ai/dossier-structuring-service'
import { Accordion } from '@/components/ui/accordion'
import { calculateReadingTimeFromObject } from '@/lib/utils/reading-time'

import SyllogismCard from './analysis/SyllogismCard'
import DiagnosticSection from './analysis/DiagnosticSection'
import FactualAnalysisSection from './analysis/FactualAnalysisSection'
import QualificationAccordion from './analysis/QualificationAccordion'
import AdmissibilityAccordion from './analysis/AdmissibilityAccordion'
import JurisdictionAccordion from './analysis/JurisdictionAccordion'
import EvidenceAccordion from './analysis/EvidenceAccordion'
import GlobalStrategyAccordion from './analysis/GlobalStrategyAccordion'
import ArgumentationAccordion from './analysis/ArgumentationAccordion'
import RisksAccordion from './analysis/RisksAccordion'
import RecommendationAccordion from './analysis/RecommendationAccordion'

interface LegalAnalysisSectionProps {
  result: StructuredDossier
}

export default function LegalAnalysisSection({
  result,
}: LegalAnalysisSectionProps) {
  const t = useTranslations('assistant')
  const analysis = result.analyseJuridique

  const readingTimes = {
    diagnostic: calculateReadingTimeFromObject(analysis?.diagnostic || {}),
    analyseFaits: calculateReadingTimeFromObject(analysis?.analyseFaits || {}),
    qualification: calculateReadingTimeFromObject(analysis?.qualification || {}),
    recevabilite: calculateReadingTimeFromObject(analysis?.recevabilite || {}),
    competence: calculateReadingTimeFromObject(analysis?.competence || {}),
    strategiePreuve: calculateReadingTimeFromObject(analysis?.strategiePreuve || {}),
    strategieGlobale: calculateReadingTimeFromObject(analysis?.strategieGlobale || {}),
    argumentation: calculateReadingTimeFromObject(analysis?.argumentation || {}),
    risques: calculateReadingTimeFromObject(analysis?.risques || []),
    recommandation: calculateReadingTimeFromObject({
      recommandation: analysis?.recommandationStrategique,
      etapes: analysis?.prochainesEtapes,
    }),
  }

  return (
    <div className="space-y-8">
      {/* Groupe 1 : Synthèse */}
      <div id="group-synthese">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold">1</span>
          <h2 className="text-base font-semibold text-foreground">{t('groups.synthese')}</h2>
        </div>
        <div className="space-y-4">
          {analysis?.syllogisme && (
            <SyllogismCard syllogisme={analysis.syllogisme} />
          )}
          <Accordion type="multiple" defaultValue={["recommendation"]} className="space-y-4">
            <div id="recommendation">
              <RecommendationAccordion result={result} analysis={analysis} readingTime={readingTimes.recommandation} />
            </div>
          </Accordion>
        </div>
      </div>

      <hr className="border-border" />

      {/* Groupe 2 : Analyse */}
      <div id="group-analyse">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white text-sm font-bold">2</span>
          <h2 className="text-base font-semibold text-foreground">{t('groups.analyse')}</h2>
        </div>
        <div className="space-y-4">
          {analysis?.diagnostic && (
            <div id="diagnostic">
              <DiagnosticSection diagnostic={analysis.diagnostic} readingTime={readingTimes.diagnostic} />
            </div>
          )}
          {analysis?.analyseFaits && (
            <div id="analyse-faits">
              <FactualAnalysisSection analyseFaits={analysis.analyseFaits} readingTime={readingTimes.analyseFaits} />
            </div>
          )}
          <Accordion type="multiple" className="space-y-4">
            <div id="qualification">
              <QualificationAccordion result={result} analysis={analysis} readingTime={readingTimes.qualification} />
            </div>
            <div id="admissibility">
              <AdmissibilityAccordion result={result} analysis={analysis} readingTime={readingTimes.recevabilite} />
            </div>
            <div id="jurisdiction">
              <JurisdictionAccordion result={result} analysis={analysis} readingTime={readingTimes.competence} />
            </div>
          </Accordion>
        </div>
      </div>

      <hr className="border-border" />

      {/* Groupe 3 : Stratégie */}
      <div id="group-strategie">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-600 text-white text-sm font-bold">3</span>
          <h2 className="text-base font-semibold text-foreground">{t('groups.strategie')}</h2>
        </div>
        <Accordion type="multiple" className="space-y-4">
          <div id="evidence">
            <EvidenceAccordion result={result} analysis={analysis} readingTime={readingTimes.strategiePreuve} />
          </div>
          {analysis?.strategieGlobale && (
            <div id="strategy">
              <GlobalStrategyAccordion strategieGlobale={analysis.strategieGlobale} readingTime={readingTimes.strategieGlobale} />
            </div>
          )}
          {analysis?.argumentation && (
            <div id="argumentation">
              <ArgumentationAccordion argumentation={analysis.argumentation} readingTime={readingTimes.argumentation} />
            </div>
          )}
        </Accordion>
      </div>

      <hr className="border-border" />

      {/* Groupe 4 : Risques & Suivi */}
      <div id="group-risques">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-red-600 text-white text-sm font-bold">4</span>
          <h2 className="text-base font-semibold text-foreground">{t('groups.risques')}</h2>
        </div>
        <Accordion type="multiple" className="space-y-4">
          <div id="risks">
            <RisksAccordion result={result} analysis={analysis} readingTime={readingTimes.risques} />
          </div>
        </Accordion>
      </div>
    </div>
  )
}
