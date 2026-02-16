#!/usr/bin/env tsx
/**
 * Test du mapping 15 catégories → 5 doc_types
 * Valide que toutes les catégories sont correctement mappées
 */

import { ALL_LEGAL_CATEGORIES, type LegalCategory } from '../lib/categories/legal-categories'
import {
  ALL_DOC_TYPES,
  CATEGORY_TO_DOC_TYPE,
  getDocumentType,
  getCategoriesForDocType,
  isDocumentType,
  DOC_TYPE_TRANSLATIONS,
  type DocumentType,
} from '../lib/categories/doc-types'

console.log('🧪 Test: Mapping 15 catégories → 5 doc_types\n')

// Test 1: Toutes les catégories sont mappées
console.log('✅ Test 1: Couverture complète des catégories')
let allMapped = true
for (const category of ALL_LEGAL_CATEGORIES) {
  const docType = CATEGORY_TO_DOC_TYPE[category]
  if (!docType) {
    console.error(`❌ Catégorie "${category}" non mappée!`)
    allMapped = false
  } else {
    console.log(`   ${category.padEnd(20)} → ${docType}`)
  }
}

if (allMapped) {
  console.log('   ✅ Toutes les catégories sont mappées\n')
} else {
  console.error('   ❌ Certaines catégories manquent!\n')
  process.exit(1)
}

// Test 2: Fonction getDocumentType
console.log('✅ Test 2: Fonction getDocumentType()')
const testCases: Array<[LegalCategory, DocumentType]> = [
  ['codes', 'TEXTES'],
  ['jurisprudence', 'JURIS'],
  ['procedures', 'PROC'],
  ['modeles', 'TEMPLATES'],
  ['doctrine', 'DOCTRINE'],
]

let allTestsPassed = true
for (const [category, expectedDocType] of testCases) {
  const actualDocType = getDocumentType(category)
  if (actualDocType === expectedDocType) {
    console.log(`   ✅ ${category} → ${actualDocType}`)
  } else {
    console.error(`   ❌ ${category}: attendu ${expectedDocType}, obtenu ${actualDocType}`)
    allTestsPassed = false
  }
}

if (!allTestsPassed) {
  console.error('   ❌ Certains tests ont échoué!\n')
  process.exit(1)
}

console.log('')

// Test 3: Fonction getCategoriesForDocType
console.log('✅ Test 3: Fonction getCategoriesForDocType()')
for (const docType of ALL_DOC_TYPES) {
  const categories = getCategoriesForDocType(docType)
  console.log(`   ${docType.padEnd(12)} → ${categories.length} catégories: ${categories.join(', ')}`)
}
console.log('')

// Test 4: Type guard isDocumentType
console.log('✅ Test 4: Type guard isDocumentType()')
const validTypes = ['TEXTES', 'JURIS', 'PROC', 'TEMPLATES', 'DOCTRINE']
const invalidTypes = ['INVALID', 'textes', 'autre', '']

for (const type of validTypes) {
  if (isDocumentType(type)) {
    console.log(`   ✅ "${type}" est valide`)
  } else {
    console.error(`   ❌ "${type}" devrait être valide`)
    allTestsPassed = false
  }
}

for (const type of invalidTypes) {
  if (!isDocumentType(type)) {
    console.log(`   ✅ "${type}" est invalide (attendu)`)
  } else {
    console.error(`   ❌ "${type}" ne devrait pas être valide`)
    allTestsPassed = false
  }
}

if (!allTestsPassed) {
  console.error('\n❌ Certains tests ont échoué!\n')
  process.exit(1)
}

console.log('')

// Test 5: Traductions
console.log('✅ Test 5: Traductions disponibles')
for (const docType of ALL_DOC_TYPES) {
  const translations = DOC_TYPE_TRANSLATIONS[docType]
  console.log(`   ${docType.padEnd(12)} → FR: "${translations.fr}", AR: "${translations.ar}"`)
}

console.log('\n🎉 Tous les tests sont passés!\n')

// Statistiques
console.log('📊 Statistiques:')
console.log(`   - Nombre de catégories: ${ALL_LEGAL_CATEGORIES.length}`)
console.log(`   - Nombre de doc_types: ${ALL_DOC_TYPES.length}`)
console.log(`   - Ratio moyen: ${(ALL_LEGAL_CATEGORIES.length / ALL_DOC_TYPES.length).toFixed(1)} catégories/type`)

console.log('\n📋 Distribution:')
for (const docType of ALL_DOC_TYPES) {
  const categories = getCategoriesForDocType(docType)
  const percentage = ((categories.length / ALL_LEGAL_CATEGORIES.length) * 100).toFixed(1)
  console.log(`   ${docType.padEnd(12)}: ${categories.length.toString().padStart(2)} catégories (${percentage}%)`)
}
