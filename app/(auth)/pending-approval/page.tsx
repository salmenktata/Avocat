'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '@/lib/icons'

export default function PendingApprovalPage() {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Erreur déconnexion:', error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <Icons.clock className="h-8 w-8 text-yellow-600 dark:text-yellow-500" />
          </div>
          <CardTitle className="text-2xl">Demande en attente</CardTitle>
          <CardDescription>
            Votre compte est en cours de validation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Votre demande d'inscription a bien été enregistrée et est actuellement
              en attente d'approbation par notre équipe.
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-left">
              <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                Prochaines étapes :
              </h4>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
                <li className="flex items-start gap-2">
                  <Icons.checkCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Notre équipe examine votre demande</span>
                </li>
                <li className="flex items-start gap-2">
                  <Icons.mail className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Vous recevrez un email de confirmation</span>
                </li>
                <li className="flex items-start gap-2">
                  <Icons.zap className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Vous pourrez alors accéder à la plateforme</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <Icons.info className="h-4 w-4 inline mr-1" />
                Délai estimé : <strong>24 à 48 heures</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full"
            >
              <Icons.arrowLeft className="h-4 w-4 mr-2" />
              Retour à la connexion
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Une question ?{' '}
              <a href="mailto:support@moncabinet.tn" className="text-primary hover:underline">
                Contactez le support
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
