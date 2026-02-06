import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Icons } from '@/lib/icons'
import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Paramètres</h2>
        <p className="text-slate-400">Configuration globale de la plateforme</p>
      </div>

      {/* Configuration Plans */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Icons.creditCard className="h-5 w-5" />
            Configuration des Plans
          </CardTitle>
          <CardDescription className="text-slate-400">
            Définir les limites par plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-slate-400 text-center py-8">
            <Icons.settings className="h-12 w-12 mx-auto mb-4 text-slate-600" />
            <p>Configuration des plans à venir</p>
            <p className="text-sm text-slate-500 mt-2">
              Les limites sont actuellement codées en dur dans l'application
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Email */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Icons.mail className="h-5 w-5" />
            Configuration Email
          </CardTitle>
          <CardDescription className="text-slate-400">
            Paramètres Resend / Brevo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50">
              <div>
                <p className="font-medium text-white">Resend API</p>
                <p className="text-sm text-slate-400">Service d'envoi d'emails transactionnels</p>
              </div>
              <Badge className={process.env.RESEND_API_KEY ? 'bg-green-500' : 'bg-red-500'}>
                {process.env.RESEND_API_KEY ? 'Configuré' : 'Non configuré'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50">
              <div>
                <p className="font-medium text-white">Brevo API</p>
                <p className="text-sm text-slate-400">Service de notifications quotidiennes</p>
              </div>
              <Badge className={process.env.BREVO_API_KEY ? 'bg-green-500' : 'bg-red-500'}>
                {process.env.BREVO_API_KEY ? 'Configuré' : 'Non configuré'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration IA */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Icons.zap className="h-5 w-5" />
            Configuration IA
          </CardTitle>
          <CardDescription className="text-slate-400">
            Paramètres OpenAI / Ollama
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50">
              <div>
                <p className="font-medium text-white">OpenAI API</p>
                <p className="text-sm text-slate-400">GPT-4, Embeddings, etc.</p>
              </div>
              <Badge className={process.env.OPENAI_API_KEY ? 'bg-green-500' : 'bg-red-500'}>
                {process.env.OPENAI_API_KEY ? 'Configuré' : 'Non configuré'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50">
              <div>
                <p className="font-medium text-white">Ollama (Local)</p>
                <p className="text-sm text-slate-400">Modèles locaux</p>
              </div>
              <Badge className={process.env.OLLAMA_BASE_URL ? 'bg-green-500' : 'bg-yellow-500'}>
                {process.env.OLLAMA_BASE_URL ? 'Configuré' : 'Optionnel'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Base de données */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Icons.layers className="h-5 w-5" />
            Base de Données
          </CardTitle>
          <CardDescription className="text-slate-400">
            PostgreSQL avec pgvector
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50">
              <div>
                <p className="font-medium text-white">PostgreSQL</p>
                <p className="text-sm text-slate-400">Base de données principale</p>
              </div>
              <Badge className="bg-green-500">Connecté</Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50">
              <div>
                <p className="font-medium text-white">pgvector</p>
                <p className="text-sm text-slate-400">Extension pour embeddings</p>
              </div>
              <Badge className="bg-green-500">Activé</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informations système */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Icons.info className="h-5 w-5" />
            Informations Système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-slate-700/50">
              <p className="text-sm text-slate-400">Version</p>
              <p className="text-white font-medium">MonCabinet v1.0.0</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-700/50">
              <p className="text-sm text-slate-400">Environnement</p>
              <p className="text-white font-medium">{process.env.NODE_ENV}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-700/50">
              <p className="text-sm text-slate-400">URL de l'application</p>
              <p className="text-white font-medium">{process.env.NEXT_PUBLIC_APP_URL || 'Non défini'}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-700/50">
              <p className="text-sm text-slate-400">Node.js</p>
              <p className="text-white font-medium">{process.version}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
