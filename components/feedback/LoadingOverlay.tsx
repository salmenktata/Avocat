/**
 * LoadingOverlay - Composant d'overlay de chargement avancé
 * Affiche les opérations en cours avec progression et messages dynamiques
 *
 * @module components/feedback
 * @see Sprint 1 - Système Feedback
 */

'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Brain, Database, Upload, Download, FileText, Zap } from 'lucide-react'
import { useFeedbackStore, type OperationType, type Operation } from '@/lib/stores/feedback-store'
import { cn } from '@/lib/utils'

interface LoadingOverlayProps {
  /**
   * Afficher l'overlay si au moins une opération est active
   * @default true
   */
  showOnActiveOperations?: boolean

  /**
   * Forcer l'affichage (ignore les opérations actives)
   */
  forceShow?: boolean

  /**
   * Message personnalisé (override le message de l'opération)
   */
  customMessage?: string

  /**
   * Opération spécifique à afficher (ignore les autres)
   */
  operationId?: string

  /**
   * Type d'opération à filtrer (affiche uniquement ce type)
   */
  operationType?: OperationType

  /**
   * Classes CSS personnalisées
   */
  className?: string

  /**
   * Désactiver le backdrop blur
   * @default false
   */
  noBlur?: boolean

  /**
   * Callback quand l'overlay est affiché/masqué
   */
  onVisibilityChange?: (visible: boolean) => void
}

/**
 * Icônes par type d'opération
 */
const OPERATION_ICONS: Record<OperationType, typeof Loader2> = {
  'llm-chat': Brain,
  'llm-embedding': Brain,
  'llm-classification': Brain,
  'llm-extraction': Brain,
  'api-fetch': Database,
  'api-mutation': Database,
  'file-upload': Upload,
  'file-download': Download,
  'file-processing': FileText,
  'db-query': Database,
  'cache-operation': Zap,
}

/**
 * Couleurs par type d'opération
 */
const OPERATION_COLORS: Record<OperationType, string> = {
  'llm-chat': 'text-purple-600 dark:text-purple-400',
  'llm-embedding': 'text-purple-600 dark:text-purple-400',
  'llm-classification': 'text-purple-600 dark:text-purple-400',
  'llm-extraction': 'text-purple-600 dark:text-purple-400',
  'api-fetch': 'text-blue-600 dark:text-blue-400',
  'api-mutation': 'text-blue-600 dark:text-blue-400',
  'file-upload': 'text-green-600 dark:text-green-400',
  'file-download': 'text-green-600 dark:text-green-400',
  'file-processing': 'text-orange-600 dark:text-orange-400',
  'db-query': 'text-cyan-600 dark:text-cyan-400',
  'cache-operation': 'text-yellow-600 dark:text-yellow-400',
}

/**
 * Composant barre de progression
 */
function ProgressBar({ progress }: { progress?: number }) {
  if (progress === undefined) return null

  return (
    <div className="mt-4 w-full max-w-xs">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">{Math.round(progress)}%</p>
    </div>
  )
}

/**
 * Carte d'opération individuelle
 */
function OperationCard({ operation }: { operation: Operation }) {
  const Icon = OPERATION_ICONS[operation.type]
  const colorClass = OPERATION_COLORS[operation.type]

  return (
    <div className="flex flex-col items-center gap-2">
      <Icon className={cn('h-8 w-8 animate-spin', colorClass)} />
      {operation.message && (
        <p className="max-w-sm text-center text-sm font-medium text-foreground">
          {operation.message}
        </p>
      )}
      <ProgressBar progress={operation.progress} />
    </div>
  )
}

/**
 * Overlay de chargement avec support multi-opérations
 */
export function LoadingOverlay({
  showOnActiveOperations = true,
  forceShow = false,
  customMessage,
  operationId,
  operationType,
  className,
  noBlur = false,
  onVisibilityChange,
}: LoadingOverlayProps) {
  const t = useTranslations('common')
  const { operations, getActiveOperations, getOperation, getOperationsByType } = useFeedbackStore()

  // Déterminer les opérations à afficher
  const [displayedOperations, setDisplayedOperations] = useState<Operation[]>([])

  useEffect(() => {
    let ops: Operation[] = []

    if (operationId) {
      // Opération spécifique
      const op = getOperation(operationId)
      if (op && op.status === 'pending') {
        ops = [op]
      }
    } else if (operationType) {
      // Filtrer par type
      ops = getOperationsByType(operationType).filter((op) => op.status === 'pending')
    } else if (showOnActiveOperations) {
      // Toutes les opérations actives
      ops = getActiveOperations()
    }

    setDisplayedOperations(ops)
  }, [
    operations,
    operationId,
    operationType,
    showOnActiveOperations,
    getOperation,
    getOperationsByType,
    getActiveOperations,
  ])

  // Visibilité de l'overlay
  const isVisible = forceShow || displayedOperations.length > 0

  // Callback visibilité
  useEffect(() => {
    onVisibilityChange?.(isVisible)
  }, [isVisible, onVisibilityChange])

  if (!isVisible) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
        !noBlur && 'backdrop-blur-sm',
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="rounded-lg border bg-card p-6 shadow-2xl">
        {customMessage ? (
          // Message personnalisé simple
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-center text-sm font-medium text-foreground">{customMessage}</p>
          </div>
        ) : displayedOperations.length === 1 ? (
          // Une seule opération
          <OperationCard operation={displayedOperations[0]} />
        ) : displayedOperations.length > 1 ? (
          // Plusieurs opérations
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <p className="text-sm font-semibold text-foreground">
                {displayedOperations.length} {t('operationsInProgress')}
              </p>
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {displayedOperations.map((op) => (
                <div
                  key={op.id}
                  className="rounded border border-border bg-muted/50 p-3"
                >
                  <OperationCard operation={op} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Fallback générique
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-center text-sm font-medium text-foreground">{t('loading')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Hook utilitaire pour afficher facilement un overlay pendant une opération
 *
 * @example
 * ```tsx
 * const { execute, isLoading } = useLoadingOverlay()
 *
 * const handleSubmit = async () => {
 *   await execute(
 *     async () => {
 *       await api.submitData()
 *     },
 *     {
 *       type: 'api-mutation',
 *       message: 'Envoi des données...',
 *     }
 *   )
 * }
 * ```
 */
export function useLoadingOverlay() {
  const { startOperation, completeOperation, failOperation } = useFeedbackStore()
  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null)

  const execute = async <T,>(
    fn: () => Promise<T>,
    options: {
      type: OperationType
      message?: string
      metadata?: Record<string, any>
      onSuccess?: (result: T) => void
      onError?: (error: Error) => void
    }
  ): Promise<T | undefined> => {
    const opId = startOperation(options.type, options.message, options.metadata)
    setCurrentOperationId(opId)

    try {
      const result = await fn()
      completeOperation(opId, true)
      options.onSuccess?.(result)
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      failOperation(opId, err)
      options.onError?.(err)
      throw error
    } finally {
      setCurrentOperationId(null)
    }
  }

  return {
    execute,
    isLoading: currentOperationId !== null,
    operationId: currentOperationId,
  }
}
