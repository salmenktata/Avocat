import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface Echeance {
  id: string
  titre: string
  date_echeance: string
  priorite?: 'URGENT' | 'NORMAL' | 'FAIBLE'
  dossier?: {
    numero: string
    objet: string
  }
}

interface UrgentActionsProps {
  echeances: Echeance[]
}

export function UrgentActions({ echeances }: UrgentActionsProps) {
  const t = useTranslations('dashboard')

  // Calculer les jours restants
  const getJoursRestants = (dateEcheance: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const echeance = new Date(dateEcheance)
    echeance.setHours(0, 0, 0, 0)
    const diffTime = echeance.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Trier par date et limiter à 5
  const echeancesUrgentes = echeances
    .sort((a, b) => new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime())
    .slice(0, 5)

  const getDelaiText = (jours: number) => {
    if (jours < 0) return 'En retard'
    if (jours === 0) return "Aujourd'hui"
    if (jours === 1) return 'Demain'
    return `Dans ${jours}j`
  }

  const getDelaiVariant = (jours: number) => {
    if (jours < 0) return 'destructive'
    if (jours === 0) return 'destructive'
    if (jours <= 3) return 'warning'
    return 'secondary'
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">
          <div className="flex items-center gap-2">
            <Icons.alertCircle className="h-5 w-5 text-orange-600" />
            Actions urgentes
          </div>
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/echeances">
            Voir tout
            <Icons.arrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {echeancesUrgentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icons.checkCircle className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucune échéance urgente
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {echeancesUrgentes.map((echeance) => {
              const joursRestants = getJoursRestants(echeance.date_echeance)
              return (
                <Link
                  key={echeance.id}
                  href={`/echeances`}
                  className="block rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icons.calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="font-medium text-sm truncate">
                          {echeance.titre}
                        </p>
                      </div>
                      {echeance.dossier && (
                        <p className="text-xs text-muted-foreground truncate ml-6">
                          Dossier {echeance.dossier.numero} - {echeance.dossier.objet}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={getDelaiVariant(joursRestants) as any}
                      className="shrink-0"
                    >
                      {getDelaiText(joursRestants)}
                    </Badge>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
