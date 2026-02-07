/**
 * Utilitaires de gestion des tokens
 *
 * Module centralisé pour le comptage et la gestion des tokens.
 * Utilise gpt-tokenizer pour un comptage précis compatible avec GPT-4/Claude.
 */

import { encode } from 'gpt-tokenizer'

/**
 * Compte le nombre de tokens dans un texte de manière précise
 * Utilise gpt-tokenizer pour un comptage exact compatible GPT-4/Claude
 *
 * @param text - Texte à analyser
 * @returns Nombre de tokens
 */
export function countTokens(text: string): number {
  if (!text) return 0

  try {
    return encode(text).length
  } catch {
    // Fallback si erreur d'encodage (caractères spéciaux rares)
    return Math.ceil(text.length / 4)
  }
}

/**
 * Estime le nombre de tokens (alias pour compatibilité)
 * @deprecated Utiliser countTokens à la place
 */
export function estimateTokenCount(text: string): number {
  return countTokens(text)
}

/**
 * Tronque un texte à un nombre maximum de tokens
 *
 * @param text - Texte à tronquer
 * @param maxTokens - Nombre maximum de tokens
 * @returns Texte tronqué
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (!text) return ''

  const tokens = countTokens(text)
  if (tokens <= maxTokens) return text

  // Estimation: 4 caractères par token en moyenne
  // On tronque progressivement jusqu'à atteindre la limite
  let truncated = text
  let currentTokens = tokens

  while (currentTokens > maxTokens && truncated.length > 0) {
    // Réduire de ~10% à chaque itération
    const newLength = Math.floor(truncated.length * 0.9)
    truncated = truncated.substring(0, newLength)
    currentTokens = countTokens(truncated)
  }

  return truncated
}

/**
 * Vérifie si un texte dépasse une limite de tokens
 *
 * @param text - Texte à vérifier
 * @param maxTokens - Limite maximale
 * @returns true si le texte dépasse la limite
 */
export function exceedsTokenLimit(text: string, maxTokens: number): boolean {
  return countTokens(text) > maxTokens
}

/**
 * Calcule le coût estimé en tokens pour un ensemble de textes
 *
 * @param texts - Liste de textes
 * @returns Total de tokens
 */
export function totalTokens(texts: string[]): number {
  return texts.reduce((sum, text) => sum + countTokens(text), 0)
}
