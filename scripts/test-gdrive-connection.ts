/**
 * Script de test de connexion Google Drive
 *
 * Vérifie:
 * - Service account configuré
 * - Accès au dossier de test
 * - Liste des fichiers disponibles
 *
 * Usage:
 *   npx tsx scripts/test-gdrive-connection.ts [FOLDER_ID]
 */

import { validateDriveFolderAccess, parseGoogleDriveFolderUrl } from '@/lib/web-scraper/gdrive-utils'
import { config } from 'dotenv'

config()

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/test-gdrive-connection.ts <FOLDER_ID_OR_URL>')
    console.error('')
    console.error('Exemples:')
    console.error('  npx tsx scripts/test-gdrive-connection.ts 1A2B3C4D5E6F')
    console.error('  npx tsx scripts/test-gdrive-connection.ts https://drive.google.com/drive/folders/1A2B3C4D5E6F')
    process.exit(1)
  }

  const input = args[0]

  // Parser l'input (peut être URL ou folderId)
  let folderId = parseGoogleDriveFolderUrl(input)
  if (!folderId) {
    console.error('❌ URL ou folderId invalide:', input)
    process.exit(1)
  }

  console.log('🔍 Test de connexion Google Drive\n')
  console.log(`Folder ID: ${folderId}`)
  console.log('---')

  // Vérifier variables d'environnement
  if (!process.env.GOOGLE_DRIVE_ENABLED || process.env.GOOGLE_DRIVE_ENABLED !== 'true') {
    console.error('❌ GOOGLE_DRIVE_ENABLED n\'est pas activé dans .env')
    console.error('   Ajoutez: GOOGLE_DRIVE_ENABLED=true')
    process.exit(1)
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('❌ GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET manquants')
    console.error('   Vérifiez votre configuration Google OAuth')
    process.exit(1)
  }

  console.log('✅ Variables d\'environnement configurées')

  // Tester l'accès au dossier
  console.log('\n🔐 Test d\'accès au dossier...')
  const result = await validateDriveFolderAccess(folderId)

  if (!result.success) {
    console.error('\n❌ Échec de connexion:')
    console.error(`   ${result.error}`)
    console.error('\n💡 Vérifiez que:')
    console.error('   - Le dossier existe')
    console.error('   - Le dossier est partagé avec le service account')
    console.error('   - Permission: Lecteur (read-only)')
    process.exit(1)
  }

  console.log('✅ Connexion réussie')
  console.log(`✅ ${result.fileCount} fichier(s) découvert(s)`)
  console.log('\n✨ Configuration Google Drive opérationnelle!')
}

main().catch((error) => {
  console.error('❌ Erreur fatale:', error.message)
  process.exit(1)
})
