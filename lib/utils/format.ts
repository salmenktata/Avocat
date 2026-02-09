/**
 * Utilitaires de formatage pour l'affichage des données
 */

/**
 * Formate un montant monétaire
 */
export function formatCurrency(amount: number, currency: 'USD' | 'TND' = 'USD'): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return `${currency === 'USD' ? '$' : 'TND'} 0.00`
  }

  const formatted = amount.toFixed(2)

  if (currency === 'USD') {
    return `$${formatted}`
  } else {
    return `${formatted} TND`
  }
}

/**
 * Formate un nombre avec séparateurs de milliers et suffixes K/M
 */
export function formatNumber(num: number): string {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0'
  }

  // Si < 1000, afficher tel quel
  if (num < 1000) {
    return num.toString()
  }

  // Si < 1 million, afficher en K
  if (num < 1000000) {
    return `${(num / 1000).toFixed(1)}K`
  }

  // Si >= 1 million, afficher en M
  return `${(num / 1000000).toFixed(2)}M`
}

/**
 * Formate un nombre avec séparateurs de milliers (format français)
 */
export function formatNumberWithSeparators(num: number): string {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0'
  }

  return num.toLocaleString('fr-FR')
}

/**
 * Formate une date au format court (DD/MM/YYYY)
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Formate une date au format long (1er janvier 2026)
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', { dateStyle: 'long' })
}

/**
 * Formate une durée en millisecondes en format lisible
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }

  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }

  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}
