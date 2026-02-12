#!/usr/bin/env tsx
/**
 * Monitoring temps réel de la reclassification KB
 *
 * Objectif : Suivre la progression et la qualité de la reclassification
 *           avec refresh automatique
 *
 * Usage : npx tsx scripts/monitor-reclassification.ts [--interval=5]
 */

import { db } from '@/lib/db/postgres'
import type { LegalCategory } from '@/lib/categories/legal-categories'
import { LEGAL_CATEGORY_TRANSLATIONS } from '@/lib/categories/legal-categories'

// =============================================================================
// CONFIGURATION
// =============================================================================

const INTERVAL_ARG = process.argv.find(arg => arg.startsWith('--interval='))
const REFRESH_INTERVAL = INTERVAL_ARG ? parseInt(INTERVAL_ARG.split('=')[1], 10) * 1000 : 5000 // Default 5s

// =============================================================================
// TYPES
// =============================================================================

interface MonitoringStats {
  // Totaux
  total_docs: number
  reclassified: number
  needs_review: number
  from_ai: number
  from_default: number

  // Qualité
  avg_confidence: number
  min_confidence: number
  max_confidence: number

  // Diversité
  distinct_categories: number
  max_category_pct: number
  max_category_name: string

  // Distribution catégories
  categories: Array<{
    category: LegalCategory
    count: number
    pct: number
  }>

  // Timeline
  reclassified_last_hour: number
  reclassified_last_5min: number
}

// =============================================================================
// MONITORING
// =============================================================================

async function getMonitoringStats(): Promise<MonitoringStats> {
  // 1. Stats globales
  const globalResult = await db.query(`
    SELECT
      COUNT(*) as total_docs,
      COUNT(*) FILTER (WHERE metadata->>'reclassified_at' IS NOT NULL) as reclassified,
      COUNT(*) FILTER (WHERE metadata->>'needs_review' = 'true') as needs_review,
      COUNT(*) FILTER (WHERE metadata->>'classification_source' = 'ai') as from_ai,
      COUNT(*) FILTER (WHERE metadata->>'classification_source' = 'default') as from_default,
      COALESCE(ROUND(AVG((metadata->>'classification_confidence')::float)::numeric, 2), 0) as avg_confidence,
      COALESCE(ROUND(MIN((metadata->>'classification_confidence')::float)::numeric, 2), 0) as min_confidence,
      COALESCE(ROUND(MAX((metadata->>'classification_confidence')::float)::numeric, 2), 0) as max_confidence,
      COUNT(DISTINCT category) as distinct_categories
    FROM knowledge_base
    WHERE is_active = true
      AND source_file IS NOT NULL
  `)

  const global = globalResult.rows[0]

  // 2. Distribution catégories
  const categoriesResult = await db.query(`
    SELECT
      category,
      COUNT(*) as count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
    FROM knowledge_base
    WHERE is_active = true
      AND source_file IS NOT NULL
    GROUP BY category
    ORDER BY COUNT(*) DESC
  `)

  const categories = categoriesResult.rows

  // 3. Catégorie dominante
  const maxCategory = categories[0] || { category: 'none', pct: 0 }

  // 4. Timeline (dernière heure et 5 dernières minutes)
  const timelineResult = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE (metadata->>'reclassified_at')::timestamp > NOW() - INTERVAL '1 hour') as last_hour,
      COUNT(*) FILTER (WHERE (metadata->>'reclassified_at')::timestamp > NOW() - INTERVAL '5 minutes') as last_5min
    FROM knowledge_base
    WHERE metadata->>'reclassified_at' IS NOT NULL
  `)

  const timeline = timelineResult.rows[0]

  return {
    total_docs: parseInt(global.total_docs),
    reclassified: parseInt(global.reclassified),
    needs_review: parseInt(global.needs_review),
    from_ai: parseInt(global.from_ai),
    from_default: parseInt(global.from_default),
    avg_confidence: parseFloat(global.avg_confidence),
    min_confidence: parseFloat(global.min_confidence),
    max_confidence: parseFloat(global.max_confidence),
    distinct_categories: parseInt(global.distinct_categories),
    max_category_pct: parseFloat(maxCategory.pct),
    max_category_name: maxCategory.category,
    categories,
    reclassified_last_hour: parseInt(timeline.last_hour || '0'),
    reclassified_last_5min: parseInt(timeline.last_5min || '0'),
  }
}

// =============================================================================
// AFFICHAGE
// =============================================================================

function clearScreen() {
  process.stdout.write('\x1Bc') // Clear terminal
}

function formatPercent(value: number, total: number): string {
  return total === 0 ? '0.0%' : `${((value / total) * 100).toFixed(1)}%`
}

function getStatusEmoji(pct: number, thresholdGood: number, thresholdBad: number): string {
  if (pct <= thresholdGood) return '✅'
  if (pct <= thresholdBad) return '⚠️ '
  return '🚨'
}

function printDashboard(stats: MonitoringStats, iteration: number) {
  clearScreen()

  const now = new Date().toLocaleString('fr-FR')
  console.log('═'.repeat(70))
  console.log(`  📊 MONITORING RECLASSIFICATION KB - ${now}`)
  console.log(`  Refresh: ${REFRESH_INTERVAL / 1000}s | Iteration: ${iteration}`)
  console.log('═'.repeat(70))
  console.log('')

  // Section 1 : Vue d'ensemble
  console.log('┌─ VUE D\'ENSEMBLE ' + '─'.repeat(52))
  console.log(`│`)
  console.log(`│  Total documents      : ${stats.total_docs.toLocaleString()}`)
  console.log(`│  Reclassifiés         : ${stats.reclassified.toLocaleString()} (${formatPercent(stats.reclassified, stats.total_docs)})`)
  console.log(`│  Non reclassifiés     : ${(stats.total_docs - stats.reclassified).toLocaleString()} (${formatPercent(stats.total_docs - stats.reclassified, stats.total_docs)})`)
  console.log(`│`)
  console.log(`└${'─'.repeat(69)}`)
  console.log('')

  // Section 2 : Classification Source
  console.log('┌─ SOURCE CLASSIFICATION ' + '─'.repeat(45))
  console.log(`│`)
  console.log(`│  Classification IA    : ${stats.from_ai.toLocaleString()} (${formatPercent(stats.from_ai, stats.total_docs)})`)
  console.log(`│  Par défaut (autre)   : ${stats.from_default.toLocaleString()} (${formatPercent(stats.from_default, stats.total_docs)})`)
  console.log(`│  Besoin review        : ${stats.needs_review.toLocaleString()} (${formatPercent(stats.needs_review, stats.total_docs)}) ${getStatusEmoji(stats.needs_review / stats.total_docs * 100, 10, 20)}`)
  console.log(`│`)
  console.log(`└${'─'.repeat(69)}`)
  console.log('')

  // Section 3 : Qualité
  console.log('┌─ QUALITÉ ' + '─'.repeat(59))
  console.log(`│`)
  console.log(`│  Confiance moyenne    : ${stats.avg_confidence.toFixed(2)} ${getStatusEmoji(stats.avg_confidence, 0.6, 0.5)}`)
  console.log(`│  Confiance min        : ${stats.min_confidence.toFixed(2)}`)
  console.log(`│  Confiance max        : ${stats.max_confidence.toFixed(2)}`)
  console.log(`│`)
  console.log(`└${'─'.repeat(69)}`)
  console.log('')

  // Section 4 : Diversité
  console.log('┌─ DIVERSITÉ ' + '─'.repeat(57))
  console.log(`│`)
  console.log(`│  Catégories actives   : ${stats.distinct_categories}`)
  console.log(`│  Catégorie dominante  : ${LEGAL_CATEGORY_TRANSLATIONS[stats.max_category_name as LegalCategory]?.fr || stats.max_category_name} (${stats.max_category_pct.toFixed(1)}%) ${getStatusEmoji(stats.max_category_pct, 30, 40)}`)
  console.log(`│`)
  console.log(`└${'─'.repeat(69)}`)
  console.log('')

  // Section 5 : Distribution Catégories (Top 10)
  console.log('┌─ DISTRIBUTION CATÉGORIES (Top 10) ' + '─'.repeat(33))
  console.log(`│`)

  stats.categories.slice(0, 10).forEach((cat, i) => {
    const label = LEGAL_CATEGORY_TRANSLATIONS[cat.category as LegalCategory]?.fr || cat.category
    const bar = '█'.repeat(Math.round(cat.pct / 2))
    console.log(`│  ${(i + 1).toString().padStart(2)}. ${label.padEnd(18)} : ${cat.count.toString().padStart(5)} (${cat.pct.toString().padStart(5)}%) ${bar}`)
  })

  console.log(`│`)
  console.log(`└${'─'.repeat(69)}`)
  console.log('')

  // Section 6 : Activité Récente
  console.log('┌─ ACTIVITÉ RÉCENTE ' + '─'.repeat(50))
  console.log(`│`)
  console.log(`│  Dernière heure       : ${stats.reclassified_last_hour.toLocaleString()} documents`)
  console.log(`│   5 dernières minutes  : ${stats.reclassified_last_5min.toLocaleString()} documents`)
  console.log(`│`)
  console.log(`└${'─'.repeat(69)}`)
  console.log('')

  // Section 7 : Alertes
  const alerts: string[] = []

  if (stats.max_category_pct > 40) {
    alerts.push(`🚨 Catégorie dominante >40% (${stats.max_category_pct.toFixed(1)}%)`)
  } else if (stats.max_category_pct > 30) {
    alerts.push(`⚠️  Catégorie dominante >30% (${stats.max_category_pct.toFixed(1)}%)`)
  }

  if (stats.needs_review / stats.total_docs > 0.2) {
    alerts.push(`🚨 >20% des docs nécessitent review (${formatPercent(stats.needs_review, stats.total_docs)})`)
  } else if (stats.needs_review / stats.total_docs > 0.1) {
    alerts.push(`⚠️  >10% des docs nécessitent review (${formatPercent(stats.needs_review, stats.total_docs)})`)
  }

  if (stats.avg_confidence < 0.5) {
    alerts.push(`🚨 Confiance moyenne très faible (<0.5) : ${stats.avg_confidence.toFixed(2)}`)
  } else if (stats.avg_confidence < 0.6) {
    alerts.push(`⚠️  Confiance moyenne faible (<0.6) : ${stats.avg_confidence.toFixed(2)}`)
  }

  if (alerts.length > 0) {
    console.log('┌─ ALERTES ' + '─'.repeat(59))
    console.log(`│`)
    alerts.forEach(alert => {
      console.log(`│  ${alert}`)
    })
    console.log(`│`)
    console.log(`└${'─'.repeat(69)}`)
  } else {
    console.log('✅ AUCUNE ALERTE - Système nominal')
  }

  console.log('')
  console.log('═'.repeat(70))
  console.log(`  Prochain refresh dans ${REFRESH_INTERVAL / 1000}s... (Ctrl+C pour quitter)`)
  console.log('═'.repeat(70))
}

// =============================================================================
// MAIN
// =============================================================================

async function monitor() {
  let iteration = 1

  while (true) {
    try {
      const stats = await getMonitoringStats()
      printDashboard(stats, iteration)
      iteration++

      await new Promise(resolve => setTimeout(resolve, REFRESH_INTERVAL))
    } catch (error) {
      console.error('\n❌ Erreur monitoring:', error)
      console.log('Nouvelle tentative dans 10s...\n')
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
  }
}

async function main() {
  console.log('🚀 Démarrage du monitoring...\n')

  try {
    await monitor()
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  }
}

main()
