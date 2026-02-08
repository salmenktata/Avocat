#!/usr/bin/env tsx
/**
 * Script de batch extraction des métadonnées structurées
 *
 * Extrait les métadonnées juridiques structurées pour tous les documents KB
 * Utilise le service extractStructuredMetadataV2() avec pipeline hybride
 *
 * Exécution:
 * ```bash
 * npx tsx scripts/extract-structured-metadata.ts [options]
 * ```
 *
 * Options:
 * --limit N : Limite le nombre de documents à traiter
 * --category CAT : Filtre par catégorie (jurisprudence, code, doctrine)
 * --force : Force la ré-extraction même si métadonnées déjà extraites
 * --regex-only : Utilise seulement l'extraction regex (rapide)
 * --llm-only : Utilise seulement l'extraction LLM (précis mais lent)
 */

import { db } from '@/lib/db/postgres'
import { extractStructuredMetadataV2 } from '@/lib/knowledge-base/structured-metadata-extractor-service'
import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// CONFIGURATION
// =============================================================================

interface ScriptOptions {
  limit?: number
  category?: string
  force: boolean
  regexOnly: boolean
  llmOnly: boolean
  batchSize: number
}

const DEFAULT_OPTIONS: ScriptOptions = {
  force: false,
  regexOnly: false,
  llmOnly: false,
  batchSize: 10, // Traiter 10 documents à la fois
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
    } else if (arg === '--force') {
      options.force = true
    } else if (arg === '--regex-only') {
      options.regexOnly = true
    } else if (arg === '--llm-only') {
      options.llmOnly = true
    } else if (arg === '--batch-size') {
      options.batchSize = parseInt(process.argv[++i], 10)
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return options
}

function printHelp() {
  console.log(`
Script d'extraction de métadonnées structurées

Usage:
  npx tsx scripts/extract-structured-metadata.ts [options]

Options:
  --limit N         Limite le nombre de documents à traiter
  --category CAT    Filtre par catégorie (jurisprudence, code, doctrine)
  --force           Force la ré-extraction même si métadonnées déjà extraites
  --regex-only      Utilise seulement l'extraction regex (rapide)
  --llm-only        Utilise seulement l'extraction LLM (précis mais lent)
  --batch-size N    Nombre de documents traités en parallèle (défaut: 10)
  --help, -h        Affiche cette aide

Exemples:
  # Extraire métadonnées pour tous les documents
  npx tsx scripts/extract-structured-metadata.ts

  # Extraire seulement pour jurisprudence (premiers 50)
  npx tsx scripts/extract-structured-metadata.ts --category jurisprudence --limit 50

  # Re-extraire avec regex seulement (rapide)
  npx tsx scripts/extract-structured-metadata.ts --force --regex-only

  # Extraction précise avec LLM (lent)
  npx tsx scripts/extract-structured-metadata.ts --llm-only --limit 10
`)
}

// =============================================================================
// STATISTIQUES
// =============================================================================

interface ExtractionStats {
  total: number
  success: number
  errors: number
  skipped: number
  startTime: number
  endTime?: number
  byCategory: Record<string, { success: number; errors: number }>
}

const stats: ExtractionStats = {
  total: 0,
  success: 0,
  errors: 0,
  skipped: 0,
  startTime: Date.now(),
  byCategory: {},
}

// =============================================================================
// FONCTION PRINCIPALE
// =============================================================================

async function main() {
  console.log('='.repeat(80))
  console.log('Extraction de Métadonnées Structurées - Batch Processing')
  console.log('='.repeat(80))
  console.log()

  const options = parseArgs()

  console.log('Configuration:')
  console.log(`  - Limite: ${options.limit || 'Aucune'}`)
  console.log(`  - Catégorie: ${options.category || 'Toutes'}`)
  console.log(`  - Force ré-extraction: ${options.force ? 'Oui' : 'Non'}`)
  console.log(`  - Mode: ${options.regexOnly ? 'Regex uniquement' : options.llmOnly ? 'LLM uniquement' : 'Hybride (regex + LLM)'}`)
  console.log(`  - Batch size: ${options.batchSize}`)
  console.log()

  // 1. Récupérer la liste des documents KB à traiter
  console.log('Récupération des documents...')

  let query = `
    SELECT
      kb.id,
      kb.title,
      kb.category,
      meta.id AS has_metadata
    FROM knowledge_base kb
    LEFT JOIN kb_structured_metadata meta ON kb.id = meta.knowledge_base_id
    WHERE kb.is_indexed = true
  `

  const queryParams: any[] = []
  let paramIndex = 1

  // Filtrer par catégorie
  if (options.category) {
    query += ` AND kb.category = $${paramIndex}`
    queryParams.push(options.category)
    paramIndex++
  }

  // Filtrer documents sans métadonnées (sauf si force)
  if (!options.force) {
    query += ` AND meta.id IS NULL`
  }

  query += ` ORDER BY kb.indexed_at DESC`

  // Limiter le nombre
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

  // 2. Traiter les documents par batch
  console.log('Début de l\'extraction...\n')

  for (let i = 0; i < documents.length; i += options.batchSize) {
    const batch = documents.slice(i, i + options.batchSize)
    const batchNum = Math.floor(i / options.batchSize) + 1
    const totalBatches = Math.ceil(documents.length / options.batchSize)

    console.log(`[Batch ${batchNum}/${totalBatches}] Traitement ${batch.length} documents...`)

    // Traiter le batch en parallèle
    await Promise.all(
      batch.map(async (doc) => {
        try {
          const result = await extractStructuredMetadataV2(doc.id, {
            forceReextract: options.force,
            useRegexOnly: options.regexOnly,
            useLLMOnly: options.llmOnly,
          })

          if (result.success) {
            stats.success++
            console.log(`  ✓ ${doc.title} (confiance: ${Math.round((result.metadata?.extractionConfidence || 0) * 100)}%)`)

            // Stats par catégorie
            if (!stats.byCategory[doc.category]) {
              stats.byCategory[doc.category] = { success: 0, errors: 0 }
            }
            stats.byCategory[doc.category].success++
          } else {
            stats.errors++
            console.error(`  ✗ ${doc.title} - Erreurs: ${result.errors.join(', ')}`)

            if (!stats.byCategory[doc.category]) {
              stats.byCategory[doc.category] = { success: 0, errors: 0 }
            }
            stats.byCategory[doc.category].errors++
          }

          if (result.warnings.length > 0) {
            console.warn(`    ⚠ Avertissements: ${result.warnings.join(', ')}`)
          }
        } catch (error) {
          stats.errors++
          console.error(`  ✗ ${doc.title} - Exception: ${error instanceof Error ? error.message : error}`)

          if (!stats.byCategory[doc.category]) {
            stats.byCategory[doc.category] = { success: 0, errors: 0 }
          }
          stats.byCategory[doc.category].errors++
        }
      })
    )

    console.log()
  }

  stats.endTime = Date.now()

  // 3. Afficher les statistiques finales
  console.log('='.repeat(80))
  console.log('RÉSUMÉ')
  console.log('='.repeat(80))
  console.log()
  console.log(`Total documents traités: ${stats.total}`)
  console.log(`✓ Succès: ${stats.success} (${Math.round((stats.success / stats.total) * 100)}%)`)
  console.log(`✗ Erreurs: ${stats.errors} (${Math.round((stats.errors / stats.total) * 100)}%)`)
  console.log()

  console.log('Par catégorie:')
  for (const [category, catStats] of Object.entries(stats.byCategory)) {
    const total = catStats.success + catStats.errors
    console.log(`  ${category}: ${catStats.success}/${total} réussis (${Math.round((catStats.success / total) * 100)}%)`)
  }
  console.log()

  const durationMs = stats.endTime - stats.startTime
  const durationSec = Math.round(durationMs / 1000)
  const avgTimePerDoc = Math.round(durationMs / stats.total)
  console.log(`Durée totale: ${durationSec}s (${avgTimePerDoc}ms/document en moyenne)`)
  console.log()

  // 4. Exporter le rapport
  const reportDir = path.join(process.cwd(), 'reports')
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  const reportPath = path.join(
    reportDir,
    `metadata-extraction-${new Date().toISOString().split('T')[0]}.json`
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

  // Exit code selon résultats
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
