/**
 * RediSearch Service - Recherche vectorielle KB ultra-rapide
 * Optionnel: Activer uniquement si latence RAG >1.5s après Phase 1
 *
 * @module lib/cache/redisearch-kb-service
 * @see Phase 4.7 - Optimisations - Redis Stack RediSearch
 * @see docs/RAG_OPTIMIZATION_PHASE2.md
 */

import { getRedisClient } from '@/lib/cache/redis'
import { createLogger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/utils/error-utils'

const log = createLogger('Cache:RediSearch')

/**
 * Configuration RediSearch
 */
const REDISEARCH_ENABLED = process.env.USE_REDISEARCH === 'true'
const INDEX_NAME = 'idx:kb_chunks'
const KEY_PREFIX = 'kb:chunk:'

/**
 * KB Chunk pour indexation
 */
export interface RediSearchKBChunk {
  id: string
  kb_id: string
  content: string
  category: string
  language: string
  embedding?: number[]
  metadata?: Record<string, unknown>
}

/**
 * Résultat de recherche
 */
export interface RediSearchResult {
  id: string
  kb_id: string
  content: string
  category: string
  score: number
  metadata?: Record<string, unknown>
}

/**
 * Statistiques index
 */
export interface RediSearchStats {
  indexExists: boolean
  numDocs: number
  numTerms: number
  numRecords: number
  indexingProgress: number
}

/**
 * Vérifie si RediSearch est activé
 */
export function isRediSearchEnabled(): boolean {
  return REDISEARCH_ENABLED
}

/**
 * Créer l'index RediSearch pour la KB
 * À appeler une seule fois au setup initial
 */
export async function createKBIndex(force: boolean = false): Promise<void> {
  if (!REDISEARCH_ENABLED) {
    log.warn('RediSearch disabled, skipping index creation')
    return
  }

  const redis = await getRedisClient()
  if (!redis) {
    throw new Error('Redis client unavailable')
  }

  try {
    // Vérifier si l'index existe déjà
    try {
      await redis.sendCommand(['FT.INFO', INDEX_NAME])

      if (!force) {
        log.info('RediSearch index already exists', { indexName: INDEX_NAME })
        return
      }

      // Supprimer l'index existant
      await redis.sendCommand(['FT.DROPINDEX', INDEX_NAME, 'DD'])
      log.info('Dropped existing index', { indexName: INDEX_NAME })
    } catch (error) {
      // Index n'existe pas, c'est OK
      const errMsg = getErrorMessage(error)
      if (!errMsg.includes('Unknown Index name')) {
        throw error
      }
    }

    // Créer le nouvel index
    // Schema: kb_id (TAG), content (TEXT), category (TAG), language (TAG)
    await redis.sendCommand([
      'FT.CREATE',
      INDEX_NAME,
      'ON',
      'HASH',
      'PREFIX',
      '1',
      KEY_PREFIX,
      'SCHEMA',
      'kb_id',
      'TAG',
      'SEPARATOR',
      '|',
      'content',
      'TEXT',
      'WEIGHT',
      '1.0',
      'category',
      'TAG',
      'SEPARATOR',
      '|',
      'language',
      'TAG',
      'SEPARATOR',
      '|',
    ])

    log.info('RediSearch index created successfully', { indexName: INDEX_NAME })
  } catch (error) {
    log.error('Failed to create RediSearch index', { error })
    throw error
  }
}

/**
 * Indexer un chunk KB dans RediSearch
 */
export async function indexChunk(chunk: RediSearchKBChunk): Promise<void> {
  if (!REDISEARCH_ENABLED) {
    return
  }

  const redis = await getRedisClient()
  if (!redis) {
    log.warn('Redis unavailable, skipping chunk indexation')
    return
  }

  try {
    const key = `${KEY_PREFIX}${chunk.id}`

    // Indexer en utilisant HSET (RediSearch indexe automatiquement)
    await redis.hSet(key, {
      kb_id: chunk.kb_id,
      content: chunk.content,
      category: chunk.category,
      language: chunk.language,
      // metadata en JSON si présente
      ...(chunk.metadata && { metadata: JSON.stringify(chunk.metadata) }),
    })

    log.debug('Chunk indexed in RediSearch', { chunkId: chunk.id, kb_id: chunk.kb_id })
  } catch (error) {
    log.error('Failed to index chunk', { error, chunkId: chunk.id })
    // Ne pas throw - continuer même si Redis échoue
  }
}

/**
 * Indexer plusieurs chunks en batch
 */
export async function indexChunksBatch(chunks: RediSearchKBChunk[]): Promise<number> {
  if (!REDISEARCH_ENABLED || chunks.length === 0) {
    return 0
  }

  const redis = await getRedisClient()
  if (!redis) {
    log.warn('Redis unavailable, skipping batch indexation')
    return 0
  }

  let indexed = 0

  try {
    // Utiliser pipeline pour batch
    const pipeline = redis.multi()

    for (const chunk of chunks) {
      const key = `${KEY_PREFIX}${chunk.id}`
      pipeline.hSet(key, {
        kb_id: chunk.kb_id,
        content: chunk.content,
        category: chunk.category,
        language: chunk.language,
        ...(chunk.metadata && { metadata: JSON.stringify(chunk.metadata) }),
      })
    }

    await pipeline.exec()
    indexed = chunks.length

    log.info('Batch indexed successfully', { count: indexed })
  } catch (error) {
    log.error('Failed to index batch', { error, count: chunks.length })
  }

  return indexed
}

/**
 * Rechercher dans la KB via RediSearch (texte full-text)
 */
export async function searchKB(
  query: string,
  options: {
    category?: string
    language?: string
    limit?: number
  } = {}
): Promise<RediSearchResult[]> {
  if (!REDISEARCH_ENABLED) {
    return []
  }

  const redis = await getRedisClient()
  if (!redis) {
    log.warn('Redis unavailable, returning empty results')
    return []
  }

  const { category, language, limit = 10 } = options

  try {
    // Construire la requête FT.SEARCH
    const filters: string[] = []

    // Filtre texte
    if (query && query.trim()) {
      filters.push(query.trim())
    } else {
      filters.push('*') // Tous les documents
    }

    // Filtre catégorie
    if (category) {
      filters.push(`@category:{${category}}`)
    }

    // Filtre langue
    if (language) {
      filters.push(`@language:{${language}}`)
    }

    const searchQuery = filters.join(' ')

    // Exécuter la recherche
    const result = await redis.sendCommand([
      'FT.SEARCH',
      INDEX_NAME,
      searchQuery,
      'LIMIT',
      '0',
      limit.toString(),
      'SORTBY',
      '_score',
      'DESC',
    ])

    // Parser les résultats
    // Format: [totalResults, [key1, [field1, value1, field2, value2, ...]], ...]
    if (!Array.isArray(result) || result.length < 1) {
      return []
    }

    const totalResults = result[0] as number
    if (totalResults === 0) {
      return []
    }

    const results: RediSearchResult[] = []

    for (let i = 1; i < result.length; i += 2) {
      const key = result[i] as string
      const fields = result[i + 1] as string[]

      // Parser fields array [field1, value1, field2, value2, ...]
      const doc: Record<string, string> = {}
      for (let j = 0; j < fields.length; j += 2) {
        doc[fields[j]] = fields[j + 1]
      }

      results.push({
        id: key.replace(KEY_PREFIX, ''),
        kb_id: doc.kb_id || '',
        content: doc.content || '',
        category: doc.category || '',
        score: 1.0, // RediSearch ne retourne pas le score dans ce format simple
        metadata: doc.metadata ? JSON.parse(doc.metadata) : undefined,
      })
    }

    log.info('RediSearch query executed', {
      query: searchQuery,
      totalResults,
      returned: results.length,
    })

    return results
  } catch (error) {
    log.error('RediSearch query failed', { error, query })
    return []
  }
}

/**
 * Obtenir les statistiques de l'index
 */
export async function getIndexStats(): Promise<RediSearchStats | null> {
  if (!REDISEARCH_ENABLED) {
    return null
  }

  const redis = await getRedisClient()
  if (!redis) {
    return null
  }

  try {
    const info = await redis.sendCommand(['FT.INFO', INDEX_NAME])

    // Parser info array [key1, value1, key2, value2, ...]
    const infoMap: Record<string, unknown> = {}
    if (Array.isArray(info)) {
      for (let i = 0; i < info.length; i += 2) {
        infoMap[info[i] as string] = info[i + 1]
      }
    }

    return {
      indexExists: true,
      numDocs: Number(infoMap.num_docs || 0),
      numTerms: Number(infoMap.num_terms || 0),
      numRecords: Number(infoMap.num_records || 0),
      indexingProgress: Number(infoMap.percent_indexed || 0),
    }
  } catch (error) {
    const errMsg = getErrorMessage(error)
    if (errMsg.includes('Unknown Index name')) {
      return {
        indexExists: false,
        numDocs: 0,
        numTerms: 0,
        numRecords: 0,
        indexingProgress: 0,
      }
    }

    log.error('Failed to get index stats', { error })
    return null
  }
}

/**
 * Supprimer un chunk de l'index
 */
export async function deleteChunk(chunkId: string): Promise<void> {
  if (!REDISEARCH_ENABLED) {
    return
  }

  const redis = await getRedisClient()
  if (!redis) {
    return
  }

  try {
    const key = `${KEY_PREFIX}${chunkId}`
    await redis.del(key)
    log.debug('Chunk deleted from RediSearch', { chunkId })
  } catch (error) {
    log.error('Failed to delete chunk', { error, chunkId })
  }
}

/**
 * Vider complètement l'index (pour réindexation)
 */
export async function clearIndex(): Promise<void> {
  if (!REDISEARCH_ENABLED) {
    return
  }

  const redis = await getRedisClient()
  if (!redis) {
    throw new Error('Redis client unavailable')
  }

  try {
    // Supprimer l'index ET les documents (DD = Delete Documents)
    await redis.sendCommand(['FT.DROPINDEX', INDEX_NAME, 'DD'])
    log.info('RediSearch index cleared', { indexName: INDEX_NAME })

    // Recréer l'index vide
    await createKBIndex()
  } catch (error) {
    log.error('Failed to clear index', { error })
    throw error
  }
}
