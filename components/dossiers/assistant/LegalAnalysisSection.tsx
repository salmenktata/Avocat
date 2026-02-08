'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import type {
  StructuredDossier,
  LegalAnalysis,
  Diagnostic,
  AnalyseFaits,
  StrategieGlobale,
  Argumentation,
  DecisiveNode,
  Actor,
  ChronologyEvent,
  StrategicScenario,
  HierarchizedArgument,
  AnticipatedObjection,
} from '@/lib/ai/dossier-structuring-service'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { calculateReadingTimeFromObject, formatReadingTime } from '@/lib/utils/reading-time'

interface LegalAnalysisSectionProps {
  result: StructuredDossier
}

export default function LegalAnalysisSection({
  result,
}: LegalAnalysisSectionProps) {
  const t = useTranslations('assistant')
  const locale = useLocale()

  // Utiliser l'analyse de l'IA si disponible, sinon générer localement
  const analysis = result.analyseJuridique

  // Calculer les temps de lecture pour chaque section
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
    <div className="space-y-6">
      {/* Syllogisme Juridique (si disponible) */}
      {analysis?.syllogisme && (
        <div className="rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">&#128161;</span>
            <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-200">
              Syllogisme Juridique
            </h3>
            <span className="text-sm text-indigo-600 dark:text-indigo-400" dir="rtl">
              (القياس القانوني)
            </span>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4 border-l-4 border-indigo-500">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase">Majeure (La règle de droit)</span>
              <p className="mt-1 text-indigo-900 dark:text-indigo-200">{analysis.syllogisme.majeure}</p>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4 border-l-4 border-purple-500">
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">Mineure (Les faits qualifiés)</span>
              <p className="mt-1 text-purple-900 dark:text-purple-200">{analysis.syllogisme.mineure}</p>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4 border-l-4 border-blue-500">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Conclusion (La demande)</span>
              <p className="mt-1 text-blue-900 dark:text-blue-200 font-medium">{analysis.syllogisme.conclusion}</p>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 1 - Diagnostic Initial (si disponible) */}
      {analysis?.diagnostic && (
        <div className="rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">&#128269;</span>
            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
              {t('legalAnalysis.diagnostic.title')}
            </h3>
            <span className="text-sm text-amber-600 dark:text-amber-400" dir="rtl">
              (التشخيص الأولي)
            </span>
            <span className="ml-auto text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
              ⏱ {formatReadingTime(readingTimes.diagnostic, locale)}
            </span>
          </div>

          <div className="space-y-4">
            {/* Objectif Client */}
            {analysis.diagnostic.objectifClient && (
              <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
                <h4 className="font-medium text-amber-900 dark:text-amber-200 mb-3 flex items-center gap-2">
                  <span>&#127919;</span>
                  {t('legalAnalysis.diagnostic.clientObjective')}
                </h4>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase">{t('legalAnalysis.diagnostic.principal')}</span>
                    <p className="mt-1 text-green-900 dark:text-green-200 text-sm">{analysis.diagnostic.objectifClient.principal}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">{t('legalAnalysis.diagnostic.secondary')}</span>
                    <ul className="mt-1 text-blue-900 dark:text-blue-200 text-sm list-disc list-inside">
                      {analysis.diagnostic.objectifClient.secondaires.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase">{t('legalAnalysis.diagnostic.redLine')}</span>
                    <p className="mt-1 text-red-900 dark:text-red-200 text-sm">{analysis.diagnostic.objectifClient.ligneRouge}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Séparation Faits / Interprétations / Ressentis */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Faits Juridiques */}
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                <h4 className="font-medium text-green-900 dark:text-green-200 mb-2 flex items-center gap-2">
                  <span>&#9989;</span>
                  {t('legalAnalysis.diagnostic.legalFacts')}
                </h4>
                <p className="text-xs text-green-700 dark:text-green-400 mb-2">{t('legalAnalysis.diagnostic.legalFactsDesc')}</p>
                <ul className="space-y-1">
                  {analysis.diagnostic.faitsJuridiques?.slice(0, 5).map((fact, i) => (
                    <li key={i} className="text-sm text-green-800 dark:text-green-300 flex items-start gap-1">
                      <span className="text-green-600">•</span>
                      <span>{fact.label}: {fact.valeur}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Interprétations */}
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                <h4 className="font-medium text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
                  <span>&#128161;</span>
                  {t('legalAnalysis.diagnostic.interpretations')}
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">{t('legalAnalysis.diagnostic.interpretationsDesc')}</p>
                <ul className="space-y-1">
                  {analysis.diagnostic.interpretations?.map((interp, i) => (
                    <li key={i} className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-1">
                      <span className="text-amber-600">?</span>
                      <span>{interp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Ressentis */}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 p-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-200 mb-2 flex items-center gap-2">
                  <span>&#128167;</span>
                  {t('legalAnalysis.diagnostic.feelings')}
                </h4>
                <p className="text-xs text-gray-700 dark:text-gray-400 mb-2">{t('legalAnalysis.diagnostic.feelingsDesc')}</p>
                <ul className="space-y-1">
                  {analysis.diagnostic.ressentis?.map((ressenti, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-1 line-through opacity-70">
                      <span>~</span>
                      <span>{ressenti}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Champs Juridiques */}
            {analysis.diagnostic.champsJuridiques && (
              <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
                <h4 className="font-medium text-amber-900 dark:text-amber-200 mb-2">
                  {t('legalAnalysis.diagnostic.legalFields')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-amber-200 dark:bg-amber-800 px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-200">
                    {analysis.diagnostic.champsJuridiques.principal}
                  </span>
                  {analysis.diagnostic.champsJuridiques.satellites?.map((sat, i) => (
                    <span key={i} className="rounded-full bg-amber-100 dark:bg-amber-900/50 px-3 py-1 text-sm text-amber-700 dark:text-amber-300">
                      {sat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PHASE 2 - Analyse Factuelle (si disponible) */}
      {analysis?.analyseFaits && (
        <div className="rounded-lg border-2 border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">&#128200;</span>
            <h3 className="text-lg font-semibold text-cyan-900 dark:text-cyan-200">
              {t('legalAnalysis.analyseFaits.title')}
            </h3>
            <span className="text-sm text-cyan-600 dark:text-cyan-400" dir="rtl">
              (التحليل الوقائعي)
            </span>
            <span className="ml-auto text-xs text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/30 px-2 py-1 rounded-full">
              ⏱ {formatReadingTime(readingTimes.analyseFaits, locale)}
            </span>
          </div>

          <div className="space-y-4">
            {/* Nœuds Décisifs */}
            {analysis.analyseFaits.noeudsDecisifs && analysis.analyseFaits.noeudsDecisifs.length > 0 && (
              <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
                <h4 className="font-medium text-cyan-900 dark:text-cyan-200 mb-3 flex items-center gap-2">
                  <span>&#11088;</span>
                  {t('legalAnalysis.analyseFaits.decisiveNodes')}
                </h4>
                <div className="space-y-3">
                  {analysis.analyseFaits.noeudsDecisifs.map((node, i) => (
                    <div
                      key={i}
                      className={`rounded-lg p-3 border ${
                        node.importance === 'critique'
                          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                          : node.importance === 'important'
                          ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
                          : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                              node.importance === 'critique'
                                ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                                : node.importance === 'important'
                                ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                                : 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                            }`}>
                              {node.importance === 'critique' ? t('legalAnalysis.analyseFaits.critical') : node.importance === 'important' ? t('legalAnalysis.analyseFaits.important') : t('legalAnalysis.analyseFaits.secondary')}
                            </span>
                          </div>
                          <p className="mt-2 font-medium">{node.point}</p>
                          <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm">
                            <div>
                              <span className="text-green-600 dark:text-green-400">{t('legalAnalysis.analyseFaits.currentProof')}:</span>
                              <span className="ml-1">{node.preuveActuelle || t('legalAnalysis.analyseFaits.none')}</span>
                            </div>
                            <div>
                              <span className="text-amber-600 dark:text-amber-400">{t('legalAnalysis.analyseFaits.missingProof')}:</span>
                              <span className="ml-1">{node.preuveManquante || t('legalAnalysis.analyseFaits.none')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acteurs */}
            {analysis.analyseFaits.acteurs && analysis.analyseFaits.acteurs.length > 0 && (
              <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
                <h4 className="font-medium text-cyan-900 dark:text-cyan-200 mb-3 flex items-center gap-2">
                  <span>&#128101;</span>
                  {t('legalAnalysis.analyseFaits.actors')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.analyseFaits.acteurs.map((actor, i) => (
                    <div
                      key={i}
                      className={`rounded-lg px-3 py-2 border ${
                        actor.interet === 'favorable'
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                          : actor.interet === 'defavorable'
                          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20'
                      }`}
                    >
                      <div className="font-medium text-sm">{actor.nom}</div>
                      <div className="text-xs text-muted-foreground">{actor.role}</div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className={`text-xs ${
                          actor.interet === 'favorable' ? 'text-green-600' : actor.interet === 'defavorable' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {actor.interet === 'favorable' ? '&#128994;' : actor.interet === 'defavorable' ? '&#128308;' : '&#128993;'}
                        </span>
                        <span className="text-xs text-muted-foreground">{actor.fiabilite}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chronologie */}
            {analysis.analyseFaits.chronologie && analysis.analyseFaits.chronologie.length > 0 && (
              <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
                <h4 className="font-medium text-cyan-900 dark:text-cyan-200 mb-3 flex items-center gap-2">
                  <span>&#128197;</span>
                  {t('legalAnalysis.analyseFaits.chronology')}
                </h4>
                <div className="space-y-2">
                  {analysis.analyseFaits.chronologie.slice(0, 5).map((event, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 whitespace-nowrap">{event.date}</span>
                      <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                        event.importance === 'decisif' ? 'bg-red-500' : event.importance === 'important' ? 'bg-amber-500' : 'bg-gray-400'
                      }`} />
                      <span>{event.evenement}</span>
                      {event.preuve && (
                        <span className="text-xs text-green-600 dark:text-green-400 ml-auto">&#128196; {event.preuve}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accordéon pour les sections d'analyse */}
      <Accordion type="multiple" defaultValue={["qualification", "admissibility", "strategy", "recommendation"]} className="space-y-4">
        {/* 1. Qualification Juridique */}
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
                ⏱ {formatReadingTime(readingTimes.qualification, locale)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">

        <div className="grid gap-4 md:grid-cols-2">
          {/* Type d'action */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
              {t('legalAnalysis.qualification.actionType')}
            </h4>
            <p className="text-blue-800 dark:text-blue-300">
              {analysis?.qualification?.natureAction || getActionType(result)}
            </p>
          </div>

          {/* Code applicable */}
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
            <h4 className="font-medium text-emerald-900 dark:text-emerald-200 mb-2">
              {t('legalAnalysis.qualification.applicableCode')}
            </h4>
            <p className="text-emerald-800 dark:text-emerald-300">
              {analysis?.qualification?.codeApplicable || getApplicableCode(result)}
            </p>
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

          {/* Fondement juridique */}
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

        {/* 2. Analyse de Recevabilité */}
        <AccordionItem value="admissibility" className="rounded-lg border bg-card shadow-sm">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <span className="text-xl">&#128270;</span>
              <h3 className="text-lg font-semibold text-foreground">
                {t('legalAnalysis.admissibility.title')}
              </h3>
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                ⏱ {formatReadingTime(readingTimes.recevabilite, locale)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">

        <div className="space-y-4">
          {/* Utiliser les données de l'IA si disponibles */}
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
            /* Fallback: générer localement */
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

        {/* 3. Juridiction Compétente */}
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
                ⏱ {formatReadingTime(readingTimes.competence, locale)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              {t('legalAnalysis.jurisdiction.territorial')}
            </h4>
            <p className="font-medium text-foreground">
              {analysis?.competence?.territoriale ||
                result.donneesSpecifiques.tribunal ||
                getTerritorialJurisdiction(result)}
            </p>
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

        {/* 4. Stratégie de Preuve */}
        <AccordionItem value="evidence" className="rounded-lg border bg-card shadow-sm">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <span className="text-xl">&#128206;</span>
              <h3 className="text-lg font-semibold text-foreground">
                {t('legalAnalysis.evidence.title')}
              </h3>
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                ⏱ {formatReadingTime(readingTimes.strategiePreuve, locale)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">

        {analysis?.strategiePreuve ? (
          <div className="space-y-4">
            {/* Charge de la preuve */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-1">Charge de la preuve</h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">{analysis.strategiePreuve.chargeDeLaPreuve}</p>
            </div>

            {/* Preuves disponibles */}
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

            {/* Preuves manquantes */}
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

            {/* Mode de preuve */}
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
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
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

        {/* 5. Stratégie Globale (PHASE 5) */}
        {analysis?.strategieGlobale && (
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
                ⏱ {formatReadingTime(readingTimes.strategieGlobale, locale)}
              </span>
            </div>
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
                  {analysis.strategieGlobale.scenarios?.map((scenario, i) => (
                    <div
                      key={i}
                      className={`rounded-lg p-4 border ${
                        scenario.option === analysis.strategieGlobale?.scenarioRecommande
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500/50'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-medium">{scenario.option}</h5>
                        {scenario.option === analysis.strategieGlobale?.scenarioRecommande && (
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
                    analysis.strategieGlobale.tempo === 'urgent'
                      ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                      : analysis.strategieGlobale.tempo === 'rapide'
                      ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                      : analysis.strategieGlobale.tempo === 'temporiser'
                      ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                  }`}>
                    {analysis.strategieGlobale.tempo === 'urgent' ? '&#128680; Urgent' :
                     analysis.strategieGlobale.tempo === 'rapide' ? '&#9889; Rapide' :
                     analysis.strategieGlobale.tempo === 'temporiser' ? '&#128260; Temporiser' : '&#128336; Normal'}
                  </span>
                  <p className="text-sm text-muted-foreground">{analysis.strategieGlobale.justificationTempo}</p>
                </div>
              </div>

              {/* Plan B */}
              {analysis.strategieGlobale.planB && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                  <h4 className="font-medium text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
                    <span>&#128260;</span>
                    {t('legalAnalysis.strategy.planB')}
                  </h4>
                  <div className="text-sm space-y-1">
                    <p><strong>{t('legalAnalysis.strategy.condition')}:</strong> {analysis.strategieGlobale.planB.condition}</p>
                    <p><strong>{t('legalAnalysis.strategy.action')}:</strong> {analysis.strategieGlobale.planB.action}</p>
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
        )}

        {/* 6. Argumentation (PHASE 6) */}
        {analysis?.argumentation && (
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
                ⏱ {formatReadingTime(readingTimes.argumentation, locale)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-4">
              {/* Moyens hiérarchisés */}
              {analysis.argumentation.moyensHierarchises && analysis.argumentation.moyensHierarchises.length > 0 && (
                <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
                  <h4 className="font-medium text-teal-900 dark:text-teal-200 mb-3 flex items-center gap-2">
                    <span>&#128203;</span>
                    {t('legalAnalysis.argumentation.hierarchizedArguments')}
                  </h4>
                  <div className="space-y-2">
                    {analysis.argumentation.moyensHierarchises.map((moyen, i) => (
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

              {/* Objections anticipées */}
              {analysis.argumentation.objectionsAnticipees && analysis.argumentation.objectionsAnticipees.length > 0 && (
                <div className="rounded-lg bg-white/60 dark:bg-white/5 p-4">
                  <h4 className="font-medium text-teal-900 dark:text-teal-200 mb-3 flex items-center gap-2">
                    <span>&#128172;</span>
                    {t('legalAnalysis.argumentation.anticipatedObjections')}
                  </h4>
                  <div className="space-y-3">
                    {analysis.argumentation.objectionsAnticipees.map((obj, i) => (
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
        )}

        {/* 7. Évaluation des Risques */}
        <AccordionItem value="risks" className="rounded-lg border bg-card shadow-sm">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <span className="text-xl">&#9888;</span>
              <h3 className="text-lg font-semibold text-foreground">
                {t('legalAnalysis.risks.title')}
              </h3>
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                ⏱ {formatReadingTime(readingTimes.risques, locale)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">

        <div className="grid gap-3">
          {(analysis?.risques || getRisks(result)).map((risk, index) => {
            const level = 'niveau' in risk ? risk.niveau : risk.level
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
                  {'nature' in risk ? risk.nature : risk.title}
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

        {/* 6. Recommandation Stratégique */}
        <AccordionItem value="recommendation" className="rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-sm">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <span className="text-2xl">&#128161;</span>
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">
                {t('legalAnalysis.recommendation.title')}
              </h3>
              <span className="ml-auto text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                ⏱ {formatReadingTime(readingTimes.recommandation, locale)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">

        <div className="space-y-4">
          <p className="text-blue-900 dark:text-blue-200">
            {analysis?.recommandationStrategique || getStrategicRecommendation(result)}
          </p>

          {/* Prochaines étapes recommandées */}
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
      </Accordion>
    </div>
  )
}

// === Fonctions utilitaires pour générer l'analyse ===

function getActionType(result: StructuredDossier): string {
  const isAr = result.langue === 'ar'
  switch (result.typeProcedure) {
    case 'divorce':
      return isAr ? 'دعوى طلاق قضائي' : 'Action en divorce judiciaire (دعوى الطلاق)'
    case 'commercial':
      if (result.donneesSpecifiques.montantPrincipal) {
        return isAr ? 'دعوى استخلاص ديون تجارية' : 'Action en recouvrement de créance commerciale (دعوى استخلاص ديون تجارية)'
      }
      return isAr ? 'دعوى تجارية' : 'Action commerciale'
    case 'civil_premiere_instance':
      return isAr ? 'دعوى مدنية ابتدائية' : 'Action civile en première instance (دعوى مدنية)'
    case 'refere':
      return isAr ? 'القضاء الاستعجالي - إجراء عاجل' : 'Procédure de référé - mesure urgente (القضاء الاستعجالي)'
    default:
      return isAr ? 'دعوى بحاجة إلى تكييف' : 'Action à qualifier'
  }
}

function getApplicableCode(result: StructuredDossier): string {
  const isAr = result.langue === 'ar'
  switch (result.typeProcedure) {
    case 'divorce':
      return isAr ? 'مجلة الأحوال الشخصية (CSP)' : 'Code du Statut Personnel (CSP) - مجلة الأحوال الشخصية'
    case 'commercial':
      return isAr ? 'المجلة التجارية + مجلة الالتزامات والعقود (COC)' : 'Code de Commerce + Code des Obligations et Contrats (COC) - المجلة التجارية'
    case 'civil_premiere_instance':
      return isAr ? 'مجلة الالتزامات والعقود (COC)' : 'Code des Obligations et Contrats (COC) - مجلة الالتزامات والعقود'
    case 'refere':
      return isAr ? 'مجلة المرافعات المدنية والتجارية' : 'Code de Procédure Civile et Commerciale - مجلة المرافعات المدنية والتجارية'
    default:
      return isAr ? 'يُحدّد حسب الوقائع' : 'À déterminer selon les faits'
  }
}

function getLegalBasis(result: StructuredDossier): string {
  const isAr = result.langue === 'ar'
  switch (result.typeProcedure) {
    case 'divorce':
      return isAr
        ? `الفصول 30 وما بعدها من مجلة الأحوال الشخصية: الطلاق القضائي بطلب من أحد الزوجين.
              الفصل 31: غرامة المتعة (التعويضية). الفصل 46: النفقة للأطفال.
              الفصول 67 وما بعدها: الحضانة.`
        : `Articles 30 et suivants du CSP: Divorce judiciaire sur demande de l'un des époux.
              Art. 31: Pension Moutaa (compensatoire). Art. 46: Pension alimentaire des enfants.
              Art. 67 et suivants: Garde des enfants (الحضانة).`
    case 'commercial':
      return isAr
        ? `الفصول 278 وما بعدها من مجلة الالتزامات والعقود: المسؤولية التعاقدية وفوائض التأخير.
              الفصل 410 مكرر من المجلة التجارية: التعويض الجزافي عن الشيك بدون رصيد.
              نسبة الفائض القانوني: TMM + 7 نقاط = 14.5% (BCT).`
        : `Art. 278 et suivants COC: Responsabilité contractuelle et intérêts moratoires.
              Art. 410bis Code de Commerce: Indemnité forfaitaire pour chèque impayé.
              Taux d'intérêt légal: TMM + 7 points = 14.5% (BCT).`
    case 'civil_premiere_instance':
      return isAr
        ? `الفصول 82 وما بعدها من مجلة الالتزامات والعقود: المسؤولية المدنية.
              الفصول 242 وما بعدها من مجلة الالتزامات والعقود: تنفيذ الالتزامات.`
        : `Art. 82 et suivants COC: Responsabilité civile.
              Art. 242 et suivants COC: Exécution des obligations.`
    case 'refere':
      return isAr
        ? `الفصول 201 وما بعدها من مجلة المرافعات: شروط القضاء الاستعجالي - الاستعجال وغياب نزاع جدي.`
        : `Art. 201 et suivants CPC: Conditions du référé - urgence et absence de contestation sérieuse.`
    default:
      return isAr ? 'الأساس القانوني يُحدّد بعد تحليل معمّق.' : 'Fondement à préciser après analyse approfondie.'
  }
}

function getAdmissibilityChecks(
  result: StructuredDossier
): Array<{
  title: string
  titleAr?: string
  description: string
  status: 'ok' | 'warning' | 'error'
}> {
  const isAr = result.langue === 'ar'
  const checks = []

  // Prescription
  checks.push({
    title: isAr ? 'التقادم' : 'Prescription',
    titleAr: isAr ? undefined : 'التقادم',
    description: getPrescriptionAnalysis(result),
    status: 'ok' as const,
  })

  // Qualité pour agir
  checks.push({
    title: isAr ? 'الصفة' : 'Qualité pour agir',
    titleAr: isAr ? undefined : 'الصفة',
    description: result.client.nom
      ? (isAr
          ? 'تم التعرف على الحريف. يجب التثبت من الوثائق المثبتة لصفته (عقد ملكية، عقد، مضمون من السجل التجاري).'
          : 'Le client est identifié. Vérifier les documents établissant sa qualité (titre de propriété, contrat, extrait RNE).')
      : (isAr
          ? 'لم يتم التعرف على الحريف - يستحيل التثبت من الصفة.'
          : 'Client non identifié - impossible de vérifier la qualité pour agir.'),
    status: result.client.nom ? ('warning' as const) : ('error' as const),
  })

  // Intérêt à agir
  checks.push({
    title: isAr ? 'المصلحة' : 'Intérêt à agir',
    titleAr: isAr ? undefined : 'المصلحة',
    description: isAr
      ? 'يجب أن تكون المصلحة قائمة وحالّة وشخصية ومشروعة. يُتثبت منها حسب الوثائق.'
      : 'L\'intérêt doit être né, actuel, personnel et légitime. À confirmer selon les pièces.',
    status: 'warning' as const,
  })

  // Forme de l'acte
  if (result.typeProcedure !== 'refere') {
    checks.push({
      title: isAr ? 'العيوب الشكلية' : 'Vices de forme',
      titleAr: isAr ? undefined : 'العيوب الشكلية',
      description: isAr
        ? 'يجب التثبت من البيانات الوجوبية لعريضة الدعوى (الهوية الكاملة، المحكمة المختصة، موضوع الدعوى، الأساس القانوني).'
        : 'Vérifier les mentions obligatoires de l\'assignation (identité complète, tribunal compétent, objet précis, moyen de droit).',
      status: 'warning' as const,
    })
  }

  return checks
}

function getPrescriptionAnalysis(result: StructuredDossier): string {
  const isAr = result.langue === 'ar'
  switch (result.typeProcedure) {
    case 'divorce':
      return isAr
        ? 'لا تقادم في دعوى الطلاق. مطالب النفقة لا تسقط بالتقادم.'
        : 'Pas de prescription pour l\'action en divorce. Les demandes de pension sont imprescriptibles.'
    case 'commercial':
      return isAr
        ? 'تقادم تجاري بسنة أو 3 سنوات حسب طبيعة الدعوى. يجب التثبت من تاريخ الدين.'
        : 'Prescription commerciale de 1 an ou 3 ans selon la nature. Vérifier la date de la créance.'
    default:
      return isAr
        ? 'تقادم مدني بالقانون العام: 15 سنة. يجب التثبت حسب نوع الدعوى.'
        : 'Prescription civile de droit commun: 15 ans. À vérifier selon le type d\'action.'
  }
}

function getTerritorialJurisdiction(result: StructuredDossier): string {
  const isAr = result.langue === 'ar'
  switch (result.typeProcedure) {
    case 'divorce':
      return isAr
        ? 'محكمة الأسرة بمكان المسكن الزوجي أو آخر مسكن مشترك'
        : 'Tribunal de la Famille du domicile conjugal ou du dernier domicile commun'
    case 'commercial':
      return isAr
        ? 'المحكمة الابتدائية ذات الاختصاص التجاري بمقر المدّعى عليه'
        : 'Tribunal de Première Instance à compétence commerciale du siège du défendeur'
    default:
      return isAr
        ? 'محكمة مقر المدّعى عليه (الفصل 27 م.م.م.ت)'
        : 'Tribunal du domicile du défendeur (Art. 27 CPC)'
  }
}

function getMaterialJurisdiction(result: StructuredDossier): string {
  const isAr = result.langue === 'ar'
  const montant = result.donneesSpecifiques.montantPrincipal || 0

  if (result.typeProcedure === 'divorce') {
    return isAr ? 'محكمة الأسرة (دوائر الأحوال الشخصية)' : 'Tribunal de la Famille (chambres de statut personnel)'
  }

  if (result.typeProcedure === 'refere') {
    return isAr ? 'رئيس المحكمة الابتدائية (قاضي الاستعجالي)' : 'Président du Tribunal de Première Instance (juge des référés)'
  }

  if (montant <= 7000) {
    return isAr ? 'قاضي الناحية - حتى 7,000 د.ت' : 'Juge Cantonal (قاضي الناحية) - jusqu\'à 7 000 TND'
  } else {
    return isAr ? 'المحكمة الابتدائية - أكثر من 7,000 د.ت' : 'Tribunal de Première Instance (المحكمة الابتدائية) - au-delà de 7 000 TND'
  }
}

function getEvidenceStrategy(
  result: StructuredDossier
): Array<{
  icon: string
  document: string
  purpose: string
  priority: 'essential' | 'important' | 'useful'
}> {
  const isAr = result.langue === 'ar'
  const evidence = []

  // Documents communs à toutes les procédures
  evidence.push({
    icon: '&#128196;',
    document: isAr ? 'نسخة من بطاقة التعريف الوطنية' : 'Copie CIN du client',
    purpose: isAr ? 'إثبات الهوية والأهلية القانونية' : 'Preuve d\'identité et de capacité juridique',
    priority: 'essential' as const,
  })

  // Documents spécifiques selon le type
  if (result.typeProcedure === 'divorce') {
    evidence.push({
      icon: '&#128141;',
      document: isAr ? 'عقد الزواج الأصلي' : 'Acte de mariage original',
      purpose: isAr ? 'إثبات الرابطة الزوجية' : 'Preuve du lien matrimonial (عقد الزواج)',
      priority: 'essential' as const,
    })
    if (result.enfants && result.enfants.length > 0) {
      evidence.push({
        icon: '&#128118;',
        document: isAr ? 'مضامين ولادة الأطفال' : 'Extraits de naissance des enfants',
        purpose: isAr ? 'إثبات النسب للحضانة' : 'Preuve de la filiation pour la garde',
        priority: 'essential' as const,
      })
    }
    evidence.push({
      icon: '&#128176;',
      document: isAr ? 'بطاقات الخلاص (آخر 3 أشهر)' : 'Fiches de paie (3 derniers mois)',
      purpose: isAr ? 'قاعدة احتساب النفقات' : 'Base de calcul des pensions',
      priority: 'important' as const,
    })
    if (
      result.donneesSpecifiques.biensCommuns &&
      result.donneesSpecifiques.biensCommuns.length > 0
    ) {
      evidence.push({
        icon: '&#127968;',
        document: isAr ? 'رسم الملكية / تقدير العقار' : 'Titre de propriété / estimation bien immobilier',
        purpose: isAr ? 'تقييم الممتلكات المشتركة' : 'Évaluation du patrimoine commun',
        priority: 'important' as const,
      })
    }
  }

  if (result.typeProcedure === 'commercial') {
    evidence.push({
      icon: '&#128203;',
      document: isAr ? 'العقد أو طلب الشراء' : 'Contrat ou bon de commande',
      purpose: isAr ? 'إثبات الالتزام التعاقدي' : 'Preuve de l\'obligation contractuelle',
      priority: 'essential' as const,
    })
    evidence.push({
      icon: '&#128181;',
      document: isAr ? 'الفواتير غير المدفوعة' : 'Factures impayées',
      purpose: isAr ? 'إثبات الدين ومبلغه' : 'Preuve de la créance et de son montant',
      priority: 'essential' as const,
    })
    evidence.push({
      icon: '&#128231;',
      document: isAr ? 'الإنذار مع وصل الاستلام' : 'Mise en demeure + AR',
      purpose: isAr ? 'إثبات محاولة الاستخلاص بالتراضي' : 'Preuve de la tentative de recouvrement amiable',
      priority: 'essential' as const,
    })
    evidence.push({
      icon: '&#127970;',
      document: isAr ? 'مضمون من السجل التجاري للدائن والمدين' : 'Extrait RNE du créancier et débiteur',
      purpose: isAr ? 'إثبات الصفة التجارية' : 'Preuve de la qualité commerciale',
      priority: 'important' as const,
    })
  }

  if (result.typeProcedure === 'civil_premiere_instance') {
    evidence.push({
      icon: '&#128203;',
      document: isAr ? 'كل عقد أو اتفاقية مكتوبة' : 'Tout contrat ou convention écrite',
      purpose: isAr ? 'الحجة الكتابية أساسية في القانون المدني التونسي' : 'La preuve écrite est primordiale en droit civil tunisien',
      priority: 'essential' as const,
    })
    evidence.push({
      icon: '&#128247;',
      document: isAr ? 'محضر معاينة عدل منفذ (عند الحاجة)' : 'Constat d\'huissier (si nécessaire)',
      purpose: isAr ? 'إثبات مادي للوقائع' : 'Preuve matérielle des faits (محضر معاينة)',
      priority: 'important' as const,
    })
  }

  return evidence
}

function getRisks(
  result: StructuredDossier
): Array<{
  title: string
  description: string
  level: 'high' | 'medium' | 'low'
  mitigation?: string
}> {
  const isAr = result.langue === 'ar'
  const risks = []

  // Risque de forme
  risks.push({
    title: isAr ? 'عدم سماع الدعوى شكلاً' : 'Fin de non-recevoir pour vice de forme',
    description: isAr
      ? 'يمكن للقاضي التونسي رفض الدعوى لعيب إجرائي قبل النظر في الأصل.'
      : 'Le juge tunisien peut rejeter la demande pour irrégularité de procédure (عدم سماع الدعوى شكلاً) avant même d\'examiner le fond.',
    level: 'high' as const,
    mitigation: isAr
      ? 'التثبت بدقة من جميع البيانات الوجوبية وآجال التبليغ.'
      : 'Vérifier minutieusement toutes les mentions obligatoires et les délais de signification.',
  })

  // Risques spécifiques
  if (result.typeProcedure === 'divorce') {
    risks.push({
      title: isAr ? 'فشل محاولات الصلح' : 'Échec des conciliations',
      description: isAr
        ? 'محاولات الصلح الثلاث إجبارية. إذا لم يحضر الحريف، قد تُرفض الدعوى.'
        : 'Les 3 tentatives de conciliation sont obligatoires. Si le client ne se présente pas, l\'action peut être rejetée.',
      level: 'medium' as const,
      mitigation: isAr
        ? 'تحضير الحريف لجلسات الصلح والتأكد من حضوره.'
        : 'Préparer le client aux séances de conciliation et s\'assurer de sa présence.',
    })
  }

  if (result.typeProcedure === 'commercial') {
    if (!result.donneesSpecifiques.dateCreance) {
      risks.push({
        title: isAr ? 'خطر التقادم' : 'Risque de prescription',
        description: isAr
          ? 'بدون تاريخ دقيق للدين، يستحيل التثبت من عدم سقوط الدعوى بالتقادم (سنة أو 3 سنوات في المادة التجارية).'
          : 'Sans date de créance précise, impossible de vérifier si l\'action n\'est pas prescrite (1 an ou 3 ans en commercial).',
        level: 'high' as const,
        mitigation: isAr
          ? 'الحصول على الوثائق المؤرخة المثبتة للدين.'
          : 'Obtenir les documents datés établissant la créance.',
      })
    }
  }

  // Risque de preuve
  risks.push({
    title: isAr ? 'قصور في الأدلة' : 'Insuffisance de preuves',
    description: isAr
      ? 'في القانون التونسي، "البيّنة سيّدة المعارك". دعوى ضعيفة التوثيق سيُرفض طلبها.'
      : 'En droit tunisien, "la preuve est la reine des batailles". Une demande mal documentée sera rejetée.',
    level: 'medium' as const,
    mitigation: isAr
      ? 'تكوين ملف مؤيدات كامل قبل رفع الدعوى.'
      : 'Constituer un bordereau de pièces complet avant l\'introduction de l\'instance.',
  })

  return risks
}

function getStrategicRecommendation(result: StructuredDossier): string {
  const isAr = result.langue === 'ar'
  switch (result.typeProcedure) {
    case 'divorce':
      return isAr
        ? `بناءً على المعطيات المستخرجة، يُوصى برفع دعوى طلاق قضائي أمام محكمة الأسرة. مع وجود ${result.enfants?.length || 0} طفل/أطفال قُصّر، ستكون مسائل الحضانة والنفقة محورية. غرامة المتعة المقدّرة والنفقات تمثل قاعدة تفاوض متينة.`
        : `Compte tenu des éléments extraits, il est recommandé d'engager une procédure de divorce judiciaire
              devant le Tribunal de la Famille. Avec ${result.enfants?.length || 0} enfant(s) mineur(s),
              les questions de garde (حضانة) et de pension alimentaire seront centrales.
              La Moutaa estimée et les pensions alimentaires constituent une base de négociation solide.`
    case 'commercial':
      return isAr
        ? `قبل أي إجراء قضائي، يجب إرسال إنذار رسمي بمكتوب مضمون الوصول مع الإعلام بالبلوغ. هذا يُفعّل سريان فوائض التأخير (14.5%) ويُثبت للقاضي حسن نية الدائن. إذا كان المبلغ يبرر ذلك، يمكن تقديم عريضة أمر بالدفع لتسريع الإجراءات.`
        : `Avant toute action judiciaire, envoyer une mise en demeure formelle par lettre recommandée avec AR.
              Cela fait courir les intérêts moratoires (14.5%) et démontre au juge la bonne foi du créancier.
              Si le montant le justifie, envisager une requête en injonction de payer pour accélérer la procédure.`
    case 'refere':
      return isAr
        ? `إجراء الاستعجالي مناسب إذا ثبت الاستعجال ولم يوجد نزاع جدي في الحق. يجب إعداد عريضة تُثبت هذين الشرطين بوضوح.`
        : `La procédure de référé est appropriée si l'urgence est caractérisée et qu'il n'y a pas
              de contestation sérieuse du droit. Préparer une requête démontrant clairement ces deux conditions.`
    default:
      return isAr
        ? `بعد تحليل الوقائع، يجب تكوين ملف مؤيدات متين والتثبت من قبول الدعوى قبل رفعها. يُوصى باستشارة معمّقة.`
        : `Après analyse des faits, constituer un dossier de pièces solide et vérifier la recevabilité
              de l'action avant d'engager la procédure. Une consultation approfondie est recommandée.`
  }
}

function getNextSteps(result: StructuredDossier): string[] {
  const isAr = result.langue === 'ar'
  const steps = []

  steps.push(isAr ? 'جمع جميع المؤيدات الأساسية المحددة' : 'Collecter toutes les pièces essentielles identifiées')
  steps.push(isAr ? 'تحرير وإمضاء اتفاقية الأتعاب' : 'Rédiger et faire signer la Convention d\'Honoraires')

  if (result.typeProcedure === 'commercial') {
    steps.push(isAr ? 'إرسال الإنذار بمكتوب مضمون الوصول مع الإعلام بالبلوغ' : 'Envoyer la mise en demeure par lettre recommandée avec AR')
    steps.push(isAr ? 'انتظار 15 يوم أجل الرد' : 'Attendre 15 jours le délai de réponse')
  }

  if (result.typeProcedure === 'divorce') {
    steps.push(isAr ? 'تحضير الحريف لجلسات الصلح الإجبارية' : 'Préparer le client aux séances de conciliation obligatoires')
  }

  steps.push(isAr ? 'تحرير مذكرة التحليل القانوني الداخلية' : 'Rédiger la Note d\'Analyse Juridique interne')
  steps.push(isAr ? 'تكوين جدول المؤيدات المرقّم' : 'Constituer le bordereau de pièces numéroté')
  steps.push(isAr ? 'تحرير عريضة افتتاح الدعوى' : 'Rédiger l\'acte introductif d\'instance')

  return steps
}
