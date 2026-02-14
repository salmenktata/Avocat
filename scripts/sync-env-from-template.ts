#!/usr/bin/env tsx
/**
 * Script de synchronisation .env.production depuis .env.production.template
 *
 * Mode wizard interactif pour synchroniser variables divergentes
 *
 * Features:
 * - Dry-run mode (--dry-run): Affiche changements sans appliquer
 * - Backup automatique avant modification (.env.production.backup.{timestamp})
 * - Confirmation interactive pour chaque divergence CRITICAL/HIGH
 * - Préserve secrets existants (ne remplace pas si déjà configuré)
 * - Validation post-sync (appelle validate-rag-config.sh si disponible)
 *
 * Usage:
 *   npx tsx scripts/sync-env-from-template.ts
 *   npx tsx scripts/sync-env-from-template.ts --dry-run
 *   npx tsx scripts/sync-env-from-template.ts --auto-yes  # DANGER: accepte tout automatiquement
 */

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import readline from 'readline'

const execAsync = promisify(exec)

// Types
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

interface SyncAction {
  variable: string
  severity: Severity
  currentValue: string | null
  newValue: string
  reason: string
}

// Configuration
const CRITICAL_VARS = [
  'RAG_ENABLED',
  'OLLAMA_ENABLED',
  'OLLAMA_BASE_URL',
  'DATABASE_URL',
  'DB_PASSWORD',
  'NEXTAUTH_SECRET',
  'NODE_ENV',
]

const HIGH_VARS = [
  'GROQ_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'MINIO_SECRET_KEY',
  'REDIS_URL',
  'CRON_SECRET',
]

/**
 * Parse fichier .env
 */
async function parseEnvFile(filePath: string): Promise<Map<string, string>> {
  const content = await fs.readFile(filePath, 'utf-8')
  const vars = new Map<string, string>()

  content.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) {
      const [, key, value] = match
      vars.set(key, value)
    }
  })

  return vars
}

/**
 * Détermine severity
 */
function getSeverity(varName: string): Severity {
  if (CRITICAL_VARS.includes(varName)) return 'CRITICAL'
  if (HIGH_VARS.includes(varName)) return 'HIGH'
  return 'MEDIUM'
}

/**
 * Détecte actions de sync nécessaires
 */
async function detectSyncActions(
  prodFile: string,
  templateFile: string
): Promise<SyncAction[]> {
  const prodVars = await parseEnvFile(prodFile)
  const templateVars = await parseEnvFile(templateFile)

  const actions: SyncAction[] = []

  // Cas spécifiques critiques identifiés dans le plan
  const criticalFixes = [
    {
      variable: 'OLLAMA_ENABLED',
      expectedValue: 'true',
      reason: 'RAG non-fonctionnel si false (bug récurrent Feb 12-14, 2026)',
    },
    {
      variable: 'OLLAMA_BASE_URL',
      expectedValue: 'http://host.docker.internal:11434',
      reason: 'localhost ne fonctionne pas dans contexte Docker',
    },
  ]

  criticalFixes.forEach(({ variable, expectedValue, reason }) => {
    const currentValue = prodVars.get(variable) || null
    const templateValue = templateVars.get(variable) || expectedValue

    if (currentValue !== expectedValue) {
      actions.push({
        variable,
        severity: 'CRITICAL',
        currentValue,
        newValue: expectedValue,
        reason,
      })
    }
  })

  return actions.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

/**
 * Crée backup du fichier .env.production
 */
async function createBackup(filePath: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')
  const backupPath = `${filePath}.backup.${timestamp}`

  await fs.copyFile(filePath, backupPath)
  console.log(`✅ Backup créé: ${backupPath}`)

  return backupPath
}

/**
 * Applique une action de sync
 */
async function applyAction(filePath: string, action: SyncAction): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8')

  // Remplacer ligne existante ou ajouter si manquante
  const regex = new RegExp(`^${action.variable}=.*$`, 'm')

  if (regex.test(content)) {
    // Remplacer ligne existante
    content = content.replace(regex, `${action.variable}=${action.newValue}`)
  } else {
    // Ajouter variable (chercher section appropriée)
    const sectionMarkers = [
      { marker: '# RAG Configuration', vars: ['RAG_ENABLED', 'OLLAMA_ENABLED', 'OLLAMA_BASE_URL'] },
      { marker: '# Database PostgreSQL', vars: ['DATABASE_URL', 'DB_PASSWORD'] },
    ]

    let inserted = false
    for (const section of sectionMarkers) {
      if (section.vars.includes(action.variable)) {
        const sectionRegex = new RegExp(`(${section.marker}[\\s\\S]*?)(?=\\n\\n|\\n#|$)`)
        content = content.replace(sectionRegex, `$1\n${action.variable}=${action.newValue}`)
        inserted = true
        break
      }
    }

    // Si section non trouvée, ajouter à la fin
    if (!inserted) {
      content += `\n${action.variable}=${action.newValue}\n`
    }
  }

  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Demande confirmation utilisateur
 */
async function confirmAction(action: SyncAction): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(query, resolve))
  }

  const emoji = action.severity === 'CRITICAL' ? '🚨' : '⚠️'
  console.log(`\n${emoji} ${action.severity}: ${action.variable}`)
  console.log(`   Actuel: ${action.currentValue || '(manquant)'}`)
  console.log(`   Nouveau: ${action.newValue}`)
  console.log(`   Raison: ${action.reason}`)

  const answer = await question('\nAppliquer ce changement ? (o/N) ')
  rl.close()

  return answer.toLowerCase() === 'o' || answer.toLowerCase() === 'oui'
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const autoYes = args.includes('--auto-yes')

  const rootDir = path.join(__dirname, '..')
  const prodFile = path.join(rootDir, '.env.production')
  const templateFile = path.join(rootDir, '.env.production.template')

  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║           Synchronisation .env.production                 ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  if (isDryRun) {
    console.log('🔍 Mode DRY-RUN (aucune modification appliquée)\n')
  }

  if (autoYes) {
    console.log('⚠️  Mode AUTO-YES (toutes les modifications acceptées automatiquement)\n')
  }

  // Détecter actions
  console.log('🔍 Analyse divergences...\n')
  const actions = await detectSyncActions(prodFile, templateFile)

  if (actions.length === 0) {
    console.log('✅ Aucune action de sync nécessaire - Configuration alignée!\n')
    return
  }

  console.log(`📊 ${actions.length} actions de sync détectées:\n`)

  // Afficher résumé
  actions.forEach((action, index) => {
    const emoji = action.severity === 'CRITICAL' ? '🚨' : action.severity === 'HIGH' ? '⚠️' : 'ℹ️'
    console.log(`${index + 1}. ${emoji} ${action.variable}`)
    console.log(`   ${action.currentValue || '(manquant)'} → ${action.newValue}`)
    console.log(`   ${action.reason}`)
  })

  if (isDryRun) {
    console.log('\n✅ Dry-run terminé (aucune modification appliquée)')
    return
  }

  // Backup
  console.log('\n💾 Création backup...')
  const backupPath = await createBackup(prodFile)

  // Appliquer actions
  let appliedCount = 0

  for (const action of actions) {
    let shouldApply = autoYes

    if (!autoYes) {
      shouldApply = await confirmAction(action)
    }

    if (shouldApply) {
      await applyAction(prodFile, action)
      console.log(`✅ ${action.variable} synchronisé`)
      appliedCount++
    } else {
      console.log(`⏭️  ${action.variable} ignoré`)
    }
  }

  console.log(`\n📊 Résumé: ${appliedCount}/${actions.length} actions appliquées`)

  if (appliedCount > 0) {
    console.log('\n🔍 Validation configuration RAG...')

    const validateScript = path.join(rootDir, 'scripts/validate-rag-config.sh')
    try {
      await fs.access(validateScript)
      const { stdout } = await execAsync(`bash ${validateScript} ${prodFile}`)
      console.log(stdout)
    } catch (error) {
      console.log('⚠️  Script validate-rag-config.sh non trouvé (skip validation)')
    }

    console.log('\n✅ Synchronisation terminée!')
    console.log(`\n💡 Prochaines étapes:`)
    console.log('   1. Vérifier changements: git diff .env.production')
    console.log('   2. Tester localement: npm run dev')
    console.log('   3. Health check: curl http://localhost:7002/api/health | jq .rag')
    console.log(`\n🔙 Rollback possible: cp ${backupPath} .env.production`)
  }
}

main().catch((error) => {
  console.error('❌ Erreur:', error.message)
  process.exit(1)
})
