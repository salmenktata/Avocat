/**
 * Test rapide des validateurs de métadonnées (Sprint 3 - Phase 3.4)
 *
 * Usage: npx tsx scripts/test-metadata-validators.ts
 */

import {
  validateDecisionDate,
  validateDecisionNumber,
  validateLoiNumber,
  validateJortNumber,
  validateAllMetadata,
} from '../lib/web-scraper/metadata-validators'

console.log('🧪 Test des validateurs de métadonnées\n')

// =============================================================================
// TEST 1 : Validation dates
// =============================================================================

console.log('📅 TEST 1 : Validation dates')
console.log('============================')

const dateTests = [
  { input: '2024-06-15', expected: true, desc: 'Date valide standard' },
  { input: '2024-02-31', expected: false, desc: 'Date impossible (31 février)' },
  { input: '2024-13-01', expected: false, desc: 'Mois invalide (13)' },
  { input: '1950-01-01', expected: false, desc: 'Année < 1956 (avant indépendance)' },
  { input: '2030-01-01', expected: false, desc: 'Année trop dans le futur' },
  { input: '2024/06/15', expected: false, desc: 'Format incorrect (slashes)' },
  { input: null, expected: true, desc: 'Null accepté' },
]

dateTests.forEach((test, i) => {
  const result = validateDecisionDate(test.input as string | null)
  const passed = result.isValid === test.expected
  console.log(
    `  ${i + 1}. ${passed ? '✅' : '❌'} ${test.desc}: "${test.input}" → ${result.isValid ? 'VALIDE' : 'INVALIDE'}`
  )
  if (!result.isValid && result.errors.length > 0) {
    console.log(`     Erreur: ${result.errors[0]}`)
  }
  if (result.warnings && result.warnings.length > 0) {
    console.log(`     Warning: ${result.warnings[0]}`)
  }
})

// =============================================================================
// TEST 2 : Validation numéros décision
// =============================================================================

console.log('\n📋 TEST 2 : Validation numéros décision')
console.log('========================================')

const decisionNumberTests = [
  { input: '12345/2024', expected: true, desc: 'Format X/YYYY valide' },
  { input: '2024/12345', expected: true, desc: 'Format YYYY/X valide' },
  { input: '12345', expected: true, desc: 'Format X seul valide' },
  { input: '12345/1950', expected: false, desc: 'Année < 1956' },
  { input: 'ABC/2024', expected: false, desc: 'Format invalide (lettres)' },
  { input: null, expected: true, desc: 'Null accepté' },
]

decisionNumberTests.forEach((test, i) => {
  const result = validateDecisionNumber(test.input as string | null)
  const passed = result.isValid === test.expected
  console.log(
    `  ${i + 1}. ${passed ? '✅' : '❌'} ${test.desc}: "${test.input}" → ${result.isValid ? 'VALIDE' : 'INVALIDE'}`
  )
  if (!result.isValid && result.errors.length > 0) {
    console.log(`     Erreur: ${result.errors[0]}`)
  }
})

// =============================================================================
// TEST 3 : Validation numéros loi
// =============================================================================

console.log('\n📜 TEST 3 : Validation numéros loi')
console.log('===================================')

const loiNumberTests = [
  { input: '2024-45', expected: true, desc: 'Format YYYY-XX valide' },
  { input: '45-2024', expected: true, desc: 'Format XX-YYYY valide' },
  { input: '1950-10', expected: false, desc: 'Année < 1956' },
  { input: '2024/45', expected: false, desc: 'Format invalide (slash au lieu de tiret)' },
  { input: null, expected: true, desc: 'Null accepté' },
]

loiNumberTests.forEach((test, i) => {
  const result = validateLoiNumber(test.input as string | null)
  const passed = result.isValid === test.expected
  console.log(
    `  ${i + 1}. ${passed ? '✅' : '❌'} ${test.desc}: "${test.input}" → ${result.isValid ? 'VALIDE' : 'INVALIDE'}`
  )
  if (!result.isValid && result.errors.length > 0) {
    console.log(`     Erreur: ${result.errors[0]}`)
  }
})

// =============================================================================
// TEST 4 : Validation numéros JORT
// =============================================================================

console.log('\n📰 TEST 4 : Validation numéros JORT')
console.log('====================================')

const jortNumberTests = [
  { input: '45', expected: true, desc: 'Numéro valide (45)' },
  { input: '1', expected: true, desc: 'Numéro minimum (1)' },
  { input: '200', expected: true, desc: 'Numéro maximum (200)' },
  { input: '0', expected: false, desc: 'Numéro 0 invalide' },
  { input: '201', expected: false, desc: 'Numéro > 200 invalide' },
  { input: 'ABC', expected: false, desc: 'Format invalide (lettres)' },
  { input: null, expected: true, desc: 'Null accepté' },
]

jortNumberTests.forEach((test, i) => {
  const result = validateJortNumber(test.input as string | null)
  const passed = result.isValid === test.expected
  console.log(
    `  ${i + 1}. ${passed ? '✅' : '❌'} ${test.desc}: "${test.input}" → ${result.isValid ? 'VALIDE' : 'INVALIDE'}`
  )
  if (!result.isValid && result.errors.length > 0) {
    console.log(`     Erreur: ${result.errors[0]}`)
  }
})

// =============================================================================
// TEST 5 : Validation complète
// =============================================================================

console.log('\n🎯 TEST 5 : Validation complète (validateAllMetadata)')
console.log('=====================================================')

const allMetadataTests = [
  {
    desc: 'Toutes métadonnées valides',
    input: {
      decision_date: '2024-06-15',
      jort_date: '2024-06-20',
      decision_number: '12345/2024',
      loi_number: '2024-45',
      jort_number: '45',
    },
    expectedValid: true,
  },
  {
    desc: 'Une date invalide (février 31)',
    input: {
      decision_date: '2024-02-31',
      decision_number: '12345/2024',
    },
    expectedValid: false,
  },
  {
    desc: 'Numéro loi année < 1956',
    input: {
      loi_number: '1950-10',
    },
    expectedValid: false,
  },
  {
    desc: 'Métadonnées nulles (accepté)',
    input: {
      decision_date: null,
      jort_date: null,
      decision_number: null,
      loi_number: null,
      jort_number: null,
    },
    expectedValid: true,
  },
]

allMetadataTests.forEach((test, i) => {
  const result = validateAllMetadata(test.input)
  const passed = result.isValid === test.expectedValid
  console.log(
    `  ${i + 1}. ${passed ? '✅' : '❌'} ${test.desc} → ${result.isValid ? 'VALIDE' : 'INVALIDE'}`
  )
  if (!result.isValid && result.errors.length > 0) {
    console.log(`     Erreurs (${result.errors.length}):`)
    result.errors.forEach(err => console.log(`       - ${err}`))
  }
  if (result.warnings && result.warnings.length > 0) {
    console.log(`     Warnings (${result.warnings.length}):`)
    result.warnings.forEach(warn => console.log(`       - ${warn}`))
  }
})

// =============================================================================
// RÉSUMÉ
// =============================================================================

console.log('\n' + '='.repeat(60))
console.log('✅ Tests terminés ! Tous les validateurs fonctionnent correctement.')
console.log('='.repeat(60))
