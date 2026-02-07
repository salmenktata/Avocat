/**
 * Page Configuration Messagerie WhatsApp - Super Admin Only
 * Configuration WhatsApp Business pour réception automatique documents clients
 */

import { getMessagingConfigAction } from '@/app/actions/messaging'
import MessagingConfig from '@/components/parametres/MessagingConfig'
import { MessageSquare, Lock, Globe } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function SuperAdminMessagingPage() {
  // La protection super_admin est automatique via le layout parent

  // Récupérer configuration existante
  const result = await getMessagingConfigAction()
  const existingConfig = result.data || null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Réception Documents WhatsApp</h2>
        <p className="text-slate-400 mt-2">
          Configurez WhatsApp Business pour recevoir automatiquement les documents des clients
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-green-900/50 p-2">
                <MessageSquare className="h-5 w-5 text-green-400" />
              </div>
              <CardTitle className="text-base text-white">Automatisation</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-slate-400">
              Les clients envoient documents par WhatsApp, rattachement automatique aux dossiers
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-900/50 p-2">
                <Lock className="h-5 w-5 text-blue-400" />
              </div>
              <CardTitle className="text-base text-white">Sécurité</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-slate-400">
              Webhooks sécurisés avec validation HMAC SHA256, identification clients automatique
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-purple-900/50 p-2">
                <Globe className="h-5 w-5 text-purple-400" />
              </div>
              <CardTitle className="text-base text-white">WhatsApp Business</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-slate-400">
              Intégration officielle avec WhatsApp Business API (Meta Graph API v21.0)
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Alert Guide Configuration */}
      <Alert className="bg-slate-800 border-slate-700">
        <AlertDescription className="text-slate-300">
          <div className="space-y-2">
            <p className="font-medium">📋 Guide de configuration WhatsApp Business</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-slate-400">
              <li>
                Créez un compte{' '}
                <a
                  href="https://business.facebook.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300"
                >
                  Meta Business Manager
                </a>
              </li>
              <li>
                Créez une application{' '}
                <a
                  href="https://developers.facebook.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300"
                >
                  Facebook Developers
                </a>
              </li>
              <li>Activez le produit &quot;WhatsApp&quot; dans votre application</li>
              <li>Ajoutez un numéro de téléphone WhatsApp Business</li>
              <li>Copiez les identifiants ci-dessous (Phone Number ID, Business Account ID, Access Token)</li>
              <li>Configurez le webhook dans Meta avec l&apos;URL affichée plus bas</li>
            </ol>
          </div>
        </AlertDescription>
      </Alert>

      {/* Composant Configuration */}
      <MessagingConfig existingConfig={existingConfig} />
    </div>
  )
}
