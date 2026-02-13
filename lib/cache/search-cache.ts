/**
 * Cache Redis pour les résultats de recherche sémantique
 *
 * Cache les résultats de recherche basés sur la similarité de l'embedding.
 * Si un nouvel embedding a une similarité > 0.95 avec un embedding caché,
 * on retourne les résultats cachés.
 *
 * TTL: 1 heure par défaut.
 */

import {
  getRedisClient,
  isRedisAvailable,
  hashKey,
  REDIS_KEYS,
  CACHE_TTL,
  SEARCH_CACHE_THRESHOLD,
} from './redis'
import { cosineSimilarity } from '@/lib/ai/embeddings-service'

// =============================================================================
// TYPES
// =============================================================================

export interface SearchScope {
  userId: string
  dossierId?: string
}

interface CachedSearchEntry {
  embedding: number[]
  results: unknown[]
  createdAt: number
}

export interface CacheMetrics {
  hits: number
  misses: number
  sets: number
  hitRate: number
}

// =============================================================================
// MÉTRIQUES CACHE
// =============================================================================

/**
 * Enregistre une métrique de cache (hit, miss, set)
 * Stocke les compteurs par jour avec TTL de 7 jours
 */
export async function recordCacheMetrics(type: 'hit' | 'miss' | 'set'): Promise<void> {
  if (!isRedisAvailable()) {
    return
  }

  try {
    const client = await getRedisClient()
    if (!client) return

    const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const key = `cache:metrics:${type}:${day}`

    await client.incr(key)
    await client.expire(key, 86400 * 7) // 7 jours
  } catch (error) {
    // Silent fail - ne pas bloquer la recherche pour un problème de métriques
    console.warn(
      '[SearchCache] Erreur recording metrics:',
      error instanceof Error ? error.message : error
    )
  }
}

/**
 * Récupère les métriques de cache pour une journée
 */
export async function getCacheMetricsForDay(day: string): Promise<CacheMetrics> {
  const defaultMetrics: CacheMetrics = { hits: 0, misses: 0, sets: 0, hitRate: 0 }

  if (!isRedisAvailable()) {
    return defaultMetrics
  }

  try {
    const client = await getRedisClient()
    if (!client) return defaultMetrics

    const [hits, misses, sets] = await Promise.all([
      client.get(`cache:metrics:hit:${day}`),
      client.get(`cache:metrics:miss:${day}`),
      client.get(`cache:metrics:set:${day}`),
    ])

    const hitsNum = parseInt(hits || '0')
    const missesNum = parseInt(misses || '0')
    const setsNum = parseInt(sets || '0')
    const total = hitsNum + missesNum
    const hitRate = total > 0 ? (hitsNum / total) * 100 : 0

    return {
      hits: hitsNum,
      misses: missesNum,
      sets: setsNum,
      hitRate,
    }
  } catch (error) {
    console.warn(
      '[SearchCache] Erreur lecture metrics:',
      error instanceof Error ? error.message : error
    )
    return defaultMetrics
  }
}

/**
 * Récupère les métriques de cache pour les N derniers jours
 */
export async function getCacheMetricsHistory(days: number = 7): Promise<Record<string, CacheMetrics>> {
  const history: Record<string, CacheMetrics> = {}

  const today = new Date()
  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const day = date.toISOString().slice(0, 10)
    history[day] = await getCacheMetricsForDay(day)
  }

  return history
}

// =============================================================================
// CACHE RECHERCHE
// =============================================================================

/**
 * Génère une clé de scope pour le cache
 */
function getScopeKey(scope: SearchScope): string {
  if (scope.dossierId) {
    return `u:${scope.userId}:d:${scope.dossierId}`
  }
  return `u:${scope.userId}`
}

/**
 * Récupère des résultats de recherche du cache
 * Recherche un embedding similaire (> threshold) dans le cache
 *
 * @param embedding - Embedding de la requête
 * @param scope - Scope de recherche (userId, dossierId)
 * @returns Résultats si trouvés, null sinon
 */
export async function getCachedSearchResults(
  embedding: number[],
  scope: SearchScope
): Promise<unknown[] | null> {
  if (!isRedisAvailable()) {
    return null
  }

  try {
    const client = await getRedisClient()
    if (!client) return null

    const scopeKey = getScopeKey(scope)
    const indexKey = REDIS_KEYS.searchIndex(scopeKey)

    // Récupérer la liste des clés de recherche pour ce scope
    const searchKeys = await client.sMembers(indexKey)

    if (searchKeys.length === 0) {
      return null
    }

    // Chercher un embedding similaire dans le cache
    for (const key of searchKeys) {
      const cached = await client.get(key)
      if (!cached) continue

      const entry = JSON.parse(cached) as CachedSearchEntry

      // Calculer la similarité
      const similarity = cosineSimilarity(embedding, entry.embedding)

      if (similarity >= SEARCH_CACHE_THRESHOLD) {
        console.log(
          `[SearchCache] HIT: similarity=${similarity.toFixed(4)} (threshold=${SEARCH_CACHE_THRESHOLD})`
        )
        await recordCacheMetrics('hit')
        return entry.results
      }
    }

    // Aucun résultat similaire trouvé = miss
    await recordCacheMetrics('miss')
    return null
  } catch (error) {
    console.warn(
      '[SearchCache] Erreur lecture:',
      error instanceof Error ? error.message : error
    )
    return null
  }
}

/**
 * Stocke des résultats de recherche dans le cache
 *
 * @param embedding - Embedding de la requête
 * @param results - Résultats de recherche
 * @param scope - Scope de recherche
 */
export async function setCachedSearchResults(
  embedding: number[],
  results: unknown[],
  scope: SearchScope
): Promise<void> {
  if (!isRedisAvailable()) {
    return
  }

  try {
    const client = await getRedisClient()
    if (!client) return

    const scopeKey = getScopeKey(scope)
    const hash = await hashKey(embedding.slice(0, 50).join(',')) // Hash partiel pour perf
    const key = REDIS_KEYS.search(hash, scopeKey)
    const indexKey = REDIS_KEYS.searchIndex(scopeKey)

    const entry: CachedSearchEntry = {
      embedding,
      results,
      createdAt: Date.now(),
    }

    // Stocker l'entrée avec TTL
    await client.setEx(key, CACHE_TTL.search, JSON.stringify(entry))

    // Ajouter la clé à l'index du scope
    await client.sAdd(indexKey, key)
    await client.expire(indexKey, CACHE_TTL.search * 2) // Index expire après les entrées

    // Enregistrer métrique
    await recordCacheMetrics('set')

    console.log(
      `[SearchCache] SET: ${hash.substring(0, 8)}... scope=${scopeKey} (TTL: ${CACHE_TTL.search}s)`
    )

    // Limiter le nombre d'entrées par scope (max 100)
    const indexSize = await client.sCard(indexKey)
    if (indexSize > 100) {
      // Supprimer les entrées les plus anciennes
      const oldKeys = await client.sMembers(indexKey)
      const keysToRemove = oldKeys.slice(0, indexSize - 100)
      for (const oldKey of keysToRemove) {
        await client.del(oldKey)
        await client.sRem(indexKey, oldKey)
      }
    }
  } catch (error) {
    console.warn(
      '[SearchCache] Erreur écriture:',
      error instanceof Error ? error.message : error
    )
  }
}

/**
 * Invalide le cache de recherche pour un scope
 */
export async function invalidateSearchCache(scope: SearchScope): Promise<void> {
  if (!isRedisAvailable()) {
    return
  }

  try {
    const client = await getRedisClient()
    if (!client) return

    const scopeKey = getScopeKey(scope)
    const indexKey = REDIS_KEYS.searchIndex(scopeKey)

    // Supprimer toutes les entrées du scope
    const keys = await client.sMembers(indexKey)
    for (const key of keys) {
      await client.del(key)
    }
    await client.del(indexKey)

    console.log(`[SearchCache] Invalidé scope=${scopeKey} (${keys.length} entrées)`)
  } catch (error) {
    console.warn(
      '[SearchCache] Erreur invalidation:',
      error instanceof Error ? error.message : error
    )
  }
}

/**
 * Statistiques du cache de recherche
 */
export async function getSearchCacheStats(): Promise<{
  available: boolean
  scopeCount?: number
  totalEntries?: number
}> {
  if (!isRedisAvailable()) {
    return { available: false }
  }

  try {
    const client = await getRedisClient()
    if (!client) return { available: false }

    // Compter les index de scope
    const indexKeys = await client.keys('search_idx:*')

    // Compter le total d'entrées
    const searchKeys = await client.keys('search:*')

    return {
      available: true,
      scopeCount: indexKeys.length,
      totalEntries: searchKeys.length,
    }
  } catch {
    return { available: false }
  }
}
