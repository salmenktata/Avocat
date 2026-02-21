/**
 * Script: populate-kb-branch.ts
 *
 * Peuple et vérifie la colonne `branch` sur knowledge_base.
 * Utilisé pour les cas ambigus que le SQL automatique ne couvre pas.
 *
 * Usage:
 *   npx tsx scripts/populate-kb-branch.ts             # Affiche distribution + docs avec branch='autre'
 *   npx tsx scripts/populate-kb-branch.ts --fix        # Re-applique le peuplement heuristique
 *   npx tsx scripts/populate-kb-branch.ts --top-autre  # Liste les 50 docs 'autre' pour revue manuelle
 *
 * Sprint 1 RAG Audit-Proof — 2026-02-21
 */

import { db } from '@/lib/db/postgres'

async function main() {
  const args = process.argv.slice(2)
  const shouldFix = args.includes('--fix')
  const topAutre = args.includes('--top-autre')

  console.log('\n=== Populate KB Branch ===\n')

  // 1. Distribution actuelle
  const distResult = await db.query(`
    SELECT branch::text, COUNT(*) as count,
           ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER(), 0), 1) as pct
    FROM knowledge_base
    WHERE is_active = true
    GROUP BY branch
    ORDER BY count DESC
  `)

  console.log('📊 Distribution branches (knowledge_base actifs):')
  console.log('─'.repeat(50))
  for (const row of distResult.rows) {
    const bar = '█'.repeat(Math.round(parseFloat(row.pct) / 2))
    console.log(`  ${row.branch?.padEnd(20)} ${String(row.count).padStart(6)} (${String(row.pct).padStart(5)}%) ${bar}`)
  }
  console.log()

  // 2. Docs avec branch=autre (cibles d'amélioration)
  const autreResult = await db.query(`
    SELECT COUNT(*) as count
    FROM knowledge_base
    WHERE is_active = true AND branch = 'autre'
  `)
  const autreCount = parseInt(autreResult.rows[0].count)
  const totalResult = await db.query(`SELECT COUNT(*) as count FROM knowledge_base WHERE is_active = true`)
  const total = parseInt(totalResult.rows[0].count)

  const autrePct = total > 0 ? (autreCount / total * 100).toFixed(1) : '0'
  const status = parseFloat(autrePct) < 5 ? '✅' : parseFloat(autrePct) < 15 ? '⚠️' : '❌'
  console.log(`${status} Docs avec branch='autre': ${autreCount}/${total} (${autrePct}%)`)
  console.log(`   Objectif: <5% pour un RAG audit-proof\n`)

  // 3. Toplist des docs 'autre' pour revue manuelle
  if (topAutre) {
    const autreDocsResult = await db.query(`
      SELECT id, title, category::text, subcategory
      FROM knowledge_base
      WHERE is_active = true AND branch = 'autre'
      ORDER BY created_at DESC
      LIMIT 50
    `)

    console.log('📋 50 derniers docs avec branch=\'autre\' (pour revue manuelle):')
    console.log('─'.repeat(80))
    for (const row of autreDocsResult.rows) {
      console.log(`  [${row.category?.padEnd(15)}] ${row.title?.substring(0, 60)}`)
    }
    console.log()
  }

  // 4. Re-application du peuplement heuristique
  if (shouldFix) {
    console.log('🔧 Re-application du peuplement branch...')

    const updateResult = await db.query(`
      UPDATE knowledge_base SET branch = (
        CASE
          WHEN title ILIKE '%الشغل%' OR title ILIKE '%travail%' THEN 'travail'
          WHEN title ILIKE '%الجزائية%' OR title ILIKE '%الجزائي%' OR title ILIKE '%pénal%' THEN 'pénal'
          WHEN title ILIKE '%المرافعات%' OR title ILIKE '%procédure%' OR title ILIKE '%الإجراءات الجزائية%' THEN 'procédure'
          WHEN title ILIKE '%الالتزامات والعقود%' OR title ILIKE '%obligations%' THEN 'civil'
          WHEN title ILIKE '%الأحوال الشخصية%' OR title ILIKE '%statut personnel%' THEN 'famille'
          WHEN title ILIKE '%الصفقات%' OR title ILIKE '%marchés publics%' THEN 'marchés_publics'
          WHEN title ILIKE '%تجاري%' OR title ILIKE '%التجارية%' OR title ILIKE '%commercial%' THEN 'commercial'
          WHEN title ILIKE '%ضريب%' OR title ILIKE '%جبائ%' OR title ILIKE '%fiscal%' THEN 'fiscal'
          WHEN title ILIKE '%بنك%' OR title ILIKE '%مصرف%' OR title ILIKE '%bancaire%' THEN 'bancaire'
          WHEN title ILIKE '%عقار%' OR title ILIKE '%immobili%' THEN 'immobilier'
          WHEN title ILIKE '%إداري%' OR title ILIKE '%administratif%' THEN 'administratif'
          ELSE 'autre'
        END
      )::legal_branch
      WHERE is_active = true
      RETURNING id
    `)

    console.log(`  ✅ ${updateResult.rowCount} docs mis à jour`)

    // Propagation chunks
    const chunksResult = await db.query(`
      UPDATE knowledge_base_chunks kbc
      SET branch = kb.branch
      FROM knowledge_base kb
      WHERE kbc.knowledge_base_id = kb.id
      RETURNING kbc.id
    `)
    console.log(`  ✅ ${chunksResult.rowCount} chunks mis à jour`)

    // Sync metadata JSONB
    await db.query(`
      UPDATE knowledge_base
      SET metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object('branch', branch::text)
      WHERE is_active = true
    `)
    console.log('  ✅ Metadata JSONB synchronisée')

    // Nouvelle distribution
    const newDistResult = await db.query(`
      SELECT branch::text, COUNT(*) as count
      FROM knowledge_base
      WHERE is_active = true
      GROUP BY branch
      ORDER BY count DESC
    `)

    console.log('\n📊 Nouvelle distribution:')
    for (const row of newDistResult.rows) {
      console.log(`  ${row.branch?.padEnd(20)} ${row.count}`)
    }
  }

  await db.end()
  console.log('\n✅ Script terminé.\n')
}

main().catch(err => {
  console.error('❌ Erreur:', err)
  process.exit(1)
})
