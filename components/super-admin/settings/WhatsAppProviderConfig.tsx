'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Icons } from '@/lib/icons'
import { useToast } from '@/lib/hooks/use-toast'
import { ProviderTestButton } from './ProviderTestButton'
import {
  updateWhatsAppEnabledAction,
  getWhatsAppStatusAction,
} from '@/app/actions/provider-config'

interface WhatsAppConfig {
  enabled: boolean
  configured: boolean
  phoneNumberId: string | null
}

export function WhatsAppProviderConfig() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const { toast } = useToast()

  // Charger la configuration
  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const result = await getWhatsAppStatusAction()

      if (result.success && result.data) {
        setConfig(result.data)
        setEnabled(result.data.enabled)
      } else {
        toast({
          title: 'Erreur',
          description: result.error || 'Impossible de charger la configuration',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Erreur',
        description: 'Erreur de connexion au serveur',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (newEnabled: boolean) => {
    setSaving(true)
    setEnabled(newEnabled)

    try {
      const result = await updateWhatsAppEnabledAction(newEnabled)

      if (result.success) {
        toast({
          title: 'Succès',
          description: result.message,
        })
        // Recharger la config
        loadConfig()
      } else {
        // Rétablir l'état précédent
        setEnabled(!newEnabled)
        toast({
          title: 'Erreur',
          description: result.error || 'Échec de la mise à jour',
          variant: 'destructive',
        })
      }
    } catch {
      setEnabled(!newEnabled)
      toast({
        title: 'Erreur',
        description: 'Erreur de connexion au serveur',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="flex items-center justify-center py-8">
          <Icons.spinner className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icons.messageSquare className="h-5 w-5 text-green-500" />
          <CardTitle className="text-white">WhatsApp Business</CardTitle>
        </div>
        <CardDescription className="text-slate-400">
          Gérez l&apos;intégration WhatsApp Business pour la messagerie avec les clients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statut et activation */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-700/50 border border-slate-600">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label className="text-white font-medium">Activation globale</Label>
              <Badge className={config?.configured ? 'bg-green-500' : 'bg-yellow-500'}>
                {config?.configured ? 'Configuré' : 'Non configuré'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              {enabled
                ? 'WhatsApp est activé pour tous les cabinets'
                : 'WhatsApp est désactivé globalement'}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={saving || !config?.configured}
          />
        </div>

        {/* Info configuration */}
        {config?.configured && (
          <div className="p-4 rounded-lg bg-slate-700/30 border border-slate-600">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Icons.info className="h-4 w-4 text-blue-400" />
              <span>Phone Number ID: </span>
              <code className="px-2 py-0.5 bg-slate-600 rounded text-xs font-mono">
                {config.phoneNumberId || 'N/A'}
              </code>
            </div>
          </div>
        )}

        {/* Alerte si non configuré */}
        {!config?.configured && (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-start gap-3">
              <Icons.alertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-300 font-medium">
                  Configuration incomplète
                </p>
                <p className="text-xs text-yellow-400/80 mt-1">
                  Le token WhatsApp ou le Phone Number ID n&apos;est pas configuré.
                  Accédez à la configuration détaillée pour compléter les paramètres.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Link href="/super-admin/settings/messagerie">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
              <Icons.settings className="h-4 w-4 mr-2" />
              Configuration détaillée
            </Button>
          </Link>

          <ProviderTestButton
            provider="whatsapp"
            disabled={!config?.configured || !enabled}
          />
        </div>
      </CardContent>
    </Card>
  )
}
