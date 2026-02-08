'use client'

import { useRef, useCallback, useEffect, useMemo } from 'react'
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at?: string
  sources?: unknown[]
}

interface UseVirtualizedMessagesOptions {
  /**
   * Seuil minimum de messages pour activer la virtualisation
   * @default 50
   */
  threshold?: number

  /**
   * Nombre d'éléments à rendre en dehors de la zone visible
   * @default 5
   */
  overscan?: number

  /**
   * Hauteur estimée d'un message en pixels
   * @default 120
   */
  estimatedHeight?: number

  /**
   * Activer l'auto-scroll vers le dernier message
   * @default true
   */
  autoScrollToBottom?: boolean
}

interface UseVirtualizedMessagesResult {
  /**
   * Ref à attacher au conteneur scrollable
   */
  containerRef: React.RefObject<HTMLDivElement>

  /**
   * Indique si la virtualisation est active
   */
  isVirtualized: boolean

  /**
   * Items virtuels à rendre
   */
  virtualItems: VirtualItem[]

  /**
   * Hauteur totale de la liste virtualisée
   */
  totalHeight: number

  /**
   * Fonction pour scroller vers un index
   */
  scrollToIndex: (index: number) => void

  /**
   * Fonction pour scroller vers le bas
   */
  scrollToBottom: () => void

  /**
   * Mesurer un item après rendu (pour tailles dynamiques)
   */
  measureElement: (element: Element | null) => void
}

/**
 * Estime la hauteur d'un message basé sur son contenu
 */
function estimateMessageHeight(message: ChatMessage): number {
  const baseHeight = 80 // Padding + header
  const contentLength = message.content?.length || 0

  // Environ 80 caractères par ligne, 24px par ligne
  const estimatedLines = Math.ceil(contentLength / 80)
  const contentHeight = estimatedLines * 24

  // Sources ajoutent de la hauteur
  const sourcesHeight = message.sources?.length ? 60 : 0

  return Math.max(baseHeight + contentHeight + sourcesHeight, 100)
}

/**
 * Hook pour virtualiser une liste de messages de chat
 * Améliore les performances pour les conversations longues (50+ messages)
 */
export function useVirtualizedMessages(
  messages: ChatMessage[],
  options: UseVirtualizedMessagesOptions = {}
): UseVirtualizedMessagesResult {
  const {
    threshold = 50,
    overscan = 5,
    estimatedHeight = 120,
    autoScrollToBottom = true,
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const isVirtualized = messages.length > threshold

  // Configuration du virtualizer
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const message = messages[index]
        return message ? estimateMessageHeight(message) : estimatedHeight
      },
      [messages, estimatedHeight]
    ),
    overscan,
    // Activer le mesure dynamique pour les tailles exactes
    measureElement: (element) => element?.getBoundingClientRect().height ?? estimatedHeight,
  })

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  const previousLength = useRef(messages.length)
  useEffect(() => {
    if (autoScrollToBottom && messages.length > previousLength.current) {
      // Petit délai pour laisser le temps au rendu
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
      })
    }
    previousLength.current = messages.length
  }, [messages.length, autoScrollToBottom, virtualizer])

  // Scroller vers un index spécifique
  const scrollToIndex = useCallback(
    (index: number) => {
      virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' })
    },
    [virtualizer]
  )

  // Scroller vers le bas
  const scrollToBottom = useCallback(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' })
    }
  }, [messages.length, virtualizer])

  // Memo pour éviter les re-renders inutiles
  const virtualItems = useMemo(
    () => (isVirtualized ? virtualizer.getVirtualItems() : []),
    [isVirtualized, virtualizer]
  )

  const totalHeight = isVirtualized ? virtualizer.getTotalSize() : 0

  return {
    containerRef,
    isVirtualized,
    virtualItems,
    totalHeight,
    scrollToIndex,
    scrollToBottom,
    measureElement: virtualizer.measureElement,
  }
}

/**
 * Hook simplifié pour les cas où on veut juste savoir si virtualiser
 */
export function useShouldVirtualize(itemCount: number, threshold = 50): boolean {
  return itemCount > threshold
}
