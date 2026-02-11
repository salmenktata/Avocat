#!/usr/bin/env tsx
/**
 * Script de test des nouvelles routes API Dossiers
 *
 * Teste les routes :
 * - POST /api/dossiers/[id]/assistant
 * - GET  /api/dossiers/[id]/assistant
 * - POST /api/dossiers/[id]/consultation
 */

import fetch from 'node-fetch'

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // URL de l'API (local ou production)
  apiUrl: process.env.TEST_ENV === 'production'
    ? 'https://qadhya.tn'
    : 'http://localhost:7002',

  // ID du dossier à tester (si connu)
  dossierId: process.env.DOSSIER_ID || null,

  // Token de session (pour production)
  sessionToken: process.env.QADHYA_SESSION_TOKEN || '',
}

// =============================================================================
// QUESTIONS DE TEST
// =============================================================================

const TEST_QUESTIONS = {
  assistant: "Résume les points juridiques clés de ce dossier et identifie les principaux enjeux.",

  consultation: "Le client peut-il obtenir des dommages-intérêts dans cette affaire ?",

  consultationFacts: "Client engagé depuis 5 ans avec contrat CDI. Licencié sans préavis ni motif valable documenté. Aucune procédure disciplinaire préalable."
}

// =============================================================================
// TYPES
// =============================================================================

interface AssistantResponse {
  answer: string
  sources: Array<{
    id: string
    title: string
    category?: string
    similarity: number
  }>
  conversationId?: string
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  model: string
}

interface ConsultationResponse {
  answer: string
  sources: Array<{
    id: string
    title: string
    category?: string
    similarity: number
  }>
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  model: string
  format: 'IRAC'
}

interface ConversationsResponse {
  conversations: Array<{
    id: string
    title: string
    messageCount: number
    createdAt: string
    updatedAt: string
  }>
}

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

function printSection(title: string, emoji: string = '📌') {
  console.log('\n' + '='.repeat(80))
  console.log(`${emoji} ${title}`)
  console.log('='.repeat(80))
}

function printKeyValue(key: string, value: any, indent: number = 0) {
  const spaces = ' '.repeat(indent)
  console.log(`${spaces}${key.padEnd(25 - indent)}: ${value}`)
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// =============================================================================
// TESTS
// =============================================================================

async function testAssistantRoute(dossierId: string) {
  printSection('🧪 TEST 1/3 : POST /api/dossiers/[id]/assistant', '🧪')

  const startTime = Date.now()

  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/dossiers/${dossierId}/assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CONFIG.sessionToken ? { 'Cookie': `session=${CONFIG.sessionToken}` } : {}),
      },
      body: JSON.stringify({
        question: TEST_QUESTIONS.assistant,
        includeJurisprudence: true,
        usePremiumModel: false,
      }),
    })

    const duration = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json() as AssistantResponse

    console.log('\n✅ SUCCÈS')
    console.log('\n⏱️  Performance:')
    printKeyValue('Temps réponse', formatDuration(duration))

    console.log('\n📊 Résultat:')
    printKeyValue('Modèle utilisé', data.model)
    printKeyValue('Tokens utilisés', data.tokensUsed.total)
    printKeyValue('Conversation ID', data.conversationId || 'N/A')
    printKeyValue('Sources trouvées', data.sources.length)

    if (data.sources.length > 0) {
      console.log('\n📚 Sources (top 3):')
      data.sources.slice(0, 3).forEach((source, i) => {
        console.log(`  ${i + 1}. ${source.title} (similarité: ${(source.similarity * 100).toFixed(1)}%)`)
      })
    }

    console.log('\n💬 Réponse (premiers 300 caractères):')
    console.log('─'.repeat(80))
    console.log(data.answer.substring(0, 300) + '...')
    console.log('─'.repeat(80))

    return data.conversationId

  } catch (error) {
    console.log('\n❌ ÉCHEC')
    if (error instanceof Error) {
      console.error('Erreur:', error.message)
    }
    throw error
  }
}

async function testAssistantHistoryRoute(dossierId: string) {
  printSection('🧪 TEST 2/3 : GET /api/dossiers/[id]/assistant', '🧪')

  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/dossiers/${dossierId}/assistant`, {
      method: 'GET',
      headers: {
        ...(CONFIG.sessionToken ? { 'Cookie': `session=${CONFIG.sessionToken}` } : {}),
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json() as ConversationsResponse

    console.log('\n✅ SUCCÈS')
    console.log('\n📊 Résultat:')
    printKeyValue('Conversations trouvées', data.conversations.length)

    if (data.conversations.length > 0) {
      console.log('\n💬 Conversations récentes (top 5):')
      data.conversations.slice(0, 5).forEach((conv, i) => {
        console.log(`  ${i + 1}. ${conv.title}`)
        console.log(`     Messages: ${conv.messageCount} | Dernière MAJ: ${new Date(conv.updatedAt).toLocaleString('fr-FR')}`)
      })
    } else {
      console.log('  Aucune conversation trouvée pour ce dossier')
    }

  } catch (error) {
    console.log('\n❌ ÉCHEC')
    if (error instanceof Error) {
      console.error('Erreur:', error.message)
    }
    throw error
  }
}

async function testConsultationRoute(dossierId: string) {
  printSection('🧪 TEST 3/3 : POST /api/dossiers/[id]/consultation', '🧪')

  const startTime = Date.now()

  try {
    const response = await fetch(`${CONFIG.apiUrl}/api/dossiers/${dossierId}/consultation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CONFIG.sessionToken ? { 'Cookie': `session=${CONFIG.sessionToken}` } : {}),
      },
      body: JSON.stringify({
        question: TEST_QUESTIONS.consultation,
        facts: TEST_QUESTIONS.consultationFacts,
        usePremiumModel: false,
      }),
    })

    const duration = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json() as ConsultationResponse

    console.log('\n✅ SUCCÈS')
    console.log('\n⏱️  Performance:')
    printKeyValue('Temps réponse', formatDuration(duration))

    console.log('\n📊 Résultat:')
    printKeyValue('Format', data.format)
    printKeyValue('Modèle utilisé', data.model)
    printKeyValue('Tokens utilisés', data.tokensUsed.total)
    printKeyValue('Sources trouvées', data.sources.length)

    console.log('\n💬 Consultation IRAC (premiers 500 caractères):')
    console.log('─'.repeat(80))
    console.log(data.answer.substring(0, 500) + '...')
    console.log('─'.repeat(80))

    // Vérifier structure IRAC
    const hasIRAC = {
      issue: data.answer.includes('PROBLÉMATIQUE') || data.answer.includes('الإشكالية'),
      rule: data.answer.includes('RÈGLES') || data.answer.includes('القواعد'),
      application: data.answer.includes('ANALYSE') || data.answer.includes('التحليل'),
      conclusion: data.answer.includes('CONCLUSION') || data.answer.includes('الخلاصة'),
    }

    const iracScore = Object.values(hasIRAC).filter(Boolean).length
    console.log(`\n🎓 Structure IRAC: ${iracScore}/4 sections détectées`)
    if (iracScore === 4) {
      console.log('   ✅ Consultation IRAC complète')
    } else {
      console.log('   ⚠️  Structure IRAC partielle')
    }

  } catch (error) {
    console.log('\n❌ ÉCHEC')
    if (error instanceof Error) {
      console.error('Erreur:', error.message)
    }
    throw error
  }
}

// =============================================================================
// FONCTION PRINCIPALE
// =============================================================================

async function main() {
  printSection('🧪 TEST DES ROUTES API DOSSIERS', '🧪')

  console.log('\n📋 Configuration:')
  printKeyValue('Environment', CONFIG.apiUrl.includes('localhost') ? 'Local (Dev)' : 'Production')
  printKeyValue('API URL', CONFIG.apiUrl)
  printKeyValue('Dossier ID', CONFIG.dossierId || 'Non spécifié')
  printKeyValue('Authentification', CONFIG.sessionToken ? 'Token fourni ✅' : 'Aucun token ⚠️')

  // Vérifier qu'on a un dossier ID
  if (!CONFIG.dossierId) {
    console.log('\n❌ ERREUR: ID de dossier requis')
    console.log('\nUtilisation:')
    console.log('  DOSSIER_ID=<uuid> npm run test:dossiers-routes')
    console.log('\nOu pour production:')
    console.log('  TEST_ENV=production DOSSIER_ID=<uuid> QADHYA_SESSION_TOKEN=<token> npm run test:dossiers-routes')
    process.exit(1)
  }

  // Vérifier authentification en production
  if (CONFIG.apiUrl.includes('qadhya.tn') && !CONFIG.sessionToken) {
    console.log('\n⚠️  ATTENTION: Pas de token de session pour la production')
    console.log('   Les requêtes seront probablement rejetées (401 Unauthorized)')
    console.log('\nPour obtenir un token:')
    console.log('  1. Connectez-vous sur https://qadhya.tn')
    console.log('  2. Ouvrez DevTools (F12) → Application → Cookies')
    console.log('  3. Copiez la valeur du cookie "session"')
    console.log('  4. Relancez avec: QADHYA_SESSION_TOKEN=<token> npm run test:dossiers-routes')
    console.log('\nVoulez-vous continuer quand même ? (Les tests échoueront probablement)')
  }

  let testsPassed = 0
  let testsFailed = 0

  // Test 1: Assistant POST
  try {
    await testAssistantRoute(CONFIG.dossierId)
    testsPassed++
  } catch (error) {
    testsFailed++
  }

  await new Promise(resolve => setTimeout(resolve, 2000))

  // Test 2: Assistant GET (historique)
  try {
    await testAssistantHistoryRoute(CONFIG.dossierId)
    testsPassed++
  } catch (error) {
    testsFailed++
  }

  await new Promise(resolve => setTimeout(resolve, 2000))

  // Test 3: Consultation POST
  try {
    await testConsultationRoute(CONFIG.dossierId)
    testsPassed++
  } catch (error) {
    testsFailed++
  }

  // Résumé final
  printSection('📊 RÉSUMÉ DES TESTS', '📊')
  console.log(`\n✅ Tests réussis : ${testsPassed}/3`)
  console.log(`❌ Tests échoués : ${testsFailed}/3`)
  console.log(`📈 Taux de réussite : ${((testsPassed / 3) * 100).toFixed(1)}%`)

  if (testsPassed === 3) {
    console.log('\n🎉 Tous les tests sont passés avec succès !')
    process.exit(0)
  } else {
    console.log('\n⚠️  Certains tests ont échoué. Vérifiez les logs ci-dessus.')
    process.exit(1)
  }
}

// Afficher l'aide
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🧪 Script de Test - Routes API Dossiers

USAGE:
  npm run test:dossiers-routes              # Local (nécessite serveur dev)
  npm run test:dossiers-routes:prod         # Production (nécessite token)

VARIABLES D'ENVIRONNEMENT:
  DOSSIER_ID               ID du dossier à tester (requis)
  TEST_ENV=production      Tester sur production
  QADHYA_SESSION_TOKEN     Token de session (requis pour production)

EXEMPLES:
  # Test local
  DOSSIER_ID=abc-123-def npm run test:dossiers-routes

  # Test production
  TEST_ENV=production DOSSIER_ID=abc-123-def QADHYA_SESSION_TOKEN=xxx npm run test:dossiers-routes

ROUTES TESTÉES:
  1. POST /api/dossiers/[id]/assistant     - Analyse dossier
  2. GET  /api/dossiers/[id]/assistant     - Historique conversations
  3. POST /api/dossiers/[id]/consultation  - Consultation IRAC
`)
  process.exit(0)
}

// Lancer les tests
main()
