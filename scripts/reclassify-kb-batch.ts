#!/usr/bin/env tsx
/**
 * Script de reclassification batch de la base de connaissances
 *
 * Objectif : Reclasser les 8 735 documents KB selon leur contenu réel
 *           en utilisant UNIQUEMENT la classification IA (legal_classifications)
 *
 * Principe : ❌ PAS de fallback vers web_source.category
 *           ✅ Classification pure par contenu (primary_category)
 *
 * Usage : npx tsx scripts/reclassify-kb-batch.ts [--dry-run] [--limit=N]
 */

import { db } from '@/lib/db/postgres'
import type { LegalCategory } from '@/lib/categories/legal-categories'

// =============================================================================
// CONFIGURATION
// =============================================================================

const BATCH_SIZE = 50 // Traiter 50 docs par batch
const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT_ARG = process.argv.find(arg => arg.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : undefined

// =============================================================================
// TYPES
// =============================================================================

interface KBDocument {
  kb_id: string
  old_category: LegalCategory
  source_file: string
  page_id: string | null
}

interface Classification {
  primary_category: LegalCategory
  confidence_score: number
  signals_used: string[] | null
}

interface Stats {
  total: number
  reclassified: number
  unchanged: number
  needs_review: number
  by_category: Record<LegalCategory, number>
  errors: number
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Détermine la catégorie KB basée UNIQUEMENT sur le contenu (classification IA)
 * Même logique que web-indexer-service.ts
 */
function determineCategoryForKB(
  classification: Classification | null
): LegalCategory {
  // Cas 1 : Classification IA disponible → utiliser primary_category
  if (classification?.primary_category) {
    return classification.primary_category
  }

  // Cas 2 : Pas de classification → "autre" + flag review
  return 'autre'
}

/**
 * Découpe un array en chunks
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Calcule un pourcentage formaté
 */
function pct(value: number, total: number): string {
  return total === 0 ? '0.0' : ((value / total) * 100).toFixed(1)
}

// =============================================================================
// RECLASSIFICATION
// =============================================================================

async function reclassifyKnowledgeBase(): Promise<Stats> {
  console.log('\n🔄 RECLASSIFICATION BATCH KB - Classification Pure par Contenu\n')
  console.log(`Mode : ${DRY_RUN ? '🔍 DRY RUN (aucune modification)' : '✍️  WRITE (modifications effectives)'}`)
  if (LIMIT) console.log(`Limite : ${LIMIT} documents`)
  console.log('')

  // Initialiser les stats
  const stats: Stats = {
    total: 0,
    reclassified: 0,
    unchanged: 0,
    needs_review: 0,
    by_category: {} as Record<LegalCategory, number>,
    errors: 0,
  }

  // 1. Récupérer tous les docs KB avec leur page_id source
  console.log('📊 Récupération des documents KB...')
  let sql = `
    SELECT
      kb.id as kb_id,
      kb.category as old_category,
      kb.source_file,
      wp.id as page_id
    FROM knowledge_base kb
    LEFT JOIN web_pages wp ON kb.source_file = wp.url
    WHERE kb.source_type = 'web'
      AND kb.is_active = true
  `

  if (LIMIT) {
    sql += ` LIMIT ${LIMIT}`
  }

  const docsResult = await db.query(sql)
  const docs = docsResult.rows as KBDocument[]

  stats.total = docs.length
  console.log(`✅ ${stats.total} documents à traiter\n`)

  // 2. Traitement par batch
  const batches = chunk(docs, BATCH_SIZE)
  let processed = 0

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    console.log(`📦 Batch ${i + 1}/${batches.length} (${batch.length} docs)...`)

    await Promise.all(
      batch.map(async (doc) => {
        try {
          // 3. Récupérer classification IA existante
          let classification: Classification | null = null

          if (doc.page_id) {
            const classifResult = await db.query(
              `SELECT primary_category, confidence_score, signals_used
               FROM legal_classifications
               WHERE page_id = $1`,
              [doc.page_id]
            )

            if (classifResult.rows.length > 0) {
              const row = classifResult.rows[0]
              classification = {
                primary_category: row.primary_category,
                confidence_score: row.confidence_score || 0,
                signals_used: row.signals_used,
              }
            }
          }

          // 4. Déterminer nouvelle catégorie (classification IA pure)
          const newCategory = determineCategoryForKB(classification)

          // 5. Update KB si changement
          if (newCategory !== doc.old_category) {
            if (!DRY_RUN) {
              await db.query(
                `UPDATE knowledge_base
                 SET
                   category = $1,
                   metadata = jsonb_set(
                     COALESCE(metadata, '{}'::jsonb),
                     '{classification_source}',
                     $2
                   ),
                   metadata = jsonb_set(
                     metadata,
                     '{old_category}',
                     $3
                   ),
                   metadata = jsonb_set(
                     metadata,
                     '{reclassified_at}',
                     $4
                   ),
                   metadata = jsonb_set(
                     metadata,
                     '{needs_review}',
                     $5
                   ),
                   metadata = jsonb_set(
                     metadata,
                     '{classification_confidence}',
                     $6
                   ),
                   updated_at = NOW()
                 WHERE id = $7`,
                [
                  newCategory,
                  JSON.stringify(classification ? 'ai' : 'default'),
                  JSON.stringify(doc.old_category),
                  JSON.stringify(new Date().toISOString()),
                  JSON.stringify(!classification),
                  JSON.stringify(classification?.confidence_score || null),
                  doc.kb_id,
                ]
              )
            }

            stats.reclassified++
            stats.by_category[newCategory] = (stats.by_category[newCategory] || 0) + 1

            if (!classification) {
              stats.needs_review++
            }
          } else {
            stats.unchanged++
          }
        } catch (error) {
          console.error(`❌ Erreur doc ${doc.kb_id}:`, error)
          stats.errors++
        }
      })
    )

    processed += batch.length
    console.log(`   ✅ Traités : ${processed}/${stats.total} (${pct(processed, stats.total)}%)\n`)
  }

  return stats
}

// =============================================================================
// RAPPORT
// =============================================================================

function printReport(stats: Stats) {
  console.log('\n' + '='.repeat(60))
  console.log('📊 RECLASSIFICATION KB COMPLÉTÉE')
  console.log('='.repeat(60) + '\n')

  console.log(`Total documents     : ${stats.total}`)
  console.log(`Reclassifiés        : ${stats.reclassified} (${pct(stats.reclassified, stats.total)}%)`)
  console.log(`Inchangés           : ${stats.unchanged} (${pct(stats.unchanged, stats.total)}%)`)
  console.log(`Besoin review       : ${stats.needs_review} (${pct(stats.needs_review, stats.total)}%)`)
  console.log(`Erreurs             : ${stats.errors}`)

  console.log('\n📈 Distribution par catégorie :')
  const sorted = Object.entries(stats.by_category)
    .sort((a, b) => b[1] - a[1])

  sorted.forEach(([cat, count]) => {
    console.log(`   ${cat.padEnd(18)} : ${count.toString().padStart(5)} (${pct(count, stats.total)}%)`)
  })

  if (stats.needs_review > 0) {
    console.log('\n⚠️  ATTENTION :')
    console.log(`   ${stats.needs_review} documents nécessitent une review (catégorie "autre")`)
    console.log('   SQL pour audit :')
    console.log('   SELECT * FROM knowledge_base')
    console.log("   WHERE category = 'autre'")
    console.log("     AND metadata->>'needs_review' = 'true'")
  }

  console.log('\n' + '='.repeat(60) + '\n')
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  try {
    const stats = await reclassifyKnowledgeBase()
    printReport(stats)

    if (DRY_RUN) {
      console.log('💡 Relancez sans --dry-run pour appliquer les changements\n')
    }

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  }
}

main()
