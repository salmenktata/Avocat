/**
 * Debug: Afficher les chunks contenant "abroge" pour analyser les patterns
 */
import { Pool } from 'pg'

const PROD_DB = {
  host: 'localhost',
  port: 5434,
  database: 'qadhya',
  user: 'moncabinet',
  password: process.env.DB_PASSWORD || '',
}

async function main() {
  const pool = new Pool(PROD_DB)

  try {
    const result = await pool.query(`
      SELECT DISTINCT
        kb.id,
        kb.title,
        kb.category::text as category,
        kbc.content
      FROM knowledge_base kb
      JOIN knowledge_base_chunks kbc ON kb.id = kbc.knowledge_base_id
      WHERE (
        kbc.content ILIKE '%abroge%'
        OR kbc.content ILIKE '%abrogée%'
        OR kbc.content LIKE '%ملغى%'
      )
      AND kb.is_active = true
      LIMIT 10
    `)

    console.log(`\n📊 ${result.rows.length} chunks trouvés\n`)

    result.rows.forEach((row, i) => {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`Chunk ${i + 1}/${result.rows.length}`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`KB ID: ${row.id}`)
      console.log(`Titre: ${row.title}`)
      console.log(`Catégorie: ${row.category}`)
      console.log(`\nContenu:`)
      console.log(row.content)
      console.log(`\n`)
    })

  } finally {
    await pool.end()
  }
}

main().catch(console.error)
