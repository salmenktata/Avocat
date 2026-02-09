/**
 * Client Gemini 2.0 Flash-Lite
 *
 * Modèle économique de Google pour RAG à grande échelle.
 * - Tier gratuit: illimité en input/output (avec rate limiting 15 RPM)
 * - Tier payant: $0.075/M input, $0.30/M output
 * - Contexte: 1M tokens (excellent pour longs documents PDF)
 * - Langues: Excellent support AR/FR
 *
 * Intégré dans la stratégie LLM par contexte (RAG, web scraping, traduction)
 */

import { GoogleGenerativeAI, GenerateContentResult } from '@google/generative-ai'
import { aiConfig } from './config'

// =============================================================================
// TYPES
// =============================================================================

export interface GeminiMessage {
  role: 'user' | 'model' // Gemini utilise 'model' au lieu de 'assistant'
  parts: string | { text: string }
}

export interface GeminiOptions {
  temperature?: number
  maxTokens?: number
  systemInstruction?: string
}

export interface GeminiResponse {
  answer: string
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  modelUsed: string
  finishReason: string
}

// =============================================================================
// CONFIGURATION
// =============================================================================

// Tier gratuit Gemini : 15 RPM (requêtes par minute)
// Source: https://ai.google.dev/pricing
const FREE_TIER_RPM_LIMIT = 15

// Compteur simple pour tracking RPM (réinitialise chaque minute)
let requestsThisMinute = 0
let currentMinuteTimestamp = Math.floor(Date.now() / 60000)

/**
 * Reset compteur RPM si on change de minute
 */
function resetRPMCounterIfNeeded(): void {
  const now = Math.floor(Date.now() / 60000)
  if (now > currentMinuteTimestamp) {
    requestsThisMinute = 0
    currentMinuteTimestamp = now
  }
}

/**
 * Vérifie si on peut faire une requête (rate limiting)
 */
function canMakeRequest(): boolean {
  resetRPMCounterIfNeeded()
  return requestsThisMinute < FREE_TIER_RPM_LIMIT
}

/**
 * Incrémente le compteur de requêtes
 */
function incrementRequestCounter(): void {
  resetRPMCounterIfNeeded()
  requestsThisMinute++
}

/**
 * Retourne les stats RPM pour monitoring
 */
export function getGeminiRPMStats(): {
  requestsThisMinute: number
  limit: number
  availableSlots: number
  minuteTimestamp: number
} {
  resetRPMCounterIfNeeded()
  return {
    requestsThisMinute,
    limit: FREE_TIER_RPM_LIMIT,
    availableSlots: Math.max(0, FREE_TIER_RPM_LIMIT - requestsThisMinute),
    minuteTimestamp: currentMinuteTimestamp,
  }
}

// =============================================================================
// CLIENT SINGLETON
// =============================================================================

let geminiClient: GoogleGenerativeAI | null = null

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    if (!aiConfig.gemini.apiKey) {
      throw new Error(
        'GOOGLE_API_KEY non configuré. ' +
        'Créez une clé sur https://aistudio.google.com/app/apikey'
      )
    }
    geminiClient = new GoogleGenerativeAI(aiConfig.gemini.apiKey)
  }
  return geminiClient
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convertit messages OpenAI format → Gemini format
 * OpenAI: { role: 'user' | 'assistant', content: string }
 * Gemini: { role: 'user' | 'model', parts: [{ text: string }] }
 */
export function convertMessagesToGeminiFormat(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): { systemInstruction?: string; contents: Array<{ role: string; parts: Array<{ text: string }> }> } {
  // Séparer system message des autres
  const userMessages = messages.filter((m) => m.role !== 'system')

  // Mapper role 'assistant' → 'model'
  const geminiMessages = userMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    parts: [{ text: m.content }],
  }))

  return {
    systemInstruction: systemPrompt,
    contents: geminiMessages,
  }
}

/**
 * Parse la réponse Gemini et extrait les tokens
 */
function parseGeminiResponse(result: GenerateContentResult): GeminiResponse {
  const response = result.response
  const text = response.text()

  // Extraire les tokens depuis usage metadata
  const usage = response.usageMetadata || {
    promptTokenCount: 0,
    candidatesTokenCount: 0,
    totalTokenCount: 0,
  }

  return {
    answer: text,
    tokensUsed: {
      input: usage.promptTokenCount || 0,
      output: usage.candidatesTokenCount || 0,
      total: usage.totalTokenCount || 0,
    },
    modelUsed: `gemini/${aiConfig.gemini.model}`,
    finishReason: response.candidates?.[0]?.finishReason || 'STOP',
  }
}

// =============================================================================
// FONCTIONS PRINCIPALES
// =============================================================================

/**
 * Appelle Gemini 2.0 Flash-Lite avec rate limiting automatique
 *
 * @param messages - Messages de conversation (format OpenAI compatible)
 * @param options - Options de génération
 * @returns Réponse Gemini avec tracking tokens
 */
export async function callGemini(
  messages: Array<{ role: string; content: string }>,
  options: GeminiOptions = {}
): Promise<GeminiResponse> {
  // Vérifier rate limit AVANT l'appel
  if (!canMakeRequest()) {
    const stats = getGeminiRPMStats()
    throw new Error(
      `Gemini rate limit atteint (${stats.requestsThisMinute}/${stats.limit} RPM). ` +
      `Réessayez dans ${61 - (Date.now() % 60000) / 1000}s ou utilisez le fallback.`
    )
  }

  const client = getGeminiClient()
  const model = client.getGenerativeModel({
    model: aiConfig.gemini.model,
    systemInstruction: options.systemInstruction,
  })

  // Convertir messages au format Gemini
  const { contents } = convertMessagesToGeminiFormat(messages, options.systemInstruction)

  // Préparer les paramètres de génération
  const generationConfig = {
    temperature: options.temperature ?? 0.3,
    maxOutputTokens: options.maxTokens || 4000,
  }

  try {
    // Incrémenter AVANT l'appel pour éviter races
    incrementRequestCounter()

    const result = await model.generateContent({
      contents,
      generationConfig,
    })

    return parseGeminiResponse(result)
  } catch (error) {
    // Si erreur 429 (rate limit), logger pour monitoring
    if (error instanceof Error && error.message.includes('429')) {
      console.error('[Gemini] Rate limit error:', error.message)
      throw new Error(
        `Gemini quota épuisé ou rate limit atteint. ` +
        `Erreur: ${error.message}`
      )
    }

    // Si erreur 503 (service unavailable), retry possible
    if (error instanceof Error && error.message.includes('503')) {
      throw new Error(
        `Gemini temporairement indisponible (503). ` +
        `Le fallback va prendre le relais.`
      )
    }

    // Autres erreurs
    throw new Error(
      `Gemini error: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Appelle Gemini en mode streaming (pour UI temps réel)
 * Note: À implémenter si besoin futur
 */
export async function* callGeminiStream(
  messages: Array<{ role: string; content: string }>,
  options: GeminiOptions = {}
): AsyncGenerator<string, void, unknown> {
  // Vérifier rate limit
  if (!canMakeRequest()) {
    throw new Error('Gemini rate limit atteint')
  }

  const client = getGeminiClient()
  const model = client.getGenerativeModel({
    model: aiConfig.gemini.model,
    systemInstruction: options.systemInstruction,
  })

  const { contents } = convertMessagesToGeminiFormat(messages, options.systemInstruction)

  incrementRequestCounter()

  const result = await model.generateContentStream({
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens || 4000,
    },
  })

  for await (const chunk of result.stream) {
    const text = chunk.text()
    if (text) {
      yield text
    }
  }
}

/**
 * Vérifie la disponibilité de Gemini (health check)
 */
export async function checkGeminiHealth(): Promise<{
  available: boolean
  rpmStats: ReturnType<typeof getGeminiRPMStats>
  error?: string
}> {
  try {
    const stats = getGeminiRPMStats()

    // Si rate limit atteint, retourner indisponible
    if (!canMakeRequest()) {
      return {
        available: false,
        rpmStats: stats,
        error: 'Rate limit atteint (15 RPM)',
      }
    }

    // Test simple avec un prompt minimal
    const result = await callGemini([
      { role: 'user', content: 'Réponds "OK"' },
    ], { maxTokens: 10 })

    return {
      available: true,
      rpmStats: getGeminiRPMStats(),
    }
  } catch (error) {
    return {
      available: false,
      rpmStats: getGeminiRPMStats(),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Retourne les informations sur le modèle Gemini
 */
export function getGeminiInfo(): {
  model: string
  contextWindow: number
  costInput: string
  costOutput: string
  freeTier: boolean
  rpmLimit: number
} {
  return {
    model: aiConfig.gemini.model,
    contextWindow: 1_000_000, // 1M tokens
    costInput: '$0.075/M',
    costOutput: '$0.30/M',
    freeTier: true,
    rpmLimit: FREE_TIER_RPM_LIMIT,
  }
}
