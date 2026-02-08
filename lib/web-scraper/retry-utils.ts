/**
 * Utilitaires pour retry avec exponential backoff
 */

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  retryableStatusCodes: number[]
  retryableErrors: string[] // 'TIMEOUT', 'ECONNRESET', etc.
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatusCodes: [429, 503, 504, 408],
  retryableErrors: ['TIMEOUT', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
}

export function isRetryableError(
  error: unknown,
  statusCode?: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  // Vérifier status code
  if (statusCode && config.retryableStatusCodes.includes(statusCode)) {
    return true
  }

  // Vérifier erreur réseau
  if (error instanceof Error) {
    const errorCode = (error as any).code
    if (errorCode && config.retryableErrors.includes(errorCode)) {
      return true
    }

    // Timeout explicite
    if (error.message.toLowerCase().includes('timeout')) {
      return true
    }

    // Détection bannissement - ne pas retry
    if (error.message.includes('BAN_DETECTED')) {
      return false
    }
  }

  return false
}

export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, ...
  const baseDelay = config.initialDelayMs * Math.pow(2, attempt)
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs)

  // Ajouter jitter (±20%) pour éviter thundering herd
  const jitter = cappedDelay * 0.2 * (Math.random() * 2 - 1)
  const finalDelay = Math.floor(cappedDelay + jitter)

  return Math.max(finalDelay, 0)
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, delay: number, error: unknown) => void
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // Dernière tentative ?
      if (attempt === config.maxRetries) {
        break
      }

      // Vérifier si retry est pertinent
      if (!shouldRetry(error)) {
        throw error // Ne pas retry, erreur non-retryable
      }

      // Calculer délai et attendre
      const delay = calculateBackoffDelay(attempt, config)
      onRetry?.(attempt, delay, error)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
