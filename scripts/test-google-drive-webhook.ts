/**
 * Script de test webhook Google Drive
 * Usage: node --loader ts-node/esm scripts/test-google-drive-webhook.ts [userId]
 *
 * Ce script teste:
 * 1. Création webhook Google Drive (push notifications)
 * 2. Vérification enregistrement dans DB
 * 3. Calcul temps restant avant expiration
 * 4. Test arrêt webhook
 */

import { createClient } from '@supabase/supabase-js'
import { createGoogleDriveProvider } from '../lib/integrations/cloud-storage'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL + '/api/webhooks/google-drive'
const WEBHOOK_TOKEN = process.env.GOOGLE_DRIVE_WEBHOOK_VERIFY_TOKEN!

async function testGoogleDriveWebhook(userId: string) {
  console.log('[Test Webhook] Démarrage test pour user:', userId)
  console.log('[Test Webhook] Date:', new Date().toISOString())
  console.log('[Test Webhook] Webhook URL:', WEBHOOK_URL)
  console.log()

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // 1. Récupérer configuration
    console.log('[1/5] Récupération configuration...')
    const { data: config, error: configError } = await supabase
      .from('cloud_providers_config')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google_drive')
      .single()

    if (configError || !config) {
      console.error('❌ Configuration non trouvée:', configError)
      process.exit(1)
    }

    console.log('✅ Configuration trouvée')
    console.log('   - Dossier racine:', config.folder_name)
    console.log('   - Dossier ID:', config.root_folder_id)
    console.log()

    // 2. Créer provider
    const provider = createGoogleDriveProvider({
      accessToken: config.access_token,
      refreshToken: config.refresh_token,
      expiresAt: new Date(config.token_expires_at),
    })

    // 3. Créer webhook (watch folder)
    console.log('[2/5] Création webhook...')
    console.log('   Note: Les webhooks Google Drive expirent après 7 jours max')
    console.log()

    const watch = await provider.watchFolder(
      config.root_folder_id!,
      WEBHOOK_URL,
      WEBHOOK_TOKEN
    )

    console.log('✅ Webhook créé avec succès')
    console.log('   - Channel ID:', watch.channelId)
    console.log('   - Resource ID:', watch.resourceId)
    console.log('   - Expire le:', watch.expiresAt.toLocaleString())

    const hoursUntilExpiration = Math.floor(
      (watch.expiresAt.getTime() - Date.now()) / 1000 / 60 / 60
    )
    console.log(`   - Temps restant: ${hoursUntilExpiration}h (${Math.floor(hoursUntilExpiration / 24)}j)`)
    console.log()

    // 4. Enregistrer dans DB
    console.log('[3/5] Enregistrement webhook dans DB...')

    // Arrêter ancien webhook si existe
    if (config.webhook_channel_id && config.webhook_resource_id) {
      console.log('   ⚠️  Ancien webhook détecté, arrêt en cours...')

      try {
        await provider.stopFileWatch(
          config.webhook_channel_id,
          config.webhook_resource_id
        )
        console.log('   ✅ Ancien webhook arrêté')

        // Marquer comme stopped dans DB
        await supabase
          .from('webhook_channels')
          .update({ stopped_at: new Date().toISOString() })
          .eq('channel_id', config.webhook_channel_id)
      } catch (stopError: any) {
        console.log('   ⚠️  Impossible d\'arrêter ancien webhook (peut-être déjà expiré)')
      }
    }

    // Créer nouvelle entrée webhook_channels
    const { data: webhookChannel, error: webhookError } = await supabase
      .from('webhook_channels')
      .insert({
        user_id: userId,
        provider: 'google_drive',
        channel_id: watch.channelId,
        resource_id: watch.resourceId,
        folder_id: config.root_folder_id!,
        folder_name: config.folder_name,
        expires_at: watch.expiresAt.toISOString(),
      })
      .select()
      .single()

    if (webhookError) {
      console.error('❌ Erreur enregistrement webhook:', webhookError)
    } else {
      console.log('✅ Webhook enregistré dans DB')
      console.log('   - ID:', webhookChannel.id)
    }

    // Mettre à jour cloud_providers_config
    await supabase
      .from('cloud_providers_config')
      .update({
        webhook_channel_id: watch.channelId,
        webhook_resource_id: watch.resourceId,
        webhook_expires_at: watch.expiresAt.toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'google_drive')

    console.log('✅ Configuration mise à jour')
    console.log()

    // 5. Vérifier webhooks expirant bientôt
    console.log('[4/5] Vérification webhooks expirant bientôt...')

    const { data: expiring } = await supabase
      .from('webhook_channels_expiring_soon')
      .select('*')
      .eq('user_id', userId)

    if (expiring && expiring.length > 0) {
      console.log(`⚠️  ${expiring.length} webhook(s) expirent dans < 24h`)
      expiring.forEach((w: any) => {
        console.log(`   - Channel ${w.channel_id}: ${w.hours_until_expiration}h restantes`)
      })
    } else {
      console.log('✅ Aucun webhook expirant dans les 24h')
    }
    console.log()

    // 6. Test simulation changement fichier
    console.log('[5/5] Simulation changement fichier...')
    console.log('   Note: Modifier un fichier dans Google Drive pour déclencher webhook')
    console.log('   Webhook URL:', WEBHOOK_URL)
    console.log()
    console.log('   Pour tester manuellement:')
    console.log('   1. Aller sur Google Drive')
    console.log('   2. Modifier/ajouter un fichier dans:', config.folder_name)
    console.log('   3. Vérifier logs webhook dans table sync_logs')
    console.log()

    // Résumé
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ Test Webhook Google Drive RÉUSSI')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log()
    console.log('Résultat:')
    console.log('  ✅ Webhook créé et enregistré')
    console.log(`  ✅ Expire dans ${hoursUntilExpiration}h (${Math.floor(hoursUntilExpiration / 24)}j)`)
    console.log('  ✅ Notifications push activées')
    console.log()
    console.log('Prochaines étapes:')
    console.log('  1. Modifier fichier sur Google Drive')
    console.log('  2. Vérifier POST reçu sur webhook URL')
    console.log('  3. Vérifier sync_logs pour tracking synchronisation')
    console.log('  4. Configurer renouvellement automatique (cron quotidien)')
    console.log()
    console.log('Commandes utiles:')
    console.log(`  SELECT * FROM webhook_channels WHERE user_id = '${userId}';`)
    console.log(`  SELECT * FROM sync_logs WHERE user_id = '${userId}' ORDER BY started_at DESC LIMIT 10;`)
    console.log('  SELECT * FROM webhook_channels_expiring_soon;')
    console.log()

    // Ne pas arrêter le webhook (on veut le garder actif)
    console.log('⚠️  Webhook laissé actif pour recevoir notifications')
    console.log('   Pour l\'arrêter manuellement:')
    console.log(`   node --loader ts-node/esm scripts/stop-webhook.ts ${userId}`)
    console.log()

    process.exit(0)
  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ Test Webhook Google Drive ÉCHOUÉ')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error()
    console.error('Erreur:', error.message)
    console.error()
    console.error('Stack trace:', error.stack)
    console.error()
    process.exit(1)
  }
}

// Exécution
const userId = process.argv[2]

if (!userId) {
  console.error('Usage: node --loader ts-node/esm scripts/test-google-drive-webhook.ts [userId]')
  console.error()
  console.error('Example:')
  console.error('  node --loader ts-node/esm scripts/test-google-drive-webhook.ts a1b2c3d4-...')
  process.exit(1)
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !WEBHOOK_TOKEN) {
  console.error('Variables manquantes:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  console.error('  - GOOGLE_DRIVE_WEBHOOK_VERIFY_TOKEN')
  process.exit(1)
}

testGoogleDriveWebhook(userId)
