#!/usr/bin/env tsx
/**
 * Test: Recherche hybride avec filtrage par doc_type
 * Valide que le paramètre p_doc_type fonctionne correctement
 */

import { Pool } from 'pg'
import type { DocumentType } from '../lib/categories/doc-types'

// Configuration production via tunnel SSH
const pool = new Pool({
  host: 'localhost',
  port: 5434, // Tunnel SSH
  database: 'qadhya',
  user: 'moncabinet',
  password: 'prod_secure_password_2026',
})

// Helper pour exécuter des queries
async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const result = await pool.query(text, params)
  return result.rows
}

// Queries de test (arabes pour correspondre au contenu)
const TEST_QUERIES = [
  { text: 'الدفاع الشرعي', description: 'Légitime défense' },
  { text: 'عقد البيع', description: 'Contrat de vente' },
  { text: 'المجلة الجزائية', description: 'Code pénal' },
  { text: 'محكمة التعقيب', description: 'Cour de cassation' },
]

const ALL_DOC_TYPES: DocumentType[] = ['TEXTES', 'JURIS', 'PROC', 'TEMPLATES', 'DOCTRINE']

interface SearchResult {
  knowledge_base_id: string
  chunk_id: string
  title: string
  category: string
  chunk_content: string
  similarity: number
  bm25_rank: number
  hybrid_score: number
}

/**
 * Recherche sans doc_type (baseline)
 */
async function searchWithoutDocType(queryText: string): Promise<SearchResult[]> {
  return query<SearchResult>(`
    SELECT
      knowledge_base_id::text,
      chunk_id::text,
      title,
      category,
      LEFT(chunk_content, 100) as chunk_content,
      similarity,
      bm25_rank,
      hybrid_score
    FROM search_knowledge_base_hybrid(
      $1,
      NULL::vector,  -- Pas d'embedding pour ce test
      NULL::text,    -- Pas de filtrage par category
      NULL::text,    -- Pas de filtrage par doc_type
      10,            -- limit
      0.0,           -- threshold (accepter tous)
      false          -- use_openai
    )
    LIMIT 5
  `, [queryText])
}

/**
 * Recherche avec doc_type spécifique
 */
async function searchWithDocType(
  queryText: string,
  docType: DocumentType
): Promise<SearchResult[]> {
  return query<SearchResult>(`
    SELECT
      knowledge_base_id::text,
      chunk_id::text,
      title,
      category,
      LEFT(chunk_content, 100) as chunk_content,
      similarity,
      bm25_rank,
      hybrid_score
    FROM search_knowledge_base_hybrid(
      $1,
      NULL::vector,
      NULL::text,
      $2::document_type,  -- Filtrage par doc_type
      10,
      0.0,
      false
    )
    LIMIT 5
  `, [queryText, docType])
}

/**
 * Stats globales par doc_type
 */
async function getDocTypeStats() {
  return query(`
    SELECT
      doc_type,
      COUNT(*) as total_docs,
      COUNT(*) FILTER (WHERE is_indexed = true) as indexed_docs
    FROM knowledge_base
    WHERE is_active = true AND doc_type IS NOT NULL
    GROUP BY doc_type
    ORDER BY COUNT(*) DESC
  `)
}

/**
 * Main test
 */
async function main() {
  console.log('🧪 Test: Recherche hybride avec doc_type\n')
  console.log('=' .repeat(80))

  // Stats préliminaires
  console.log('\n📊 Statistiques par doc_type:\n')
  const stats = await getDocTypeStats()
  for (const stat of stats) {
    console.log(`   ${stat.doc_type.padEnd(12)}: ${stat.total_docs} docs (${stat.indexed_docs} indexés)`)
  }

  // Test chaque query
  for (const query of TEST_QUERIES) {
    console.log('\n' + '='.repeat(80))
    console.log(`\n🔍 Query: "${query.text}" (${query.description})\n`)

    // 1. Recherche sans filtrage (baseline)
    console.log('📋 Baseline (sans doc_type):')
    const baselineResults = await searchWithoutDocType(query.text)

    if (baselineResults.length === 0) {
      console.log('   ⚠️  Aucun résultat trouvé (peut-être que les embeddings manquent)\n')
      continue
    }

    console.log(`   ✅ ${baselineResults.length} résultats\n`)
    for (const result of baselineResults) {
      console.log(`   [${result.hybrid_score.toFixed(3)}] ${result.title.substring(0, 60)}`)
      console.log(`        Category: ${result.category}`)
    }

    // 2. Recherche par doc_type
    console.log('\n📑 Par doc_type:\n')

    const docTypeResults = new Map<DocumentType, SearchResult[]>()

    for (const docType of ALL_DOC_TYPES) {
      const results = await searchWithDocType(query.text, docType)
      docTypeResults.set(docType, results)

      if (results.length > 0) {
        console.log(`   ${docType.padEnd(12)}: ${results.length} résultats`)
        for (const result of results.slice(0, 2)) {
          console.log(`      [${result.hybrid_score.toFixed(3)}] ${result.title.substring(0, 50)}`)
        }
      } else {
        console.log(`   ${docType.padEnd(12)}: 0 résultats`)
      }
    }

    // 3. Analyse distribution
    console.log('\n📈 Distribution des résultats baseline par doc_type:')
    const distribution = new Map<string, number>()

    // On ne peut pas obtenir le doc_type directement du résultat
    // car la fonction SQL ne le retourne pas encore
    // Pour l'instant, on affiche juste les catégories
    for (const result of baselineResults) {
      const count = distribution.get(result.category) || 0
      distribution.set(result.category, count + 1)
    }

    for (const [category, count] of distribution.entries()) {
      console.log(`   ${category.padEnd(20)}: ${count} résultats`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n✅ Tests terminés!\n')

  await pool.end()
}

main().catch((error) => {
  console.error('❌ Erreur:', error)
  pool.end()
  process.exit(1)
})
