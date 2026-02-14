#!/usr/bin/env tsx
/**
 * Script d'audit des divergences entre .env.production et .env.production.template
 *
 * Détecte:
 * - Variables manquantes dans l'un ou l'autre fichier
 * - Valeurs divergentes (classées par severity: CRITICAL, HIGH, MEDIUM, LOW)
 * - Placeholders non remplacés (CHANGE_ME, YOUR_*_HERE)
 *
 * Output: Table formatée + JSON pour CI/CD
 * Exit 1 si divergences CRITICAL détectées
 *
 * Usage:
 *   npx tsx scripts/audit-env-divergences.ts
 *   npx tsx scripts/audit-env-divergences.ts --output=json
 */

import fs from 'fs/promises'
import path from 'path'

// Types
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

interface Divergence {
  variable: string
  severity: Severity
  prodValue: string | null
  templateValue: string | null
  status: 'MISSING_PROD' | 'MISSING_TEMPLATE' | 'VALUE_DIFFERS' | 'PLACEHOLDER_NOT_REPLACED'
  impact?: string
  recommendation?: string
}

interface AuditResult {
  timestamp: string
  totalVars: number
  divergences: Divergence[]
  critical: number
  high: number
  medium: number
  low: number
  hasCritical: boolean
}

// Configuration des variables critiques
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

const MEDIUM_VARS = [
  'RAG_MAX_RESULTS',
  'RAG_SIMILARITY_THRESHOLD',
  'RAG_CHUNK_SIZE',
  'AI_MONTHLY_QUOTA_DEFAULT',
  'BREVO_API_KEY',
  'RESEND_API_KEY',
]

// Placeholders à détecter
const PLACEHOLDER_PATTERNS = [
  /CHANGE_ME/i,
  /YOUR_.*_HERE/i,
  /^sk-ant-api03-$/,
  /^gsk_$/,
  /^sk-proj-$/,
]

/**
 * Parse un fichier .env et retourne Map<variable, valeur>
 */
async function parseEnvFile(filePath: string): Promise<Map<string, string>> {
  const content = await fs.readFile(filePath, 'utf-8')
  const vars = new Map<string, string>()

  content.split('\n').forEach((line) => {
    // Ignorer commentaires et lignes vides
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    // Parser variable=valeur
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) {
      const [, key, value] = match
      vars.set(key, value)
    }
  })

  return vars
}

/**
 * Détermine la severity d'une variable
 */
function getSeverity(varName: string): Severity {
  if (CRITICAL_VARS.includes(varName)) return 'CRITICAL'
  if (HIGH_VARS.includes(varName)) return 'HIGH'
  if (MEDIUM_VARS.includes(varName)) return 'MEDIUM'
  return 'LOW'
}

/**
 * Vérifie si une valeur contient un placeholder
 */
function hasPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))
}

/**
 * Génère message d'impact selon la variable et divergence
 */
function getImpact(varName: string, status: Divergence['status']): string {
  const impacts: Record<string, string> = {
    OLLAMA_ENABLED:
      "Assistant IA non-fonctionnel (retourne 'لم أجد وثائق ذات صلة' malgré KB indexée)",
    OLLAMA_BASE_URL:
      'Ollama inaccessible depuis container Docker (localhost pointe vers container)',
    RAG_ENABLED: 'Système RAG désactivé, recherche sémantique non disponible',
    DATABASE_URL: 'Application ne peut pas se connecter à PostgreSQL',
    NEXTAUTH_SECRET: 'Authentification utilisateurs compromise',
    GROQ_API_KEY: 'LLM primaire indisponible (fallback vers modèles moins performants)',
    OPENAI_API_KEY: 'Embeddings cloud indisponibles (fallback vers Ollama requis)',
  }

  return impacts[varName] || `Configuration potentiellement incohérente (${varName})`
}

/**
 * Génère recommandation de fix
 */
function getRecommendation(
  varName: string,
  templateValue: string | null,
  status: Divergence['status']
): string {
  if (status === 'MISSING_PROD') {
    return `Ajouter dans .env.production: ${varName}=${templateValue}`
  }

  if (status === 'MISSING_TEMPLATE') {
    return `Documenter dans .env.production.template (ou retirer de .env.production si obsolète)`
  }

  if (status === 'PLACEHOLDER_NOT_REPLACED') {
    return `Remplacer placeholder par valeur réelle (voir docs/ENV_VARIABLES_REFERENCE.md)`
  }

  if (status === 'VALUE_DIFFERS') {
    return `Vérifier si divergence intentionnelle, sinon: npm run sync:env`
  }

  return ''
}

/**
 * Compare deux fichiers .env et détecte divergences
 */
async function auditDivergences(
  prodFile: string,
  templateFile: string
): Promise<AuditResult> {
  const prodVars = await parseEnvFile(prodFile)
  const templateVars = await parseEnvFile(templateFile)

  const allVars = new Set([...prodVars.keys(), ...templateVars.keys()])
  const divergences: Divergence[] = []

  for (const varName of allVars) {
    const prodValue = prodVars.get(varName) || null
    const templateValue = templateVars.get(varName) || null

    // Cas 1: Variable manquante dans .env.production
    if (!prodValue && templateValue) {
      divergences.push({
        variable: varName,
        severity: getSeverity(varName),
        prodValue: null,
        templateValue,
        status: 'MISSING_PROD',
        impact: getImpact(varName, 'MISSING_PROD'),
        recommendation: getRecommendation(varName, templateValue, 'MISSING_PROD'),
      })
      continue
    }

    // Cas 2: Variable manquante dans template
    if (prodValue && !templateValue) {
      divergences.push({
        variable: varName,
        severity: getSeverity(varName),
        prodValue,
        templateValue: null,
        status: 'MISSING_TEMPLATE',
        impact: getImpact(varName, 'MISSING_TEMPLATE'),
        recommendation: getRecommendation(varName, null, 'MISSING_TEMPLATE'),
      })
      continue
    }

    // Cas 3: Valeurs différentes
    if (prodValue && templateValue && prodValue !== templateValue) {
      // Ignorer si template a placeholder et prod a valeur réelle
      const templateHasPlaceholder = hasPlaceholder(templateValue)
      const prodHasRealValue = !hasPlaceholder(prodValue)

      // Divergence OK si template = placeholder et prod = valeur réelle
      if (templateHasPlaceholder && prodHasRealValue) {
        continue
      }

      // Divergence critique si prod a placeholder non remplacé
      if (hasPlaceholder(prodValue)) {
        divergences.push({
          variable: varName,
          severity: getSeverity(varName),
          prodValue,
          templateValue,
          status: 'PLACEHOLDER_NOT_REPLACED',
          impact: `Secret non configuré: ${varName}`,
          recommendation: getRecommendation(varName, templateValue, 'PLACEHOLDER_NOT_REPLACED'),
        })
        continue
      }

      // Divergence réelle (2 valeurs configurées différentes)
      divergences.push({
        variable: varName,
        severity: getSeverity(varName),
        prodValue,
        templateValue,
        status: 'VALUE_DIFFERS',
        impact: getImpact(varName, 'VALUE_DIFFERS'),
        recommendation: getRecommendation(varName, templateValue, 'VALUE_DIFFERS'),
      })
    }
  }

  // Statistiques
  const critical = divergences.filter((d) => d.severity === 'CRITICAL').length
  const high = divergences.filter((d) => d.severity === 'HIGH').length
  const medium = divergences.filter((d) => d.severity === 'MEDIUM').length
  const low = divergences.filter((d) => d.severity === 'LOW').length

  return {
    timestamp: new Date().toISOString(),
    totalVars: allVars.size,
    divergences: divergences.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    }),
    critical,
    high,
    medium,
    low,
    hasCritical: critical > 0,
  }
}

/**
 * Affiche résultat formaté en console
 */
function displayResults(result: AuditResult): void {
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║          Audit Divergences Env (Dev ↔ Template)          ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  console.log(`📊 Résumé: ${result.totalVars} variables analysées`)
  console.log(
    `   ${result.divergences.length} divergences détectées (${result.critical} CRITICAL, ${result.high} HIGH, ${result.medium} MEDIUM, ${result.low} LOW)\n`
  )

  if (result.divergences.length === 0) {
    console.log('✅ Aucune divergence détectée - Configuration alignée!\n')
    return
  }

  // Afficher divergences par severity
  const severities: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

  severities.forEach((severity) => {
    const divs = result.divergences.filter((d) => d.severity === severity)
    if (divs.length === 0) return

    const emoji = severity === 'CRITICAL' ? '🚨' : severity === 'HIGH' ? '⚠️' : 'ℹ️'
    const title = `${emoji} ${severity} (${divs.length})`

    console.log(title)
    console.log('━'.repeat(60))

    divs.forEach((div) => {
      console.log(`\n${div.variable}`)
      console.log(`  Status: ${div.status}`)
      if (div.prodValue !== null) {
        const displayValue =
          div.prodValue.length > 50 ? div.prodValue.slice(0, 50) + '...' : div.prodValue
        console.log(`  Prod:     ${displayValue}`)
      } else {
        console.log(`  Prod:     (manquant)`)
      }
      if (div.templateValue !== null) {
        const displayValue =
          div.templateValue.length > 50 ? div.templateValue.slice(0, 50) + '...' : div.templateValue
        console.log(`  Template: ${displayValue}`)
      } else {
        console.log(`  Template: (manquant)`)
      }
      if (div.impact) {
        console.log(`  Impact:   ${div.impact}`)
      }
      if (div.recommendation) {
        console.log(`  Fix:      ${div.recommendation}`)
      }
    })

    console.log('')
  })

  // Actions recommandées
  if (result.hasCritical) {
    console.log('╔═══════════════════════════════════════════════════════════╗')
    console.log('║               🚨 ACTIONS REQUISES IMMÉDIATEMENT           ║')
    console.log('╚═══════════════════════════════════════════════════════════╝\n')
    console.log('1. Corriger divergences CRITICAL:')
    console.log('   npm run sync:env\n')
    console.log('2. Valider configuration RAG:')
    console.log('   bash scripts/validate-rag-config.sh .env.production\n')
    console.log('3. Tester health check:')
    console.log('   curl http://localhost:7002/api/health | jq .rag\n')
  }
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2)
  const outputFormat = args.find((arg) => arg.startsWith('--output='))?.split('=')[1] || 'console'

  const rootDir = path.join(__dirname, '..')
  const prodFile = path.join(rootDir, '.env.production')
  const templateFile = path.join(rootDir, '.env.production.template')

  // Vérifier fichiers existent
  try {
    await fs.access(prodFile)
  } catch {
    console.error(`❌ Fichier non trouvé: ${prodFile}`)
    process.exit(1)
  }

  try {
    await fs.access(templateFile)
  } catch {
    console.error(`❌ Fichier non trouvé: ${templateFile}`)
    process.exit(1)
  }

  // Audit
  const result = await auditDivergences(prodFile, templateFile)

  // Output
  if (outputFormat === 'json') {
    console.log(JSON.stringify(result, null, 2))
  } else {
    displayResults(result)
  }

  // Exit code
  if (result.hasCritical) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Erreur:', error.message)
  process.exit(1)
})
