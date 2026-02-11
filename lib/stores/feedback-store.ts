/**
 * Store Zustand centralisé pour gérer le feedback utilisateur
 * Gère les opérations en cours, toasts, erreurs et états de chargement
 *
 * @module feedback-store
 * @see Sprint 1 - Système Feedback
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/**
 * Types d'opérations trackées
 */
export type OperationType =
  | 'llm-chat'
  | 'llm-embedding'
  | 'llm-classification'
  | 'llm-extraction'
  | 'api-fetch'
  | 'api-mutation'
  | 'file-upload'
  | 'file-download'
  | 'file-processing'
  | 'db-query'
  | 'cache-operation'

/**
 * États d'une opération
 */
export type OperationStatus = 'idle' | 'pending' | 'success' | 'error'

/**
 * Métadonnées d'une opération en cours
 */
export interface Operation {
  id: string
  type: OperationType
  status: OperationStatus
  message?: string
  progress?: number // 0-100
  startedAt: Date
  completedAt?: Date
  error?: Error
  metadata?: Record<string, any>
}

/**
 * Types de toasts
 */
export type ToastVariant = 'default' | 'success' | 'info' | 'warning' | 'error'

/**
 * Toast avec variante enrichie
 */
export interface FeedbackToast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  duration?: number // ms, undefined = persist jusqu'à dismiss manuel
  action?: {
    label: string
    onClick: () => void
  }
  dismissible?: boolean
  createdAt: Date
}

/**
 * Erreur globale avec contexte
 */
export interface GlobalError {
  id: string
  error: Error
  context: string
  recoverable: boolean
  retryAction?: () => void
  fallbackAction?: () => void
  createdAt: Date
}

/**
 * État du feedback store
 */
interface FeedbackState {
  // Opérations en cours
  operations: Map<string, Operation>

  // Toasts actifs
  toasts: FeedbackToast[]

  // Erreurs globales
  errors: GlobalError[]

  // Flags état global
  hasActiveOperations: boolean
  hasErrors: boolean

  // Actions - Opérations
  startOperation: (type: OperationType, message?: string, metadata?: Record<string, any>) => string
  updateOperation: (id: string, updates: Partial<Omit<Operation, 'id' | 'type' | 'startedAt'>>) => void
  completeOperation: (id: string, success?: boolean, message?: string) => void
  failOperation: (id: string, error: Error, message?: string) => void
  clearOperation: (id: string) => void
  clearAllOperations: () => void

  // Actions - Toasts
  showToast: (toast: Omit<FeedbackToast, 'id' | 'createdAt'>) => string
  success: (title: string, description?: string, duration?: number) => string
  info: (title: string, description?: string, duration?: number) => string
  warning: (title: string, description?: string, duration?: number) => string
  error: (title: string, description?: string, duration?: number) => string
  dismissToast: (id: string) => void
  clearToasts: () => void

  // Actions - Erreurs
  addError: (error: Error, context: string, recoverable?: boolean) => string
  clearError: (id: string) => void
  clearAllErrors: () => void

  // Getters
  getOperation: (id: string) => Operation | undefined
  getOperationsByType: (type: OperationType) => Operation[]
  getActiveOperations: () => Operation[]
}

/**
 * Générateur d'ID unique
 */
let counter = 0
function generateId(prefix: string): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER
  return `${prefix}-${Date.now()}-${counter}`
}

/**
 * Hook principal du feedback store
 */
export const useFeedbackStore = create<FeedbackState>()(
  devtools(
    (set, get) => ({
      // État initial
      operations: new Map(),
      toasts: [],
      errors: [],
      hasActiveOperations: false,
      hasErrors: false,

      // === OPÉRATIONS ===

      startOperation: (type, message, metadata) => {
        const id = generateId('op')
        const operation: Operation = {
          id,
          type,
          status: 'pending',
          message,
          startedAt: new Date(),
          metadata,
        }

        set((state) => {
          const operations = new Map(state.operations)
          operations.set(id, operation)
          return {
            operations,
            hasActiveOperations: true,
          }
        })

        return id
      },

      updateOperation: (id, updates) => {
        set((state) => {
          const operations = new Map(state.operations)
          const existing = operations.get(id)

          if (!existing) return state

          operations.set(id, {
            ...existing,
            ...updates,
          })

          return { operations }
        })
      },

      completeOperation: (id, success = true, message) => {
        set((state) => {
          const operations = new Map(state.operations)
          const existing = operations.get(id)

          if (!existing) return state

          operations.set(id, {
            ...existing,
            status: success ? 'success' : 'error',
            message: message || existing.message,
            completedAt: new Date(),
          })

          const hasActiveOperations = Array.from(operations.values()).some(
            (op) => op.status === 'pending'
          )

          return { operations, hasActiveOperations }
        })
      },

      failOperation: (id, error, message) => {
        set((state) => {
          const operations = new Map(state.operations)
          const existing = operations.get(id)

          if (!existing) return state

          operations.set(id, {
            ...existing,
            status: 'error',
            error,
            message: message || error.message,
            completedAt: new Date(),
          })

          const hasActiveOperations = Array.from(operations.values()).some(
            (op) => op.status === 'pending'
          )

          return { operations, hasActiveOperations }
        })
      },

      clearOperation: (id) => {
        set((state) => {
          const operations = new Map(state.operations)
          operations.delete(id)

          const hasActiveOperations = Array.from(operations.values()).some(
            (op) => op.status === 'pending'
          )

          return { operations, hasActiveOperations }
        })
      },

      clearAllOperations: () => {
        set({
          operations: new Map(),
          hasActiveOperations: false,
        })
      },

      // === TOASTS ===

      showToast: (toast) => {
        const id = generateId('toast')
        const newToast: FeedbackToast = {
          ...toast,
          id,
          createdAt: new Date(),
        }

        set((state) => ({
          toasts: [...state.toasts, newToast],
        }))

        // Auto-dismiss si duration définie
        if (toast.duration !== undefined && toast.duration > 0) {
          setTimeout(() => {
            get().dismissToast(id)
          }, toast.duration)
        }

        return id
      },

      success: (title, description, duration = 5000) => {
        return get().showToast({
          variant: 'success',
          title,
          description,
          duration,
          dismissible: true,
        })
      },

      info: (title, description, duration = 5000) => {
        return get().showToast({
          variant: 'info',
          title,
          description,
          duration,
          dismissible: true,
        })
      },

      warning: (title, description, duration = 7000) => {
        return get().showToast({
          variant: 'warning',
          title,
          description,
          duration,
          dismissible: true,
        })
      },

      error: (title, description, duration) => {
        // Les erreurs persistent par défaut (pas de duration)
        return get().showToast({
          variant: 'error',
          title,
          description,
          duration,
          dismissible: true,
        })
      },

      dismissToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      },

      clearToasts: () => {
        set({ toasts: [] })
      },

      // === ERREURS ===

      addError: (error, context, recoverable = true) => {
        const id = generateId('err')
        const globalError: GlobalError = {
          id,
          error,
          context,
          recoverable,
          createdAt: new Date(),
        }

        set((state) => ({
          errors: [...state.errors, globalError],
          hasErrors: true,
        }))

        return id
      },

      clearError: (id) => {
        set((state) => {
          const errors = state.errors.filter((e) => e.id !== id)
          return {
            errors,
            hasErrors: errors.length > 0,
          }
        })
      },

      clearAllErrors: () => {
        set({
          errors: [],
          hasErrors: false,
        })
      },

      // === GETTERS ===

      getOperation: (id) => {
        return get().operations.get(id)
      },

      getOperationsByType: (type) => {
        return Array.from(get().operations.values()).filter((op) => op.type === type)
      },

      getActiveOperations: () => {
        return Array.from(get().operations.values()).filter((op) => op.status === 'pending')
      },
    }),
    {
      name: 'feedback-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
)

/**
 * Sélecteurs optimisés (évite re-renders inutiles)
 */
export const selectHasActiveOperations = (state: FeedbackState) => state.hasActiveOperations
export const selectHasErrors = (state: FeedbackState) => state.hasErrors
export const selectToasts = (state: FeedbackState) => state.toasts
export const selectActiveOperations = (state: FeedbackState) => state.getActiveOperations()
export const selectOperationsByType = (type: OperationType) => (state: FeedbackState) =>
  state.getOperationsByType(type)
