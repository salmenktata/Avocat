/**
 * Fetch avec Timeout et Helpers
 *
 * Wrapper autour de fetch() qui ajoute:
 * - Timeout configurable via AbortController
 * - Helper pour les appels JSON
 * - Gestion d'erreurs améliorée
 *
 * Usage:
 * import { fetchWithTimeout, apiCall } from '@/lib/utils/fetch-with-timeout'
 *
 * const response = await fetchWithTimeout(url, { timeoutMs: 5000 })
 * const data = await apiCall<User>('/api/users/1')
 */

import { TimeoutError, ExternalServiceError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('Fetch')

/**
 * Options pour fetchWithTimeout
 */
export interface FetchWithTimeoutOptions extends Omit<RequestInit, 'signal'> {
  /**
   * Timeout en millisecondes
   * @default 30000 (30 secondes)
   */
  timeoutMs?: number

  /**
   * Signal d'abort externe (sera combiné avec le timeout)
   */
  signal?: AbortSignal
}

/**
 * Options pour apiCall
 */
export interface ApiCallOptions extends FetchWithTimeoutOptions {
  /**
   * Nom du service pour les messages d'erreur
   */
  serviceName?: string
}

/**
 * Erreur HTTP avec détails
 */
export class HttpError extends Error {
  public readonly statusCode: number
  public readonly statusText: string
  public readonly url: string
  public readonly body?: string

  constructor(
    statusCode: number,
    statusText: string,
    url: string,
    body?: string
  ) {
    super(`HTTP ${statusCode} ${statusText}: ${url}`)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.statusText = statusText
    this.url = url
    this.body = body
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Vérifie si l'erreur est de type client (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500
  }

  /**
   * Vérifie si l'erreur est de type serveur (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500 && this.statusCode < 600
  }
}

/**
 * Fetch avec timeout configurable
 *
 * @example
 * // Requête simple avec timeout de 5 secondes
 * const response = await fetchWithTimeout('https://api.example.com/data', {
 *   timeoutMs: 5000
 * })
 *
 * @example
 * // POST avec timeout
 * const response = await fetchWithTimeout('https://api.example.com/users', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ name: 'John' }),
 *   timeoutMs: 10000
 * })
 */
export async function fetchWithTimeout(
  url: string | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = 30000, signal: externalSignal, ...fetchOptions } = options

  // Créer un AbortController pour le timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Timeout après ${timeoutMs}ms`))
  }, timeoutMs)

  // Combiner avec un signal externe si fourni
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason))
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })

    return response
  } catch (error) {
    // Gérer l'erreur de timeout
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('Timeout')) {
        throw new TimeoutError(`Timeout après ${timeoutMs}ms: ${url}`, { timeoutMs })
      }
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Helper pour les appels API JSON
 *
 * @example
 * // GET
 * const user = await apiCall<User>('/api/users/1')
 *
 * @example
 * // POST
 * const newUser = await apiCall<User>('/api/users', {
 *   method: 'POST',
 *   data: { name: 'John', email: 'john@example.com' }
 * })
 *
 * @example
 * // Avec service name pour les erreurs
 * const data = await apiCall<Data>('https://external-api.com/data', {
 *   serviceName: 'ExternalAPI',
 *   timeoutMs: 5000
 * })
 */
export async function apiCall<T = unknown>(
  url: string | URL,
  options: ApiCallOptions & { data?: unknown } = {}
): Promise<T> {
  const { data, serviceName, timeoutMs = 30000, ...fetchOptions } = options

  // Préparer les headers
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  }

  // Préparer le body si data est fourni
  let body: string | undefined
  if (data !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(data)
  }

  const urlString = url.toString()
  const startTime = Date.now()

  try {
    const response = await fetchWithTimeout(urlString, {
      ...fetchOptions,
      headers,
      body: body || fetchOptions.body,
      timeoutMs,
    })

    const duration = Date.now() - startTime
    log.debug(`${fetchOptions.method || 'GET'} ${urlString} - ${response.status} (${duration}ms)`)

    // Gérer les erreurs HTTP
    if (!response.ok) {
      const errorBody = await response.text().catch(() => undefined)

      log.warn(`API error: ${response.status} ${response.statusText}`, {
        url: urlString,
        body: errorBody?.substring(0, 200),
      })

      throw new HttpError(response.status, response.statusText, urlString, errorBody)
    }

    // Parser la réponse JSON
    const responseData = await response.json()
    return responseData as T
  } catch (error) {
    // Wrapper les erreurs de timeout/réseau en ExternalServiceError si serviceName est fourni
    if (serviceName && !(error instanceof HttpError)) {
      throw new ExternalServiceError(
        serviceName,
        error instanceof Error ? error.message : String(error),
        { originalError: error instanceof Error ? error : undefined }
      )
    }
    throw error
  }
}

/**
 * Créer un client API pré-configuré pour un service
 *
 * @example
 * const flouciApi = createApiClient('https://api.flouci.com', {
 *   serviceName: 'Flouci',
 *   timeoutMs: 10000,
 *   headers: { 'Authorization': 'Bearer xxx' }
 * })
 *
 * const payment = await flouciApi.post<Payment>('/payments', { amount: 1000 })
 */
export function createApiClient(
  baseUrl: string,
  defaultOptions: ApiCallOptions = {}
) {
  const buildUrl = (path: string) => `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`

  return {
    get: <T = unknown>(path: string, options?: ApiCallOptions) =>
      apiCall<T>(buildUrl(path), { ...defaultOptions, ...options, method: 'GET' }),

    post: <T = unknown>(path: string, data?: unknown, options?: ApiCallOptions) =>
      apiCall<T>(buildUrl(path), { ...defaultOptions, ...options, method: 'POST', data }),

    put: <T = unknown>(path: string, data?: unknown, options?: ApiCallOptions) =>
      apiCall<T>(buildUrl(path), { ...defaultOptions, ...options, method: 'PUT', data }),

    patch: <T = unknown>(path: string, data?: unknown, options?: ApiCallOptions) =>
      apiCall<T>(buildUrl(path), { ...defaultOptions, ...options, method: 'PATCH', data }),

    delete: <T = unknown>(path: string, options?: ApiCallOptions) =>
      apiCall<T>(buildUrl(path), { ...defaultOptions, ...options, method: 'DELETE' }),
  }
}

/**
 * Vérifie si une erreur est une erreur de timeout
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError
}

/**
 * Vérifie si une erreur est une erreur HTTP
 */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError
}
