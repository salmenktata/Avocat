/**
 * Rate Limiter en mémoire pour MonCabinet
 *
 * Implémente un algorithme de fenêtre glissante (sliding window)
 * pour limiter le nombre de requêtes par IP/identifiant.
 *
 * Usage:
 * import { loginLimiter, registerLimiter } from '@/lib/rate-limiter'
 *
 * // Dans une route API
 * const ip = request.headers.get('x-forwarded-for') || 'unknown'
 * const result = loginLimiter.check(ip)
 * if (!result.allowed) {
 *   return NextResponse.json({ error: 'Trop de tentatives' }, { status: 429 })
 * }
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('RateLimiter')

interface RateLimitEntry {
  count: number
  resetAt: number
  timestamps: number[] // Pour sliding window
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number // Secondes avant de réessayer
}

interface RateLimiterOptions {
  /**
   * Nombre maximum de requêtes autorisées dans la fenêtre
   */
  maxRequests: number
  /**
   * Durée de la fenêtre en millisecondes
   */
  windowMs: number
  /**
   * Nom du limiter pour les logs
   */
  name?: string
  /**
   * Activer le mode strict (block après dépassement même si la fenêtre se réinitialise)
   */
  strictMode?: boolean
  /**
   * Durée du blocage en mode strict (ms)
   */
  blockDurationMs?: number
}

/**
 * Rate Limiter avec algorithme de fenêtre glissante
 */
export class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map()
  private blockedUntil: Map<string, number> = new Map()
  private readonly options: Required<RateLimiterOptions>

  constructor(options: RateLimiterOptions) {
    this.options = {
      maxRequests: options.maxRequests,
      windowMs: options.windowMs,
      name: options.name || 'RateLimiter',
      strictMode: options.strictMode ?? false,
      blockDurationMs: options.blockDurationMs ?? options.windowMs * 2,
    }

    // Nettoyage périodique des entrées expirées (toutes les 5 minutes)
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000)
    }
  }

  /**
   * Vérifie si une requête est autorisée
   *
   * @param identifier Identifiant unique (IP, userId, etc.)
   * @returns Résultat avec statut et informations de limite
   */
  check(identifier: string): RateLimitResult {
    const now = Date.now()
    const windowStart = now - this.options.windowMs

    // Vérifier si bloqué en mode strict
    const blockedUntil = this.blockedUntil.get(identifier)
    if (blockedUntil && now < blockedUntil) {
      const retryAfter = Math.ceil((blockedUntil - now) / 1000)
      log.warn(`[${this.options.name}] Requête bloquée pour ${identifier} - retry après ${retryAfter}s`)
      return {
        allowed: false,
        remaining: 0,
        resetAt: blockedUntil,
        retryAfter,
      }
    }

    // Récupérer ou créer l'entrée
    let entry = this.entries.get(identifier)

    if (!entry) {
      entry = {
        count: 0,
        resetAt: now + this.options.windowMs,
        timestamps: [],
      }
    }

    // Filtrer les timestamps dans la fenêtre actuelle (sliding window)
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart)

    // Vérifier la limite
    if (entry.timestamps.length >= this.options.maxRequests) {
      // Calculer quand la prochaine requête sera autorisée
      const oldestInWindow = entry.timestamps[0]
      const resetAt = oldestInWindow + this.options.windowMs
      const retryAfter = Math.ceil((resetAt - now) / 1000)

      // En mode strict, bloquer pour une durée plus longue
      if (this.options.strictMode) {
        const blockUntil = now + this.options.blockDurationMs
        this.blockedUntil.set(identifier, blockUntil)
        log.warn(`[${this.options.name}] Limite dépassée pour ${identifier} - bloqué jusqu'à ${new Date(blockUntil).toISOString()}`)
      } else {
        log.info(`[${this.options.name}] Limite atteinte pour ${identifier}`)
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      }
    }

    // Ajouter le timestamp actuel
    entry.timestamps.push(now)
    entry.count = entry.timestamps.length
    entry.resetAt = now + this.options.windowMs

    this.entries.set(identifier, entry)

    // Supprimer le blocage si la requête est maintenant autorisée
    this.blockedUntil.delete(identifier)

    return {
      allowed: true,
      remaining: this.options.maxRequests - entry.timestamps.length,
      resetAt: entry.resetAt,
    }
  }

  /**
   * Réinitialise le compteur pour un identifiant
   * Utile après une connexion réussie
   */
  reset(identifier: string): void {
    this.entries.delete(identifier)
    this.blockedUntil.delete(identifier)
    log.debug(`[${this.options.name}] Reset pour ${identifier}`)
  }

  /**
   * Nettoie les entrées expirées
   */
  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.entries.entries()) {
      if (entry.resetAt < now && entry.timestamps.every((ts) => ts < now - this.options.windowMs)) {
        this.entries.delete(key)
        cleaned++
      }
    }

    for (const [key, until] of this.blockedUntil.entries()) {
      if (until < now) {
        this.blockedUntil.delete(key)
      }
    }

    if (cleaned > 0) {
      log.debug(`[${this.options.name}] Nettoyage: ${cleaned} entrées supprimées`)
    }
  }

  /**
   * Retourne les statistiques actuelles
   */
  getStats(): { entries: number; blocked: number } {
    return {
      entries: this.entries.size,
      blocked: this.blockedUntil.size,
    }
  }
}

// =============================================================================
// INSTANCES PRÉ-CONFIGURÉES
// =============================================================================

/**
 * Rate limiter pour le login
 * 5 tentatives par 15 minutes par IP, mode strict activé
 */
export const loginLimiter = new RateLimiter({
  name: 'Login',
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  strictMode: true,
  blockDurationMs: 30 * 60 * 1000, // 30 minutes de blocage après dépassement
})

/**
 * Rate limiter pour l'inscription
 * 3 inscriptions par heure par IP
 */
export const registerLimiter = new RateLimiter({
  name: 'Register',
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 heure
  strictMode: true,
  blockDurationMs: 2 * 60 * 60 * 1000, // 2 heures de blocage
})

/**
 * Rate limiter pour la réinitialisation de mot de passe
 * 3 demandes par heure par email/IP
 */
export const passwordResetLimiter = new RateLimiter({
  name: 'PasswordReset',
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 heure
  strictMode: false,
})

/**
 * Rate limiter pour le renvoi d'email de vérification
 * 3 demandes par 15 minutes par email
 */
export const resendVerificationLimiter = new RateLimiter({
  name: 'ResendVerification',
  maxRequests: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
  strictMode: false,
})

/**
 * Rate limiter général pour les API
 * 100 requêtes par minute par IP
 */
export const apiLimiter = new RateLimiter({
  name: 'API',
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  strictMode: false,
})

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extrait l'IP du client depuis les headers de requête
 */
export function getClientIP(request: Request): string {
  // Cloudflare
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) return cfConnectingIP

  // Standard proxy headers
  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    // Prendre la première IP (client original)
    return xForwardedFor.split(',')[0].trim()
  }

  const xRealIP = request.headers.get('x-real-ip')
  if (xRealIP) return xRealIP

  // Fallback
  return 'unknown'
}

/**
 * Crée les headers de rate limit pour la réponse
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
  }

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString()
  }

  return headers
}
