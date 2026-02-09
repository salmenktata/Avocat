/**
 * Script de vérification de santé MinIO
 *
 * Vérifie que tous les buckets nécessaires existent
 * Utilisation: npm run check:minio
 */

import { getMinioClient } from '../lib/storage/minio'

// Liste des buckets requis
const REQUIRED_BUCKETS = [
  process.env.MINIO_BUCKET || 'documents',
  'web-files',
  'avatars',
  'uploads',
]

async function checkMinioHealth() {
  console.log('🔍 Vérification santé MinIO...\n')

  const client = getMinioClient()
  const results: { bucket: string; exists: boolean; error?: string }[] = []

  // Vérifier chaque bucket
  for (const bucketName of REQUIRED_BUCKETS) {
    try {
      const exists = await client.bucketExists(bucketName)
      results.push({ bucket: bucketName, exists })

      if (exists) {
        console.log(`✅ ${bucketName}`)
      } else {
        console.log(`❌ ${bucketName} - MANQUANT`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      results.push({ bucket: bucketName, exists: false, error: errorMsg })
      console.log(`❌ ${bucketName} - ERREUR: ${errorMsg}`)
    }
  }

  // Résumé
  const existingBuckets = results.filter((r) => r.exists)
  const missingBuckets = results.filter((r) => !r.exists)

  console.log('\n📊 Résumé:')
  console.log(`   - Buckets OK: ${existingBuckets.length}/${REQUIRED_BUCKETS.length}`)
  console.log(`   - Buckets manquants: ${missingBuckets.length}`)

  if (missingBuckets.length > 0) {
    console.log('\n⚠️  Buckets manquants:')
    missingBuckets.forEach((r) => {
      console.log(`   - ${r.bucket}`)
    })
    console.log('\n💡 Solution: npm run init:minio')
    process.exit(1)
  }

  console.log('\n✅ MinIO est en bonne santé')
}

// Exécution
checkMinioHealth().catch((error) => {
  console.error('❌ Erreur fatale:', error)
  process.exit(1)
})
