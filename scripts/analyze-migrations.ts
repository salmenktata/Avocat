/**
 * Script: Analyse migrations orphelines
 * Identifie les migrations dans /migrations/ qui doivent être consolidées
 */

import * as fs from 'fs'
import * as path from 'path'

interface MigrationInfo {
  filename: string
  path: string
  type: 'critical' | 'important' | 'optional' | 'duplicate'
  reason: string
  targetFilename?: string
}

const CRITICAL_KEYWORDS = [
  'openai', 'embedding', 'hybrid', 'bm25', 'approval', 'type_casting',
  'classify_pages', 'api_keys'
]

const OPTIONAL_KEYWORDS = [
  'indexes', 'autovacuum', 'gamification', 'redisearch'
]

function analyzeMigration(filename: string): MigrationInfo {
  const fullPath = path.join('migrations', filename)
  const content = fs.readFileSync(fullPath, 'utf-8')

  let type: MigrationInfo['type'] = 'optional'
  let reason = ''

  // Vérifier si migration critique
  const lower = filename.toLowerCase()
  for (const keyword of CRITICAL_KEYWORDS) {
    if (lower.includes(keyword)) {
      type = 'critical'
      reason = `Contient "${keyword}" - fonctionnalité essentielle`
      break
    }
  }

  // Vérifier si migration déjà dans /db/migrations/
  const dbMigrations = fs.readdirSync('db/migrations')
  const similarInDb = dbMigrations.find(dbFile => {
    const baseName = filename.replace(/^(2026-\d{2}-\d{2}|202602\d{2})/, '')
    return dbFile.includes(baseName.replace(/\.sql$/, ''))
  })

  if (similarInDb) {
    type = 'duplicate'
    reason = `Déjà dans /db/migrations/ (${similarInDb})`
  }

  // Générer nom cible pour /db/migrations/
  let targetFilename: string | undefined
  if (type === 'critical' || type === 'important') {
    // Format: 20260217000XXX_descriptive_name.sql
    const timestamp = '20260217' // Base timestamp Phase 2
    const baseName = filename
      .replace(/^(2026-\d{2}-\d{2}-|202602\d{2}_)/, '')
      .replace(/\.sql$/, '')
    targetFilename = `${timestamp}XXXXXX_${baseName}.sql`
  }

  return {
    filename,
    path: fullPath,
    type,
    reason,
    targetFilename
  }
}

function main() {
  console.log('🔍 Analyse migrations orphelines...\n')

  const migrationsDir = 'migrations'
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))

  console.log(`📂 Migrations trouvées: ${files.length}\n`)

  const analyzed = files.map(analyzeMigration)

  // Grouper par type
  const byType = {
    critical: analyzed.filter(m => m.type === 'critical'),
    important: analyzed.filter(m => m.type === 'important'),
    optional: analyzed.filter(m => m.type === 'optional'),
    duplicate: analyzed.filter(m => m.type === 'duplicate')
  }

  // Afficher résultats
  console.log('═══════════════════════════════════════════════════════')
  console.log('📊 RÉSULTATS ANALYSE')
  console.log('═══════════════════════════════════════════════════════\n')

  console.log('🔴 CRITIQUES (à consolider immédiatement):')
  console.log(`   ${byType.critical.length} migrations\n`)
  byType.critical.forEach(m => {
    console.log(`   ✓ ${m.filename}`)
    console.log(`     → ${m.reason}`)
    if (m.targetFilename) {
      console.log(`     → Cible: ${m.targetFilename}`)
    }
    console.log()
  })

  console.log('🟠 IMPORTANTES (recommandées):')
  console.log(`   ${byType.important.length} migrations\n`)
  byType.important.forEach(m => {
    console.log(`   ✓ ${m.filename}`)
    console.log(`     → ${m.reason}`)
    console.log()
  })

  console.log('⚪ OPTIONNELLES (Phase 4):')
  console.log(`   ${byType.optional.length} migrations\n`)
  byType.optional.forEach(m => {
    console.log(`   ○ ${m.filename}`)
    console.log(`     → ${m.reason || 'Optimisation non critique'}`)
    console.log()
  })

  console.log('🔵 DOUBLONS (déjà appliquées):')
  console.log(`   ${byType.duplicate.length} migrations\n`)
  byType.duplicate.forEach(m => {
    console.log(`   ✓ ${m.filename}`)
    console.log(`     → ${m.reason}`)
    console.log()
  })

  // Recommandations
  console.log('═══════════════════════════════════════════════════════')
  console.log('💡 RECOMMANDATIONS')
  console.log('═══════════════════════════════════════════════════════\n')

  console.log(`1. Consolider ${byType.critical.length} migrations CRITIQUES`)
  console.log(`   → scripts/consolidate-migrations.sh --critical`)
  console.log()

  console.log(`2. Réviser ${byType.duplicate.length} DOUBLONS`)
  console.log(`   → Supprimer ou vérifier différences`)
  console.log()

  console.log(`3. Planifier ${byType.optional.length} OPTIONNELLES`)
  console.log(`   → Phase 4 (backlog)`)
  console.log()

  // Sauvegarder résultats
  const reportPath = 'migrations-analysis-report.json'
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: files.length,
      critical: byType.critical.length,
      important: byType.important.length,
      optional: byType.optional.length,
      duplicate: byType.duplicate.length
    },
    migrations: analyzed
  }, null, 2))

  console.log(`📄 Rapport détaillé: ${reportPath}`)
}

main()
