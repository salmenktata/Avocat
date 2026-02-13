/**
 * Service de logging structuré pour le système RAG
 *
 * Permet de tracer les requêtes end-to-end avec correlation IDs
 * et logging structuré en JSON.
 *
 * @module lib/logging/rag-logger
 */

import { randomUUID } from 'crypto'

// =============================================================================
// TYPES
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type RAGComponent =
  | 'search'
  | 'rerank'
  | 'cache'
  | 'llm'
  | 'embedding'
  | 'filter'
  | 'expansion'
  | 'classifier'
  | 'bilingual'
  | 'abrogation'
  | 'hybrid'

export interface LogEntry {
  level: LogLevel
  requestId: string
  component: RAGComponent
  message: string
  data?: any
  elapsed: number
  timestamp: string
}

export interface MetricsData {
  [key: string]: number | string | boolean | null | undefined
}

// =============================================================================
// CLASSE RAGLOGGER
// =============================================================================

/**
 * Logger centralisé pour le système RAG avec correlation IDs
 *
 * @example
 * const logger = new RAGLogger()
 * logger.info('search', 'Recherche KB démarrée', { query, threshold })
 * logger.metrics({ hits: 10, latency: 250 })
 */
export class RAGLogger {
  private requestId: string
  private startTime: number
  private context: Record<string, any>

  constructor(requestId?: string, context?: Record<string, any>) {
    this.requestId = requestId || randomUUID()
    this.startTime = Date.now()
    this.context = context || {}
  }

  /**
   * Log niveau DEBUG (développement uniquement)
   */
  debug(component: RAGComponent, message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development' || process.env.RAG_DEBUG === 'true') {
      this.log('debug', component, message, data)
    }
  }

  /**
   * Log niveau INFO (opérations normales)
   */
  info(component: RAGComponent, message: string, data?: any): void {
    this.log('info', component, message, data)
  }

  /**
   * Log niveau WARN (avertissements non-bloquants)
   */
  warn(component: RAGComponent, message: string, data?: any): void {
    this.log('warn', component, message, data)
  }

  /**
   * Log niveau ERROR (erreurs critiques)
   */
  error(component: RAGComponent, message: string, error?: any): void {
    const errorData = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : error

    this.log('error', component, message, errorData)
  }

  /**
   * Log métriques quantitatives (latence, hit rate, scores, etc.)
   */
  metrics(data: MetricsData): void {
    const entry: LogEntry = {
      level: 'info',
      requestId: this.requestId,
      component: 'search',
      message: 'Métriques RAG',
      data: { ...this.context, ...data },
      elapsed: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
    }

    console.log(JSON.stringify(entry))
  }

  /**
   * Retourne le requestId pour chaînage/référence
   */
  getRequestId(): string {
    return this.requestId
  }

  /**
   * Retourne le temps écoulé depuis création du logger
   */
  getElapsed(): number {
    return Date.now() - this.startTime
  }

  /**
   * Ajoute du contexte persistant au logger
   */
  addContext(key: string, value: any): void {
    this.context[key] = value
  }

  /**
   * Méthode interne de logging structuré
   */
  private log(level: LogLevel, component: RAGComponent, message: string, data?: any): void {
    const entry: LogEntry = {
      level,
      requestId: this.requestId,
      component,
      message,
      data: data ? { ...this.context, ...data } : this.context,
      elapsed: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
    }

    // Output formaté selon le niveau
    const output = JSON.stringify(entry)

    switch (level) {
      case 'error':
        console.error(output)
        break
      case 'warn':
        console.warn(output)
        break
      case 'debug':
      case 'info':
      default:
        console.log(output)
        break
    }
  }
}

// =============================================================================
// UTILITAIRES
// =============================================================================

/**
 * Parse une ligne de log JSON pour extraction
 */
export function parseLogEntry(line: string): LogEntry | null {
  try {
    const parsed = JSON.parse(line)
    if (parsed.requestId && parsed.component && parsed.message) {
      return parsed as LogEntry
    }
    return null
  } catch {
    return null
  }
}

/**
 * Filtre les logs par requestId (pour tracer une requête complète)
 */
export function filterLogsByRequestId(logs: string[], requestId: string): LogEntry[] {
  return logs
    .map(parseLogEntry)
    .filter((entry): entry is LogEntry => entry !== null && entry.requestId === requestId)
}

/**
 * Extrait les métriques d'une série de logs
 */
export function extractMetrics(logs: string[]): MetricsData {
  const entries = logs.map(parseLogEntry).filter((e): e is LogEntry => e !== null)

  const metrics: MetricsData = {}

  entries.forEach((entry) => {
    if (entry.data && typeof entry.data === 'object') {
      Object.entries(entry.data).forEach(([key, value]) => {
        if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
          metrics[key] = value
        }
      })
    }
  })

  return metrics
}
