'use client'

import { AlertTriangle, FileText, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { AbrogationAlert } from '@/lib/legal/abrogation-detector-service'

interface AbrogationAlertsProps {
  alerts: AbrogationAlert[]
}

export function AbrogationAlerts({ alerts }: AbrogationAlertsProps) {
  if (alerts.length === 0) return null

  return (
    <div className="space-y-3 mb-4">
      {alerts.map((alert, index) => (
        <AbrogationAlertCard key={index} alert={alert} />
      ))}
    </div>
  )
}

function AbrogationAlertCard({ alert }: { alert: AbrogationAlert }) {
  const severityConfig = {
    critical: {
      variant: 'destructive' as const,
      icon: '🚫',
      title: 'Abrogation Totale',
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      borderColor: 'border-red-200 dark:border-red-800',
    },
    warning: {
      variant: 'default' as const,
      icon: '⚠️',
      title: 'Abrogation Confirmée',
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
    },
    info: {
      variant: 'default' as const,
      icon: '💡',
      title: 'Information',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
  }

  const config = severityConfig[alert.severity]

  const scopeBadgeConfig = {
    total: { label: 'Totale', variant: 'destructive' as const },
    partial: { label: 'Partielle', variant: 'default' as const },
    implicit: { label: 'Implicite', variant: 'secondary' as const },
  }

  const scopeBadge = scopeBadgeConfig[alert.abrogation.scope]

  const formattedDate = new Date(alert.abrogation.abrogationDate).toLocaleDateString('fr-TN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Card className={`${config.borderColor} border-2 ${config.bgColor}`}>
      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{config.title}</span>
              <Badge variant={scopeBadge.variant}>{scopeBadge.label}</Badge>
              {alert.abrogation.verified && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Vérifiée
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Vous faites référence à une loi qui a été abrogée
            </p>
          </div>
        </div>

        <Separator />

        {/* Référence détectée */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Référence détectée</p>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{alert.reference.text}</span>
          </div>
        </div>

        {/* Abrogation */}
        <div className="space-y-2 bg-background/50 p-3 rounded-md">
          <div>
            <p className="text-sm font-semibold">{alert.abrogation.abrogatedReference}</p>
            {alert.abrogation.abrogatedReferenceAr && (
              <p className="text-sm text-muted-foreground" dir="rtl">
                {alert.abrogation.abrogatedReferenceAr}
              </p>
            )}
          </div>

          {alert.abrogation.abrogatingReference && (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>→</span>
                <span>Abrogée par</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                  {alert.abrogation.abrogatingReference}
                </p>
                {alert.abrogation.abrogatingReferenceAr && (
                  <p className="text-sm text-muted-foreground" dir="rtl">
                    {alert.abrogation.abrogatingReferenceAr}
                  </p>
                )}
              </div>
            </>
          )}

          <p className="text-xs text-muted-foreground">Date d'abrogation : {formattedDate}</p>

          {alert.abrogation.affectedArticles && alert.abrogation.affectedArticles.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="text-xs text-muted-foreground">Articles :</span>
              {alert.abrogation.affectedArticles.slice(0, 5).map((article, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {article}
                </Badge>
              ))}
              {alert.abrogation.affectedArticles.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{alert.abrogation.affectedArticles.length - 5}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Suggestion de remplacement */}
        {alert.replacementSuggestion && (
          <Alert>
            <AlertTitle className="text-sm">Nouvelle référence recommandée</AlertTitle>
            <AlertDescription className="text-sm whitespace-pre-wrap">
              {alert.replacementSuggestion}
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {alert.abrogation.jortUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs"
            >
              <a
                href={alert.abrogation.jortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                JORT
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            asChild
            className="text-xs"
          >
            <a
              href={`/legal/abrogations/${alert.abrogation.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              <FileText className="h-3 w-3" />
              Détails complets
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
