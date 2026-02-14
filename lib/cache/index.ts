/**
 * Cache module - Barrel export
 */

export * from './redis'
export * from './search-cache'
export * from './embedding-cache'
export * from './enhanced-search-cache'
export * from './classification-cache-service'
export * from './translation-cache'

// Re-export redis client
import { redis as redisClient } from './redis'

/**
 * Wrapper cache avec sérialisation JSON automatique
 */
export const cache = {
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key)
      if (!value) return null
      return JSON.parse(value) as T
    } catch (err) {
      console.error(`[Cache] Error getting ${key}:`, err)
      return null
    }
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value)
      if (ttlSeconds) {
        await redisClient.setEx(key, ttlSeconds, serialized)
      } else {
        await redisClient.set(key, serialized)
      }
      return true
    } catch (err) {
      console.error(`[Cache] Error setting ${key}:`, err)
      return false
    }
  },

  async del(key: string): Promise<boolean> {
    try {
      await redisClient.del(key)
      return true
    } catch (err) {
      console.error(`[Cache] Error deleting ${key}:`, err)
      return false
    }
  },
}
