/**
 * Script de test de l'intégration Gemini 2.0 Flash-Lite
 *
 * Usage:
 *   GOOGLE_API_KEY=xxx tsx scripts/test-gemini-integration.ts
 */

import 'dotenv/config'
import {
  callGemini,
  checkGeminiHealth,
  getGeminiInfo,
  getGeminiRPMStats,
} from '../lib/ai/gemini-client'
import { callLLMWithFallback } from '../lib/ai/llm-fallback-service'
import { aiConfig } from '../lib/ai/config'

async function main() {
  console.log('='.repeat(80))
  console.log('TEST INTÉGRATION GEMINI 2.0 FLASH-LITE')
  console.log('='.repeat(80))
  console.log()

  // 1. Vérifier configuration
  console.log('1. Configuration Gemini:')
  console.log('   - API Key configurée:', !!aiConfig.gemini.apiKey ? '✓' : '✗')
  console.log('   - Modèle:', aiConfig.gemini.model)
  console.log('   - Max tokens:', aiConfig.gemini.maxTokens)

  const geminiInfo = getGeminiInfo()
  console.log('   - Contexte:', geminiInfo.contextWindow.toLocaleString(), 'tokens')
  console.log('   - Coût input:', geminiInfo.costInput)
  console.log('   - Coût output:', geminiInfo.costOutput)
  console.log('   - Tier gratuit:', geminiInfo.freeTier ? 'Oui' : 'Non')
  console.log('   - Rate limit:', geminiInfo.rpmLimit, 'RPM')
  console.log()

  if (!aiConfig.gemini.apiKey) {
    console.error('❌ GOOGLE_API_KEY non configuré')
    console.log()
    console.log('Pour obtenir une clé API:')
    console.log('1. Allez sur https://aistudio.google.com/app/apikey')
    console.log('2. Cliquez "Create API key"')
    console.log('3. Ajoutez GOOGLE_API_KEY=xxx dans .env')
    process.exit(1)
  }

  // 2. Health check
  console.log('2. Health Check Gemini:')
  const health = await checkGeminiHealth()
  console.log('   - Disponible:', health.available ? '✓' : '✗')
  console.log('   - RPM utilisé:', health.rpmStats.requestsThisMinute, '/', health.rpmStats.limit)
  console.log('   - Slots disponibles:', health.rpmStats.availableSlots)
  if (health.error) {
    console.log('   - Erreur:', health.error)
  }
  console.log()

  if (!health.available) {
    console.error('❌ Gemini indisponible')
    process.exit(1)
  }

  // 3. Test simple français
  console.log('3. Test réponse simple (français):')
  try {
    const result = await callGemini(
      [{ role: 'user', content: 'Qu\'est-ce que le Code des Obligations et Contrats tunisien ?' }],
      { temperature: 0.3, maxTokens: 200 }
    )

    console.log('   ✓ Réponse reçue')
    console.log('   - Tokens input:', result.tokensUsed.input)
    console.log('   - Tokens output:', result.tokensUsed.output)
    console.log('   - Total tokens:', result.tokensUsed.total)
    console.log('   - Modèle:', result.modelUsed)
    console.log('   - Finish reason:', result.finishReason)
    console.log()
    console.log('   Extrait réponse:')
    console.log('   ', result.answer.substring(0, 150), '...')
    console.log()
  } catch (error) {
    console.error('   ❌ Erreur:', error instanceof Error ? error.message : error)
    console.log()
  }

  // 4. Test simple arabe
  console.log('4. Test réponse simple (arabe):')
  try {
    const result = await callGemini(
      [{ role: 'user', content: 'ما هو قانون الالتزامات والعقود التونسي؟' }],
      { temperature: 0.3, maxTokens: 200 }
    )

    console.log('   ✓ Réponse reçue')
    console.log('   - Tokens input:', result.tokensUsed.input)
    console.log('   - Tokens output:', result.tokensUsed.output)
    console.log('   - Total tokens:', result.tokensUsed.total)
    console.log()
    console.log('   Extrait réponse:')
    console.log('   ', result.answer.substring(0, 100), '...')
    console.log()
  } catch (error) {
    console.error('   ❌ Erreur:', error instanceof Error ? error.message : error)
    console.log()
  }

  // 5. Test fallback automatique
  console.log('5. Test fallback LLM (devrait utiliser Gemini en premier):')
  try {
    const result = await callLLMWithFallback(
      [
        { role: 'user', content: 'Explique en 2 phrases ce qu\'est le droit tunisien.' },
      ],
      { temperature: 0.3, maxTokens: 100 }
    )

    console.log('   ✓ Réponse reçue')
    console.log('   - Provider utilisé:', result.provider)
    console.log('   - Modèle:', result.modelUsed)
    console.log('   - Fallback activé:', result.fallbackUsed ? 'Oui' : 'Non')
    if (result.fallbackUsed && result.originalProvider) {
      console.log('   - Provider original:', result.originalProvider)
    }
    console.log('   - Total tokens:', result.tokensUsed.total)
    console.log()
    console.log('   Réponse:')
    console.log('   ', result.answer)
    console.log()
  } catch (error) {
    console.error('   ❌ Erreur:', error instanceof Error ? error.message : error)
    console.log()
  }

  // 6. Stats RPM finales
  const finalStats = getGeminiRPMStats()
  console.log('6. Stats RPM finales:')
  console.log('   - Requêtes effectuées:', finalStats.requestsThisMinute)
  console.log('   - Limite:', finalStats.limit)
  console.log('   - Slots restants:', finalStats.availableSlots)
  console.log()

  // 7. Estimation coûts
  console.log('7. Estimation coûts (si tier payant):')
  const totalTokensUsed = 800 // Estimation des 4 tests
  const costInput = (totalTokensUsed / 1_000_000) * 0.075
  const costOutput = (totalTokensUsed / 1_000_000) * 0.30
  const costTotal = costInput + costOutput
  console.log('   - Tokens totaux (estimation):', totalTokensUsed)
  console.log('   - Coût input: $' + costInput.toFixed(6))
  console.log('   - Coût output: $' + costOutput.toFixed(6))
  console.log('   - Coût total: $' + costTotal.toFixed(6))
  console.log('   - Note: Tier gratuit illimité (pas de coût réel)')
  console.log()

  console.log('='.repeat(80))
  console.log('✓ Tests Gemini terminés avec succès')
  console.log('='.repeat(80))
}

main().catch((error) => {
  console.error('Erreur fatale:', error)
  process.exit(1)
})
