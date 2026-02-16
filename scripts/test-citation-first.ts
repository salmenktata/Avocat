#!/usr/bin/env tsx
/**
 * Test du système Citation-First Enforcer
 * Valide la détection et correction automatique des réponses sans citation-first
 */

import {
  validateCitationFirst,
  enforceCitationFirst,
  type Source,
} from '../lib/ai/citation-first-enforcer'

console.log('🧪 Test: Citation-First Enforcer\n')

// Sources de test
const testSources: Source[] = [
  {
    label: '[Source-1]',
    content: 'الفصل 258 من المجلة الجزائية: الدفاع الشرعي يشترط وجود خطر حال ورد فعل متناسب.',
    title: 'Code Pénal Tunisien',
    category: 'codes',
  },
  {
    label: '[KB-2]',
    content: 'قرار تعقيبي عدد 12345 بتاريخ 2024/01/15: الدفاع الشرعي ينتفي إذا كان الخطر غير حال.',
    title: 'Jurisprudence Cassation',
    category: 'jurisprudence',
  },
]

// Tests cases
const testCases = [
  {
    name: '✅ Citation-First Correct',
    answer: `[Source-1] "الفصل 258 من المجلة الجزائية: الدفاع الشرعي يشترط وجود خطر حال"

بناءً على هذا الفصل، شروط الدفاع الشرعي هي:
1. خطر حال (danger actuel)
2. رد فعل متناسب`,
    expectedValid: true,
  },
  {
    name: '❌ Explication avant citation (citation_too_late)',
    answer: `شروط الدفاع الشرعي تتمثل في وجود خطر حال ورد فعل متناسب. هذا الشرط مهم جدا في القانون التونسي. [Source-1] الفصل 258`,
    expectedValid: false,
  },
  {
    name: '❌ Aucune citation (no_citations)',
    answer: `شروط الدفاع الشرعي هي وجود خطر حال ورد فعل متناسب. هذا حسب القانون التونسي.`,
    expectedValid: false,
  },
  {
    name: '❌ Citation sans extrait (missing_quote)',
    answer: `[Source-1] الفصل 258

شروط الدفاع الشرعي هي...`,
    expectedValid: false,
  },
  {
    name: '✅ Citation rapide (5 mots avant)',
    answer: `بناءً على المصدر، [Source-1] "الفصل 258 من المجلة الجزائية"

التفسير...`,
    expectedValid: true,
  },
]

// Exécuter tests
let passed = 0
let failed = 0

for (const testCase of testCases) {
  console.log(`\n📝 Test: ${testCase.name}`)
  console.log(`   Réponse: ${testCase.answer.substring(0, 80)}...`)

  const validation = validateCitationFirst(testCase.answer)

  console.log(`   Métriques:`)
  console.log(`     - Citations totales: ${validation.metrics.totalCitations}`)
  console.log(`     - Mots avant 1ère citation: ${validation.metrics.wordsBeforeFirstCitation}`)
  console.log(`     - % avant 1ère citation: ${validation.metrics.percentBeforeFirstCitation.toFixed(1)}%`)
  console.log(`     - A des extraits: ${validation.metrics.hasQuotes ? 'Oui' : 'Non'}`)

  if (validation.valid === testCase.expectedValid) {
    console.log(`   ✅ PASS (valid=${validation.valid})`)
    passed++
  } else {
    console.log(`   ❌ FAIL (attendu: ${testCase.expectedValid}, obtenu: ${validation.valid})`)
    if (validation.issue) {
      console.log(`      Issue détectée: ${validation.issue}`)
    }
    failed++
  }

  // Si invalide, tester l'enforcement
  if (!validation.valid) {
    console.log(`\n   🔧 Test enforcement automatique...`)
    const enforced = enforceCitationFirst(testCase.answer, testSources)
    const enforcedValidation = validateCitationFirst(enforced)

    console.log(`   Réponse corrigée: ${enforced.substring(0, 100)}...`)
    console.log(`   Validation après correction: ${enforcedValidation.valid ? '✅ VALID' : '❌ STILL INVALID'}`)

    if (enforcedValidation.valid) {
      console.log(`   ✅ Enforcement réussi!`)
    } else {
      console.log(`   ⚠️ Enforcement n'a pas complètement corrigé (issue: ${enforcedValidation.issue})`)
    }
  }
}

// Résumé
console.log(`\n\n📊 Résumé des tests:`)
console.log(`   ✅ Tests réussis: ${passed}/${testCases.length}`)
console.log(`   ❌ Tests échoués: ${failed}/${testCases.length}`)
console.log(`   📈 Taux de réussite: ${((passed / testCases.length) * 100).toFixed(1)}%`)

// Test métriques agrégées
console.log(`\n\n📈 Métriques Agrégées:`)
const allValidations = testCases.map(tc => validateCitationFirst(tc.answer))

const totalResponses = allValidations.length
const citationFirstCount = allValidations.filter(v => v.valid).length
const citationFirstRate = (citationFirstCount / totalResponses) * 100

const responsesWithCitations = allValidations.filter(v => v.metrics.totalCitations > 0)
const quotesCount = responsesWithCitations.filter(v => v.metrics.hasQuotes).length
const quoteRate = responsesWithCitations.length > 0
  ? (quotesCount / responsesWithCitations.length) * 100
  : 0

console.log(`   - Taux citation-first: ${citationFirstRate.toFixed(1)}% (objectif: >95%)`)
console.log(`   - Taux avec extraits: ${quoteRate.toFixed(1)}% (objectif: >90%)`)
console.log(`   - Réponses testées: ${totalResponses}`)

// Exit code
if (failed > 0) {
  console.log(`\n❌ Certains tests ont échoué!\n`)
  process.exit(1)
} else {
  console.log(`\n🎉 Tous les tests sont passés!\n`)
  process.exit(0)
}
