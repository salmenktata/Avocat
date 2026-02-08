import { describe, it, expect, vi } from 'vitest'
import { calculateBackoffDelay, isRetryableError, withRetry, DEFAULT_RETRY_CONFIG } from '../retry-utils'

describe('retry-utils', () => {
  describe('calculateBackoffDelay', () => {
    it('calcule délai exponentiel', () => {
      const delays = [0, 1, 2, 3].map(attempt => calculateBackoffDelay(attempt))

      // Vérifier progression exponentielle (avec marge pour jitter)
      expect(delays[1]).toBeGreaterThan(1500)  // ~2000ms ± 20%
      expect(delays[1]).toBeLessThan(2500)
      expect(delays[2]).toBeGreaterThan(3000)  // ~4000ms ± 20%
      expect(delays[2]).toBeLessThan(5000)
    })

    it('respecte maxDelayMs (avec marge pour jitter)', () => {
      const delay = calculateBackoffDelay(10, DEFAULT_RETRY_CONFIG)
      // Le jitter peut ajouter jusqu'à 20% au maxDelayMs
      const maxWithJitter = DEFAULT_RETRY_CONFIG.maxDelayMs * 1.2
      expect(delay).toBeLessThanOrEqual(maxWithJitter)
    })

    it('ajoute du jitter pour éviter thundering herd', () => {
      const delays = Array.from({ length: 10 }, () => calculateBackoffDelay(2))
      const uniqueDelays = new Set(delays)

      // Les délais doivent être variés (jitter)
      expect(uniqueDelays.size).toBeGreaterThan(1)
    })
  })

  describe('isRetryableError', () => {
    it('détecte status codes retryable', () => {
      expect(isRetryableError(new Error(), 429)).toBe(true)
      expect(isRetryableError(new Error(), 503)).toBe(true)
      expect(isRetryableError(new Error(), 504)).toBe(true)
      expect(isRetryableError(new Error(), 408)).toBe(true)
      expect(isRetryableError(new Error(), 404)).toBe(false)
      expect(isRetryableError(new Error(), 200)).toBe(false)
    })

    it('détecte erreurs réseau', () => {
      const timeoutError = new Error('Request timeout')
      ;(timeoutError as any).code = 'ETIMEDOUT'
      expect(isRetryableError(timeoutError)).toBe(true)

      const connError = new Error('Connection reset')
      ;(connError as any).code = 'ECONNRESET'
      expect(isRetryableError(connError)).toBe(true)
    })

    it('détecte timeout dans message', () => {
      const error = new Error('Operation timeout')
      expect(isRetryableError(error)).toBe(true)
    })

    it('ne retry pas les bannissements', () => {
      const banError = new Error('BAN_DETECTED: Captcha détecté')
      expect(isRetryableError(banError)).toBe(false)
    })
  })

  describe('withRetry', () => {
    it('retry sur échec puis succès', async () => {
      let attempts = 0
      const operation = vi.fn(async () => {
        attempts++
        if (attempts < 3) throw new Error('Temporary error')
        return 'success'
      })

      const result = await withRetry(
        operation,
        () => true,
        { ...DEFAULT_RETRY_CONFIG, initialDelayMs: 10 }
      )

      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('abandonne après maxRetries', async () => {
      const operation = vi.fn(async () => {
        throw new Error('Persistent error')
      })

      await expect(
        withRetry(operation, () => true, { ...DEFAULT_RETRY_CONFIG, maxRetries: 2, initialDelayMs: 10 })
      ).rejects.toThrow('Persistent error')

      expect(operation).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
    })

    it('ne retry pas si shouldRetry retourne false', async () => {
      const operation = vi.fn(async () => {
        throw new Error('Non-retryable error')
      })

      await expect(
        withRetry(operation, () => false, { ...DEFAULT_RETRY_CONFIG, initialDelayMs: 10 })
      ).rejects.toThrow('Non-retryable error')

      expect(operation).toHaveBeenCalledTimes(1) // Pas de retry
    })

    it('appelle onRetry callback', async () => {
      let attempts = 0
      const operation = async () => {
        attempts++
        if (attempts < 2) throw new Error('Temporary')
        return 'success'
      }

      const onRetry = vi.fn()

      await withRetry(
        operation,
        () => true,
        { ...DEFAULT_RETRY_CONFIG, initialDelayMs: 10 },
        onRetry
      )

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith(
        0, // attempt
        expect.any(Number), // delay
        expect.any(Error) // error
      )
    })

    it('réussit immédiatement sans erreur', async () => {
      const operation = vi.fn(async () => 'success')

      const result = await withRetry(
        operation,
        () => true,
        DEFAULT_RETRY_CONFIG
      )

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })
})
