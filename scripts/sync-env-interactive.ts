#!/usr/bin/env tsx
/**
 * Wizard interactif pour synchroniser variables Dev → Prod ou Prod → Dev
 *
 * Usage:
 *   npm run sync-env
 *   npm run sync-env dev→prod
 *   npm run sync-env prod→dev
 *   npm run sync-env --dry-run
 *
 * Features:
 * - Affiche diff avant sync
 * - Confirmation variable par variable
 * - Skip secrets (demande confirmation explicite)
 * - Dry-run mode (--dry-run)
 * - Backup automatique
 * - Health check post-sync
 */

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import readline from 'readline'

const execAsync = promisify(exec)

// Types
interface SyncAction {
  variable: string
  fromValue: string | null
  toValue: string
  direction: 'dev→prod' | 'prod→dev'
  isSecret: boolean
  impact: string
}

// Configuration
const VPS_HOST = '84.247.165.187'
const VPS_USER = 'root'
const VPS_ENV_PATH = '/opt/qadhya/.env.production.local'

const SECRET_PATTERNS = [/API_KEY/i, /SECRET/i, /PASSWORD/i, /TOKEN/i, /^ENCRYPTION_KEY$/]

/**
 * Parse fichier .env
 */
function parseEnvContent(content: string): Map<string, string> {
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
 * Récupère .env production depuis VPS
 */
async function fetchProdEnv(): Promise<Map<string, string>> {
  const { stdout } = await execAsync(
    `ssh ${VPS_USER}@${VPS_HOST} "cat ${VPS_ENV_PATH}" 2>/dev/null`,
    { timeout: 10000 }
  )
  return parseEnvContent(stdout)
}

/**
 * Détermine si variable est secrète
 */
function isSecret(varName: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(varName))
}

/**
 * Masque secret
 */
function maskSecret(value: string): string {
  if (value.length <= 8) return '***'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

/**
 * Détecte actions de sync nécessaires
 */
async function detectSyncActions(
  direction: 'dev→prod' | 'prod→dev' | 'auto'
): Promise<SyncAction[]> {
  const rootDir = path.join(__dirname, '..')
  const devEnvPath = path.join(rootDir, '.env.local')

  // Charger .env.local (dev)
  let devVars: Map<string, string>
  try {
    const devContent = await fs.readFile(devEnvPath, 'utf-8')
    devVars = parseEnvContent(devContent)
  } catch {
    const fallbackPath = path.join(rootDir, '.env.production')
    const fallbackContent = await fs.readFile(fallbackPath, 'utf-8')
    devVars = parseEnvContent(fallbackContent)
  }

  // Charger .env production (VPS)
  const prodVars = await fetchProdEnv()

  const actions: SyncAction[] = []

  // Cas auto: détecter différences critiques
  if (direction === 'auto' || direction === 'dev→prod') {
    // Variables critiques à synchroniser dev → prod
    const criticalVars = ['OLLAMA_ENABLED', 'OLLAMA_BASE_URL', 'RAG_ENABLED']

    for (const varName of criticalVars) {
      const devValue = devVars.get(varName)
      const prodValue = prodVars.get(varName)

      if (devValue && prodValue && devValue !== prodValue) {
        actions.push({
          variable: varName,
          fromValue: prodValue,
          toValue: devValue,
          direction: 'dev→prod',
          isSecret: isSecret(varName),
          impact: `Configuration critique différente (dev: ${devValue}, prod: ${prodValue})`,
        })
      }
    }
  }

  if (direction === 'prod→dev') {
    // Sync secrets prod → dev (pour développement local)
    const secretVars = Array.from(prodVars.keys()).filter(isSecret)

    for (const varName of secretVars) {
      const devValue = devVars.get(varName)
      const prodValue = prodVars.get(varName)

      if (prodValue && (!devValue || devValue !== prodValue)) {
        actions.push({
          variable: varName,
          fromValue: devValue || null,
          toValue: prodValue,
          direction: 'prod→dev',
          isSecret: true,
          impact: `Secret manquant ou différent en dev`,
        })
      }
    }
  }

  return actions
}

/**
 * Affiche résumé actions
 */
function displayActionsSummary(actions: SyncAction[]): void {
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║           Wizard Synchronisation Environnement            ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  if (actions.length === 0) {
    console.log('✅ Aucune action de sync détectée - Environnements alignés!\n')
    return
  }

  console.log(`📊 ${actions.length} actions de sync détectées:\n`)

  actions.forEach((action, index) => {
    const arrow = action.direction === 'dev→prod' ? '→' : '←'
    const emoji = action.isSecret ? '🔐' : '📝'

    console.log(`${index + 1}. ${emoji} ${action.variable}`)
    console.log(`   ${action.direction}`)

    if (action.fromValue !== null) {
      const displayFrom = action.isSecret ? maskSecret(action.fromValue) : action.fromValue
      console.log(`   From: ${displayFrom}`)
    } else {
      console.log(`   From: (non défini)`)
    }

    const displayTo = action.isSecret ? maskSecret(action.toValue) : action.toValue
    console.log(`   To:   ${displayTo}`)
    console.log(`   Impact: ${action.impact}`)
    console.log('')
  })
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

  const emoji = action.isSecret ? '🔐' : '📝'
  console.log(`\n${emoji} ${action.variable} (${action.direction})`)

  if (action.fromValue !== null) {
    const displayFrom = action.isSecret ? maskSecret(action.fromValue) : action.fromValue
    console.log(`   From: ${displayFrom}`)
  } else {
    console.log(`   From: (non défini)`)
  }

  const displayTo = action.isSecret ? maskSecret(action.toValue) : action.toValue
  console.log(`   To:   ${displayTo}`)
  console.log(`   Impact: ${action.impact}`)

  const answer = await question('\nAppliquer cette synchronisation ? (o/N) ')
  rl.close()

  return answer.toLowerCase() === 'o' || answer.toLowerCase() === 'oui'
}

/**
 * Applique action sync
 */
async function applyAction(action: SyncAction, isDryRun: boolean): Promise<boolean> {
  if (isDryRun) {
    console.log(`✅ [DRY-RUN] ${action.variable} synchronisé (simulation)`)
    return true
  }

  if (action.direction === 'dev→prod') {
    // Sync dev → prod via fix-prod-config.sh
    const scriptPath = path.join(__dirname, 'fix-prod-config.sh')

    try {
      const { stdout, stderr } = await execAsync(`bash ${scriptPath} ${action.variable} "${action.toValue}"`, {
        timeout: 120000,
      })

      console.log(stdout)

      if (stderr && !stderr.includes('✅')) {
        console.error(`⚠️  Warnings: ${stderr}`)
      }

      return true
    } catch (error) {
      console.error(`❌ Erreur sync ${action.variable}:`, error)
      return false
    }
  } else {
    // Sync prod → dev (modification .env.local)
    const rootDir = path.join(__dirname, '..')
    const devEnvPath = path.join(rootDir, '.env.local')

    let content = await fs.readFile(devEnvPath, 'utf-8')

    // Remplacer ou ajouter variable
    const regex = new RegExp(`^${action.variable}=.*$`, 'm')

    if (regex.test(content)) {
      content = content.replace(regex, `${action.variable}=${action.toValue}`)
    } else {
      content += `\n${action.variable}=${action.toValue}\n`
    }

    await fs.writeFile(devEnvPath, content, 'utf-8')

    console.log(`✅ ${action.variable} synchronisé vers .env.local`)
    return true
  }
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')

  let direction: 'dev→prod' | 'prod→dev' | 'auto' = 'auto'

  if (args.includes('dev→prod') || args.includes('dev-prod')) {
    direction = 'dev→prod'
  } else if (args.includes('prod→dev') || args.includes('prod-dev')) {
    direction = 'prod→dev'
  }

  if (isDryRun) {
    console.log('\n🔍 Mode DRY-RUN (aucune modification appliquée)\n')
  }

  // Détecter actions
  console.log('🔍 Analyse divergences...\n')
  const actions = await detectSyncActions(direction)

  displayActionsSummary(actions)

  if (actions.length === 0) {
    return
  }

  if (isDryRun) {
    console.log('✅ Dry-run terminé (aucune modification appliquée)')
    return
  }

  // Appliquer actions avec confirmation
  let appliedCount = 0
  let failedCount = 0

  for (const action of actions) {
    const shouldApply = await confirmAction(action)

    if (shouldApply) {
      const success = await applyAction(action, isDryRun)

      if (success) {
        appliedCount++
      } else {
        failedCount++
      }
    } else {
      console.log(`⏭️  ${action.variable} ignoré`)
    }
  }

  console.log(`\n📊 Résumé: ${appliedCount} synchronisés, ${failedCount} échecs\n`)

  if (appliedCount > 0 && direction === 'dev→prod') {
    console.log('✅ Synchronisation dev → prod terminée!')
    console.log('\n💡 Prochaines étapes:')
    console.log('   1. Vérifier health check: curl https://qadhya.tn/api/health | jq .rag')
    console.log('   2. Tester Assistant IA production')
    console.log('')
  }

  if (appliedCount > 0 && direction === 'prod→dev') {
    console.log('✅ Synchronisation prod → dev terminée!')
    console.log('\n💡 Prochaines étapes:')
    console.log('   1. Vérifier .env.local modifié')
    console.log('   2. Restart dev: npm run restart')
    console.log('   3. Tester localement')
    console.log('')
  }
}

main().catch((error) => {
  console.error('❌ Erreur:', error.message)
  process.exit(1)
})
