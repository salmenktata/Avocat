#!/usr/bin/env npx tsx
/**
 * Script CLI interactif pour annoter les goldChunkIds du gold eval dataset
 *
 * Pour chaque question sans goldChunkIds :
 * 1. Génère l'embedding de la question
 * 2. Recherche hybrid les chunks les plus pertinents
 * 3. Affiche le top-15 pour validation manuelle
 * 4. Écrit les goldChunkIds dans le JSON (crash-safe)
 *
 * Usage :
 *   npx tsx scripts/annotate-gold-chunks.ts              # Mode interactif
 *   npx tsx scripts/annotate-gold-chunks.ts --batch=5     # 5 questions max
 *   npx tsx scripts/annotate-gold-chunks.ts --auto        # Auto-accept ≥0.60
 *   npx tsx scripts/annotate-gold-chunks.ts --id=civil_easy_01  # Une seule question
 *   npx tsx scripts/annotate-gold-chunks.ts --difficulty=hard,expert  # Filtrer par difficulté
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { Pool } from 'pg'
import { generateEmbedding, formatEmbeddingForPostgres } from '../lib/ai/embeddings-service'

// =============================================================================
// CONFIG
// =============================================================================

const GOLD_DATASET_PATH = path.join(process.cwd(), 'data', 'gold-eval-dataset.json')
const AUTO_MODE = process.argv.includes('--auto')
const BATCH_SIZE = parseInt(process.argv.find(a => a.startsWith('--batch='))?.split('=')[1] || '0', 10)
const SINGLE_ID = process.argv.find(a => a.startsWith('--id='))?.split('=')[1]
const DIFFICULTY_FILTER = process.argv.find(a => a.startsWith('--difficulty='))?.split('=')[1]?.split(',')

const pool = new Pool({
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
  [key: string]: unknown
}

interface ChunkResult {
  chunk_id: string
  document_id: string
  content: string
  title: string
  similarity: number
  category: string | null
}

// =============================================================================
// SEARCH
// =============================================================================

async function searchChunksHybrid(question: string, limit: number = 15): Promise<ChunkResult[]> {
  // Générer embedding OpenAI
  const embeddingResult = await generateEmbedding(question)
  const embeddingStr = formatEmbeddingForPostgres(embeddingResult.embedding)

  // Recherche hybrid via la fonction SQL
  const result = await pool.query(
    `SELECT
       kbc.id as chunk_id,
       kbc.knowledge_base_id as document_id,
       kbc.content,
       kb.title,
       kb.category,
       1 - (kbc.embedding_openai <=> $1::vector) as similarity
     FROM knowledge_base_chunks kbc
     JOIN knowledge_base kb ON kbc.knowledge_base_id = kb.id
     WHERE kb.is_indexed = true
       AND kbc.embedding_openai IS NOT NULL
     ORDER BY kbc.embedding_openai <=> $1::vector
     LIMIT $2`,
    [embeddingStr, limit]
  )

  return result.rows.map((r: Record<string, unknown>) => ({
    chunk_id: r.chunk_id as string,
    document_id: r.document_id as string,
    content: r.content as string,
    title: r.title as string,
    similarity: parseFloat(r.similarity as string),
    category: r.category as string | null,
  }))
}

// =============================================================================
// INTERACTIVE PROMPT
// =============================================================================

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

async function askQuestion(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, answer => resolve(answer.trim()))
  })
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('=== Annotation goldChunkIds ===\n')

  // Charger le dataset
  if (!fs.existsSync(GOLD_DATASET_PATH)) {
    console.error(`Dataset non trouvé: ${GOLD_DATASET_PATH}`)
    process.exit(1)
  }

  let goldCases: GoldEvalCase[] = JSON.parse(fs.readFileSync(GOLD_DATASET_PATH, 'utf-8'))

  // Filtrer : seulement les questions sans goldChunkIds
  let toAnnotate = goldCases.filter(c => !c.goldChunkIds || c.goldChunkIds.length === 0)

  if (SINGLE_ID) {
    toAnnotate = toAnnotate.filter(c => c.id === SINGLE_ID)
    if (toAnnotate.length === 0) {
      const existing = goldCases.find(c => c.id === SINGLE_ID)
      if (existing?.goldChunkIds?.length) {
        console.log(`Question ${SINGLE_ID} déjà annotée (${existing.goldChunkIds.length} chunks)`)
      } else {
        console.error(`Question ${SINGLE_ID} non trouvée`)
      }
      process.exit(0)
    }
  }

  if (DIFFICULTY_FILTER) {
    toAnnotate = toAnnotate.filter(c => DIFFICULTY_FILTER.includes(c.difficulty))
    console.log(`Filtré par difficulté: ${DIFFICULTY_FILTER.join(', ')}`)
  }

  if (BATCH_SIZE > 0) {
    toAnnotate = toAnnotate.slice(0, BATCH_SIZE)
  }

  const totalToAnnotate = toAnnotate.length
  const totalAnnotated = goldCases.filter(c => c.goldChunkIds && c.goldChunkIds.length > 0).length

  console.log(`Total questions: ${goldCases.length}`)
  console.log(`Déjà annotées: ${totalAnnotated}`)
  console.log(`À annoter: ${totalToAnnotate}\n`)

  if (totalToAnnotate === 0) {
    console.log('Toutes les questions sont déjà annotées !')
    await pool.end()
    process.exit(0)
  }

  const rl = AUTO_MODE ? null : createReadline()
  let annotatedCount = 0

  for (let i = 0; i < toAnnotate.length; i++) {
    const evalCase = toAnnotate[i]
    const progress = `[${i + 1}/${totalToAnnotate}]`

    console.log(`\n${'='.repeat(70)}`)
    console.log(`${progress} ${evalCase.id} (${evalCase.domain}, ${evalCase.difficulty})`)
    console.log(`Question: ${evalCase.question}`)
    console.log(`Key points: ${evalCase.expectedAnswer.keyPoints.join(' | ')}`)
    console.log(`${'─'.repeat(70)}`)

    try {
      const chunks = await searchChunksHybrid(evalCase.question)

      if (chunks.length === 0) {
        console.log('  ⚠️ Aucun chunk trouvé — skip')
        continue
      }

      // Afficher les chunks
      for (let j = 0; j < chunks.length; j++) {
        const c = chunks[j]
        const excerpt = c.content.replace(/\n/g, ' ').substring(0, 200)
        const simPct = (c.similarity * 100).toFixed(1)
        console.log(`  [${j + 1}] ${simPct}% | ${c.category || '?'} | ${c.title?.substring(0, 50) || 'Sans titre'}`)
        console.log(`      ${excerpt}...`)
      }

      let selectedIds: string[]

      if (AUTO_MODE) {
        // Auto-accept chunks ≥ 0.60
        selectedIds = chunks
          .filter(c => c.similarity >= 0.60)
          .map(c => c.chunk_id)
        console.log(`  → Auto-accept: ${selectedIds.length} chunks ≥ 60%`)
      } else {
        // Mode interactif
        const answer = await askQuestion(rl!, `\n  Numéros à valider (ex: "1,2,5"), 'a' (auto ≥0.60), 's' (skip): `)

        if (answer.toLowerCase() === 's') {
          console.log('  → Skipped')
          continue
        }

        if (answer.toLowerCase() === 'a') {
          selectedIds = chunks
            .filter(c => c.similarity >= 0.60)
            .map(c => c.chunk_id)
          console.log(`  → Auto: ${selectedIds.length} chunks ≥ 60%`)
        } else {
          const indices = answer.split(',').map(n => parseInt(n.trim()) - 1).filter(n => n >= 0 && n < chunks.length)
          selectedIds = indices.map(idx => chunks[idx].chunk_id)
        }
      }

      if (selectedIds.length === 0) {
        console.log('  ⚠️ Aucun chunk sélectionné — skip')
        continue
      }

      // Collecter aussi les document IDs uniques
      const selectedDocIds = [...new Set(
        selectedIds.map(chunkId => {
          const chunk = chunks.find(c => c.chunk_id === chunkId)
          return chunk?.document_id
        }).filter(Boolean) as string[]
      )]

      // Mettre à jour le dataset (crash-safe : écrire après chaque question)
      const caseIndex = goldCases.findIndex(c => c.id === evalCase.id)
      if (caseIndex >= 0) {
        goldCases[caseIndex].goldChunkIds = selectedIds
        goldCases[caseIndex].goldDocumentIds = selectedDocIds
        fs.writeFileSync(GOLD_DATASET_PATH, JSON.stringify(goldCases, null, 2) + '\n')
        annotatedCount++
        console.log(`  ✅ ${selectedIds.length} chunks, ${selectedDocIds.length} docs — sauvegardé`)
      }
    } catch (error) {
      console.error(`  ❌ Erreur: ${error instanceof Error ? error.message : error}`)
    }
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log(`Annotation terminée: ${annotatedCount} questions annotées sur ${totalToAnnotate}`)
  console.log(`Total annotées: ${totalAnnotated + annotatedCount}/${goldCases.length}`)

  if (rl) rl.close()
  await pool.end()
}

main().catch(err => {
  console.error('Erreur fatale:', err)
  pool.end()
  process.exit(1)
})
