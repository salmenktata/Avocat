#!/usr/bin/env tsx
/**
 * Script CLI de validation des variables d'environnement contre le schéma JSON
 *
 * Usage:
 *   npx tsx scripts/validate-env-schema.ts --env=.env.production
 *   npx tsx scripts/validate-env-schema.ts --env=.env.local --strict
 *   npx tsx scripts/validate-env-schema.ts --check-connectivity
 *   npx tsx scripts/validate-env-schema.ts --output=json
 *
 * Options:
 *   --env=FILE           Fichier .env à valider (défaut: .env.production)
 *   --strict             Mode strict (warnings bloquent aussi)
 *   --check-connectivity Tester connectivity API keys (appels réels)
 *   --output=json        Sortie JSON pour CI/CD (défaut: console)
 *   --environment=dev|prod  Environnement attendu (défaut: prod)
 */

import fs from 'fs/promises'
import path from 'path'
import { EnvSchemaValidator, type ValidationResult, type Severity } from '@/lib/config/env-schema-validator'

/**
 * Parse fichier .env
 */
async function parseEnvFile(filePath: string): Promise<Record<string, string>> {
  const content = await fs.readFile(filePath, 'utf-8')
  const vars: Record<string, string> = {}

  content.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) {
      const [, key, value] = match
      vars[key] = value
    }
  })

  return vars
}

/**
 * Affiche résultat formaté en console
 */
function displayResults(result: ValidationResult, envFile: string): void {
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║          Validation Schema Environnement                  ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  console.log(`📄 Fichier: ${envFile}`)
  console.log(
    `📊 Statistiques: ${result.stats.validatedVars}/${result.stats.totalVars} variables validées`
  )

  if (result.stats.missingRequired > 0) {
    console.log(`⚠️  ${result.stats.missingRequired} variables requises manquantes`)
  }

  if (result.stats.criticalIssues > 0) {
    console.log(`🚨 ${result.stats.criticalIssues} erreurs CRITICAL détectées\n`)
  } else {
    console.log('')
  }

  // Afficher erreurs
  if (result.errors.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('❌ ERREURS\n')

    const groupedErrors = groupBySeverity(result.errors)

    ;(['CRITICAL', 'ERROR', 'HIGH'] as Severity[]).forEach((severity) => {
      const errors = groupedErrors[severity] || []
      if (errors.length === 0) return

      const emoji = severity === 'CRITICAL' ? '🚨' : '❌'
      console.log(`${emoji} ${severity} (${errors.length})`)
      console.log('─'.repeat(60))

      errors.forEach((error) => {
        console.log(`\n  ${error.variable}`)
        console.log(`  ${error.message}`)
        if (error.validator) {
          console.log(`  Validateur: ${error.validator}`)
        }
      })

      console.log('')
    })
  }

  // Afficher warnings
  if (result.warnings.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⚠️  AVERTISSEMENTS\n')

    result.warnings.forEach((warning) => {
      console.log(`  ${warning.variable}`)
      console.log(`  ${warning.message}`)
      if (warning.value) {
        console.log(`  Valeur: ${warning.value}`)
      }
      console.log('')
    })
  }

  // Résultat final
  console.log('╔═══════════════════════════════════════════════════════════╗')
  if (result.valid) {
    console.log('║                 ✅ VALIDATION RÉUSSIE                     ║')
  } else {
    console.log('║                 ❌ VALIDATION ÉCHOUÉE                     ║')
  }
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  if (!result.valid) {
    console.log('💡 Actions recommandées:')
    if (result.stats.criticalIssues > 0) {
      console.log('   1. Corriger erreurs CRITICAL: npm run sync:env')
      console.log('   2. Valider configuration RAG: bash scripts/validate-rag-config.sh')
    }
    if (result.stats.missingRequired > 0) {
      console.log('   3. Ajouter variables requises manquantes')
    }
    console.log('')
  }
}

/**
 * Groupe erreurs par severity
 */
function groupBySeverity(
  errors: Array<{ severity: Severity; variable: string; message: string; validator?: string }>
): Record<Severity, typeof errors> {
  return errors.reduce(
    (acc, error) => {
      if (!acc[error.severity]) {
        acc[error.severity] = []
      }
      acc[error.severity].push(error)
      return acc
    },
    {} as Record<Severity, typeof errors>
  )
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  const envFileArg = args.find((arg) => arg.startsWith('--env='))?.split('=')[1]
  const strict = args.includes('--strict')
  const checkConnectivity = args.includes('--check-connectivity')
  const outputFormat = args.find((arg) => arg.startsWith('--output='))?.split('=')[1] || 'console'
  const environmentArg = args
    .find((arg) => arg.startsWith('--environment='))
    ?.split('=')[1] as 'dev' | 'prod' | undefined

  const rootDir = path.join(__dirname, '..')
  const envFile = envFileArg
    ? path.join(rootDir, envFileArg)
    : path.join(rootDir, '.env.production')
  const environment = environmentArg || 'prod'

  // Vérifier fichier existe
  try {
    await fs.access(envFile)
  } catch {
    console.error(`❌ Fichier non trouvé: ${envFile}`)
    console.error('\nUsage:')
    console.error('  npx tsx scripts/validate-env-schema.ts --env=.env.production')
    process.exit(1)
  }

  // Parse .env
  const envVars = await parseEnvFile(envFile)

  // Validation
  const validator = new EnvSchemaValidator()
  const result = await validator.validate(envVars, {
    strict,
    checkConnectivity,
    environment,
  })

  // Output
  if (outputFormat === 'json') {
    console.log(JSON.stringify(result, null, 2))
  } else {
    displayResults(result, envFile)
  }

  // Exit code
  if (!result.valid) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Erreur:', error.message)
  console.error(error.stack)
  process.exit(1)
})
