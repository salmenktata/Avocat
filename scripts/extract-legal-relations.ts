#!/usr/bin/env tsx
/**
 * Script de batch extraction des relations juridiques
 *
 * Extrait les relations entre documents juridiques (citations, abrogations, etc.)
 *
 * Exécution:
 * ```bash
 * npx tsx scripts/extract-legal-relations.ts [options]
 * ```
 *
 * Options:
 * --limit N : Limite le nombre de documents à traiter
 * --category CAT : Filtre par catégorie (jurisprudence, code)
 * --regex-only : Utilise seulement regex (rapide)
 * --llm-only : Utilise seulement LLM (précis mais lent)
 */

import { db } from '@/lib/db/postgres'
import { extractLegalRelations } from '@/lib/knowledge-base/legal-relations-extractor-service'
import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// CONFIGURATION
// =============================================================================

interface ScriptOptions {
  limit?: number
  category?: string
  regexOnly: boolean
  llmOnly: boolean
}

const DEFAULT_OPTIONS: ScriptOptions = {
  regexOnly: false,
  llmOnly: false,
}

// =============================================================================
// PARSING ARGUMENTS
// =============================================================================

function parseArgs(): ScriptOptions {
  const options = { ...DEFAULT_OPTIONS }

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]

    if (arg === '--limit') {
      options.limit = parseInt(process.argv[++i], 10)
    } else if (arg === '--category') {
      options.category = process.argv[++i]
    } else if (arg === '--regex-only') {
      options.regexOnly = true
    } else if (arg === '--llm-only') {
      options.llmOnly = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return options
}

function printHelp() {
  console.log(`
Script d'extraction de relations juridiques

Usage:
  npx tsx scripts/extract-legal-relations.ts [options]

Options:
  --limit N         Limite le nombre de documents à traiter
  --category CAT    Filtre par catégorie (jurisprudence, code)
  --regex-only      Utilise seulement regex (rapide)
  --llm-only        Utilise seulement LLM (précis mais lent)
  --help, -h        Affiche cette aide

Exemples:
  # Extraire relations pour jurisprudence (regex seulement, rapide)
  npx tsx scripts/extract-legal-relations.ts --category jurisprudence --regex-only

  # Extraction précise avec LLM (premiers 20)
  npx tsx scripts/extract-legal-relations.ts --llm-only --limit 20
`)
}

// =============================================================================
// STATISTIQUES
// =============================================================================

interface ExtractionStats {
  total: number
  success: number
  errors: number
  totalRelations: number
  startTime: number
  endTime?: number
}

const stats: ExtractionStats = {
  total: 0,
  success: 0,
  errors: 0,
  totalRelations: 0,
  startTime: Date.now(),
}

// =============================================================================
// FONCTION PRINCIPALE
// =============================================================================

async function main() {
  console.log('='.repeat(80))
  console.log('Extraction de Relations Juridiques - Batch Processing')
  console.log('='.repeat(80))
  console.log()

  const options = parseArgs()

  console.log('Configuration:')
  console.log(`  - Limite: ${options.limit || 'Aucune'}`)
  console.log(`  - Catégorie: ${options.category || 'Toutes'}`)
  console.log(`  - Mode: ${options.regexOnly ? 'Regex uniquement' : options.llmOnly ? 'LLM uniquement' : 'Hybride'}`)
  console.log()

  // 1. Récupérer la liste des documents
  console.log('Récupération des documents...')

  let query = `
    SELECT id, title, category
    FROM knowledge_base
    WHERE is_indexed = true
      AND category IN ('jurisprudence', 'code', 'législation')
  `

  const queryParams: any[] = []
  let paramIndex = 1

  if (options.category) {
    query += ` AND category = $${paramIndex}`
    queryParams.push(options.category)
    paramIndex++
  }

  query += ` ORDER BY indexed_at DESC`

  if (options.limit) {
    query += ` LIMIT $${paramIndex}`
    queryParams.push(options.limit)
  }

  const result = await db.query(query, queryParams)
  const documents = result.rows

  console.log(`✓ ${documents.length} documents à traiter\n`)

  if (documents.length === 0) {
    console.log('Aucun document à traiter.')
    await db.closePool()
    return
  }

  stats.total = documents.length

  // 2. Traiter séquentiellement (évite surcharge)
  console.log('Début de l\'extraction des relations...\n')

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]
    console.log(`[${i + 1}/${documents.length}] ${doc.title}`)

    try {
      const result = await extractLegalRelations(doc.id, {
        useRegexOnly: options.regexOnly,
        useLLMOnly: options.llmOnly,
      })

      if (result.success) {
        stats.success++
        stats.totalRelations += result.relations.length
        console.log(`  ✓ ${result.relations.length} relations détectées`)
      } else {
        stats.errors++
        console.error(`  ✗ Erreurs: ${result.errors.join(', ')}`)
      }
    } catch (error) {
      stats.errors++
      console.error(`  ✗ Exception: ${error instanceof Error ? error.message : error}`)
    }
  }

  stats.endTime = Date.now()

  // 3. Afficher les statistiques finales
  console.log()
  console.log('='.repeat(80))
  console.log('RÉSUMÉ')
  console.log('='.repeat(80))
  console.log()
  console.log(`Total documents traités: ${stats.total}`)
  console.log(`✓ Succès: ${stats.success} (${Math.round((stats.success / stats.total) * 100)}%)`)
  console.log(`✗ Erreurs: ${stats.errors} (${Math.round((stats.errors / stats.total) * 100)}%)`)
  console.log(`🔗 Total relations créées: ${stats.totalRelations}`)
  console.log(`   Moyenne: ${Math.round(stats.totalRelations / stats.success)} relations/document`)
  console.log()

  const durationMs = stats.endTime - stats.startTime
  const durationSec = Math.round(durationMs / 1000)
  console.log(`Durée totale: ${durationSec}s (${Math.round(durationMs / stats.total)}ms/document)`)
  console.log()

  // 4. Exporter le rapport
  const reportDir = path.join(process.cwd(), 'reports')
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  const reportPath = path.join(
    reportDir,
    `legal-relations-${new Date().toISOString().split('T')[0]}.json`
  )

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        ...stats,
        options,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  )

  console.log(`Rapport sauvegardé: ${reportPath}`)
  console.log()

  // Fermer la connexion DB
  await db.closePool()

  process.exit(stats.errors > 0 ? 1 : 0)
}

// =============================================================================
// POINT D'ENTRÉE
// =============================================================================

if (require.main === module) {
  main().catch((error) => {
    console.error('Erreur fatale:', error)
    process.exit(1)
  })
}

export { main }
