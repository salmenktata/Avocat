/**
 * Erreurs personnalisées pour Qadhya
 *
 * Hiérarchie d'erreurs typées pour une gestion cohérente des erreurs
 * à travers l'application.
 *
 * Usage:
 * import { AuthenticationError, ValidationError } from '@/lib/errors'
 *
 * throw new AuthenticationError('Session expirée')
 * throw new ValidationError('Email invalide', { field: 'email' })
 */

/**
 * Erreur de base pour l'application
 * Toutes les erreurs personnalisées héritent de cette classe
 */
export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly context?: Record<string, unknown>

  constructor(
    message: string,
    options: {
      code?: string
      statusCode?: number
      isOperational?: boolean
      context?: Record<string, unknown>
      cause?: Error
    } = {}
  ) {
    super(message, { cause: options.cause })
    this.name = this.constructor.name
    this.code = options.code || 'APP_ERROR'
    this.statusCode = options.statusCode || 500
    this.isOperational = options.isOperational ?? true
    this.context = options.context

    // Maintenir la stack trace correcte
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Convertit l'erreur en objet JSON sérialisable
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.context && { context: this.context }),
    }
  }
}

/**
 * Erreur d'authentification
 * Utilisée quand l'utilisateur n'est pas connecté ou le token est invalide
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Non authentifié', context?: Record<string, unknown>) {
    super(message, {
      code: 'AUTHENTICATION_ERROR',
      statusCode: 401,
      context,
    })
  }
}

/**
 * Erreur d'autorisation
 * Utilisée quand l'utilisateur n'a pas les droits nécessaires
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Accès non autorisé', context?: Record<string, unknown>) {
    super(message, {
      code: 'AUTHORIZATION_ERROR',
      statusCode: 403,
      context,
    })
  }
}

/**
 * Erreur de rate limiting
 * Utilisée quand trop de requêtes sont effectuées
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number

  constructor(
    message = 'Trop de requêtes, veuillez réessayer plus tard',
    options: { retryAfter?: number; context?: Record<string, unknown> } = {}
  ) {
    super(message, {
      code: 'RATE_LIMIT_ERROR',
      statusCode: 429,
      context: {
        ...options.context,
        ...(options.retryAfter && { retryAfter: options.retryAfter }),
      },
    })
    this.retryAfter = options.retryAfter
  }
}

/**
 * Erreur de validation
 * Utilisée quand les données fournies sont invalides
 */
export class ValidationError extends AppError {
  public readonly field?: string
  public readonly errors?: Array<{ field: string; message: string }>

  constructor(
    message = 'Données invalides',
    options: {
      field?: string
      errors?: Array<{ field: string; message: string }>
      context?: Record<string, unknown>
    } = {}
  ) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      context: {
        ...options.context,
        ...(options.field && { field: options.field }),
        ...(options.errors && { errors: options.errors }),
      },
    })
    this.field = options.field
    this.errors = options.errors
  }
}

/**
 * Erreur ressource non trouvée
 * Utilisée quand une entité demandée n'existe pas
 */
export class NotFoundError extends AppError {
  public readonly resource?: string
  public readonly resourceId?: string

  constructor(
    message = 'Ressource non trouvée',
    options: {
      resource?: string
      resourceId?: string
      context?: Record<string, unknown>
    } = {}
  ) {
    super(message, {
      code: 'NOT_FOUND_ERROR',
      statusCode: 404,
      context: {
        ...options.context,
        ...(options.resource && { resource: options.resource }),
        ...(options.resourceId && { resourceId: options.resourceId }),
      },
    })
    this.resource = options.resource
    this.resourceId = options.resourceId
  }
}

/**
 * Erreur de service externe
 * Utilisée quand un service tiers (Flouci, Resend, etc.) échoue
 */
export class ExternalServiceError extends AppError {
  public readonly service: string
  public readonly originalError?: Error

  constructor(
    service: string,
    message?: string,
    options: {
      originalError?: Error
      context?: Record<string, unknown>
    } = {}
  ) {
    super(message || `Erreur du service ${service}`, {
      code: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 502,
      context: {
        ...options.context,
        service,
      },
      cause: options.originalError,
    })
    this.service = service
    this.originalError = options.originalError
  }
}

/**
 * Erreur de base de données
 * Utilisée quand une opération DB échoue
 */
export class DatabaseError extends AppError {
  public readonly query?: string
  public readonly originalError?: Error

  constructor(
    message = 'Erreur de base de données',
    options: {
      query?: string
      originalError?: Error
      context?: Record<string, unknown>
    } = {}
  ) {
    super(message, {
      code: 'DATABASE_ERROR',
      statusCode: 500,
      isOperational: false, // Les erreurs DB sont souvent non-opérationnelles
      context: {
        ...options.context,
        ...(options.query && process.env.NODE_ENV !== 'production' && { query: options.query }),
      },
      cause: options.originalError,
    })
    this.query = options.query
    this.originalError = options.originalError
  }
}

/**
 * Erreur de conflit
 * Utilisée quand une opération échoue à cause d'un conflit (ex: email déjà utilisé)
 */
export class ConflictError extends AppError {
  constructor(message = 'Conflit avec une ressource existante', context?: Record<string, unknown>) {
    super(message, {
      code: 'CONFLICT_ERROR',
      statusCode: 409,
      context,
    })
  }
}

/**
 * Erreur de timeout
 * Utilisée quand une opération dépasse le temps imparti
 */
export class TimeoutError extends AppError {
  public readonly timeoutMs?: number

  constructor(
    message = 'Opération expirée',
    options: { timeoutMs?: number; context?: Record<string, unknown> } = {}
  ) {
    super(message, {
      code: 'TIMEOUT_ERROR',
      statusCode: 504,
      context: {
        ...options.context,
        ...(options.timeoutMs && { timeoutMs: options.timeoutMs }),
      },
    })
    this.timeoutMs = options.timeoutMs
  }
}

/**
 * Vérifie si une erreur est une AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/**
 * Convertit une erreur en AppError si ce n'est pas déjà le cas
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    return new AppError(error.message, {
      cause: error,
      isOperational: false,
    })
  }

  return new AppError(String(error), {
    isOperational: false,
  })
}

/**
 * Extrait un message d'erreur sécurisé pour l'utilisateur
 * Cache les détails techniques en production
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError && error.isOperational) {
    return error.message
  }

  if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
    return error.message
  }

  return 'Une erreur inattendue est survenue'
}

/**
 * Extrait le code de statut HTTP d'une erreur
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode
  }
  return 500
}
