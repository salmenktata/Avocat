/**
 * Liste les modèles Gemini disponibles pour la clé API
 */

import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY

  if (!apiKey) {
    console.error('❌ GOOGLE_API_KEY non configuré')
    process.exit(1)
  }

  console.log('🔍 Listing Gemini models...')
  console.log('API Key:', apiKey.substring(0, 20) + '...')
  console.log()

  const genAI = new GoogleGenerativeAI(apiKey)

  try {
    const models = await genAI.listModels()

    console.log(`✅ Trouvé ${models.length} modèle(s) disponible(s):\n`)

    for (const model of models) {
      console.log('━'.repeat(80))
      console.log(`Nom: ${model.name}`)
      console.log(`Display Name: ${model.displayName}`)
      console.log(`Description: ${model.description}`)
      console.log(`Supported methods: ${model.supportedGenerationMethods?.join(', ')}`)
      console.log(`Input token limit: ${model.inputTokenLimit}`)
      console.log(`Output token limit: ${model.outputTokenLimit}`)
      console.log()
    }

    console.log('━'.repeat(80))
    console.log()
    console.log('💡 Modèles à utiliser pour generateContent:')
    const generateModels = models.filter(m =>
      m.supportedGenerationMethods?.includes('generateContent')
    )

    for (const model of generateModels) {
      // Extraire juste le nom du modèle depuis le path complet
      const modelName = model.name.replace('models/', '')
      console.log(`  - ${modelName}`)
    }

  } catch (error) {
    console.error('❌ Erreur:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
