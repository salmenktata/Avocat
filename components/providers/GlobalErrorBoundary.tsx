/**
 * GlobalErrorBoundary - Error Boundary global pour toute l'application
 * Capture les erreurs non gérées et affiche une page d'erreur gracieuse
 *
 * @module components/providers
 * @see Sprint 1 - Système Feedback
 */

'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  children: ReactNode
  /**
   * Message personnalisé pour l'erreur
   */
  fallbackMessage?: string
  /**
   * Callback appelé quand une erreur est capturée
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /**
   * Afficher les détails techniques de l'erreur (mode développement)
   * @default true en development, false en production
   */
  showErrorDetails?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  errorCount: number
}

/**
 * Error Boundary global
 * Wrapper toute l'application pour capturer les erreurs React non gérées
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log l'erreur
    console.error('🚨 Global Error Boundary caught error:', error)
    console.error('Error Info:', errorInfo)

    // Incrémenter le compteur d'erreurs
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }))

    // Callback custom
    this.props.onError?.(error, errorInfo)

    // En production, envoyer à un service de monitoring (Sentry, LogRocket, etc.)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Intégrer service de monitoring
      // Sentry.captureException(error, { extra: errorInfo })
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/dashboard'
  }

  handleReportBug = () => {
    const { error, errorInfo } = this.state
    const body = encodeURIComponent(`
**Erreur capturée par GlobalErrorBoundary**

**Message:**
${error?.message || 'Erreur inconnue'}

**Stack:**
\`\`\`
${error?.stack || 'N/A'}
\`\`\`

**Component Stack:**
\`\`\`
${errorInfo?.componentStack || 'N/A'}
\`\`\`

**Navigateur:**
${navigator.userAgent}

**URL:**
${window.location.href}
    `)

    window.open(
      `https://github.com/salmenktata/moncabinet/issues/new?title=Bug+Report+Global+Error&body=${body}`,
      '_blank'
    )
  }

  render() {
    const { hasError, error, errorInfo, errorCount } = this.state
    const { children, fallbackMessage, showErrorDetails } = this.props

    if (!hasError) {
      return children
    }

    const isDevelopment = process.env.NODE_ENV === 'development'
    const shouldShowDetails = showErrorDetails ?? isDevelopment

    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-2xl border-destructive">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <CardTitle className="text-2xl">Une erreur s'est produite</CardTitle>
                <CardDescription>
                  {fallbackMessage || "L'application a rencontré une erreur inattendue"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Message d'erreur */}
            {error && (
              <div className="rounded-md bg-destructive/10 p-4">
                <p className="font-mono text-sm text-destructive">
                  {error.message || 'Erreur inconnue'}
                </p>
              </div>
            )}

            {/* Détails techniques (développement uniquement) */}
            {shouldShowDetails && errorInfo && (
              <details className="rounded-md border bg-muted p-4">
                <summary className="cursor-pointer font-semibold text-muted-foreground">
                  Détails techniques
                </summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Stack Trace:</p>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-background p-2 font-mono text-xs">
                      {error?.stack}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Component Stack:</p>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-background p-2 font-mono text-xs">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                </div>
              </details>
            )}

            {/* Compteur d'erreurs (si plusieurs erreurs consécutives) */}
            {errorCount > 1 && (
              <div className="rounded-md bg-orange-50 p-3 dark:bg-orange-900/20">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  <strong>Attention:</strong> {errorCount} erreurs consécutives détectées. Il est
                  recommandé de recharger la page.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={this.handleReset} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>

              <Button onClick={this.handleReload} variant="secondary" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Recharger la page
              </Button>

              <Button onClick={this.handleGoHome} variant="outline" className="gap-2">
                <Home className="h-4 w-4" />
                Retour à l'accueil
              </Button>

              <Button onClick={this.handleReportBug} variant="ghost" className="gap-2">
                <Bug className="h-4 w-4" />
                Signaler le bug
              </Button>
            </div>

            {/* Info contact */}
            <div className="rounded-md border-l-4 border-blue-500 bg-blue-50 p-3 dark:bg-blue-900/20">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Besoin d'aide ?</strong> Si le problème persiste, contactez le support à{' '}
                <a
                  href="mailto:support@qadhya.tn"
                  className="underline hover:text-blue-600"
                >
                  support@qadhya.tn
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}
