'use client'

/**
 * Composant EventCard - Sprint 4
 *
 * Card pour un événement de la timeline jurisprudentielle avec :
 * - Style coloré selon type (major_shift, confirmation, nuance, standard)
 * - Métadonnées complètes (tribunal, chambre, date, décision)
 * - Relations juridiques (overrules, confirms, distinguishes)
 * - Mode inline (compact) et modal (détails complets)
 */

import { X, Scale, Building2, Calendar, FileText, TrendingUp, Link2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { TimelineEvent, EventType } from './TimelineViewer'

// =============================================================================
// TYPES
// =============================================================================

interface EventCardProps {
  event: TimelineEvent
  onClick?: () => void
  isModal?: boolean
  onClose?: () => void
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const EVENT_TYPE_CONFIG = {
  major_shift: {
    icon: TrendingUp,
    label: 'Revirement Jurisprudentiel',
    labelAr: 'نقض',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-300 dark:border-red-700',
    badgeVariant: 'destructive' as const,
  },
  confirmation: {
    icon: Scale,
    label: 'Confirmation',
    labelAr: 'تأكيد',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-300 dark:border-green-700',
    badgeVariant: 'default' as const,
  },
  nuance: {
    icon: FileText,
    label: 'Distinction/Précision',
    labelAr: 'تمييز',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
    borderColor: 'border-amber-300 dark:border-amber-700',
    badgeVariant: 'secondary' as const,
  },
  standard: {
    icon: FileText,
    label: 'Arrêt Standard',
    labelAr: 'قرار عادي',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-300 dark:border-blue-700',
    badgeVariant: 'outline' as const,
  },
}

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function EventCard({ event, onClick, isModal = false, onClose }: EventCardProps) {
  const config = EVENT_TYPE_CONFIG[event.eventType]
  const Icon = config.icon

  // Mode inline (compact)
  if (!isModal) {
    return (
      <Card
        className={`cursor-pointer hover:shadow-md transition-all ${config.borderColor} border-l-4`}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Icône type événement */}
            <div className={`${config.color} shrink-0 mt-1`}>
              <Icon className="h-5 w-5" />
            </div>

            {/* Contenu */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={config.badgeVariant} className="text-xs">
                  {config.label}
                </Badge>

                {event.decisionDate && (
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {event.decisionDate.toLocaleDateString('fr-FR')}
                  </Badge>
                )}

                {event.precedentValue > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Score: {event.precedentValue}
                  </Badge>
                )}
              </div>

              <h4 className="font-semibold text-sm mb-1 line-clamp-2">
                {event.title}
              </h4>

              {event.eventDescription && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {event.eventDescription}
                </p>
              )}

              {/* Métadonnées compactes */}
              <div className="flex flex-wrap gap-2 mt-2">
                {event.tribunalLabel && (
                  <span className="text-xs text-muted-foreground">
                    {event.tribunalLabel}
                  </span>
                )}

                {event.decisionNumber && (
                  <span className="text-xs text-muted-foreground">
                    N° {event.decisionNumber}
                  </span>
                )}

                {event.citedByCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {event.citedByCount} citations
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Mode modal (détails complets)
  return (
    <Dialog open={isModal} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className={config.color}>
                  <Icon className="h-6 w-6" />
                </div>
                <Badge variant={config.badgeVariant}>
                  {config.label}
                </Badge>
              </div>
              <DialogTitle className="text-xl">{event.title}</DialogTitle>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Description événement */}
          {event.eventDescription && (
            <div className={`${config.bgColor} rounded-lg p-4 border ${config.borderColor}`}>
              <h4 className="font-semibold text-sm mb-2">Description de l'événement</h4>
              <p className="text-sm">{event.eventDescription}</p>
            </div>
          )}

          <Separator />

          {/* Métadonnées principales */}
          <div className="grid grid-cols-2 gap-4">
            {/* Tribunal */}
            {event.tribunalLabel && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Tribunal
                </div>
                <p className="text-sm pl-6">{event.tribunalLabel}</p>
              </div>
            )}

            {/* Chambre */}
            {event.chambreLabel && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  Chambre
                </div>
                <p className="text-sm pl-6">{event.chambreLabel}</p>
              </div>
            )}

            {/* Date décision */}
            {event.decisionDate && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Date de décision
                </div>
                <p className="text-sm pl-6">
                  {event.decisionDate.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}

            {/* Numéro décision */}
            {event.decisionNumber && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Numéro de décision
                </div>
                <p className="text-sm pl-6">{event.decisionNumber}</p>
              </div>
            )}

            {/* Domaine juridique */}
            {event.domainLabel && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  Domaine juridique
                </div>
                <Badge variant="outline" className="ml-6">
                  {event.domainLabel}
                </Badge>
              </div>
            )}

            {/* Score précédent */}
            {event.precedentValue > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Score Précédent
                </div>
                <Badge variant="default" className="ml-6">
                  {event.precedentValue}/100
                </Badge>
              </div>
            )}
          </div>

          <Separator />

          {/* Résumé */}
          {event.summary && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Résumé</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {event.summary}
              </p>
            </div>
          )}

          {/* Base légale */}
          {event.legalBasis && event.legalBasis.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Base légale</h4>
              <div className="flex flex-wrap gap-2">
                {event.legalBasis.map((basis, index) => (
                  <Badge key={index} variant="outline">
                    {basis}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Solution */}
          {event.solution && (
            <div className="border-l-4 border-primary pl-4 py-2">
              <h4 className="font-semibold text-sm mb-2">Solution</h4>
              <p className="text-sm">{event.solution}</p>
            </div>
          )}

          <Separator />

          {/* Relations juridiques */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Relations Juridiques</h4>
            </div>

            <div className="space-y-3">
              {/* Renverse (overrules) */}
              {event.overrulesIds.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive" className="text-xs">
                      Renverse
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {event.overrulesIds.length} arrêt(s)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cet arrêt renverse la jurisprudence antérieure
                  </p>
                </div>
              )}

              {/* Est renversé (isOverruled) */}
              {event.isOverruled && (
                <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      Renversé
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cet arrêt a été renversé par une décision ultérieure
                  </p>
                </div>
              )}

              {/* Confirme (confirms) */}
              {event.confirmsIds.length > 0 && (
                <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="default" className="text-xs">
                      Confirme
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {event.confirmsIds.length} arrêt(s)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cet arrêt confirme la jurisprudence établie
                  </p>
                </div>
              )}

              {/* Distingue (distinguishes) */}
              {event.distinguishesIds.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      Distingue
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {event.distinguishesIds.length} arrêt(s)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cet arrêt précise ou distingue la jurisprudence antérieure
                  </p>
                </div>
              )}

              {/* Citations */}
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="font-semibold">Cité par :</span>{' '}
                  <span className="text-muted-foreground">{event.citedByCount} arrêt(s)</span>
                </div>
              </div>

              {/* Aucune relation */}
              {!event.hasOverrules &&
                !event.isOverruled &&
                event.confirmsIds.length === 0 &&
                event.distinguishesIds.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune relation juridique identifiée
                  </p>
                )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
