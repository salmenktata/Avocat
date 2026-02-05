/**
 * Script de Migration Supabase → VPS PostgreSQL + MinIO
 *
 * Migration complète des données et fichiers depuis Supabase Cloud
 * vers l'infrastructure VPS auto-hébergée.
 *
 * Usage:
 *   tsx scripts/migrate-from-supabase.ts
 *
 * Prérequis:
 *   - Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY définies
 *   - VPS PostgreSQL et MinIO accessibles
 *   - Fichier .env.production configuré
 */

import { createClient } from '@supabase/supabase-js'
import { Client as MinioClient } from 'minio'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Charger variables d'environnement
dotenv.config({ path: '.env.production' })

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const VPS_DATABASE_URL = process.env.DATABASE_URL || ''
const VPS_MINIO_CONFIG = {
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || '',
}

const MINIO_BUCKET = process.env.MINIO_BUCKET || 'documents'

// ============================================================================
// CLIENTS
// ============================================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const vpsPostgres = new Pool({
  connectionString: VPS_DATABASE_URL,
})

const vpsMinio = new MinioClient(VPS_MINIO_CONFIG)

// ============================================================================
// TYPES
// ============================================================================

interface MigrationStats {
  tables: {
    [key: string]: {
      total: number
      migrated: number
      errors: number
    }
  }
  storage: {
    total: number
    migrated: number
    errors: number
    totalSize: number
  }
}

// ============================================================================
// FONCTIONS MIGRATION
// ============================================================================

/**
 * Migrer une table Supabase → PostgreSQL VPS
 */
async function migrateTable(
  tableName: string,
  stats: MigrationStats
): Promise<void> {
  console.log(`\n📦 Migration table: ${tableName}`)

  try {
    // Récupérer toutes les lignes depuis Supabase
    const { data, error } = await supabase.from(tableName).select('*')

    if (error) {
      throw new Error(`Erreur lecture Supabase: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.log(`  ℹ️  Table ${tableName} vide, skip`)
      stats.tables[tableName] = { total: 0, migrated: 0, errors: 0 }
      return
    }

    stats.tables[tableName] = {
      total: data.length,
      migrated: 0,
      errors: 0,
    }

    console.log(`  📊 ${data.length} lignes à migrer`)

    // Insérer dans PostgreSQL VPS
    for (const row of data) {
      try {
        const keys = Object.keys(row)
        const values = Object.values(row)
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')

        await vpsPostgres.query(
          `INSERT INTO ${tableName} (${keys.join(', ')})
           VALUES (${placeholders})
           ON CONFLICT (id) DO UPDATE SET
           ${keys.map((key) => `${key} = EXCLUDED.${key}`).join(', ')}`,
          values
        )

        stats.tables[tableName].migrated++
      } catch (error: any) {
        console.error(`  ❌ Erreur ligne ${row.id}:`, error.message)
        stats.tables[tableName].errors++
      }
    }

    console.log(
      `  ✅ ${stats.tables[tableName].migrated}/${stats.tables[tableName].total} migrées`
    )
  } catch (error: any) {
    console.error(`  ❌ Erreur migration ${tableName}:`, error.message)
    stats.tables[tableName] = { total: 0, migrated: 0, errors: 1 }
  }
}

/**
 * Migrer fichiers Supabase Storage → MinIO VPS
 */
async function migrateStorage(stats: MigrationStats): Promise<void> {
  console.log('\n📦 Migration Storage (Supabase → MinIO)')

  try {
    // Vérifier/créer bucket MinIO
    const bucketExists = await vpsMinio.bucketExists(MINIO_BUCKET)
    if (!bucketExists) {
      await vpsMinio.makeBucket(MINIO_BUCKET, 'eu-west-1')
      console.log(`  ✅ Bucket MinIO créé: ${MINIO_BUCKET}`)
    }

    // Lister tous les fichiers dans Supabase Storage
    const { data: files, error } = await supabase.storage
      .from('documents')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' },
      })

    if (error) {
      throw new Error(`Erreur listing Supabase: ${error.message}`)
    }

    if (!files || files.length === 0) {
      console.log('  ℹ️  Aucun fichier à migrer')
      stats.storage = { total: 0, migrated: 0, errors: 0, totalSize: 0 }
      return
    }

    stats.storage = {
      total: files.length,
      migrated: 0,
      errors: 0,
      totalSize: 0,
    }

    console.log(`  📊 ${files.length} fichiers à migrer`)

    // Migrer chaque fichier
    for (const file of files) {
      try {
        // Télécharger depuis Supabase
        const { data, error } = await supabase.storage
          .from('documents')
          .download(file.name)

        if (error) {
          throw new Error(`Download error: ${error.message}`)
        }

        // Convertir Blob en Buffer
        const buffer = Buffer.from(await data.arrayBuffer())

        // Upload vers MinIO
        await vpsMinio.putObject(MINIO_BUCKET, file.name, buffer, buffer.length, {
          'Content-Type': file.metadata?.mimetype || 'application/octet-stream',
        })

        stats.storage.migrated++
        stats.storage.totalSize += buffer.length

        // Progress indicator
        if (stats.storage.migrated % 10 === 0) {
          console.log(
            `  📤 ${stats.storage.migrated}/${stats.storage.total} fichiers migrés`
          )
        }
      } catch (error: any) {
        console.error(`  ❌ Erreur fichier ${file.name}:`, error.message)
        stats.storage.errors++
      }
    }

    const totalSizeMB = (stats.storage.totalSize / (1024 * 1024)).toFixed(2)
    console.log(
      `  ✅ ${stats.storage.migrated}/${stats.storage.total} fichiers migrés (${totalSizeMB} MB)`
    )
  } catch (error: any) {
    console.error('  ❌ Erreur migration storage:', error.message)
    stats.storage = { total: 0, migrated: 0, errors: 1, totalSize: 0 }
  }
}

/**
 * Générer rapport de migration
 */
function generateReport(
  stats: MigrationStats,
  startTime: number
): void {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log('\n')
  console.log('============================================')
  console.log('       RAPPORT DE MIGRATION')
  console.log('============================================')
  console.log('')

  // Tables
  console.log('📊 Tables migrées:')
  let totalRows = 0
  let totalMigrated = 0
  let totalErrors = 0

  for (const [tableName, tableStats] of Object.entries(stats.tables)) {
    totalRows += tableStats.total
    totalMigrated += tableStats.migrated
    totalErrors += tableStats.errors

    const status =
      tableStats.errors > 0
        ? '⚠️'
        : tableStats.migrated === tableStats.total
        ? '✅'
        : '❌'

    console.log(
      `  ${status} ${tableName}: ${tableStats.migrated}/${tableStats.total} (${tableStats.errors} erreurs)`
    )
  }

  console.log('')
  console.log(`Total lignes: ${totalMigrated}/${totalRows}`)
  console.log(`Erreurs tables: ${totalErrors}`)

  // Storage
  console.log('')
  console.log('📦 Storage migré:')
  const storageSizeMB = (stats.storage.totalSize / (1024 * 1024)).toFixed(2)
  console.log(
    `  Fichiers: ${stats.storage.migrated}/${stats.storage.total} (${storageSizeMB} MB)`
  )
  console.log(`  Erreurs: ${stats.storage.errors}`)

  // Résumé
  console.log('')
  console.log(`⏱️  Durée: ${duration}s`)
  console.log('')

  if (totalErrors === 0 && stats.storage.errors === 0) {
    console.log('✅ Migration réussie!')
  } else {
    console.log('⚠️  Migration terminée avec erreurs')
    console.log('Vérifier les logs ci-dessus pour détails')
  }

  console.log('============================================')
}

/**
 * Sauvegarder rapport JSON
 */
function saveReport(stats: MigrationStats): void {
  const reportPath = path.join(__dirname, '..', 'migration-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2))
  console.log(`\n📄 Rapport sauvegardé: ${reportPath}`)
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 Migration Supabase → VPS PostgreSQL + MinIO')
  console.log('============================================\n')

  // Vérifier configuration
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      '❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env'
    )
    process.exit(1)
  }

  if (!VPS_DATABASE_URL) {
    console.error('❌ DATABASE_URL requis dans .env.production')
    process.exit(1)
  }

  if (!VPS_MINIO_CONFIG.accessKey || !VPS_MINIO_CONFIG.secretKey) {
    console.error('❌ MINIO_ACCESS_KEY et MINIO_SECRET_KEY requis')
    process.exit(1)
  }

  const startTime = Date.now()
  const stats: MigrationStats = {
    tables: {},
    storage: { total: 0, migrated: 0, errors: 0, totalSize: 0 },
  }

  try {
    // Test connexions
    console.log('🔌 Test connexions...')
    await vpsPostgres.query('SELECT 1')
    console.log('  ✅ PostgreSQL VPS connecté')

    await vpsMinio.listBuckets()
    console.log('  ✅ MinIO VPS connecté')

    // Tables à migrer (ordre important pour foreign keys)
    const tablesToMigrate = [
      'users',
      'clients',
      'dossiers',
      'documents',
      'echeances',
      'factures',
      'templates',
      'pending_documents',
      'sync_logs',
      'flouci_transactions',
    ]

    // Migrer tables
    for (const tableName of tablesToMigrate) {
      await migrateTable(tableName, stats)
    }

    // Migrer storage
    await migrateStorage(stats)

    // Rapport
    generateReport(stats, startTime)
    saveReport(stats)
  } catch (error: any) {
    console.error('\n❌ Erreur critique:', error)
    process.exit(1)
  } finally {
    await vpsPostgres.end()
    console.log('\n✅ Connexions fermées')
  }
}

// Exécuter
main().catch(console.error)
