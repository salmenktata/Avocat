/**
 * Helper withAuth() pour les Server Actions
 *
 * Wrapper qui gère automatiquement l'authentification des server actions,
 * éliminant la duplication du pattern de vérification de session.
 *
 * Usage:
 * export const createClientAction = withAuth(async (session, data: ClientData) => {
 *   // session est garanti d'être valide ici
 *   const userId = session.user.id
 *   // ... logique métier
 *   return { success: true, data: client }
 * })
 */

import { getSession, type Session, type SessionUser } from '@/lib/auth/session'
import { AuthenticationError, AppError, isAppError, getErrorMessage } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('Auth')

/**
 * Résultat d'une action authentifiée
 */
export type ActionResult<T = unknown> =
  | { success: true; data?: T; message?: string }
  | { success: false; error: string; code?: string }

/**
 * Fonction action avec session
 */
type AuthenticatedAction<TArgs extends unknown[], TResult> = (
  session: Session,
  ...args: TArgs
) => Promise<TResult>

/**
 * Options pour withAuth
 */
interface WithAuthOptions {
  /**
   * Rôle requis pour l'action
   */
  requiredRole?: string | string[]
  /**
   * Message d'erreur personnalisé pour l'authentification
   */
  authErrorMessage?: string
  /**
   * Message d'erreur personnalisé pour l'autorisation
   */
  roleErrorMessage?: string
}

/**
 * Wrapper pour les server actions nécessitant une authentification
 *
 * @example
 * // Action simple
 * export const getProfile = withAuth(async (session) => {
 *   const profile = await fetchProfile(session.user.id)
 *   return { success: true, data: profile }
 * })
 *
 * @example
 * // Action avec paramètres
 * export const updateClient = withAuth(async (session, clientId: string, data: ClientData) => {
 *   const client = await updateClientInDB(clientId, data, session.user.id)
 *   return { success: true, data: client }
 * })
 *
 * @example
 * // Action avec rôle requis
 * export const adminAction = withAuth(
 *   async (session) => {
 *     // Seuls les admins peuvent exécuter cette action
 *     return { success: true }
 *   },
 *   { requiredRole: 'admin' }
 * )
 */
export function withAuth<TArgs extends unknown[], TResult extends ActionResult>(
  action: AuthenticatedAction<TArgs, TResult>,
  options: WithAuthOptions = {}
): (...args: TArgs) => Promise<TResult | ActionResult> {
  return async (...args: TArgs): Promise<TResult | ActionResult> => {
    try {
      // 1. Vérifier l'authentification
      const session = await getSession()

      if (!session?.user?.id) {
        log.warn('Tentative d\'accès non authentifié')
        return {
          success: false,
          error: options.authErrorMessage || 'Non authentifié',
          code: 'AUTHENTICATION_ERROR',
        }
      }

      // 2. Vérifier le rôle si requis
      if (options.requiredRole) {
        const requiredRoles = Array.isArray(options.requiredRole)
          ? options.requiredRole
          : [options.requiredRole]

        const userRole = session.user.role || 'user'

        if (!requiredRoles.includes(userRole)) {
          log.warn('Accès refusé - rôle insuffisant', {
            userId: session.user.id,
            userRole,
            requiredRoles,
          })
          return {
            success: false,
            error: options.roleErrorMessage || 'Accès non autorisé',
            code: 'AUTHORIZATION_ERROR',
          }
        }
      }

      // 3. Exécuter l'action
      return await action(session, ...args)
    } catch (error) {
      // 4. Gérer les erreurs
      if (isAppError(error)) {
        log.error('Erreur action:', error.message, error.context)
        return {
          success: false,
          error: error.message,
          code: error.code,
        }
      }

      log.exception('Erreur inattendue dans action', error)
      return {
        success: false,
        error: getErrorMessage(error),
        code: 'INTERNAL_ERROR',
      }
    }
  }
}

/**
 * Version de withAuth qui retourne directement les données ou throw
 * Utile pour les cas où on veut propager les erreurs
 *
 * @example
 * export const getClientOrThrow = withAuthThrow(async (session, clientId: string) => {
 *   const client = await fetchClient(clientId, session.user.id)
 *   if (!client) throw new NotFoundError('Client non trouvé')
 *   return client
 * })
 */
export function withAuthThrow<TArgs extends unknown[], TResult>(
  action: AuthenticatedAction<TArgs, TResult>,
  options: WithAuthOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    // 1. Vérifier l'authentification
    const session = await getSession()

    if (!session?.user?.id) {
      throw new AuthenticationError(options.authErrorMessage || 'Non authentifié')
    }

    // 2. Vérifier le rôle si requis
    if (options.requiredRole) {
      const requiredRoles = Array.isArray(options.requiredRole)
        ? options.requiredRole
        : [options.requiredRole]

      const userRole = session.user.role || 'user'

      if (!requiredRoles.includes(userRole)) {
        throw new AuthenticationError(options.roleErrorMessage || 'Accès non autorisé')
      }
    }

    // 3. Exécuter l'action
    return await action(session, ...args)
  }
}

/**
 * Récupère l'ID utilisateur de la session ou throw
 * Version simplifiée pour les cas où on a juste besoin de l'ID
 *
 * @example
 * export async function myAction() {
 *   const userId = await requireUserId()
 *   // ... utiliser userId
 * }
 */
export async function requireUserId(errorMessage = 'Non authentifié'): Promise<string> {
  const session = await getSession()

  if (!session?.user?.id) {
    throw new AuthenticationError(errorMessage)
  }

  return session.user.id
}

/**
 * Récupère la session ou throw
 * Version simplifiée pour les cas où on a besoin de la session complète
 *
 * @example
 * export async function myAction() {
 *   const session = await requireSession()
 *   console.log(session.user.name)
 * }
 */
export async function requireSession(errorMessage = 'Non authentifié'): Promise<Session> {
  const session = await getSession()

  if (!session?.user?.id) {
    throw new AuthenticationError(errorMessage)
  }

  return session
}

/**
 * Type helper pour extraire le type de données d'un ActionResult
 */
export type ExtractActionData<T> = T extends ActionResult<infer D> ? D : never

/**
 * Type pour les actions qui retournent une liste paginée
 */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type PaginatedActionResult<T> = ActionResult<PaginatedResult<T>>
