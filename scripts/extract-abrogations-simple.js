#!/usr/bin/env node
/**
 * Extraction simple abrogations KB (JavaScript pur, pas de TypeScript)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5434, // Tunnel SSH
  database: 'qadhya',
  user: 'moncabinet',
  password: process.env.DB_PASSWORD || 'moncabinet',
});

async function main() {
  console.log('🚀 Extraction Abrogations depuis KB Qadhya\n');

  try {
    // Requête SQL
    const result = await pool.query(`
      SELECT DISTINCT
        kb.id as kb_id,
        kb.title as kb_title,
        kb.category::text as kb_category,
        SUBSTRING(kbc.content, 1, 500) as chunk_excerpt,
        CASE
          WHEN kbc.content ~* 'abroge\\s+(la\\s+)?loi\\s+n°?\\s*\\d{4}[-‑]\\d+' THEN 'FR'
          WHEN kbc.content ~ 'يلغي|ملغى' THEN 'AR'
          ELSE 'MIXED'
        END as language,
        kb.created_at
      FROM knowledge_base kb
      JOIN knowledge_base_chunks kbc ON kb.id = kbc.knowledge_base_id
      WHERE (
        kbc.content ILIKE '%abroge%'
        OR kbc.content ILIKE '%abrogée%'
        OR kbc.content ILIKE '%abrogés%'
        OR kbc.content LIKE '%ملغى%'
        OR kbc.content LIKE '%يلغي%'
        OR kbc.content LIKE '%ألغى%'
      )
      AND kb.is_active = true
      ORDER BY kb.category, kb.title
      LIMIT 500
    `);

    console.log(`✅ ${result.rows.length} enregistrements trouvés\n`);

    // Statistiques
    const stats = {
      total: result.rows.length,
      byLanguage: {},
      byCategory: {},
    };

    result.rows.forEach(row => {
      stats.byLanguage[row.language] = (stats.byLanguage[row.language] || 0) + 1;
      stats.byCategory[row.kb_category] = (stats.byCategory[row.kb_category] || 0) + 1;
    });

    console.log('📊 STATISTIQUES\n');
    console.log(`   Total: ${stats.total} chunks`);
    console.log('\n📈 PAR LANGUE:');
    Object.entries(stats.byLanguage).forEach(([lang, count]) => {
      console.log(`   ${lang}: ${count}`);
    });

    console.log('\n📈 PAR CATÉGORIE:');
    Object.entries(stats.byCategory).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });

    // Export CSV
    const timestamp = Date.now();
    const outputPath = path.join(process.cwd(), 'data', 'abrogations', `kb-abrogations-prod-${timestamp}.csv`);

    // Créer répertoire
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    // Générer CSV
    const headers = ['kb_id', 'kb_title', 'kb_category', 'chunk_excerpt', 'language', 'created_at'];
    const rows = result.rows.map(row => [
      row.kb_id,
      `"${(row.kb_title || '').replace(/"/g, '""')}"`,
      row.kb_category,
      `"${(row.chunk_excerpt || '').replace(/"/g, '""')}"`,
      row.language,
      row.created_at
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    fs.writeFileSync(outputPath, csv, 'utf-8');

    console.log(`\n📄 Export CSV: ${outputPath}`);

    // Afficher échantillon
    console.log('\n📝 ÉCHANTILLON (5 premiers):');
    result.rows.slice(0, 5).forEach((row, i) => {
      console.log(`\n   ${i + 1}. ${row.kb_title.substring(0, 60)}...`);
      console.log(`      Catégorie: ${row.kb_category}`);
      console.log(`      Langue: ${row.language}`);
      console.log(`      Extrait: ${row.chunk_excerpt.substring(0, 100)}...`);
    });

    console.log('\n✅ Extraction terminée !');
    console.log('\n📝 Prochaines étapes:');
    console.log(`   1. Ouvrir ${outputPath}`);
    console.log('   2. Analyser manuellement les chunks');
    console.log('   3. Extraire références lois abrogées');
    console.log('   4. Compléter traductions AR/FR');
    console.log('   5. Vérifier sources JORT');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
