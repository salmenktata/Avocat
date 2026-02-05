/**
 * Script pour exécuter les migrations SQL
 * Usage: npx tsx scripts/migrate.ts
 */

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import pg from 'pg'

const { Pool } = pg

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    console.log('🔄 Connexion à la base de données...')

    // Créer la table de migrations si elle n'existe pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    // Lire toutes les migrations
    const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    console.log(`📂 ${files.length} fichiers de migration trouvés\n`)

    for (const file of files) {
      const version = file.replace('.sql', '')

      // Vérifier si la migration a déjà été appliquée
      const { rows } = await pool.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      )

      if (rows.length > 0) {
        console.log(`⏭️  Déjà appliquée: ${file}`)
        continue
      }

      // Lire et exécuter la migration
      const sql = readFileSync(join(migrationsDir, file), 'utf-8')

      console.log(`🔄 Application: ${file}`)

      try {
        await pool.query('BEGIN')
        await pool.query(sql)
        await pool.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        )
        await pool.query('COMMIT')
        console.log(`✅ Succès: ${file}\n`)
      } catch (error) {
        await pool.query('ROLLBACK')
        console.error(`❌ Échec: ${file}`)
        console.error(error)
        throw error
      }
    }

    console.log('\n✅ Toutes les migrations ont été appliquées avec succès!')

  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution des migrations:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigrations()
