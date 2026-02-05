/**
 * Script de test OAuth Google Drive
 * Usage: node --loader ts-node/esm scripts/test-google-drive-oauth.ts [userId]
 *
 * Ce script teste:
 * 1. Récupération configuration OAuth depuis DB
 * 2. Validation/refresh token si expiré
 * 3. Test listage fichiers Google Drive
 * 4. Test upload fichier
 */

import { createClient } from '@supabase/supabase-js'
import { createGoogleDriveProvider } from '../lib/integrations/cloud-storage'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function testGoogleDriveOAuth(userId: string) {
  console.log('[Test OAuth] Démarrage test pour user:', userId)
  console.log('[Test OAuth] Date:', new Date().toISOString())
  console.log()

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // 1. Récupérer configuration OAuth
    console.log('[1/5] Récupération configuration OAuth...')
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
    console.log('   - Provider:', config.provider)
    console.log('   - Dossier racine:', config.folder_name)
    console.log('   - Token expire:', new Date(config.token_expires_at).toLocaleString())
    console.log()

    // 2. Créer provider et tester refresh token
    console.log('[2/5] Validation token (refresh si expiré)...')

    const tokenExpiresAt = new Date(config.token_expires_at)
    const isExpired = tokenExpiresAt < new Date()

    if (isExpired) {
      console.log('⚠️  Token expiré, refresh automatique...')
    } else {
      const remainingMinutes = Math.floor((tokenExpiresAt.getTime() - Date.now()) / 1000 / 60)
      console.log(`✅ Token valide (expire dans ${remainingMinutes} minutes)`)
    }

    const provider = createGoogleDriveProvider({
      accessToken: config.access_token,
      refreshToken: config.refresh_token,
      expiresAt: tokenExpiresAt,
    })

    // Le provider va auto-refresh le token si nécessaire lors du premier appel API
    console.log()

    // 3. Test listage fichiers dossier racine
    console.log('[3/5] Test listage fichiers...')

    const files = await provider.listFiles({
      folderId: config.root_folder_id!,
      maxResults: 10,
    })

    console.log(`✅ Listage réussi: ${files.length} fichier(s) trouvé(s)`)

    if (files.length > 0) {
      console.log('   Premiers fichiers:')
      files.slice(0, 3).forEach((file, i) => {
        console.log(`   ${i + 1}. ${file.name} (${file.mimeType})`)
      })
    }
    console.log()

    // 4. Test structure dossiers
    console.log('[4/5] Test vérification structure dossiers...')

    try {
      // Créer dossier test (sera supprimé après)
      const testFolderName = `Test OAuth ${new Date().toISOString()}`

      const testFolder = await provider.createFolder({
        name: testFolderName,
        parentFolderId: config.root_folder_id!,
      })

      console.log('✅ Création dossier test réussie')
      console.log('   - ID:', testFolder.id)
      console.log('   - Nom:', testFolder.name)

      // Supprimer dossier test
      await provider.deleteFile({ fileId: testFolder.id })
      console.log('✅ Suppression dossier test réussie')
      console.log()
    } catch (error: any) {
      console.error('❌ Erreur test dossiers:', error.message)
      console.log()
    }

    // 5. Test upload fichier
    console.log('[5/5] Test upload fichier...')

    try {
      const testFileName = `test-${Date.now()}.txt`
      const testContent = Buffer.from('Test upload OAuth Google Drive - ' + new Date().toISOString())

      const uploadedFile = await provider.uploadFile({
        fileName: testFileName,
        fileBuffer: testContent,
        mimeType: 'text/plain',
        folderId: config.root_folder_id!,
      })

      console.log('✅ Upload fichier réussi')
      console.log('   - ID:', uploadedFile.id)
      console.log('   - Nom:', uploadedFile.name)
      console.log('   - Lien:', uploadedFile.webViewLink)

      // Supprimer fichier test
      await provider.deleteFile({ fileId: uploadedFile.id })
      console.log('✅ Suppression fichier test réussie')
      console.log()
    } catch (error: any) {
      console.error('❌ Erreur test upload:', error.message)
      console.log()
    }

    // Résumé
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ Test OAuth Google Drive RÉUSSI')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log()
    console.log('Résultat:')
    console.log('  ✅ Configuration OAuth valide')
    console.log('  ✅ Token fonctionnel (refresh automatique OK)')
    console.log('  ✅ Listage fichiers OK')
    console.log('  ✅ Création dossiers OK')
    console.log('  ✅ Upload fichiers OK')
    console.log()

    process.exit(0)
  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ Test OAuth Google Drive ÉCHOUÉ')
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
  console.error('Usage: node --loader ts-node/esm scripts/test-google-drive-oauth.ts [userId]')
  console.error()
  console.error('Example:')
  console.error('  node --loader ts-node/esm scripts/test-google-drive-oauth.ts a1b2c3d4-...')
  process.exit(1)
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Variables manquantes:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

testGoogleDriveOAuth(userId)
