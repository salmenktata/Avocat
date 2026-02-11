/**
 * Index des composants de feedback
 * Centralise tous les exports pour faciliter l'import
 *
 * @example
 * ```tsx
 * import {
 *   LoadingOverlay,
 *   ToastManager,
 *   useToastNotifications,
 *   useLoadingOverlay
 * } from '@/components/feedback'
 * ```
 */

export { LoadingOverlay, useLoadingOverlay } from './LoadingOverlay'
export { ToastManager, useToastNotifications, ToastCleanupProvider } from './ToastManager'
