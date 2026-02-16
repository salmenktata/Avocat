/**
 * Performance Utilities - Optimisations diverses
 *
 * @module lib/utils/performance-utils
 * @see Phase 4.7 - Optimisations Mineures
 */

import { NextResponse } from 'next/server'

/**
 * Cache Control Headers optimisés par type de contenu
 */
export const CACHE_HEADERS = {
  /**
   * Données statiques immuables (assets, bundles)
   * 1 an de cache
   */
  IMMUTABLE: {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },

  /**
   * Données fréquemment mises à jour (documents KB, jurisprudence)
   * 5 minutes de cache, revalidation
   */
  SHORT: {
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
  },

  /**
   * Données modérément dynamiques (profil utilisateur, stats)
   * 1 heure de cache
   */
  MEDIUM: {
    'Cache-Control': 'private, max-age=3600, stale-while-revalidate=300',
  },

  /**
   * Données rarement modifiées (catégories, configurations)
   * 24h de cache
   */
  LONG: {
    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
  },

  /**
   * Pas de cache (données sensibles, temps réel)
   */
  NO_CACHE: {
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
} as const

/**
 * Ajouter headers de cache optimaux à une réponse
 */
export function withCacheHeaders(
  response: NextResponse,
  cacheType: keyof typeof CACHE_HEADERS = 'SHORT'
): NextResponse {
  const headers = CACHE_HEADERS[cacheType]

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }

  return response
}

/**
 * Créer une réponse JSON avec headers de cache
 */
export function jsonResponse<T>(
  data: T,
  options: {
    status?: number
    cacheType?: keyof typeof CACHE_HEADERS
    headers?: Record<string, string>
  } = {}
): NextResponse {
  const { status = 200, cacheType = 'SHORT', headers = {} } = options

  const response = NextResponse.json(data, { status })

  // Ajouter cache headers
  if (cacheType) {
    const cacheHeaders = CACHE_HEADERS[cacheType]
    for (const [key, value] of Object.entries(cacheHeaders)) {
      response.headers.set(key, value)
    }
  }

  // Ajouter headers custom
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }

  return response
}

/**
 * Debounce une fonction (client-side uniquement)
 * Utile pour éviter trop d'appels API sur input utilisateur
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      func(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * Throttle une fonction (client-side)
 * Limite le nombre d'exécutions par unité de temps
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Mesurer le temps d'exécution d'une fonction
 */
export async function measurePerformance<T>(
  label: string,
  fn: () => T | Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start

  console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`)

  return { result, duration }
}

/**
 * Lazy loader pour images (placeholder → full)
 * Retourne un objet avec src optimisé
 */
export function getOptimizedImageSrc(
  src: string,
  options: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'avif' | 'jpg'
  } = {}
): string {
  const { width, height, quality = 75, format = 'webp' } = options

  // Si Next.js Image Optimization activé
  if (process.env.NEXT_PUBLIC_IMAGE_OPTIMIZATION === 'true') {
    const params = new URLSearchParams()
    if (width) params.set('w', width.toString())
    if (height) params.set('h', height.toString())
    params.set('q', quality.toString())
    params.set('f', format)

    return `/_next/image?url=${encodeURIComponent(src)}&${params.toString()}`
  }

  // Sinon retourner src brut
  return src
}

/**
 * Batch des requêtes (regrouper plusieurs appels en 1)
 * Utile pour éviter N+1 queries
 */
export class RequestBatcher<K, V> {
  private pending: Map<K, Array<(value: V) => void>> = new Map()
  private timeout: NodeJS.Timeout | null = null

  constructor(
    private batchFn: (keys: K[]) => Promise<Map<K, V>>,
    private delay: number = 10
  ) {}

  async load(key: K): Promise<V> {
    return new Promise<V>((resolve) => {
      // Ajouter à la queue
      if (!this.pending.has(key)) {
        this.pending.set(key, [])
      }
      this.pending.get(key)!.push(resolve)

      // Planifier l'exécution batch
      if (!this.timeout) {
        this.timeout = setTimeout(() => this.executeBatch(), this.delay)
      }
    })
  }

  private async executeBatch(): Promise<void> {
    const keys = Array.from(this.pending.keys())
    const callbacks = new Map(this.pending)

    // Reset
    this.pending.clear()
    this.timeout = null

    try {
      // Exécuter batch
      const results = await this.batchFn(keys)

      // Résoudre toutes les promises
      for (const [key, cbs] of callbacks.entries()) {
        const value = results.get(key)
        if (value !== undefined) {
          cbs.forEach((cb) => cb(value))
        }
      }
    } catch (error) {
      console.error('Batch execution failed:', error)
    }
  }
}

/**
 * Compression gzip (server-side)
 * Pour réponses API volumineuses
 */
export async function compressResponse(
  data: string
): Promise<{ compressed: Buffer; originalSize: number; compressedSize: number }> {
  const { gzip } = await import('zlib')
  const { promisify } = await import('util')

  const gzipAsync = promisify(gzip)
  const buffer = Buffer.from(data, 'utf-8')
  const compressed = await gzipAsync(buffer)

  return {
    compressed,
    originalSize: buffer.length,
    compressedSize: compressed.length,
  }
}

/**
 * Headers de compression pour réponses
 */
export function withCompressionHeaders(response: NextResponse): NextResponse {
  response.headers.set('Content-Encoding', 'gzip')
  response.headers.set('Vary', 'Accept-Encoding')
  return response
}

/**
 * Memoization simple (cache résultats fonction)
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    maxSize?: number
    ttl?: number
  } = {}
): T {
  const { maxSize = 100, ttl } = options
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>()

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args)

    // Vérifier cache
    const cached = cache.get(key)
    if (cached) {
      // Vérifier TTL si défini
      if (ttl && Date.now() - cached.timestamp > ttl) {
        cache.delete(key)
      } else {
        return cached.value
      }
    }

    // Calculer
    const value = fn(...args)

    // Stocker (LRU basique)
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value
      if (firstKey !== undefined) {
        cache.delete(firstKey)
      }
    }

    cache.set(key, { value, timestamp: Date.now() })

    return value
  }) as T
}

/**
 * Chunker pour itérer sur de grandes données
 * Évite de charger tout en mémoire
 */
export async function* chunkArray<T>(
  array: T[],
  chunkSize: number
): AsyncGenerator<T[]> {
  for (let i = 0; i < array.length; i += chunkSize) {
    yield array.slice(i, i + chunkSize)
  }
}

/**
 * Paralléliser avec limite de concurrence
 */
export async function parallelLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  const executing: Promise<void>[] = []

  for (const item of items) {
    const promise = fn(item).then((result) => {
      results.push(result)
    })

    executing.push(promise)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      )
    }
  }

  await Promise.all(executing)
  return results
}
