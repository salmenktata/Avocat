/**
 * Composant de feedback progressif pendant la saisie d'un narratif
 * Affiche des métriques en temps réel et des suggestions d'amélioration
 *
 * @module components/dossiers/assistant
 * @see Sprint 2 - Workflow Assistant → Validation
 */

'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  DollarSign,
  Users,
  MapPin,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { analyzeNarrative } from '@/lib/utils/narrative-analyzer'
import type { NarrativeAnalysis, NarrativeSuggestion } from '@/lib/utils/narrative-analyzer'

interface ProgressiveFeedbackProps {
  /**
   * Texte du narratif à analyser
   */
  text: string

  /**
   * Afficher le feedback en temps réel
   * @default true
   */
  realtime?: boolean

  /**
   * Classe CSS personnalisée
   */
  className?: string
}

/**
 * Icônes par type de suggestion
 */
const SUGGESTION_ICONS = {
  missing: AlertCircle,
  improve: TrendingUp,
  clarify: Info,
}

/**
 * Couleurs par sévérité
 */
const SEVERITY_COLORS = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-orange-600 dark:text-orange-400',
  low: 'text-blue-600 dark:text-blue-400',
}

/**
 * Icônes par catégorie
 */
const CATEGORY_ICONS = {
  dates: Calendar,
  montants: DollarSign,
  parties: Users,
  faits: Sparkles,
  contexte: MapPin,
}

/**
 * Composant de feedback progressif
 */
export function ProgressiveFeedback({ text, realtime = true, className }: ProgressiveFeedbackProps) {
  // Analyser le narratif (memoized pour éviter re-calculs)
  const analysis: NarrativeAnalysis = useMemo(() => {
    if (!realtime && text.length < 50) {
      // En mode non-realtime, ne rien afficher si trop court
      return {
        length: text.length,
        wordCount: 0,
        detectedLanguage: 'unknown',
        qualityScore: 0,
        completenessScore: 0,
        suggestions: [],
        detectedElements: [],
        issues: [],
      }
    }

    return analyzeNarrative(text)
  }, [text, realtime])

  // Couleur du score de qualité
  const qualityColor =
    analysis.qualityScore >= 70
      ? 'text-green-600 dark:text-green-400'
      : analysis.qualityScore >= 40
      ? 'text-orange-600 dark:text-orange-400'
      : 'text-red-600 dark:text-red-400'

  // Message de qualité
  const qualityMessage =
    analysis.qualityScore >= 70
      ? 'Excellent'
      : analysis.qualityScore >= 40
      ? 'Correct'
      : 'À améliorer'

  // Ne rien afficher si le texte est vide
  if (text.length === 0) {
    return null
  }

  return (
    <Card className={cn('border-dashed', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Analyse en temps réel
        </CardTitle>
        <CardDescription>
          Suivez la qualité de votre narratif pendant la saisie
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Métriques principales */}
        <div className="grid grid-cols-2 gap-4">
          {/* Score de qualité */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Qualité</span>
              <Badge variant="outline" className={qualityColor}>
                {qualityMessage}
              </Badge>
            </div>
            <Progress value={analysis.qualityScore} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {analysis.qualityScore}/100
            </p>
          </div>

          {/* Score de complétude */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Complétude</span>
              <span className="text-xs text-muted-foreground">
                {analysis.completenessScore}%
              </span>
            </div>
            <Progress value={analysis.completenessScore} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {analysis.detectedElements.length} élément{analysis.detectedElements.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <Separator />

        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-foreground">{analysis.wordCount}</p>
            <p className="text-xs text-muted-foreground">Mots</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{analysis.length}</p>
            <p className="text-xs text-muted-foreground">Caractères</p>
          </div>
          <div>
            <Badge variant="outline" className="text-xs">
              {analysis.detectedLanguage === 'ar' && 'Arabe'}
              {analysis.detectedLanguage === 'fr' && 'Français'}
              {analysis.detectedLanguage === 'mixed' && 'Mixte'}
              {analysis.detectedLanguage === 'unknown' && 'Inconnu'}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Langue</p>
          </div>
        </div>

        {/* Éléments détectés */}
        {analysis.detectedElements.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Éléments détectés
              </h4>
              <div className="flex flex-wrap gap-2">
                {['date', 'montant', 'personne', 'lieu'].map((type) => {
                  const count = analysis.detectedElements.filter((e) => e.type === type).length
                  if (count === 0) return null

                  return (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {type === 'date' && <Calendar className="mr-1 h-3 w-3" />}
                      {type === 'montant' && <DollarSign className="mr-1 h-3 w-3" />}
                      {type === 'personne' && <Users className="mr-1 h-3 w-3" />}
                      {type === 'lieu' && <MapPin className="mr-1 h-3 w-3" />}
                      {count} {type}{count > 1 ? 's' : ''}
                    </Badge>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Problèmes */}
        {analysis.issues.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              {analysis.issues.map((issue, idx) => {
                const Icon =
                  issue.severity === 'error'
                    ? AlertCircle
                    : issue.severity === 'warning'
                    ? AlertTriangle
                    : Info

                const variant =
                  issue.severity === 'error'
                    ? 'destructive'
                    : issue.severity === 'warning'
                    ? 'default'
                    : 'default'

                return (
                  <Alert key={idx} variant={variant} className="py-2">
                    <Icon className="h-4 w-4" />
                    <AlertDescription className="text-xs">{issue.message}</AlertDescription>
                  </Alert>
                )
              })}
            </div>
          </>
        )}

        {/* Suggestions */}
        {analysis.suggestions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Suggestions ({analysis.suggestions.length})
              </h4>
              <div className="space-y-2">
                {analysis.suggestions.slice(0, 3).map((suggestion) => {
                  const Icon = SUGGESTION_ICONS[suggestion.type]
                  const CategoryIcon = CATEGORY_ICONS[suggestion.category]

                  return (
                    <div
                      key={suggestion.id}
                      className="rounded-md border bg-muted/50 p-3 text-sm"
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={cn('h-4 w-4 mt-0.5', SEVERITY_COLORS[suggestion.severity])} />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{suggestion.title}</p>
                            <CategoryIcon className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {suggestion.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {analysis.suggestions.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    ... et {analysis.suggestions.length - 3} autre{analysis.suggestions.length - 3 > 1 ? 's' : ''} suggestion{analysis.suggestions.length - 3 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Message encourageant si tout va bien */}
        {analysis.qualityScore >= 70 && analysis.issues.length === 0 && (
          <>
            <Separator />
            <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-sm">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <CheckCircle2 className="h-4 w-4" />
                <p className="font-medium">
                  Excellent narratif ! Vous êtes prêt à lancer la structuration IA.
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
