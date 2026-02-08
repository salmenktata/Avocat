#!/usr/bin/env tsx
/**
 * Test de structure des prompts juridiques IRAC
 *
 * Vérifie que les prompts contiennent les éléments requis sans appeler les LLMs
 */

import {
  getSystemPromptForContext,
  CONSULTATION_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  STRUCTURATION_SYSTEM_PROMPT,
  PROMPT_CONFIG,
  type PromptContextType,
  type SupportedLanguage,
} from '@/lib/ai/legal-reasoning-prompts'

// =============================================================================
// CRITÈRES DE VALIDATION IRAC
// =============================================================================

interface ValidationCriteria {
  name: string
  check: (prompt: string) => boolean
  description: string
}

const IRAC_CRITERIA: ValidationCriteria[] = [
  {
    name: 'Structure IRAC mentionnée',
    check: (p) => p.includes('IRAC') || p.includes('Issue') && p.includes('Rule') && p.includes('Application'),
    description: 'Le prompt doit mentionner la méthode IRAC',
  },
  {
    name: 'Faits et problématique',
    check: (p) => p.toLowerCase().includes('fait') && (p.toLowerCase().includes('problématique') || p.toLowerCase().includes('question')),
    description: 'Section pour exposer les faits et identifier la problématique',
  },
  {
    name: 'Règles de droit',
    check: (p) => p.toLowerCase().includes('règle') || p.toLowerCase().includes('loi') || p.toLowerCase().includes('article'),
    description: 'Section pour les règles de droit applicables',
  },
  {
    name: 'Analyse et raisonnement',
    check: (p) => p.toLowerCase().includes('analyse') || p.toLowerCase().includes('raisonnement') || p.toLowerCase().includes('syllogisme'),
    description: 'Section pour l\'analyse juridique',
  },
  {
    name: 'Conclusion',
    check: (p) => p.toLowerCase().includes('conclusion') || p.toLowerCase().includes('recommandation'),
    description: 'Section pour la conclusion et recommandations',
  },
]

const LEGAL_CRITERIA: ValidationCriteria[] = [
  {
    name: 'Ton professionnel avocat',
    check: (p) => p.toLowerCase().includes('avocat') && (p.includes('chevronné') || p.includes('expérience')),
    description: 'Le prompt doit demander un ton d\'avocat expérimenté',
  },
  {
    name: 'Citations obligatoires',
    check: (p) => p.toLowerCase().includes('cit') && (p.toLowerCase().includes('source') || p.includes('[') || p.includes('référence')),
    description: 'Le prompt doit exiger des citations des sources',
  },
  {
    name: 'Droit tunisien',
    check: (p) => p.toLowerCase().includes('tunisien'),
    description: 'Le prompt doit mentionner le droit tunisien',
  },
  {
    name: 'Bilinguisme AR/FR',
    check: (p) => (p.includes('arabe') || p.includes('ar')) && (p.includes('français') || p.includes('fr')),
    description: 'Le prompt doit supporter le bilinguisme',
  },
  {
    name: 'Prudence juridique',
    check: (p) => p.toLowerCase().includes('prudent') || p.includes('il semble') || p.includes('en principe'),
    description: 'Le prompt doit encourager la prudence dans les affirmations',
  },
  {
    name: 'Anti-hallucination',
    check: (p) => p.toLowerCase().includes('jamais inventer') || p.toLowerCase().includes('ne pas inventer'),
    description: 'Le prompt doit interdire l\'invention de sources',
  },
]

// =============================================================================
// FONCTION DE VALIDATION
// =============================================================================

function validatePrompt(
  prompt: string,
  promptName: string,
  criteria: ValidationCriteria[]
): { passed: number; failed: number; details: string[] } {
  const details: string[] = []
  let passed = 0
  let failed = 0

  console.log(`\n📋 Validation: ${promptName}`)
  console.log('='.repeat(80))

  for (const criterion of criteria) {
    const result = criterion.check(prompt)
    if (result) {
      passed++
      console.log(`  ✅ ${criterion.name}`)
    } else {
      failed++
      console.log(`  ❌ ${criterion.name}`)
      details.push(`❌ ${criterion.name}: ${criterion.description}`)
    }
  }

  console.log(`\nRésultat: ${passed}/${criteria.length} critères validés (${Math.round((passed / criteria.length) * 100)}%)`)

  return { passed, failed, details }
}

// =============================================================================
// TESTS
// =============================================================================

async function runTests() {
  console.log('\n' + '='.repeat(80))
  console.log('TEST DE STRUCTURE DES PROMPTS JURIDIQUES IRAC')
  console.log('='.repeat(80))

  let totalPassed = 0
  let totalFailed = 0
  const allDetails: string[] = []

  // Test 1: Prompt CONSULTATION
  console.log('\n\n🔍 TEST 1/6: CONSULTATION_SYSTEM_PROMPT')
  const result1 = validatePrompt(CONSULTATION_SYSTEM_PROMPT, 'Consultation (français)', [
    ...IRAC_CRITERIA,
    ...LEGAL_CRITERIA,
  ])
  totalPassed += result1.passed
  totalFailed += result1.failed
  allDetails.push(...result1.details)

  // Test 2: Prompt CHAT
  console.log('\n\n🔍 TEST 2/6: CHAT_SYSTEM_PROMPT')
  const result2 = validatePrompt(CHAT_SYSTEM_PROMPT, 'Chat conversationnel (français)', [
    ...IRAC_CRITERIA,
    ...LEGAL_CRITERIA,
  ])
  totalPassed += result2.passed
  totalFailed += result2.failed
  allDetails.push(...result2.details)

  // Test 3: Prompt STRUCTURATION
  console.log('\n\n🔍 TEST 3/6: STRUCTURATION_SYSTEM_PROMPT')
  const result3 = validatePrompt(STRUCTURATION_SYSTEM_PROMPT, 'Structuration de dossier', [
    {
      name: 'Extraction structurée',
      check: (p) => p.toLowerCase().includes('extrait') || p.toLowerCase().includes('structur'),
      description: 'Le prompt doit demander une extraction structurée',
    },
    {
      name: 'Format JSON',
      check: (p) => p.toLowerCase().includes('json'),
      description: 'Le prompt doit spécifier un format JSON',
    },
    {
      name: 'Éléments juridiques',
      check: (p) => p.toLowerCase().includes('fait') && p.toLowerCase().includes('partie'),
      description: 'Le prompt doit identifier les éléments juridiques clés',
    },
  ])
  totalPassed += result3.passed
  totalFailed += result3.failed
  allDetails.push(...result3.details)

  // Test 4: Fonction getSystemPromptForContext - français
  console.log('\n\n🔍 TEST 4/6: getSystemPromptForContext(\'consultation\', \'fr\')')
  const consultationFr = getSystemPromptForContext('consultation', 'fr')
  const result4 = validatePrompt(consultationFr, 'Consultation FR via fonction', IRAC_CRITERIA)
  totalPassed += result4.passed
  totalFailed += result4.failed

  // Test 5: Fonction getSystemPromptForContext - arabe
  console.log('\n\n🔍 TEST 5/6: getSystemPromptForContext(\'chat\', \'ar\')')
  const chatAr = getSystemPromptForContext('chat', 'ar')
  if (chatAr.includes('arabe') || chatAr.includes('UNIQUEMENT en arabe')) {
    console.log('  ✅ Instruction langue arabe présente')
    totalPassed++
  } else {
    console.log('  ❌ Instruction langue arabe absente')
    allDetails.push('❌ Langue arabe: L\'instruction de répondre en arabe est manquante')
    totalFailed++
  }

  // Test 6: Configuration PROMPT_CONFIG
  console.log('\n\n🔍 TEST 6/6: PROMPT_CONFIG')
  const configs: PromptContextType[] = ['consultation', 'chat', 'structuration']
  let configPassed = 0
  let configFailed = 0

  for (const context of configs) {
    const config = PROMPT_CONFIG[context]
    if (config && typeof config.temperature === 'number' && typeof config.maxTokens === 'number') {
      console.log(`  ✅ ${context}: temperature=${config.temperature}, maxTokens=${config.maxTokens}`)
      configPassed++
    } else {
      console.log(`  ❌ ${context}: Configuration invalide ou manquante`)
      configFailed++
    }
  }

  totalPassed += configPassed
  totalFailed += configFailed

  // Validation cohérence temperature
  if (PROMPT_CONFIG.consultation.temperature < PROMPT_CONFIG.chat.temperature) {
    console.log('  ✅ Temperature consultation < chat (plus précis)')
    totalPassed++
  } else {
    console.log('  ❌ Temperature consultation devrait être < chat')
    allDetails.push('❌ Temperature: consultation devrait être plus basse que chat pour plus de précision')
    totalFailed++
  }

  // Résumé final
  console.log('\n\n' + '='.repeat(80))
  console.log('RÉSUMÉ GLOBAL')
  console.log('='.repeat(80))
  console.log(`Total critères validés: ${totalPassed}`)
  console.log(`Total critères échoués: ${totalFailed}`)
  console.log(`Taux de réussite: ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%`)

  if (allDetails.length > 0) {
    console.log('\n⚠️  Points d\'amélioration:')
    allDetails.forEach((detail) => console.log(`   ${detail}`))
  }

  console.log('\n' + '='.repeat(80))

  if (totalFailed === 0) {
    console.log('✅ TOUS LES TESTS RÉUSSIS - Les prompts IRAC sont correctement structurés')
    process.exit(0)
  } else {
    console.log(`⚠️  ${totalFailed} critères non validés - Voir détails ci-dessus`)
    process.exit(1)
  }
}

// =============================================================================
// POINT D'ENTRÉE
// =============================================================================

if (require.main === module) {
  runTests().catch((error) => {
    console.error('Erreur fatale:', error)
    process.exit(1)
  })
}

export { runTests }
