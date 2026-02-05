/**
 * Script: Renouvellement webhooks Google Drive
 * Usage: node --loader ts-node/esm scripts/renew-google-drive-webhooks.ts
 * Cron: 0 2 * * * (tous les jours à 2h00)
 */

import { createClient } from '@supabase/supabase-js'
import { createGoogleDriveProvider } from '../lib/integrations/cloud-storage'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL + '/api/webhooks/google-drive'
const WEBHOOK_TOKEN = process.env.GOOGLE_DRIVE_WEBHOOK_VERIFY_TOKEN!

interface WebhookChannel {
  id: string
  user_id: string
  provider: string
  channel_id: string
  resource_id: string
  folder_id: string
  folder_name: string | null
  expires_at: string
  hours_until_expiration: number
}

interface CloudConfig {
  user_id: string
  provider: string
  access_token: string
  refresh_token: string
  token_expires_at: string
}

async function renewGoogleDriveWebhooks() {
  console.log('[Webhook Renewal] Démarrage...')
  console.log('[Webhook Renewal] Date:', new Date().toISOString())

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // 1. Récupérer webhooks expirant dans moins de 24h
    const { data: expiring, error: expiringError } = await supabase
      .from('webhook_channels_expiring_soon')
      .select('*')

    if (expiringError) {
      console.error('[Webhook Renewal] Erreur récupération webhooks:', expiringError)
      return
    }

    if (!expiring || expiring.length === 0) {
      console.log('[Webhook Renewal] Aucun webhook à renouveler')
      return
    }

    console.log(`[Webhook Renewal] ${expiring.length} webhook(s) à renouveler`)

    let renewed = 0
    let failed = 0

    // 2. Pour chaque webhook expirant
    for (const webhook of expiring as WebhookChannel[]) {
      try {
        console.log(`[Webhook Renewal] Traitement webhook ${webhook.channel_id}...`)

        // Vérifier que la config existe
        if (!webhook.has_valid_config) {
          console.warn(`[Webhook Renewal] Config manquante pour user ${webhook.user_id}, skip`)
          continue
        }

        // Récupérer tokens
        const { data: config, error: configError } = await supabase
          .from('cloud_providers_config')
          .select('access_token, refresh_token, token_expires_at')
          .eq('user_id', webhook.user_id)
          .eq('provider', 'google_drive')
          .single()

        if (configError || !config) {
          console.error(`[Webhook Renewal] Config non trouvée pour user ${webhook.user_id}`)
          failed++
          continue
        }

        // Créer provider Google Drive
        const provider = createGoogleDriveProvider({
          accessToken: config.access_token,
          refreshToken: config.refresh_token,
          expiresAt: new Date(config.token_expires_at),
        })

        // Arrêter ancien webhook
        try {
          await provider.stopFileWatch(webhook.channel_id, webhook.resource_id)
          console.log(`[Webhook Renewal] Ancien webhook arrêté: ${webhook.channel_id}`)
        } catch (stopError: any) {
          // Ignorer erreur si webhook déjà expiré
          console.warn(`[Webhook Renewal] Erreur arrêt webhook (ignorée):`, stopError.message)
        }

        // Créer nouveau webhook (7 jours)
        const newWatch = await provider.watchFolder(webhook.folder_id, WEBHOOK_URL, WEBHOOK_TOKEN)

        console.log(`[Webhook Renewal] Nouveau webhook créé:`, {
          channelId: newWatch.channelId,
          expiresAt: newWatch.expiresAt,
        })

        // Mettre à jour base de données
        const { error: updateError } = await supabase
          .from('webhook_channels')
          .update({
            channel_id: newWatch.channelId,
            resource_id: newWatch.resourceId,
            expires_at: newWatch.expiresAt.toISOString(),
            renewed_at: new Date().toISOString(),
          })
          .eq('id', webhook.id)

        if (updateError) {
          console.error(`[Webhook Renewal] Erreur update DB:`, updateError)
          failed++
          continue
        }

        // Mettre à jour cloud_providers_config avec nouveau channel_id
        const { error: configUpdateError } = await supabase
          .from('cloud_providers_config')
          .update({
            webhook_channel_id: newWatch.channelId,
            webhook_resource_id: newWatch.resourceId,
            webhook_expires_at: newWatch.expiresAt.toISOString(),
          })
          .eq('user_id', webhook.user_id)
          .eq('provider', 'google_drive')

        if (configUpdateError) {
          console.error(`[Webhook Renewal] Erreur update config:`, configUpdateError)
        }

        console.log(`[Webhook Renewal] ✅ Webhook renouvelé avec succès pour user ${webhook.user_id}`)
        renewed++

      } catch (error: any) {
        console.error(`[Webhook Renewal] ❌ Erreur renouvellement webhook ${webhook.channel_id}:`, error)
        failed++
      }
    }

    console.log(`[Webhook Renewal] Terminé: ${renewed} renouvelés, ${failed} échecs`)

  } catch (error: any) {
    console.error('[Webhook Renewal] Erreur globale:', error)
  }
}

// Exécution
renewGoogleDriveWebhooks()
  .then(() => {
    console.log('[Webhook Renewal] Script terminé')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[Webhook Renewal] Erreur fatale:', error)
    process.exit(1)
  })
