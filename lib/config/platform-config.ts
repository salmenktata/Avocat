/**
 * Service de configuration plateforme
 * Lit les clés API depuis la base de données avec fallback sur les variables d'environnement
 */

import { query } from '@/lib/db/postgres'

// Cache en mémoire pour éviter les requêtes répétées
const configCache: Map<string, { value: string; timestamp: number }> = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export interface PlatformConfigRow {
  id: string
  key: string
  value: string
  description: string | null
  category: string
  is_secret: boolean
  is_active: boolean
  created_at: Date
  updated_at: Date
}

/**
 * Récupère une valeur de configuration
 * Priorité: Base de données > Variables d'environnement
 */
export async function getConfig(key: string): Promise<string | null> {
  // Vérifier le cache
  const cached = configCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value
  }

  try {
    // Essayer de lire depuis la base
    const result = await query<PlatformConfigRow>(
      'SELECT value FROM platform_config WHERE key = $1 AND is_active = true',
      [key]
    )

    if (result.rows.length > 0) {
      const value = result.rows[0].value
      configCache.set(key, { value, timestamp: Date.now() })
      return value
    }
  } catch (error) {
    // Si erreur DB, on continue avec le fallback
    console.warn(`[PlatformConfig] Erreur lecture ${key} depuis DB:`, error)
  }

  // Fallback sur variable d'environnement
  const envValue = process.env[key]
  if (envValue) {
    configCache.set(key, { value: envValue, timestamp: Date.now() })
    return envValue
  }

  return null
}

/**
 * Récupère plusieurs configurations d'un coup
 */
export async function getConfigs(keys: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {}

  for (const key of keys) {
    result[key] = await getConfig(key)
  }

  return result
}

/**
 * Récupère toutes les configurations d'une catégorie
 */
export async function getConfigsByCategory(category: string): Promise<PlatformConfigRow[]> {
  try {
    const result = await query<PlatformConfigRow>(
      'SELECT * FROM platform_config WHERE category = $1 AND is_active = true ORDER BY key',
      [category]
    )
    return result.rows
  } catch (error) {
    console.error(`[PlatformConfig] Erreur lecture catégorie ${category}:`, error)
    return []
  }
}

/**
 * Récupère toutes les configurations
 */
export async function getAllConfigs(): Promise<PlatformConfigRow[]> {
  try {
    const result = await query<PlatformConfigRow>(
      'SELECT * FROM platform_config WHERE is_active = true ORDER BY category, key'
    )
    return result.rows
  } catch (error) {
    console.error('[PlatformConfig] Erreur lecture toutes configs:', error)
    return []
  }
}

/**
 * Met à jour une configuration
 */
export async function setConfig(key: string, value: string): Promise<boolean> {
  try {
    await query(
      `UPDATE platform_config SET value = $1, updated_at = NOW() WHERE key = $2`,
      [value, key]
    )

    // Invalider le cache
    configCache.delete(key)

    return true
  } catch (error) {
    console.error(`[PlatformConfig] Erreur mise à jour ${key}:`, error)
    return false
  }
}

/**
 * Crée ou met à jour une configuration
 */
export async function upsertConfig(
  key: string,
  value: string,
  options?: {
    description?: string
    category?: string
    isSecret?: boolean
  }
): Promise<boolean> {
  try {
    await query(
      `INSERT INTO platform_config (key, value, description, category, is_secret)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         description = COALESCE(EXCLUDED.description, platform_config.description),
         category = COALESCE(EXCLUDED.category, platform_config.category),
         updated_at = NOW()`,
      [
        key,
        value,
        options?.description || null,
        options?.category || 'general',
        options?.isSecret ?? true,
      ]
    )

    // Invalider le cache
    configCache.delete(key)

    return true
  } catch (error) {
    console.error(`[PlatformConfig] Erreur upsert ${key}:`, error)
    return false
  }
}

/**
 * Invalide le cache (utile après modification directe en base)
 */
export function clearConfigCache(): void {
  configCache.clear()
}

// ============================================================================
// Helpers pour les clés courantes
// ============================================================================

export async function getGroqApiKey(): Promise<string | null> {
  return getConfig('GROQ_API_KEY')
}

export async function getOpenAIApiKey(): Promise<string | null> {
  return getConfig('OPENAI_API_KEY')
}

export async function getResendApiKey(): Promise<string | null> {
  return getConfig('RESEND_API_KEY')
}

export async function getBrevoApiKey(): Promise<string | null> {
  return getConfig('BREVO_API_KEY')
}

export async function getDeepSeekApiKey(): Promise<string | null> {
  return getConfig('DEEPSEEK_API_KEY')
}

export async function getDeepSeekModel(): Promise<string> {
  return (await getConfig('DEEPSEEK_MODEL')) || 'deepseek-chat'
}

/**
 * Récupère une clé API décryptée depuis la base de données
 * Utilise le système de clés cryptées (api_keys table)
 */
export async function getDecryptedApiKey(provider: string): Promise<string | null> {
  try {
    const { getApiKey } = await import('@/lib/api-keys/api-keys-service')
    return await getApiKey(provider)
  } catch (error) {
    console.error(`[PlatformConfig] Erreur récupération clé ${provider}:`, error)
    return null
  }
}
