/**
 * Composant Configuration WhatsApp Business
 * Formulaire avec validation pour configurer réception documents via WhatsApp
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Copy, Check, Trash2, Power, MessageSquare } from 'lucide-react'
import {
  saveWhatsAppConfigAction,
  disableWhatsAppConfigAction,
  deleteWhatsAppConfigAction,
} from '@/app/actions/messaging'

const formSchema = z.object({
  phoneNumber: z.string().min(1, 'Numéro de téléphone requis'),
  phoneNumberId: z.string().min(1, 'Phone Number ID requis'),
  businessAccountId: z.string().min(1, 'Business Account ID requis'),
  accessToken: z.string().min(1, 'Access Token requis'),
  webhookVerifyToken: z.string().min(20, 'Token doit contenir au moins 20 caractères'),
  autoAttachDocuments: z.boolean(),
  requireConfirmation: z.boolean(),
  sendConfirmation: z.boolean(),
  enabled: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

interface MessagingConfigProps {
  existingConfig: any
}

export default function MessagingConfig({ existingConfig }: MessagingConfigProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  const isConfigured = !!existingConfig

  // URL Webhook
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7002'}/api/webhooks/whatsapp`

  // Formulaire
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phoneNumber: existingConfig?.phone_number || '',
      phoneNumberId: existingConfig?.phone_number_id || '',
      businessAccountId: existingConfig?.business_account_id || '',
      accessToken: existingConfig?.access_token || '',
      webhookVerifyToken: existingConfig?.webhook_verify_token || '',
      autoAttachDocuments: existingConfig?.auto_attach_documents ?? true,
      requireConfirmation: existingConfig?.require_confirmation ?? false,
      sendConfirmation: existingConfig?.send_confirmation ?? true,
      enabled: existingConfig?.enabled ?? true,
    },
  })

  // Sauvegarder configuration
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await saveWhatsAppConfigAction(values)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.message || 'Configuration enregistrée')
      router.refresh()
    })
  }

  // Désactiver configuration
  const handleDisable = () => {
    startTransition(async () => {
      const result = await disableWhatsAppConfigAction()

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Configuration désactivée')
      router.refresh()
    })
  }

  // Supprimer configuration
  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteWhatsAppConfigAction()

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Configuration supprimée')
      setDeleteDialogOpen(false)
      router.refresh()
    })
  }

  // Copier URL webhook
  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopiedWebhook(true)
    toast.success('URL webhook copiée')
    setTimeout(() => setCopiedWebhook(false), 2000)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-green-100 p-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle>Configuration WhatsApp Business</CardTitle>
                <CardDescription>
                  Connectez votre compte WhatsApp Business pour recevoir automatiquement les documents
                </CardDescription>
              </div>
            </div>
            {isConfigured && (
              <Badge variant={existingConfig.enabled ? 'default' : 'secondary'}>
                {existingConfig.enabled ? 'Actif' : 'Désactivé'}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Formulaire */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Identifiants WhatsApp Business */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Identifiants WhatsApp Business</h3>
                  <Badge variant="outline" className="text-xs">
                    Meta Graph API
                  </Badge>
                </div>

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro de téléphone WhatsApp Business</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+21612345678"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        Numéro de téléphone associé à votre compte WhatsApp Business (format E.164)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123456789012345"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        Identifiant unique du numéro WhatsApp Business (trouvé dans Meta Business Manager)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Account ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="987654321098765"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        Identifiant du compte WhatsApp Business (trouvé dans Meta Business Manager)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Token</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="EAAxxxxxxxxxxxxxxxxxxxxx"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        Token d&apos;accès à l&apos;API WhatsApp Business (généré dans Meta Developers)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="webhookVerifyToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook Verify Token</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Minimum 20 caractères aléatoires"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        Token de vérification pour sécuriser le webhook (min. 20 caractères)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Paramètres Automatisation */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Paramètres Automatisation</h3>

                <FormField
                  control={form.control}
                  name="autoAttachDocuments"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Rattachement automatique</FormLabel>
                        <FormDescription>
                          Si le client a 1 seul dossier actif, rattacher automatiquement le document
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requireConfirmation"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Demander confirmation avant rattachement</FormLabel>
                        <FormDescription>
                          Même avec 1 seul dossier, demander validation manuelle avant rattachement
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sendConfirmation"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Envoyer confirmation WhatsApp au client</FormLabel>
                        <FormDescription>
                          Envoyer un message de confirmation au client quand son document est reçu
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                      <div className="space-y-0.5">
                        <FormLabel>Activer la réception de documents</FormLabel>
                        <FormDescription>
                          Activer ou désactiver temporairement la réception de documents par WhatsApp
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Enregistrement...' : isConfigured ? 'Mettre à jour' : 'Enregistrer'}
                </Button>

                {isConfigured && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDisable}
                      disabled={isPending || !existingConfig.enabled}
                    >
                      <Power className="mr-2 h-4 w-4" />
                      Désactiver
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </Button>
                  </>
                )}
              </div>
            </form>
          </Form>

          {/* URL Webhook */}
          <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
            <Label className="text-sm font-medium">URL Webhook à configurer dans Meta</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Copiez cette URL et configurez-la dans votre application Meta Business (Webhooks)
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs bg-background"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyWebhook}
              >
                {copiedWebhook ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Instructions Configuration Webhook */}
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="text-sm font-medium">Instructions configuration webhook Meta</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Allez dans votre application Facebook Developers</li>
              <li>Produits → WhatsApp → Configuration</li>
              <li>Section &quot;Webhooks&quot;, cliquez &quot;Configurer les webhooks&quot;</li>
              <li>
                URL de rappel : Collez l&apos;URL ci-dessus (<code>{webhookUrl}</code>)
              </li>
              <li>
                Token de vérification : Collez le &quot;Webhook Verify Token&quot; du formulaire ci-dessus
              </li>
              <li>Cliquez &quot;Vérifier et enregistrer&quot;</li>
              <li>Cochez &quot;messages&quot; dans les événements webhook</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Confirmation Suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la configuration WhatsApp ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Vous devrez reconfigurer WhatsApp pour recevoir à nouveau des
              documents. Les documents déjà reçus ne seront pas supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
