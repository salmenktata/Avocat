#!/usr/bin/env tsx
/**
 * Script de validation de la reclassification KB
 *
 * Objectif : Vérifier la qualité de la reclassification par contenu
 *           - Distribution des catégories (équilibre)
 *           - Échantillons manuels
 *           - Impact RAG
 *
 * Usage : npx tsx scripts/validate-reclassification.ts [--samples=N]
 */

import { db } from '@/lib/db/postgres'
import type { LegalCategory } from '@/lib/categories/legal-categories'
import { LEGAL_CATEGORY_TRANSLATIONS } from '@/lib/categories/legal-categories'

// =============================================================================
// CONFIGURATION
// =============================================================================

const SAMPLES_ARG = process.argv.find(arg => arg.startsWith('--samples='))
const SAMPLES_COUNT = SAMPLES_ARG ? parseInt(SAMPLES_ARG.split('=')[1], 10) : 20

// =============================================================================
// TYPES
// =============================================================================

interface CategoryStats {
  category: LegalCategory
  count: number
  pct: number
}

interface Sample {
  id: string
  title: string
  new_category: LegalCategory
  old_category: LegalCategory | null
  confidence: number | null
  url: string
}

// =============================================================================
// VALIDATION 1 : DISTRIBUTION DES CATÉGORIES
// =============================================================================

async function validateDistribution(): Promise<void> {
  console.log('\n📊 VALIDATION 1 : Distribution des catégories\n')

  const result = await db.query<CategoryStats>(`
    SELECT
      category,
      COUNT(*) as count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
    FROM knowledge_base
    WHERE source_type = 'web'
      AND is_active = true
    GROUP BY category
    ORDER BY COUNT(*) DESC
  `)

  const stats = result.rows

  console.log('Distribution actuelle :')
  console.log('─'.repeat(60))
  stats.forEach(row => {
    const label = LEGAL_CATEGORY_TRANSLATIONS[row.category]?.fr || row.category
    const bar = '█'.repeat(Math.round(row.pct / 2))
    console.log(`${label.padEnd(20)} : ${row.count.toString().padStart(5)} (${row.pct.toString().padStart(5)}%) ${bar}`)
  })
  console.log('─'.repeat(60))

  // Analyse d'équilibre
  const maxPct = Math.max(...stats.map(s => s.pct))
  const activeCategories = stats.filter(s => s.count > 10).length

  console.log('\n📈 Analyse :')
  console.log(`   Catégories actives (>10 docs) : ${activeCategories}`)
  console.log(`   Catégorie dominante           : ${maxPct}%`)

  if (maxPct > 40) {
    console.log(`   ⚠️  ATTENTION : Catégorie dominante > 40% (déséquilibre)`)
  } else if (maxPct > 30) {
    console.log(`   ⚠️  Catégorie dominante > 30% (léger déséquilibre)`)
  } else {
    console.log(`   ✅ Distribution équilibrée (aucune catégorie > 30%)`)
  }

  // Documents à review
  const needsReviewResult = await db.query(`
    SELECT COUNT(*) as count
    FROM knowledge_base
    WHERE source_type = 'web'
      AND is_active = true
      AND metadata->>'needs_review' = 'true'
  `)

  const needsReviewCount = parseInt(needsReviewResult.rows[0]?.count || '0')
  const needsReviewPct = stats.reduce((sum, s) => sum + s.count, 0) > 0
    ? ((needsReviewCount / stats.reduce((sum, s) => sum + s.count, 0)) * 100).toFixed(1)
    : '0.0'

  console.log(`   Documents à review            : ${needsReviewCount} (${needsReviewPct}%)`)

  if (needsReviewCount > 0.2 * stats.reduce((sum, s) => sum + s.count, 0)) {
    console.log(`   ⚠️  >20% des docs nécessitent une review`)
  } else {
    console.log(`   ✅ Taux de review acceptable (<20%)`)
  }
}

// =============================================================================
// VALIDATION 2 : ÉCHANTILLONS MANUELS
// =============================================================================

async function validateSamples(): Promise<void> {
  console.log(`\n📝 VALIDATION 2 : Échantillons manuels (${SAMPLES_COUNT} documents)\n`)

  const result = await db.query<Sample>(`
    SELECT
      kb.id,
      kb.title,
      kb.category as new_category,
      kb.metadata->>'old_category' as old_category,
      (kb.metadata->>'classification_confidence')::float as confidence,
      wp.url
    FROM knowledge_base kb
    LEFT JOIN web_pages wp ON kb.source_file = wp.url
    WHERE kb.source_type = 'web'
      AND kb.is_active = true
      AND kb.metadata->>'reclassified_at' IS NOT NULL
    ORDER BY RANDOM()
    LIMIT $1
  `, [SAMPLES_COUNT])

  const samples = result.rows

  if (samples.length === 0) {
    console.log('⚠️  Aucun document reclassifié trouvé')
    return
  }

  console.log('Échantillon aléatoire pour validation manuelle :')
  console.log('─'.repeat(100))

  samples.forEach((sample, i) => {
    const oldLabel = sample.old_category
      ? LEGAL_CATEGORY_TRANSLATIONS[sample.old_category as LegalCategory]?.fr || sample.old_category
      : 'N/A'
    const newLabel = LEGAL_CATEGORY_TRANSLATIONS[sample.new_category]?.fr || sample.new_category

    console.log(`\n${i + 1}. ${sample.title}`)
    console.log(`   URL       : ${sample.url}`)
    console.log(`   Catégorie : ${oldLabel} → ${newLabel}`)
    console.log(`   Confiance : ${sample.confidence ? (sample.confidence * 100).toFixed(1) + '%' : 'N/A'}`)
  })

  console.log('\n─'.repeat(100))
  console.log('\n💡 Vérifiez manuellement ces échantillons pour valider la qualité de classification')
}

// =============================================================================
// VALIDATION 3 : IMPACT RAG
// =============================================================================

async function validateRAG(): Promise<void> {
  console.log('\n🔍 VALIDATION 3 : Impact RAG (recherche sémantique)\n')

  const testQueries = [
    { query: 'القانون الجنائي التونسي', expectedCategories: ['codes', 'legislation'] },
    { query: 'jurisprudence cassation divorce', expectedCategories: ['jurisprudence'] },
    { query: 'code des obligations tunisien', expectedCategories: ['codes', 'legislation'] },
    { query: 'نماذج عقد العمل', expectedCategories: ['modeles', 'formulaires'] },
  ]

  for (const test of testQueries) {
    console.log(`Query : "${test.query}"`)
    console.log(`Catégories attendues : ${test.expectedCategories.join(', ')}`)

    // Recherche simple par fulltext
    const result = await db.query(`
      SELECT
        kb.id,
        kb.title,
        kb.category,
        ts_rank(to_tsvector('arabic', kb.full_text), plainto_tsquery('arabic', $1)) as rank
      FROM knowledge_base kb
      WHERE
        kb.source_type = 'web'
        AND kb.is_active = true
        AND to_tsvector('arabic', kb.full_text) @@ plainto_tsquery('arabic', $1)
      ORDER BY rank DESC
      LIMIT 5
    `, [test.query])

    if (result.rows.length === 0) {
      console.log('   ❌ Aucun résultat trouvé')
    } else {
      console.log(`   ✅ ${result.rows.length} résultats :`)
      result.rows.forEach((row, i) => {
        const label = LEGAL_CATEGORY_TRANSLATIONS[row.category as LegalCategory]?.fr || row.category
        const match = test.expectedCategories.includes(row.category) ? '✓' : '✗'
        console.log(`      ${i + 1}. [${label}] ${row.title} ${match}`)
      })
    }

    console.log('')
  }

  console.log('💡 Vérifiez que les résultats correspondent aux catégories attendues')
}

// =============================================================================
// VALIDATION 4 : QUALITÉ DES CLASSIFICATIONS
// =============================================================================

async function validateQuality(): Promise<void> {
  console.log('\n🎯 VALIDATION 4 : Qualité des classifications\n')

  // Stats par confiance
  const confidenceResult = await db.query(`
    SELECT
      CASE
        WHEN (metadata->>'classification_confidence')::float IS NULL THEN 'Aucune classification'
        WHEN (metadata->>'classification_confidence')::float >= 0.8 THEN 'Haute confiance (≥0.8)'
        WHEN (metadata->>'classification_confidence')::float >= 0.5 THEN 'Confiance moyenne (0.5-0.8)'
        ELSE 'Faible confiance (<0.5)'
      END as confidence_range,
      COUNT(*) as count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
    FROM knowledge_base
    WHERE source_type = 'web'
      AND is_active = true
      AND metadata->>'reclassified_at' IS NOT NULL
    GROUP BY confidence_range
    ORDER BY
      CASE confidence_range
        WHEN 'Haute confiance (≥0.8)' THEN 1
        WHEN 'Confiance moyenne (0.5-0.8)' THEN 2
        WHEN 'Faible confiance (<0.5)' THEN 3
        ELSE 4
      END
  `)

  console.log('Distribution par niveau de confiance :')
  console.log('─'.repeat(60))
  confidenceResult.rows.forEach(row => {
    const bar = '█'.repeat(Math.round(row.pct / 2))
    console.log(`${row.confidence_range.padEnd(30)} : ${row.count.toString().padStart(5)} (${row.pct.toString().padStart(5)}%) ${bar}`)
  })
  console.log('─'.repeat(60))

  // Confiance moyenne par catégorie
  const avgConfResult = await db.query(`
    SELECT
      category,
      COUNT(*) as count,
      ROUND(AVG((metadata->>'classification_confidence')::float)::numeric, 2) as avg_confidence
    FROM knowledge_base
    WHERE source_type = 'web'
      AND is_active = true
      AND metadata->>'classification_confidence' IS NOT NULL
    GROUP BY category
    ORDER BY avg_confidence DESC
  `)

  console.log('\nConfiance moyenne par catégorie :')
  console.log('─'.repeat(60))
  avgConfResult.rows.forEach(row => {
    const label = LEGAL_CATEGORY_TRANSLATIONS[row.category as LegalCategory]?.fr || row.category
    console.log(`${label.padEnd(20)} : ${row.avg_confidence} (${row.count} docs)`)
  })
  console.log('─'.repeat(60))
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('✅ VALIDATION RECLASSIFICATION KB')
  console.log('='.repeat(60))

  try {
    await validateDistribution()
    await validateSamples()
    await validateRAG()
    await validateQuality()

    console.log('\n' + '='.repeat(60))
    console.log('✅ Validation complétée')
    console.log('='.repeat(60) + '\n')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  }
}

main()
