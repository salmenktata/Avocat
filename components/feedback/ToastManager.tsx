/**
 * ToastManager - Système de toasts enrichi avec variantes
 * Intégration avec feedback-store pour affichage centralisé
 *
 * @module components/feedback
 * @see Sprint 1 - Système Feedback
 */

'use client'

import { useEffect } from 'react'
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'
import { useFeedbackStore, type FeedbackToast, type ToastVariant } from '@/lib/stores/feedback-store'
import { cn } from '@/lib/utils'

/**
 * Icônes par variante de toast
 */
const TOAST_ICONS: Record<ToastVariant, typeof CheckCircle2 | null> = {
  default: null,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
}

/**
 * Couleurs par variante de toast
 */
const TOAST_STYLES: Record<ToastVariant, string> = {
  default: 'border-border bg-background text-foreground',
  success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100',
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
  warning: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100',
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
}

/**
 * Couleurs icône par variante
 */
const ICON_COLORS: Record<ToastVariant, string> = {
  default: 'text-foreground',
  success: 'text-green-600 dark:text-green-400',
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-orange-600 dark:text-orange-400',
  error: 'text-red-600 dark:text-red-400',
}

/**
 * Composant Toast individuel
 */
function Toast({ toast }: { toast: FeedbackToast }) {
  const { dismissToast } = useFeedbackStore()
  const Icon = TOAST_ICONS[toast.variant]

  const handleDismiss = () => {
    dismissToast(toast.id)
  }

  const handleAction = () => {
    toast.action?.onClick()
    handleDismiss()
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'pointer-events-auto relative flex w-full max-w-md items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all',
        'animate-in slide-in-from-top-full duration-300',
        TOAST_STYLES[toast.variant]
      )}
    >
      {/* Icône */}
      {Icon && (
        <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', ICON_COLORS[toast.variant])} />
      )}

      {/* Contenu */}
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="text-sm opacity-90 leading-tight">{toast.description}</p>
        )}

        {/* Action button */}
        {toast.action && (
          <button
            onClick={handleAction}
            className="mt-2 text-sm font-medium underline underline-offset-2 hover:opacity-80"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Bouton dismiss */}
      {toast.dismissible && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/**
 * Container des toasts
 * Affiche tous les toasts actifs du feedback store
 */
export function ToastManager() {
  const { toasts } = useFeedbackStore()

  return (
    <div
      className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-md"
      aria-label="Notifications"
      role="region"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

/**
 * Hook utilitaire pour afficher des toasts facilement
 *
 * @example
 * ```tsx
 * const toast = useToastNotifications()
 *
 * const handleSave = async () => {
 *   try {
 *     await saveData()
 *     toast.success('Données sauvegardées')
 *   } catch (error) {
 *     toast.error('Erreur lors de la sauvegarde', error.message)
 *   }
 * }
 * ```
 */
export function useToastNotifications() {
  const { success, info, warning, error, showToast } = useFeedbackStore()

  return {
    /**
     * Afficher un toast de succès
     */
    success: (title: string, description?: string, duration?: number) =>
      success(title, description, duration),

    /**
     * Afficher un toast d'information
     */
    info: (title: string, description?: string, duration?: number) =>
      info(title, description, duration),

    /**
     * Afficher un toast d'avertissement
     */
    warning: (title: string, description?: string, duration?: number) =>
      warning(title, description, duration),

    /**
     * Afficher un toast d'erreur
     */
    error: (title: string, description?: string, duration?: number) =>
      error(title, description, duration),

    /**
     * Afficher un toast personnalisé
     */
    custom: (toast: Omit<FeedbackToast, 'id' | 'createdAt'>) => showToast(toast),
  }
}

/**
 * Provider auto-cleanup des toasts (optionnel)
 * Nettoie les toasts après un certain temps
 */
export function ToastCleanupProvider({ children }: { children: React.ReactNode }) {
  const { toasts, dismissToast } = useFeedbackStore()

  useEffect(() => {
    // Nettoyer les toasts expirés toutes les 5 secondes
    const interval = setInterval(() => {
      const now = new Date()
      toasts.forEach((toast) => {
        if (!toast.duration) return // Persist jusqu'à dismiss manuel

        const elapsed = now.getTime() - toast.createdAt.getTime()
        if (elapsed >= toast.duration) {
          dismissToast(toast.id)
        }
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [toasts, dismissToast])

  return <>{children}</>
}
