#!/usr/bin/env tsx
/**
 * Récupère toutes les clés API depuis la base de données locale
 */

import { listApiKeys } from '../lib/api-keys/api-keys-service'
import 'dotenv/config'

async function main() {
  console.log('🔍 Récupération des clés API depuis la base de données locale...\n')

  try {
    const keys = await listApiKeys()

    if (keys.length === 0) {
      console.log('⚠️  Aucune clé trouvée dans la base de données\n')
      return
    }

    console.log(`✓ ${keys.length} clés trouvées:\n`)

    for (const key of keys) {
      const keyPreview = key.apiKey.substring(0, 20) + '...'
      const status = key.isActive ? '✅ Active' : '❌ Inactive'

      console.log(`Provider: ${key.provider}`)
      console.log(`Label: ${key.label}`)
      console.log(`Clé: ${keyPreview}`)
      console.log(`Status: ${status}`)
      console.log(`Dernière utilisation: ${key.lastUsedAt || 'Jamais'}`)
      console.log('---')
    }

    console.log('\n📋 Format .env pour copier-coller:\n')

    for (const key of keys) {
      const envName = getEnvVarName(key.provider)
      console.log(`${envName}=${key.apiKey}`)
    }
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

function getEnvVarName(provider: string): string {
  switch (provider) {
    case 'google':
      return 'GOOGLE_API_KEY'
    case 'groq':
      return 'GROQ_API_KEY'
    case 'deepseek':
      return 'DEEPSEEK_API_KEY'
    case 'anthropic':
      return 'ANTHROPIC_API_KEY'
    case 'openai':
      return 'OPENAI_API_KEY'
    default:
      return `${provider.toUpperCase()}_API_KEY`
  }
}

main()
