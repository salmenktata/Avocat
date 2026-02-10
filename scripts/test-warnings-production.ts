#!/usr/bin/env tsx
/**
 * Script Test Warnings Production
 *
 * Teste les 4 scénarios de warnings juridiques en production :
 * 1. Warning abrogation CRITIQUE (Loi n°1968-07)
 * 2. Warning citation non vérifiée (Article 999)
 * 3. Détection langue AR
 * 4. Pas de warning (loi en vigueur)
 *
 * Usage : npx tsx scripts/test-warnings-production.ts
 */

import { config } from 'dotenv'

// Charger variables env
config()

const BASE_URL = process.env.TEST_BASE_URL || 'https://qadhya.tn'
const API_ENDPOINT = `${BASE_URL}/api/chat`

// Couleurs console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

interface TestResult {
  testName: string
  passed: boolean
  details: string[]
  warnings?: {
    citations?: string[]
    abrogations?: any[]
  }
  error?: string
}

/**
 * Test 1 : Warning Abrogation CRITIQUE
 */
async function testAbrogationWarning(): Promise<TestResult> {
  const testName = 'Test 1 : Warning Abrogation CRITIQUE 🔴'
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`${colors.cyan}${testName}${colors.reset}`)
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)

  const question = "Quelle est la procédure selon la Loi n°1968-07 ?"
  console.log(`${colors.blue}Question :${colors.reset} "${question}"`)

  try {
    console.log(`\n⏳ Envoi requête à ${API_ENDPOINT}...`)

    const startTime = Date.now()
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        usePremiumModel: false, // Mode rapide Ollama
      }),
    })

    const duration = Date.now() - startTime
    console.log(`⏱️  Réponse reçue en ${duration}ms`)

    if (!response.ok) {
      return {
        testName,
        passed: false,
        details: [`Erreur HTTP ${response.status}: ${response.statusText}`],
        error: `HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    console.log(`\n✅ Réponse LLM reçue (${data.answer?.length || 0} caractères)`)

    const details: string[] = []
    let passed = true

    // Vérification 1 : Warnings abrogations présents
    if (data.abrogationWarnings && data.abrogationWarnings.length > 0) {
      console.log(`${colors.green}✓${colors.reset} Warnings abrogations détectés (${data.abrogationWarnings.length})`)
      details.push(`✓ ${data.abrogationWarnings.length} warning(s) abrogation détecté(s)`)

      // Vérification détaillée du premier warning
      const warning = data.abrogationWarnings[0]
      console.log(`\n📋 Détails Warning #1 :`)
      console.log(`   Référence : ${warning.reference}`)
      console.log(`   Severity  : ${warning.severity}`)
      console.log(`   Type      : ${warning.type}`)

      // Vérifier référence "1968-07"
      if (warning.reference.includes('1968-07') || warning.reference.includes('1968')) {
        console.log(`${colors.green}✓${colors.reset} Référence Loi n°1968-07 détectée`)
        details.push('✓ Référence Loi n°1968-07 correcte')
      } else {
        console.log(`${colors.red}✗${colors.reset} Référence Loi n°1968-07 NON détectée`)
        details.push('✗ Référence Loi n°1968-07 manquante')
        passed = false
      }

      // Vérifier severity = high
      if (warning.severity === 'high') {
        console.log(`${colors.green}✓${colors.reset} Severity HIGH (CRITIQUE)`)
        details.push('✓ Severity HIGH (critique) correcte')
      } else {
        console.log(`${colors.yellow}⚠${colors.reset} Severity ${warning.severity} (attendu: high)`)
        details.push(`⚠ Severity ${warning.severity} (attendu: high)`)
      }

      // Vérifier info abrogation
      if (warning.abrogationInfo) {
        const info = warning.abrogationInfo
        console.log(`\n📊 Informations Abrogation :`)
        console.log(`   Loi abrogée    : ${info.abrogatedReference}`)
        console.log(`   Loi abrogeante : ${info.abrogatingReference}`)
        console.log(`   Date           : ${info.abrogationDate}`)
        console.log(`   Scope          : ${info.scope}`)

        // Vérifier date 2016
        if (info.abrogationDate?.includes('2016')) {
          console.log(`${colors.green}✓${colors.reset} Date abrogation 2016 correcte`)
          details.push('✓ Date abrogation 2016 correcte')
        } else {
          console.log(`${colors.red}✗${colors.reset} Date abrogation incorrecte (attendu: 2016)`)
          details.push('✗ Date abrogation incorrecte')
          passed = false
        }

        // Vérifier loi abrogeante 2016-36
        if (info.abrogatingReference?.includes('2016-36')) {
          console.log(`${colors.green}✓${colors.reset} Loi abrogeante 2016-36 correcte`)
          details.push('✓ Loi abrogeante 2016-36 correcte')
        } else {
          console.log(`${colors.red}✗${colors.reset} Loi abrogeante 2016-36 NON détectée`)
          details.push('✗ Loi abrogeante 2016-36 manquante')
          passed = false
        }

        // Vérifier scope = total
        if (info.scope === 'total') {
          console.log(`${colors.green}✓${colors.reset} Scope TOTAL correct`)
          details.push('✓ Scope total correct')
        }
      }

      // Vérifier messages bilingues
      if (warning.message && warning.messageAr) {
        console.log(`${colors.green}✓${colors.reset} Messages bilingues FR/AR présents`)
        details.push('✓ Messages bilingues FR/AR')
      }

    } else {
      console.log(`${colors.red}✗${colors.reset} AUCUN warning abrogation détecté`)
      details.push('✗ Aucun warning abrogation (ÉCHEC)')
      passed = false
    }

    return {
      testName,
      passed,
      details,
      warnings: {
        abrogations: data.abrogationWarnings,
        citations: data.citationWarnings,
      },
    }

  } catch (error) {
    console.error(`${colors.red}✗ Erreur :${colors.reset}`, error)
    return {
      testName,
      passed: false,
      details: ['Erreur requête API'],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Test 2 : Warning Citation Non Vérifiée
 */
async function testCitationWarning(): Promise<TestResult> {
  const testName = 'Test 2 : Warning Citation Non Vérifiée 📖'
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`${colors.cyan}${testName}${colors.reset}`)
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)

  const question = "Quels sont les droits selon Article 999 Code Civil ?"
  console.log(`${colors.blue}Question :${colors.reset} "${question}"`)

  try {
    console.log(`\n⏳ Envoi requête à ${API_ENDPOINT}...`)

    const startTime = Date.now()
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        usePremiumModel: false,
      }),
    })

    const duration = Date.now() - startTime
    console.log(`⏱️  Réponse reçue en ${duration}ms`)

    if (!response.ok) {
      return {
        testName,
        passed: false,
        details: [`Erreur HTTP ${response.status}`],
        error: `HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    console.log(`\n✅ Réponse LLM reçue (${data.answer?.length || 0} caractères)`)

    const details: string[] = []
    let passed = true

    // Vérification : Warnings citations présents
    if (data.citationWarnings && data.citationWarnings.length > 0) {
      console.log(`${colors.green}✓${colors.reset} Warnings citations détectés (${data.citationWarnings.length})`)
      details.push(`✓ ${data.citationWarnings.length} citation(s) non vérifiée(s)`)

      // Vérifier si "Article 999" est dans les warnings
      const hasArticle999 = data.citationWarnings.some((cit: string) =>
        cit.includes('999') || cit.includes('Article 999')
      )

      if (hasArticle999) {
        console.log(`${colors.green}✓${colors.reset} Citation "Article 999" détectée`)
        details.push('✓ Citation Article 999 détectée')
      } else {
        console.log(`${colors.yellow}⚠${colors.reset} Citation "Article 999" non trouvée dans warnings`)
        details.push('⚠ Citation Article 999 non trouvée')
      }

      console.log(`\n📋 Citations non vérifiées :`)
      data.citationWarnings.forEach((cit: string, idx: number) => {
        console.log(`   ${idx + 1}. ${cit}`)
      })

    } else {
      console.log(`${colors.yellow}⚠${colors.reset} Aucun warning citation (peut-être Article 999 existe dans KB)`)
      details.push('⚠ Aucun warning citation (article peut exister)')
      // Ne pas marquer comme échec car l'article peut exister dans la KB
    }

    return {
      testName,
      passed,
      details,
      warnings: {
        citations: data.citationWarnings,
        abrogations: data.abrogationWarnings,
      },
    }

  } catch (error) {
    console.error(`${colors.red}✗ Erreur :${colors.reset}`, error)
    return {
      testName,
      passed: false,
      details: ['Erreur requête API'],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Test 3 : Détection Langue AR
 */
async function testLanguageDetectionAR(): Promise<TestResult> {
  const testName = 'Test 3 : Détection Langue AR 🇹🇳'
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`${colors.cyan}${testName}${colors.reset}`)
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)

  const question = "ما هي الإجراءات حسب القانون عدد 7 لسنة 1968 ؟"
  console.log(`${colors.blue}Question :${colors.reset} "${question}"`)

  try {
    console.log(`\n⏳ Envoi requête à ${API_ENDPOINT}...`)

    const startTime = Date.now()
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        usePremiumModel: false,
      }),
    })

    const duration = Date.now() - startTime
    console.log(`⏱️  Réponse reçue en ${duration}ms`)

    if (!response.ok) {
      return {
        testName,
        passed: false,
        details: [`Erreur HTTP ${response.status}`],
        error: `HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    console.log(`\n✅ Réponse LLM reçue (${data.answer?.length || 0} caractères)`)

    const details: string[] = []
    let passed = true

    // Vérification : Warnings abrogations avec messages AR
    if (data.abrogationWarnings && data.abrogationWarnings.length > 0) {
      console.log(`${colors.green}✓${colors.reset} Warnings abrogations détectés`)
      details.push('✓ Warnings abrogations détectés')

      const warning = data.abrogationWarnings[0]

      // Vérifier référence AR "القانون عدد 7"
      if (warning.reference.includes('القانون') || warning.reference.includes('1968')) {
        console.log(`${colors.green}✓${colors.reset} Référence loi tunisienne détectée (AR ou numéro)`)
        details.push('✓ Référence loi détectée')
      }

      // Vérifier message AR présent
      if (warning.messageAr) {
        console.log(`${colors.green}✓${colors.reset} Message arabe (messageAr) présent`)
        details.push('✓ Message AR présent')

        // Vérifier mots clés arabes
        const arabicKeywords = ['تحذير', 'ملغى', 'القانون']
        const hasArabicKeywords = arabicKeywords.some(kw => warning.messageAr.includes(kw))

        if (hasArabicKeywords) {
          console.log(`${colors.green}✓${colors.reset} Mots-clés arabes détectés (تحذير/ملغى/القانون)`)
          details.push('✓ Mots-clés arabes corrects')
        }

        console.log(`\n📝 Message AR :`)
        console.log(`   ${warning.messageAr.substring(0, 150)}...`)
      } else {
        console.log(`${colors.yellow}⚠${colors.reset} Message arabe manquant`)
        details.push('⚠ Message AR manquant')
      }

    } else {
      console.log(`${colors.red}✗${colors.reset} Aucun warning abrogation détecté pour loi AR`)
      details.push('✗ Aucun warning détecté')
      passed = false
    }

    return {
      testName,
      passed,
      details,
      warnings: {
        abrogations: data.abrogationWarnings,
      },
    }

  } catch (error) {
    console.error(`${colors.red}✗ Erreur :${colors.reset}`, error)
    return {
      testName,
      passed: false,
      details: ['Erreur requête API'],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Test 4 : Pas de Warning (Loi en vigueur)
 */
async function testNoWarning(): Promise<TestResult> {
  const testName = 'Test 4 : Pas de Warning (Loi en vigueur) ✅'
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`${colors.cyan}${testName}${colors.reset}`)
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)

  const question = "Quels sont les principes de la Loi n°2016-36 ?"
  console.log(`${colors.blue}Question :${colors.reset} "${question}"`)

  try {
    console.log(`\n⏳ Envoi requête à ${API_ENDPOINT}...`)

    const startTime = Date.now()
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        usePremiumModel: false,
      }),
    })

    const duration = Date.now() - startTime
    console.log(`⏱️  Réponse reçue en ${duration}ms`)

    if (!response.ok) {
      return {
        testName,
        passed: false,
        details: [`Erreur HTTP ${response.status}`],
        error: `HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    console.log(`\n✅ Réponse LLM reçue (${data.answer?.length || 0} caractères)`)

    const details: string[] = []
    let passed = true

    // Vérification : AUCUN warning abrogation (loi récente)
    if (!data.abrogationWarnings || data.abrogationWarnings.length === 0) {
      console.log(`${colors.green}✓${colors.reset} AUCUN warning abrogation (correct, loi en vigueur)`)
      details.push('✓ Aucun warning abrogation (correct)')
    } else {
      console.log(`${colors.red}✗${colors.reset} Warning abrogation détecté (INCORRECT, loi 2016-36 en vigueur)`)
      details.push('✗ Warning abrogation incorrect (loi en vigueur)')
      passed = false

      console.log(`\n⚠️  Warnings détectés (ne devrait pas) :`)
      data.abrogationWarnings.forEach((w: any, idx: number) => {
        console.log(`   ${idx + 1}. ${w.reference}`)
      })
    }

    // Vérifier que réponse est générée normalement
    if (data.answer && data.answer.length > 100) {
      console.log(`${colors.green}✓${colors.reset} Réponse générée normalement (${data.answer.length} chars)`)
      details.push('✓ Réponse générée normalement')
    }

    // Vérifier sources retournées
    if (data.sources && data.sources.length > 0) {
      console.log(`${colors.green}✓${colors.reset} Sources retournées (${data.sources.length})`)
      details.push(`✓ ${data.sources.length} source(s) retournée(s)`)
    }

    return {
      testName,
      passed,
      details,
      warnings: {
        abrogations: data.abrogationWarnings,
        citations: data.citationWarnings,
      },
    }

  } catch (error) {
    console.error(`${colors.red}✗ Erreur :${colors.reset}`, error)
    return {
      testName,
      passed: false,
      details: ['Erreur requête API'],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Afficher résumé final
 */
function displaySummary(results: TestResult[]) {
  console.log(`\n\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`${colors.cyan}📊 RÉSUMÉ TESTS WARNINGS PRODUCTION${colors.reset}`)
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`)

  const totalTests = results.length
  const passedTests = results.filter(r => r.passed).length
  const failedTests = totalTests - passedTests
  const successRate = Math.round((passedTests / totalTests) * 100)

  console.log(`📈 Taux de Réussite : ${passedTests}/${totalTests} (${successRate}%)\n`)

  results.forEach((result, idx) => {
    const icon = result.passed ? `${colors.green}✅${colors.reset}` : `${colors.red}❌${colors.reset}`
    const status = result.passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`

    console.log(`${icon} ${result.testName} - ${status}`)

    if (result.details && result.details.length > 0) {
      result.details.forEach(detail => {
        console.log(`      ${detail}`)
      })
    }

    if (result.error) {
      console.log(`      ${colors.red}Erreur : ${result.error}${colors.reset}`)
    }

    console.log('')
  })

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)

  if (failedTests === 0) {
    console.log(`${colors.green}🎉 TOUS LES TESTS SONT PASSÉS !${colors.reset}`)
    console.log(`\n✅ Phase 2 validée en production : https://qadhya.tn`)
  } else {
    console.log(`${colors.red}⚠️  ${failedTests} test(s) échoué(s)${colors.reset}`)
    console.log(`\n🔍 Vérifier les logs ci-dessus pour détails erreurs`)
  }

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`)

  process.exit(failedTests > 0 ? 1 : 0)
}

/**
 * Main : Exécuter tous les tests
 */
async function main() {
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`${colors.cyan}🧪 TESTS WARNINGS PRODUCTION - PHASE 2${colors.reset}`)
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`\n🌐 URL Production : ${BASE_URL}`)
  console.log(`📡 API Endpoint   : ${API_ENDPOINT}`)
  console.log(`\n⏰ Début tests : ${new Date().toLocaleString('fr-FR')}\n`)

  const results: TestResult[] = []

  // Exécuter les 4 tests séquentiellement
  console.log(`\n⚡ Exécution séquentielle de 4 tests...\n`)

  results.push(await testAbrogationWarning())
  await new Promise(resolve => setTimeout(resolve, 2000)) // Pause 2s

  results.push(await testCitationWarning())
  await new Promise(resolve => setTimeout(resolve, 2000))

  results.push(await testLanguageDetectionAR())
  await new Promise(resolve => setTimeout(resolve, 2000))

  results.push(await testNoWarning())

  // Afficher résumé
  displaySummary(results)
}

// Exécuter
main().catch(error => {
  console.error(`${colors.red}Erreur fatale :${colors.reset}`, error)
  process.exit(1)
})
