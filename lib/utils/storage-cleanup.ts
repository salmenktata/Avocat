/**
 * Utilitaire de nettoyage du storage pour optimiser la consommation mémoire
 *
 * Surveille la taille du localStorage/sessionStorage et nettoie les anciennes entrées
 */

interface StorageItem {
  key: string
  size: number
  timestamp?: number
}

/**
 * Calcule la taille approximative d'un item de storage en bytes
 */
function getItemSize(key: string, value: string): number {
  return new Blob([key, value]).size
}

/**
 * Liste tous les items du storage avec leur taille
 */
export function listStorageItems(storage: Storage): StorageItem[] {
  const items: StorageItem[] = []

  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key) continue

    const value = storage.getItem(key)
    if (!value) continue

    const size = getItemSize(key, value)

    // Extraire timestamp si présent
    let timestamp: number | undefined
    if (key.endsWith('_ts')) {
      timestamp = parseInt(value, 10)
    } else {
      // Essayer de parser le JSON pour trouver un timestamp
      try {
        const parsed = JSON.parse(value)
        if (parsed.state?.timestamp) {
          timestamp = parsed.state.timestamp
        }
      } catch {
        // Pas de timestamp trouvé
      }
    }

    items.push({ key, size, timestamp })
  }

  return items.sort((a, b) => b.size - a.size)
}

/**
 * Obtient la taille totale utilisée par le storage en bytes
 */
export function getStorageSize(storage: Storage): number {
  return listStorageItems(storage).reduce((total, item) => total + item.size, 0)
}

/**
 * Formate une taille en bytes vers une chaîne lisible
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Nettoie les items du storage qui correspondent à un pattern
 */
export function cleanupStorageByPattern(storage: Storage, pattern: RegExp): number {
  const keysToRemove: string[] = []

  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && pattern.test(key)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach(key => storage.removeItem(key))
  return keysToRemove.length
}

/**
 * Nettoie les items du storage plus anciens qu'un certain âge (en ms)
 */
export function cleanupOldItems(storage: Storage, maxAge: number): number {
  const now = Date.now()
  const items = listStorageItems(storage)
  let cleaned = 0

  items.forEach(item => {
    if (item.timestamp && (now - item.timestamp) > maxAge) {
      storage.removeItem(item.key)
      // Nettoyer aussi la clé timestamp associée si elle existe
      storage.removeItem(`${item.key}_ts`)
      cleaned++
    }
  })

  return cleaned
}

/**
 * Nettoie le storage pour libérer de l'espace jusqu'à atteindre une taille cible
 */
export function cleanupToTargetSize(storage: Storage, targetSizeBytes: number): number {
  let currentSize = getStorageSize(storage)
  if (currentSize <= targetSizeBytes) return 0

  const items = listStorageItems(storage)
  let cleaned = 0

  // Nettoyer les plus gros items en premier (sauf les essentiels comme session_cache)
  const essentialKeys = ['session_cache', 'session_cache_ts']

  for (const item of items) {
    if (currentSize <= targetSizeBytes) break
    if (essentialKeys.includes(item.key)) continue

    storage.removeItem(item.key)
    currentSize -= item.size
    cleaned++
  }

  return cleaned
}

/**
 * Affiche un rapport de l'utilisation du storage dans la console
 */
export function logStorageReport(storage: Storage, name: string): void {
  const items = listStorageItems(storage)
  const totalSize = getStorageSize(storage)

  console.group(`📊 ${name} Storage Report`)
  console.log(`Total size: ${formatBytes(totalSize)}`)
  console.log(`Items count: ${items.length}`)
  console.log('Top 5 largest items:')
  items.slice(0, 5).forEach(item => {
    console.log(`  - ${item.key}: ${formatBytes(item.size)}`)
  })
  console.groupEnd()
}

/**
 * Hook React pour nettoyer automatiquement le storage
 * Utiliser dans un composant racine
 */
export function useStorageCleanup(options: {
  interval?: number // ms entre chaque nettoyage (défaut: 5min)
  maxAge?: number // âge max des items (défaut: 30min)
  maxSize?: number // taille max en bytes (défaut: 5MB)
  enabled?: boolean // activer/désactiver (défaut: true)
} = {}) {
  const {
    interval = 5 * 60 * 1000, // 5 minutes
    maxAge = 30 * 60 * 1000, // 30 minutes
    maxSize = 5 * 1024 * 1024, // 5 MB
    enabled = true
  } = options

  if (typeof window === 'undefined' || !enabled) return

  const cleanup = () => {
    try {
      // Nettoyer sessionStorage
      const oldItemsCleaned = cleanupOldItems(sessionStorage, maxAge)
      const sizeCleaned = cleanupToTargetSize(sessionStorage, maxSize)

      if (oldItemsCleaned > 0 || sizeCleaned > 0) {
        console.log(`[Storage Cleanup] Cleaned ${oldItemsCleaned} old items, ${sizeCleaned} for size`)
      }

      // Optionnel : nettoyer aussi localStorage
      cleanupToTargetSize(localStorage, maxSize)

      // Log du rapport (uniquement en dev)
      if (process.env.NODE_ENV === 'development') {
        logStorageReport(sessionStorage, 'Session')
        logStorageReport(localStorage, 'Local')
      }
    } catch (error) {
      console.error('[Storage Cleanup] Error:', error)
    }
  }

  // Nettoyage initial
  cleanup()

  // Nettoyage périodique
  const intervalId = setInterval(cleanup, interval)

  // Cleanup à la fermeture
  return () => clearInterval(intervalId)
}
