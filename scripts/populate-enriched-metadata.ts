#!/usr/bin/env tsx
/**
 * Script de population des métadonnées enrichies (Phase 2)
 *
 * Ce script analyse les documents existants pour extraire et peupler :
 * - Citations standardisées (citation, citation_ar)
 * - Identifiants d'articles (article_id)
 * - Corrections de status basées sur legal_abrogations
 */

import { db } from '../lib/db/postgres'

console.log('🔧 Population des métadonnées enrichies (Phase 2)\n')

// =============================================================================
// 1. EXTRACTION CITATIONS DEPUIS TITLE
// =============================================================================

async function extractCitations() {
  console.log('📝 Extraction des citations depuis les titres...')

  // Pattern pour codes juridiques
  const codePatterns = [
    // Français: "Code pénal, art. 258"
    { regex: /^(Code\s+[^,]+),?\s+(?:article|art\.?)\s+(\d+(?:\s+(?:bis|ter|quater))?)/i, type: 'code_fr' },
    // Arabe: "المجلة الجزائية، الفصل 258"
    { regex: /^(المجلة\s+[^،]+)،?\s+(?:الفصل|فصل)\s+(\d+(?:\s+مكرر)?)/,type: 'code_ar' },
  ]

  // Pattern pour jurisprudence
  const jurisPatterns = [
    // Français: "Arrêt Cour de Cassation n°12345 du 15/01/2024"
    { regex: /(Arrêt|Décision)\s+(?:de\s+la\s+)?(Cour\s+[^n]+)\s+n°?\s*(\d+)(?:\s+du\s+(\d{2}\/\d{2}\/\d{4}))?/i, type: 'juris_fr' },
    // Arabe: "قرار تعقيبي عدد 12345 بتاريخ 15/01/2024"
    { regex: /(قرار|حكم)\s+([^\s]+)\s+عدد\s+(\d+)(?:\s+بتاريخ\s+(\d{2}\/\d{2}\/\d{4}))?/, type: 'juris_ar' },
  ]

  let codeUpdates = 0
  let jurisUpdates = 0

  // Récupérer documents codes sans citation
  const codesResult = await db.query(`
    SELECT id, title, category, language
    FROM knowledge_base
    WHERE category IN ('codes', 'legislation', 'constitution')
      AND citation IS NULL
      AND is_active = true
    LIMIT 1000
  `)

  console.log(`   Trouvé ${codesResult.rows.length} codes sans citation`)

  for (const row of codesResult.rows) {
    const title = row.title as string
    const language = row.language as string

    // Tester patterns codes
    for (const { regex, type } of codePatterns) {
      const match = title.match(regex)
      if (match) {
        const codeName = match[1]
        const articleNum = match[2]

        const citation = type === 'code_fr'
          ? `${codeName}, art. ${articleNum}`
          : `${codeName}، الفصل ${articleNum}`

        const citationAr = type === 'code_fr'
          ? null // On ne traduit pas automatiquement
          : citation

        const articleId = `art_${articleNum.replace(/\s+/g, '_').toLowerCase()}`

        await db.query(`
          UPDATE knowledge_base
          SET
            citation = $1,
            citation_ar = $2,
            article_id = $3
          WHERE id = $4
        `, [
          type === 'code_fr' ? citation : null,
          citationAr,
          articleId,
          row.id,
        ])

        codeUpdates++
        break
      }
    }
  }

  console.log(`   ✅ ${codeUpdates} codes mis à jour avec citations\n`)

  // Récupérer documents jurisprudence sans citation
  const jurisResult = await db.query(`
    SELECT id, title, category, language
    FROM knowledge_base
    WHERE category = 'jurisprudence'
      AND citation IS NULL
      AND is_active = true
    LIMIT 1000
  `)

  console.log(`   Trouvé ${jurisResult.rows.length} jurisprudences sans citation`)

  for (const row of jurisResult.rows) {
    const title = row.title as string

    // Tester patterns jurisprudence
    for (const { regex, type } of jurisPatterns) {
      const match = title.match(regex)
      if (match) {
        const typeDoc = match[1] // Arrêt/Décision/قرار/حكم
        const court = match[2] // Cour de Cassation/تعقيبي
        const number = match[3]
        const date = match[4] || ''

        const citation = type === 'juris_fr'
          ? `${typeDoc} ${court} n°${number}${date ? ' du ' + date : ''}`
          : `${typeDoc} ${court} عدد ${number}${date ? ' بتاريخ ' + date : ''}`

        const citationAr = type === 'juris_fr'
          ? null
          : citation

        await db.query(`
          UPDATE knowledge_base
          SET
            citation = $1,
            citation_ar = $2
          WHERE id = $3
        `, [
          type === 'juris_fr' ? citation : null,
          citationAr,
          row.id,
        ])

        jurisUpdates++
        break
      }
    }
  }

  console.log(`   ✅ ${jurisUpdates} jurisprudences mises à jour avec citations\n`)

  return { codeUpdates, jurisUpdates }
}

// =============================================================================
// 2. VÉRIFICATION STATUS ABROGÉ
// =============================================================================

async function verifyAbrogatedStatus() {
  console.log('🔍 Vérification des documents abrogés...')

  const result = await db.query(`
    SELECT COUNT(*) as count
    FROM vw_kb_abrogated_candidates
  `)

  const candidatesCount = parseInt(result.rows[0].count)

  console.log(`   Trouvé ${candidatesCount} documents potentiellement abrogés`)

  if (candidatesCount > 0) {
    // Afficher quelques exemples
    const examples = await db.query(`
      SELECT title, category, abrogating_reference
      FROM vw_kb_abrogated_candidates
      LIMIT 5
    `)

    console.log(`\n   Exemples:`)
    for (const row of examples.rows) {
      console.log(`     - ${row.title}`)
      console.log(`       Abrogé par: ${row.abrogating_reference}`)
    }
  }

  return candidatesCount
}

// =============================================================================
// 3. STATISTIQUES FINALES
// =============================================================================

async function displayStats() {
  console.log('\n📊 Statistiques Métadonnées Enrichies:\n')

  // Stats par status
  const statusResult = await db.query(`
    SELECT * FROM vw_kb_stats_by_status
    ORDER BY total_docs DESC
  `)

  console.log('   Status Juridique:')
  for (const row of statusResult.rows) {
    console.log(`     ${row.status.padEnd(15)} : ${row.total_docs.toString().padStart(5)} docs (${row.indexation_rate}% indexés)`)
  }

  // Stats par fiabilité
  const reliabilityResult = await db.query(`
    SELECT * FROM vw_kb_stats_by_reliability
    ORDER BY total_docs DESC
  `)

  console.log('\n   Fiabilité Sources:')
  for (const row of reliabilityResult.rows) {
    console.log(`     ${row.reliability.padEnd(15)} : ${row.total_docs.toString().padStart(5)} docs (${row.indexation_rate}% indexés)`)
  }

  // Stats citations
  const citationResult = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE citation IS NOT NULL OR citation_ar IS NOT NULL) as with_citation,
      COUNT(*) FILTER (WHERE article_id IS NOT NULL) as with_article_id,
      COUNT(*) as total
    FROM knowledge_base
    WHERE is_active = true
  `)

  const citStats = citationResult.rows[0]
  console.log('\n   Citations & Articles:')
  console.log(`     Avec citation     : ${citStats.with_citation.toString().padStart(5)} docs (${((citStats.with_citation / citStats.total) * 100).toFixed(1)}%)`)
  console.log(`     Avec article_id   : ${citStats.with_article_id.toString().padStart(5)} docs (${((citStats.with_article_id / citStats.total) * 100).toFixed(1)}%)`)

  // Chaînes de versions
  const versionResult = await db.query(`
    SELECT COUNT(*) as count
    FROM vw_kb_version_chains
  `)

  console.log(`\n   Chaînes de versions: ${versionResult.rows[0].count} documents liés`)
}

// =============================================================================
// EXÉCUTION PRINCIPALE
// =============================================================================

async function main() {
  try {
    const startTime = Date.now()

    // 1. Extraire citations
    const { codeUpdates, jurisUpdates } = await extractCitations()

    // 2. Vérifier status abrogé
    const abrogatedCount = await verifyAbrogatedStatus()

    // 3. Afficher stats
    await displayStats()

    const duration = Date.now() - startTime

    console.log(`\n✅ Population complétée en ${duration}ms`)
    console.log(`   - ${codeUpdates} codes mis à jour`)
    console.log(`   - ${jurisUpdates} jurisprudences mises à jour`)
    console.log(`   - ${abrogatedCount} documents abrogés détectés`)

  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }
}

main()
