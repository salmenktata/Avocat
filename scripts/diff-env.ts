#!/usr/bin/env tsx
/**
 * Outil de comparaison Dev ↔ Prod avec hash secrets
 *
 * Usage:
 *   npm run diff-env                    # Dev vs Prod
 *   npm run diff-env --verbose          # Mode détaillé
 *   npm run diff-env --check-connectivity  # Test API keys
 *   npm run diff-env --output=json      # JSON pour scripts
 *
 * Features:
 * - Compare .env.local (dev) vs /opt/qadhya/.env.production.local (VPS via SSH)
 * - Hash comparison secrets (SHA256 des 8 premiers + 4 derniers chars)
 * - Highlighting couleur par severity (rouge CRITICAL, jaune HIGH, bleu MEDIUM)
 * - Test connectivity optionnel (appels API réels pour vérifier clés valides)
 * - Suggestions actions automatiques (commandes fix-prod-config.sh)
 * - Détection placeholders non remplacés
 */

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Types
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type ComparisonStatus = 'IDENTICAL' | 'DIFFERENT' | 'MISSING_DEV' | 'MISSING_PROD'

interface EnvComparison {
  variable: string
  devValue: string | null
  prodValue: string | null
  devHash?: string
  prodHash?: string
  severity: Severity
  status: ComparisonStatus
  impact?: string
  recommendedAction?: string
  connectivityDev?: boolean
  connectivityProd?: boolean
}

// Configuration
const VPS_HOST = '84.247.165.187'
const VPS_USER = 'root'
const VPS_ENV_PATH = '/opt/qadhya/.env.production.local'

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
  'ENCRYPTION_KEY',
]

const MEDIUM_VARS = [
  'RAG_MAX_RESULTS',
  'RAG_SIMILARITY_THRESHOLD',
  'RAG_CHUNK_SIZE',
  'AI_MONTHLY_QUOTA_DEFAULT',
  'BREVO_API_KEY',
  'RESEND_API_KEY',
  'NEXT_PUBLIC_APP_URL',
]

const SECRET_PATTERNS = [
  /API_KEY/i,
  /SECRET/i,
  /PASSWORD/i,
  /TOKEN/i,
  /^ENCRYPTION_KEY$/,
]

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
 * Récupère .env production depuis VPS via SSH
 */
async function fetchProdEnv(): Promise<Map<string, string>> {
  try {
    console.log(`🔍 Récupération .env production depuis VPS (${VPS_HOST})...`)

    const { stdout } = await execAsync(
      `ssh ${VPS_USER}@${VPS_HOST} "cat ${VPS_ENV_PATH}" 2>/dev/null`,
      { timeout: 10000 }
    )

    return parseEnvContent(stdout)
  } catch (error) {
    console.error(`❌ Erreur récupération .env production:`, error)
    throw new Error(
      `Impossible de récupérer .env production depuis VPS. Vérifier SSH access: ssh ${VPS_USER}@${VPS_HOST}`
    )
  }
}

/**
 * Détermine severity d'une variable
 */
function getSeverity(varName: string): Severity {
  if (CRITICAL_VARS.includes(varName)) return 'CRITICAL'
  if (HIGH_VARS.includes(varName)) return 'HIGH'
  if (MEDIUM_VARS.includes(varName)) return 'MEDIUM'
  return 'LOW'
}

/**
 * Détermine si une variable est un secret
 */
function isSecret(varName: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(varName))
}

/**
 * Hash un secret pour comparaison sécurisée
 */
function hashSecret(value: string): string {
  if (value.length <= 8) return crypto.createHash('sha256').update(value).digest('hex').slice(0, 8)

  // Hash des 8 premiers + 4 derniers caractères
  const significant = value.slice(0, 8) + value.slice(-4)
  return crypto.createHash('sha256').update(significant).digest('hex').slice(0, 16)
}

/**
 * Masque un secret pour affichage
 */
function maskSecret(value: string): string {
  if (value.length <= 8) return '***'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

/**
 * Génère message d'impact
 */
function getImpact(varName: string, status: ComparisonStatus): string {
  const impacts: Record<string, string> = {
    OLLAMA_ENABLED:
      "Assistant IA potentiellement non-fonctionnel si prod=false",
    OLLAMA_BASE_URL:
      'Ollama inaccessible si localhost en production (contexte Docker)',
    RAG_ENABLED: 'Système RAG désactivé si false',
    DATABASE_URL: 'Connexion PostgreSQL différente',
    GROQ_API_KEY: 'API keys différentes (intentionnel ?)',
    OPENAI_API_KEY: 'API keys différentes (intentionnel ?)',
  }

  if (status === 'MISSING_PROD') {
    return `Variable manquante en production`
  }

  if (status === 'MISSING_DEV') {
    return `Variable manquante en dev (docs obsolète ?)`
  }

  return impacts[varName] || `Valeurs différentes entre dev et prod`
}

/**
 * Génère action recommandée
 */
function getRecommendedAction(
  varName: string,
  status: ComparisonStatus,
  prodValue: string | null
): string {
  if (status === 'MISSING_PROD') {
    return `Ajouter en production: bash scripts/fix-prod-config.sh ${varName} "VALEUR"`
  }

  if (status === 'MISSING_DEV') {
    return `Documenter dans .env.local ou retirer de production si obsolète`
  }

  if (status === 'DIFFERENT') {
    // Cas spécifiques avec fix automatique
    if (varName === 'OLLAMA_ENABLED' && prodValue === 'false') {
      return `Fix automatique: bash scripts/fix-prod-config.sh OLLAMA_ENABLED true`
    }

    if (varName === 'OLLAMA_BASE_URL' && prodValue?.includes('localhost')) {
      return `Fix automatique: bash scripts/fix-prod-config.sh OLLAMA_BASE_URL "http://host.docker.internal:11434"`
    }

    return `Vérifier si divergence intentionnelle, sinon synchroniser`
  }

  return ''
}

/**
 * Test connectivity API key
 */
async function testConnectivity(varName: string, apiKey: string): Promise<boolean> {
  try {
    // Test Groq
    if (varName === 'GROQ_API_KEY') {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    }

    // Test OpenAI
    if (varName === 'OPENAI_API_KEY') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    }

    // Test DeepSeek
    if (varName === 'DEEPSEEK_API_KEY') {
      const response = await fetch('https://api.deepseek.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    }

    // Autres providers: pas de test
    return true
  } catch {
    return false
  }
}

/**
 * Compare environnements dev et prod
 */
async function compareEnvironments(
  options: {
    verbose?: boolean
    checkConnectivity?: boolean
  } = {}
): Promise<EnvComparison[]> {
  const { verbose = false, checkConnectivity = false } = options

  // Charger .env.local (dev)
  const rootDir = path.join(__dirname, '..')
  const devEnvPath = path.join(rootDir, '.env.local')

  let devVars: Map<string, string>
  try {
    const devContent = await fs.readFile(devEnvPath, 'utf-8')
    devVars = parseEnvContent(devContent)
  } catch {
    console.warn(`⚠️  .env.local non trouvé, utilisation .env.production`)
    const fallbackPath = path.join(rootDir, '.env.production')
    const fallbackContent = await fs.readFile(fallbackPath, 'utf-8')
    devVars = parseEnvContent(fallbackContent)
  }

  // Charger .env production (VPS)
  const prodVars = await fetchProdEnv()

  // Comparer
  const allVars = new Set([...devVars.keys(), ...prodVars.keys()])
  const comparisons: EnvComparison[] = []

  for (const varName of allVars) {
    const devValue = devVars.get(varName) || null
    const prodValue = prodVars.get(varName) || null
    const secret = isSecret(varName)

    let status: ComparisonStatus
    if (!devValue && prodValue) {
      status = 'MISSING_DEV'
    } else if (devValue && !prodValue) {
      status = 'MISSING_PROD'
    } else if (devValue === prodValue) {
      status = 'IDENTICAL'
    } else {
      status = 'DIFFERENT'
    }

    // Skip identiques si pas verbose
    if (status === 'IDENTICAL' && !verbose) {
      continue
    }

    const comparison: EnvComparison = {
      variable: varName,
      devValue: secret && devValue ? maskSecret(devValue) : devValue,
      prodValue: secret && prodValue ? maskSecret(prodValue) : prodValue,
      severity: getSeverity(varName),
      status,
      impact: status !== 'IDENTICAL' ? getImpact(varName, status) : undefined,
      recommendedAction:
        status !== 'IDENTICAL' ? getRecommendedAction(varName, status, prodValue) : undefined,
    }

    // Hash secrets pour comparaison
    if (secret) {
      comparison.devHash = devValue ? hashSecret(devValue) : undefined
      comparison.prodHash = prodValue ? hashSecret(prodValue) : undefined
    }

    // Test connectivity si demandé
    if (checkConnectivity && varName.includes('API_KEY')) {
      if (devValue) {
        comparison.connectivityDev = await testConnectivity(varName, devValue)
      }
      if (prodValue && devValue !== prodValue) {
        // Récupérer valeur réelle depuis VPS (pas masquée)
        const realProdValue = prodVars.get(varName)
        if (realProdValue) {
          comparison.connectivityProd = await testConnectivity(varName, realProdValue)
        }
      }
    }

    comparisons.push(comparison)
  }

  return comparisons.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

/**
 * Affiche résultats formatés
 */
function displayResults(comparisons: EnvComparison[]): void {
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║          Dev ↔ Prod Environment Comparison                ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  const different = comparisons.filter((c) => c.status !== 'IDENTICAL')
  console.log(`📊 Summary: ${different.length} differences detected\n`)

  if (different.length === 0) {
    console.log('✅ Aucune différence détectée - Environnements alignés!\n')
    return
  }

  // Grouper par severity
  const severities: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

  severities.forEach((severity) => {
    const items = different.filter((c) => c.severity === severity)
    if (items.length === 0) return

    const emoji = severity === 'CRITICAL' ? '🚨' : severity === 'HIGH' ? '⚠️' : 'ℹ️'
    const title = `${emoji} ${severity} Differences (${items.length})`

    console.log(title)
    console.log('━'.repeat(60))

    items.forEach((item) => {
      console.log(`\n${item.variable}`)

      if (item.devValue !== null) {
        const value = item.devHash ? `${item.devValue} (hash: ${item.devHash})` : item.devValue
        console.log(`  Dev:  ${value}`)
        if (item.connectivityDev !== undefined) {
          const status = item.connectivityDev ? '✅ Valid' : '❌ Invalid'
          console.log(`        ${status}`)
        }
      } else {
        console.log(`  Dev:  (manquant)`)
      }

      if (item.prodValue !== null) {
        const value = item.prodHash ? `${item.prodValue} (hash: ${item.prodHash})` : item.prodValue
        console.log(`  Prod: ${value}`)
        if (item.connectivityProd !== undefined) {
          const status = item.connectivityProd ? '✅ Valid' : '❌ Invalid'
          console.log(`        ${status}`)
        }
      } else {
        console.log(`  Prod: (manquant)`)
      }

      if (item.impact) {
        console.log(`  Impact: ${item.impact}`)
      }

      if (item.recommendedAction) {
        console.log(`  Fix: ${item.recommendedAction}`)
      }
    })

    console.log('')
  })

  // Actions recommandées
  const criticalItems = different.filter((c) => c.severity === 'CRITICAL')
  if (criticalItems.length > 0) {
    console.log('╔═══════════════════════════════════════════════════════════╗')
    console.log('║                  Recommended Actions                       ║')
    console.log('╚═══════════════════════════════════════════════════════════╝\n')

    console.log('1. Fix CRITICAL differences:')
    criticalItems.forEach((item) => {
      if (item.recommendedAction) {
        console.log(`   ${item.recommendedAction}`)
      }
    })

    console.log('\n2. Review HIGH differences:')
    console.log('   # Keys intentionnellement différentes ? Documenter dans docs/ENV_DIFFERENCES.md\n')
  }
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2)

  const verbose = args.includes('--verbose')
  const checkConnectivity = args.includes('--check-connectivity')
  const outputFormat = args.find((arg) => arg.startsWith('--output='))?.split('=')[1] || 'console'

  try {
    const comparisons = await compareEnvironments({ verbose, checkConnectivity })

    if (outputFormat === 'json') {
      console.log(JSON.stringify(comparisons, null, 2))
    } else {
      displayResults(comparisons)
    }

    // Exit code
    const hasCritical = comparisons.some((c) => c.severity === 'CRITICAL' && c.status !== 'IDENTICAL')
    if (hasCritical) {
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Erreur:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
