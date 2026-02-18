#!/usr/bin/env npx tsx
/**
 * RAG Evaluation Benchmark Runner
 *
 * Exécute le gold eval dataset et calcule les métriques retrieval :
 * - Recall@K (K=1,3,5,10)
 * - Precision@5
 * - MRR (Mean Reciprocal Rank)
 * - Faithfulness (via LLM judge)
 * - Citation Accuracy (pattern matching)
 *
 * Usage :
 *   npx tsx scripts/run-eval-benchmark.ts              # Full benchmark
 *   npx tsx scripts/run-eval-benchmark.ts --quick       # 20 premières questions seulement
 *   npx tsx scripts/run-eval-benchmark.ts --domain=droit_civil  # Filtrer par domaine
 *
 * Résultats sauvegardés dans la table rag_eval_results.
 */

import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// =============================================================================
// CONFIG & DB
// =============================================================================

const QUICK_MODE = process.argv.includes('--quick')
const DOMAIN_FILTER = process.argv.find(a => a.startsWith('--domain='))?.split('=')[1]
const GOLD_DATASET_PATH = path.join(process.cwd(), 'data', 'gold-eval-dataset.json')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433'),
  database: process.env.POSTGRES_DB || 'moncabinet',
  user: process.env.POSTGRES_USER || 'salmenktata',
  password: process.env.POSTGRES_PASSWORD || '',
})

// =============================================================================
// TYPES
// =============================================================================

interface GoldEvalCase {
  id: string
  domain: string
  difficulty: string
  question: string
  intentType: string
  expectedAnswer: {
    keyPoints: string[]
    mandatoryCitations: string[]
  }
  expectedArticles?: string[]
  goldChunkIds?: string[]
  goldDocumentIds?: string[]
  minRecallAt5?: number
}

interface EvalResult {
  questionId: string
  question: string
  domain: string
  difficulty: string
  intentType: string
  goldChunkIds: string[]
  retrievedChunkIds: string[]
  recallAt1: number
  recallAt3: number
  recallAt5: number
  recallAt10: number
  precisionAt5: number
  mrr: number
  faithfulnessScore: number
  citationAccuracy: number
  expectedAnswer: string
  actualAnswer: string
  sourcesReturned: unknown[]
  latencyMs: number
}

// =============================================================================
// MÉTRIQUES RETRIEVAL
// =============================================================================

/**
 * Recall@K : proportion des documents gold retrouvés dans les K premiers résultats
 */
export function computeRecallAtK(goldIds: string[], retrievedIds: string[], k: number): number {
  if (goldIds.length === 0) return 1 // Pas de gold → considéré OK
  const topK = retrievedIds.slice(0, k)
  const found = goldIds.filter(id => topK.includes(id)).length
  return found / goldIds.length
}

/**
 * Precision@K : proportion des K premiers résultats qui sont dans le gold set
 */
export function computePrecisionAtK(goldIds: string[], retrievedIds: string[], k: number): number {
  if (goldIds.length === 0) return 1
  const topK = retrievedIds.slice(0, k)
  if (topK.length === 0) return 0
  const relevant = topK.filter(id => goldIds.includes(id)).length
  return relevant / topK.length
}

/**
 * MRR : inverse du rang du premier document gold trouvé
 */
export function computeMRR(goldIds: string[], retrievedIds: string[]): number {
  if (goldIds.length === 0) return 1
  for (let i = 0; i < retrievedIds.length; i++) {
    if (goldIds.includes(retrievedIds[i])) {
      return 1 / (i + 1)
    }
  }
  return 0
}

/**
 * Citation Accuracy : proportion des articles attendus effectivement cités
 */
export function computeCitationAccuracy(answer: string, expectedArticles: string[]): number {
  if (!expectedArticles || expectedArticles.length === 0) return 1
  const found = expectedArticles.filter(article => {
    // Normaliser pour comparaison flexible
    const normalized = article.replace(/\s+/g, '\\s*')
    const regex = new RegExp(normalized, 'i')
    return regex.test(answer)
  }).length
  return found / expectedArticles.length
}

/**
 * Faithfulness via LLM judge (simplifié : vérifie que les key points sont couverts)
 * Version sans appel LLM — basée sur pattern matching des key points
 */
export function computeFaithfulness(
  question: string,
  answer: string,
  keyPoints: string[]
): number {
  if (keyPoints.length === 0) return 1
  const answerLower = answer.toLowerCase()
  const found = keyPoints.filter(kp => answerLower.includes(kp.toLowerCase())).length
  return found / keyPoints.length
}

// =============================================================================
// RECHERCHE RAG (via DB directement, pas via API)
// =============================================================================

interface SearchResult {
  chunkId: string
  documentId: string
  content: string
  similarity: number
  title: string
}

async function searchRAG(question: string, topK: number = 10): Promise<SearchResult[]> {
  // Recherche BM25 fulltext dans les chunks (pas besoin d'embeddings pour le benchmark)
  const result = await pool.query(
    `SELECT
       kbc.id as chunk_id,
       kbc.knowledge_base_id as document_id,
       kbc.content,
       kb.title,
       ts_rank(
         to_tsvector('simple', kbc.content),
         plainto_tsquery('simple', $1)
       ) as similarity
     FROM knowledge_base_chunks kbc
     JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
     WHERE kb.is_indexed = true
       AND to_tsvector('simple', kbc.content) @@ plainto_tsquery('simple', $1)
     ORDER BY similarity DESC
     LIMIT $2`,
    [question, topK]
  )

  return result.rows.map((r: Record<string, unknown>) => ({
    chunkId: r.chunk_id as string,
    documentId: r.document_id as string,
    content: (r.content as string).substring(0, 500),
    similarity: r.similarity as number,
    title: r.title as string,
  }))
}

// =============================================================================
// RUNNER PRINCIPAL
// =============================================================================

async function runEvaluation() {
  console.log('=== RAG Evaluation Benchmark ===\n')

  // Charger le gold dataset
  if (!fs.existsSync(GOLD_DATASET_PATH)) {
    console.error(`Gold dataset non trouvé: ${GOLD_DATASET_PATH}`)
    console.error('Exécutez d\'abord: npx tsx scripts/seed-gold-eval-dataset.ts')
    process.exit(1)
  }

  let goldCases: GoldEvalCase[] = JSON.parse(fs.readFileSync(GOLD_DATASET_PATH, 'utf-8'))

  // Filtres
  if (DOMAIN_FILTER) {
    goldCases = goldCases.filter(c => c.domain === DOMAIN_FILTER)
    console.log(`Filtré par domaine: ${DOMAIN_FILTER} (${goldCases.length} questions)`)
  }

  if (QUICK_MODE) {
    goldCases = goldCases.slice(0, 20)
    console.log(`Mode quick: ${goldCases.length} premières questions`)
  }

  console.log(`Total questions: ${goldCases.length}\n`)

  const runId = `eval_${new Date().toISOString().replace(/[:.]/g, '-')}_${crypto.randomBytes(4).toString('hex')}`
  const results: EvalResult[] = []

  for (let i = 0; i < goldCases.length; i++) {
    const evalCase = goldCases[i]
    const progress = `[${i + 1}/${goldCases.length}]`

    try {
      const startTime = Date.now()
      const searchResults = await searchRAG(evalCase.question)
      const latencyMs = Date.now() - startTime

      const retrievedChunkIds = searchResults.map(r => r.chunkId)
      const retrievedDocIds = searchResults.map(r => r.documentId)
      const goldChunkIds = evalCase.goldChunkIds || []
      const goldDocIds = evalCase.goldDocumentIds || []

      // Si pas de goldChunkIds, utiliser goldDocumentIds pour le recall
      const goldIdsForRecall = goldChunkIds.length > 0 ? goldChunkIds : goldDocIds
      const retrievedIdsForRecall = goldChunkIds.length > 0 ? retrievedChunkIds : retrievedDocIds

      // Calculer les métriques
      const recallAt1 = computeRecallAtK(goldIdsForRecall, retrievedIdsForRecall, 1)
      const recallAt3 = computeRecallAtK(goldIdsForRecall, retrievedIdsForRecall, 3)
      const recallAt5 = computeRecallAtK(goldIdsForRecall, retrievedIdsForRecall, 5)
      const recallAt10 = computeRecallAtK(goldIdsForRecall, retrievedIdsForRecall, 10)
      const precisionAt5 = computePrecisionAtK(goldIdsForRecall, retrievedIdsForRecall, 5)
      const mrr = computeMRR(goldIdsForRecall, retrievedIdsForRecall)

      // Simuler answer à partir des chunks retrouvés
      const simulatedAnswer = searchResults.map(r => r.content).join('\n')
      const citationAccuracy = computeCitationAccuracy(simulatedAnswer, evalCase.expectedArticles || [])
      const faithfulnessScore = computeFaithfulness(
        evalCase.question,
        simulatedAnswer,
        evalCase.expectedAnswer.keyPoints
      )

      const result: EvalResult = {
        questionId: evalCase.id,
        question: evalCase.question,
        domain: evalCase.domain,
        difficulty: evalCase.difficulty,
        intentType: evalCase.intentType,
        goldChunkIds: goldIdsForRecall,
        retrievedChunkIds,
        recallAt1,
        recallAt3,
        recallAt5,
        recallAt10,
        precisionAt5,
        mrr,
        faithfulnessScore,
        citationAccuracy,
        expectedAnswer: evalCase.expectedAnswer.keyPoints.join(' | '),
        actualAnswer: simulatedAnswer.substring(0, 1000),
        sourcesReturned: searchResults.map(r => ({ id: r.chunkId, title: r.title, score: r.similarity })),
        latencyMs,
      }

      results.push(result)

      // Affichage inline
      const hasGold = goldIdsForRecall.length > 0
      const status = !hasGold ? '⚪' : recallAt5 >= 0.8 ? '✅' : recallAt5 >= 0.4 ? '🟡' : '❌'
      const hitsCount = searchResults.length
      console.log(
        `${progress} ${status} ${evalCase.id} — hits:${hitsCount}, R@5:${recallAt5.toFixed(2)}, MRR:${mrr.toFixed(2)}, cite:${citationAccuracy.toFixed(2)}, ${latencyMs}ms`
      )
    } catch (error) {
      console.error(`${progress} ❌ ${evalCase.id} — Erreur: ${error instanceof Error ? error.message : error}`)
      results.push({
        questionId: evalCase.id,
        question: evalCase.question,
        domain: evalCase.domain,
        difficulty: evalCase.difficulty,
        intentType: evalCase.intentType,
        goldChunkIds: [],
        retrievedChunkIds: [],
        recallAt1: 0, recallAt3: 0, recallAt5: 0, recallAt10: 0,
        precisionAt5: 0, mrr: 0,
        faithfulnessScore: 0, citationAccuracy: 0,
        expectedAnswer: '', actualAnswer: '',
        sourcesReturned: [],
        latencyMs: 0,
      })
    }
  }

  // =============================================================================
  // RAPPORT RÉSUMÉ
  // =============================================================================

  console.log('\n' + '='.repeat(70))
  console.log('RAPPORT RÉSUMÉ')
  console.log('='.repeat(70))

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const withGold = results.filter(r => r.goldChunkIds.length > 0)
  const all = results

  console.log(`\nMétriques globales (${all.length} questions):`)
  console.log(`  Recall@1:    ${avg(all.map(r => r.recallAt1)).toFixed(3)}`)
  console.log(`  Recall@3:    ${avg(all.map(r => r.recallAt3)).toFixed(3)}`)
  console.log(`  Recall@5:    ${avg(all.map(r => r.recallAt5)).toFixed(3)}`)
  console.log(`  Recall@10:   ${avg(all.map(r => r.recallAt10)).toFixed(3)}`)
  console.log(`  Precision@5: ${avg(all.map(r => r.precisionAt5)).toFixed(3)}`)
  console.log(`  MRR:         ${avg(all.map(r => r.mrr)).toFixed(3)}`)
  console.log(`  Faithfulness:${avg(all.map(r => r.faithfulnessScore)).toFixed(3)}`)
  console.log(`  CitAccuracy: ${avg(all.map(r => r.citationAccuracy)).toFixed(3)}`)
  console.log(`  Avg Latency: ${avg(all.map(r => r.latencyMs)).toFixed(0)}ms`)

  if (withGold.length > 0 && withGold.length !== all.length) {
    console.log(`\nMétriques avec gold set (${withGold.length} questions):`)
    console.log(`  Recall@5:    ${avg(withGold.map(r => r.recallAt5)).toFixed(3)}`)
    console.log(`  MRR:         ${avg(withGold.map(r => r.mrr)).toFixed(3)}`)
  }

  // Par domaine
  const domains = [...new Set(all.map(r => r.domain))]
  console.log('\nPar domaine:')
  for (const domain of domains.sort()) {
    const domainResults = all.filter(r => r.domain === domain)
    console.log(
      `  ${domain.padEnd(20)} R@5:${avg(domainResults.map(r => r.recallAt5)).toFixed(2)} ` +
      `MRR:${avg(domainResults.map(r => r.mrr)).toFixed(2)} ` +
      `cite:${avg(domainResults.map(r => r.citationAccuracy)).toFixed(2)} ` +
      `(n=${domainResults.length})`
    )
  }

  // Par difficulté
  const difficulties = [...new Set(all.map(r => r.difficulty))]
  console.log('\nPar difficulté:')
  for (const diff of ['easy', 'medium', 'hard', 'expert']) {
    const diffResults = all.filter(r => r.difficulty === diff)
    if (diffResults.length === 0) continue
    console.log(
      `  ${diff.padEnd(10)} R@5:${avg(diffResults.map(r => r.recallAt5)).toFixed(2)} ` +
      `MRR:${avg(diffResults.map(r => r.mrr)).toFixed(2)} ` +
      `faith:${avg(diffResults.map(r => r.faithfulnessScore)).toFixed(2)} ` +
      `(n=${diffResults.length})`
    )
  }

  // Par intentType
  const intents = [...new Set(all.map(r => r.intentType))]
  console.log('\nPar type d\'intention:')
  for (const intent of intents.sort()) {
    const intentResults = all.filter(r => r.intentType === intent)
    console.log(
      `  ${intent.padEnd(18)} R@5:${avg(intentResults.map(r => r.recallAt5)).toFixed(2)} ` +
      `cite:${avg(intentResults.map(r => r.citationAccuracy)).toFixed(2)} ` +
      `(n=${intentResults.length})`
    )
  }

  // Cas échoués (R@5 < 0.5 et gold défini)
  const failed = withGold.filter(r => r.recallAt5 < 0.5)
  if (failed.length > 0) {
    console.log(`\nCas échoués (R@5 < 0.5, ${failed.length} cas):`)
    for (const f of failed) {
      console.log(`  ❌ ${f.questionId}: R@5=${f.recallAt5.toFixed(2)}, "${f.question.substring(0, 60)}..."`)
    }
  }

  // =============================================================================
  // PERSISTANCE EN DB
  // =============================================================================

  console.log(`\nPersistance dans rag_eval_results (run_id: ${runId})...`)
  try {
    for (const r of results) {
      await pool.query(
        `INSERT INTO rag_eval_results (
          run_id, question_id, question, language, domain, difficulty,
          gold_chunk_ids, retrieved_chunk_ids,
          recall_at_1, recall_at_3, recall_at_5, recall_at_10,
          precision_at_5, mrr, faithfulness_score, citation_accuracy,
          expected_answer, actual_answer, sources_returned, latency_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          runId, r.questionId, r.question,
          /[\u0600-\u06FF]/.test(r.question) ? 'ar' : 'fr',
          r.domain, r.difficulty,
          r.goldChunkIds, r.retrievedChunkIds,
          r.recallAt1, r.recallAt3, r.recallAt5, r.recallAt10,
          r.precisionAt5, r.mrr, r.faithfulnessScore, r.citationAccuracy,
          r.expectedAnswer, r.actualAnswer,
          JSON.stringify(r.sourcesReturned), r.latencyMs,
        ]
      )
    }
    console.log(`${results.length} résultats sauvegardés.`)
  } catch (error) {
    console.warn(`Erreur persistance DB (table rag_eval_results existe?):`, error instanceof Error ? error.message : error)
    console.warn('Lancez la migration: psql -f db/migrations/20260219000001_chunk_rich_metadata.sql')
  }

  await pool.end()
  console.log('\nBenchmark terminé.')
}

// =============================================================================
// MAIN
// =============================================================================

runEvaluation().catch(err => {
  console.error('Erreur fatale:', err)
  pool.end()
  process.exit(1)
})
