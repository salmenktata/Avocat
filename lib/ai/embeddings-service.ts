/**
 * Service de génération d'embeddings via OpenAI
 * Utilise text-embedding-3-small pour la recherche sémantique
 */

import OpenAI from 'openai'
import { aiConfig } from './config'

// =============================================================================
// CLIENT OPENAI
// =============================================================================

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!aiConfig.openai.apiKey) {
      throw new Error(
        'OPENAI_API_KEY non configuré - Impossible de générer des embeddings'
      )
    }
    openaiClient = new OpenAI({ apiKey: aiConfig.openai.apiKey })
  }
  return openaiClient
}

// =============================================================================
// TYPES
// =============================================================================

export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
}

export interface BatchEmbeddingResult {
  embeddings: number[][]
  totalTokens: number
}

// =============================================================================
// FONCTIONS PRINCIPALES
// =============================================================================

/**
 * Génère un embedding pour un texte unique
 * @param text - Texte à encoder (max ~8000 tokens)
 * @returns Vecteur embedding de dimension 1536
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const client = getOpenAIClient()

  // Tronquer le texte si trop long (text-embedding-3-small supporte max 8191 tokens)
  const truncatedText = text.substring(0, 30000) // ~8k tokens approximatif

  const response = await client.embeddings.create({
    model: aiConfig.openai.embeddingModel,
    input: truncatedText,
    encoding_format: 'float',
  })

  return {
    embedding: response.data[0].embedding,
    tokenCount: response.usage.total_tokens,
  }
}

/**
 * Génère des embeddings pour plusieurs textes en batch
 * Plus efficace que des appels individuels
 * @param texts - Liste de textes à encoder
 * @returns Liste de vecteurs embeddings
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    return { embeddings: [], totalTokens: 0 }
  }

  const client = getOpenAIClient()

  // Tronquer chaque texte
  const truncatedTexts = texts.map((t) => t.substring(0, 30000))

  // OpenAI accepte jusqu'à 2048 textes par batch
  const batchSize = 100 // Limiter pour éviter timeouts
  const allEmbeddings: number[][] = []
  let totalTokens = 0

  for (let i = 0; i < truncatedTexts.length; i += batchSize) {
    const batch = truncatedTexts.slice(i, i + batchSize)

    const response = await client.embeddings.create({
      model: aiConfig.openai.embeddingModel,
      input: batch,
      encoding_format: 'float',
    })

    // Les embeddings sont retournés dans l'ordre des inputs
    for (const item of response.data) {
      allEmbeddings.push(item.embedding)
    }

    totalTokens += response.usage.total_tokens
  }

  return {
    embeddings: allEmbeddings,
    totalTokens,
  }
}

/**
 * Calcule la similarité cosinus entre deux vecteurs
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Les vecteurs doivent avoir la même dimension')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Formate un vecteur pour l'insertion PostgreSQL/pgvector
 * @param embedding - Vecteur numérique
 * @returns String au format pgvector '[0.1, 0.2, ...]'
 */
export function formatEmbeddingForPostgres(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Parse un vecteur depuis le format PostgreSQL
 */
export function parseEmbeddingFromPostgres(pgVector: string): number[] {
  // Format: '[0.1, 0.2, ...]' ou '(0.1, 0.2, ...)'
  const cleaned = pgVector.replace(/[\[\]\(\)]/g, '')
  return cleaned.split(',').map((s) => parseFloat(s.trim()))
}

// =============================================================================
// UTILITAIRES
// =============================================================================

/**
 * Estime le nombre de tokens dans un texte
 * Approximation: ~4 caractères = 1 token pour le français
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Vérifie si le service d'embeddings est disponible
 */
export function isEmbeddingsServiceAvailable(): boolean {
  return !!aiConfig.openai.apiKey
}
