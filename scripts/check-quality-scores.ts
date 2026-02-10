import { db } from '@/lib/db/postgres'

async function checkQualityScores() {
  console.log('=== Analyse des Scores de Qualité ===\n')

  // Distribution des scores
  const distribution = await db.query(`
    SELECT
      CASE
        WHEN quality_score < 20 THEN '00-19 (Très faible)'
        WHEN quality_score < 40 THEN '20-39 (Faible)'
        WHEN quality_score < 60 THEN '40-59 (Moyen)'
        WHEN quality_score < 80 THEN '60-79 (Bon)'
        ELSE '80-100 (Excellent)'
      END as range,
      COUNT(*) as count,
      ROUND(AVG(quality_score)) as avg_score
    FROM knowledge_base
    WHERE quality_score IS NOT NULL
    GROUP BY range
    ORDER BY range
  `)

  console.log('📊 Distribution des scores:\n')
  for (const row of distribution.rows) {
    console.log(`   ${row.range.padEnd(25)} ${row.count.toString().padStart(3)} docs (avg: ${row.avg_score})`)
  }

  // Top 5 meilleurs scores
  const top = await db.query(`
    SELECT
      title,
      quality_score,
      quality_clarity,
      quality_structure,
      quality_completeness,
      quality_reliability,
      quality_analysis_summary
    FROM knowledge_base
    WHERE quality_score IS NOT NULL
    ORDER BY quality_score DESC
    LIMIT 5
  `)

  console.log('\n\n✅ Top 5 meilleurs scores:\n')
  for (const doc of top.rows) {
    console.log(`   📄 ${doc.title.substring(0, 60)}`)
    console.log(`      Score: ${doc.quality_score}/100 (clarté: ${doc.quality_clarity}, structure: ${doc.quality_structure}, complétude: ${doc.quality_completeness}, fiabilité: ${doc.quality_reliability})`)
    console.log(`      Résumé: ${doc.quality_analysis_summary.substring(0, 100)}...\n`)
  }

  // Bottom 5 pires scores
  const bottom = await db.query(`
    SELECT
      title,
      quality_score,
      quality_clarity,
      quality_structure,
      quality_completeness,
      quality_reliability,
      quality_analysis_summary
    FROM knowledge_base
    WHERE quality_score IS NOT NULL
    ORDER BY quality_score ASC
    LIMIT 5
  `)

  console.log('\n❌ Bottom 5 pires scores:\n')
  for (const doc of bottom.rows) {
    console.log(`   📄 ${doc.title.substring(0, 60)}`)
    console.log(`      Score: ${doc.quality_score}/100 (clarté: ${doc.quality_clarity}, structure: ${doc.quality_structure}, complétude: ${doc.quality_completeness}, fiabilité: ${doc.quality_reliability})`)
    console.log(`      Résumé: ${doc.quality_analysis_summary.substring(0, 100)}...\n`)
  }

  await db.end()
}

checkQualityScores().catch(console.error)
