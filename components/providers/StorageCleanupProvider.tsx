'use client'

/**
 * Provider pour le nettoyage automatique du storage
 *
 * Surveille et nettoie automatiquement sessionStorage/localStorage
 * pour éviter la saturation mémoire et améliorer les performances
 */

import { useEffect } from 'react'
import { useStorageCleanup } from '@/lib/utils/storage-cleanup'

interface StorageCleanupProviderProps {
  children: React.ReactNode
  enabled?: boolean
  interval?: number // ms entre chaque nettoyage
  maxAge?: number // âge max des items en ms
  maxSize?: number // taille max en bytes
}

export function StorageCleanupProvider({
  children,
  enabled = true,
  interval = 5 * 60 * 1000, // 5 minutes
  maxAge = 30 * 60 * 1000, // 30 minutes
  maxSize = 3 * 1024 * 1024, // 3 MB (réduit de 5MB pour plus de sécurité)
}: StorageCleanupProviderProps) {

  // Appeler le hook au top-level (règle ESLint react-hooks/rules-of-hooks)
  const cleanup = useStorageCleanup({
    interval,
    maxAge,
    maxSize,
    enabled
  })

  // Nettoyer à l'unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return <>{children}</>
}
