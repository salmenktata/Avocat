/**
 * FeatureErrorBoundary - Error Boundary pour des fonctionnalités spécifiques
 * Capture les erreurs au niveau d'une feature sans crasher toute l'application
 *
 * @module components/providers
 * @see Sprint 1 - Système Feedback
 */

'use client'

import { Component, ReactNode } from 'react'
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useFeedbackStore } from '@/lib/stores/feedback-store'

interface Props {
  children: ReactNode
  /**
   * Nom de la feature (pour logging et affichage)
   */
  featureName: string
  /**
   * Fallback personnalisé (si undefined, affiche UI par défaut)
   */
  fallback?: ReactNode
  /**
   * Callback appelé quand une erreur est capturée
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /**
   * Fonction de récupération personnalisée
   */
  onReset?: () => void
  /**
   * Action de fallback (alternative à afficher si feature en erreur)
   */
  fallbackAction?: {
    label: string
    onClick: () => void
  }
  /**
   * Afficher les détails de l'erreur (mode développement)
   * @default true en development
   */
  showErrorDetails?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  isExpanded: boolean
}

/**
 * Error Boundary au niveau feature
 * Wrapper une fonctionnalité spécifique pour isoler les erreurs
 *
 * @example
 * ```tsx
 * <FeatureErrorBoundary
 *   featureName="Chat IA"
 *   fallbackAction={{
 *     label: "Consulter l'historique",
 *     onClick: () => router.push('/conversations')
 *   }}
 * >
 *   <ChatWidget />
 * </FeatureErrorBoundary>
 * ```
 */
export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isExpanded: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { featureName, onError } = this.props

    // Log l'erreur
    console.error(`⚠️ Feature Error Boundary [${featureName}] caught error:`, error)
    console.error('Error Info:', errorInfo)

    this.setState({ errorInfo })

    // Callback custom
    onError?.(error, errorInfo)

    // Ajouter à l'error store
    if (typeof window !== 'undefined') {
      const store = useFeedbackStore.getState()
      store.addError(error, `Feature: ${featureName}`, true)
    }

    // En production, envoyer à un service de monitoring
    if (process.env.NODE_ENV === 'production') {
      // TODO: Intégrer service de monitoring
      // Sentry.captureException(error, {
      //   tags: { feature: featureName },
      //   extra: errorInfo,
      // })
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isExpanded: false,
    })

    // Callback de reset personnalisé
    this.props.onReset?.()
  }

  toggleExpanded = () => {
    this.setState((prev) => ({ isExpanded: !prev.isExpanded }))
  }

  render() {
    const { hasError, error, errorInfo, isExpanded } = this.state
    const { children, featureName, fallback, fallbackAction, showErrorDetails } = this.props

    if (!hasError) {
      return children
    }

    // Fallback personnalisé
    if (fallback) {
      return fallback
    }

    const isDevelopment = process.env.NODE_ENV === 'development'
    const shouldShowDetails = showErrorDetails ?? isDevelopment

    // UI par défaut
    return (
      <Alert variant="destructive" className="border-2">
        <AlertCircle className="h-5 w-5" />
        <AlertTitle className="text-base font-semibold">
          Erreur dans {featureName}
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p className="text-sm">
            Une erreur s'est produite lors du chargement de cette fonctionnalité.
          </p>

          {/* Message d'erreur */}
          {error && (
            <div className="rounded bg-destructive/20 p-2">
              <p className="font-mono text-xs">{error.message}</p>
            </div>
          )}

          {/* Détails techniques (développement) */}
          {shouldShowDetails && errorInfo && (
            <div>
              <button
                onClick={this.toggleExpanded}
                className="flex items-center gap-1 text-xs font-medium text-destructive-foreground/80 hover:text-destructive-foreground"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Masquer les détails
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Afficher les détails
                  </>
                )}
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-2">
                  <div>
                    <p className="text-xs font-semibold">Stack Trace:</p>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-destructive/10 p-2 font-mono text-xs">
                      {error?.stack}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Component Stack:</p>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-destructive/10 p-2 font-mono text-xs">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={this.handleReset}
              size="sm"
              variant="outline"
              className="gap-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <RefreshCw className="h-3 w-3" />
              Réessayer
            </Button>

            {fallbackAction && (
              <Button
                onClick={fallbackAction.onClick}
                size="sm"
                variant="secondary"
              >
                {fallbackAction.label}
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }
}

/**
 * Hook wrapper pour utiliser FeatureErrorBoundary de manière fonctionnelle
 *
 * @example
 * ```tsx
 * function ChatWidget() {
 *   const ErrorBoundary = useFeatureErrorBoundary('Chat Widget')
 *
 *   return (
 *     <ErrorBoundary>
 *       <ChatContent />
 *     </ErrorBoundary>
 *   )
 * }
 * ```
 */
export function useFeatureErrorBoundary(
  featureName: string,
  options?: Omit<Props, 'children' | 'featureName'>
) {
  return function ErrorBoundaryWrapper({ children }: { children: ReactNode }) {
    return (
      <FeatureErrorBoundary featureName={featureName} {...options}>
        {children}
      </FeatureErrorBoundary>
    )
  }
}
