#!/usr/bin/env tsx

/**
 * Script de test pour vérifier les traductions des catégories de sources web
 * Usage: npm run test:categories
 */

import { CATEGORY_TRANSLATIONS, type WebSourceCategory } from '@/lib/web-scraper/types'
import { getCategoryLabel, getAllCategoryOptions } from '@/lib/web-scraper/category-labels'

console.log('🧪 Test des traductions des catégories de sources web\n')

// Test 1: Vérifier que toutes les catégories ont des traductions
console.log('📋 Test 1: Vérification de la complétude des traductions')
const categories: WebSourceCategory[] = [
  'legislation',
  'jurisprudence',
  'doctrine',
  'jort',
  'codes',
  'constitution',
  'conventions',
  'modeles',
  'procedures',
  'formulaires',
  'guides',
  'lexique',
  'google_drive',
  'autre',
]

let hasErrors = false

categories.forEach((cat) => {
  const frLabel = CATEGORY_TRANSLATIONS[cat]?.fr
  const arLabel = CATEGORY_TRANSLATIONS[cat]?.ar

  if (!frLabel || !arLabel) {
    console.error(`❌ Traduction manquante pour: ${cat}`)
    hasErrors = true
  } else {
    console.log(`✅ ${cat}: FR="${frLabel}" | AR="${arLabel}"`)
  }
})

console.log('')

// Test 2: Vérifier la fonction getCategoryLabel
console.log('📋 Test 2: Fonction getCategoryLabel()')
const testCategory: WebSourceCategory = 'legislation'
const frLabel = getCategoryLabel(testCategory, 'fr')
const arLabel = getCategoryLabel(testCategory, 'ar')

console.log(`Catégorie: ${testCategory}`)
console.log(`  FR: ${frLabel}`)
console.log(`  AR: ${arLabel}`)

if (frLabel === 'Textes législatifs' && arLabel === 'النصوص القانونية') {
  console.log('✅ getCategoryLabel() fonctionne correctement')
} else {
  console.error('❌ getCategoryLabel() retourne des valeurs incorrectes')
  hasErrors = true
}

console.log('')

// Test 3: Vérifier getAllCategoryOptions
console.log('📋 Test 3: Fonction getAllCategoryOptions()')
const optionsFr = getAllCategoryOptions('fr')
const optionsAr = getAllCategoryOptions('ar')

console.log(`Options FR: ${optionsFr.length} catégories`)
console.log(`Options AR: ${optionsAr.length} catégories`)

if (optionsFr.length === optionsAr.length) {
  console.log('✅ Même nombre de catégories pour FR et AR')
} else {
  console.error('❌ Nombre de catégories différent entre FR et AR')
  hasErrors = true
}

// Afficher les options
console.log('\n🇫🇷 Options Français:')
optionsFr.slice(0, 5).forEach((opt) => {
  console.log(`  - ${opt.value}: ${opt.label}`)
})
console.log('  ...')

console.log('\n🇸🇦 Options Arabe:')
optionsAr.slice(0, 5).forEach((opt) => {
  console.log(`  - ${opt.value}: ${opt.label}`)
})
console.log('  ...')

// Résultat final
console.log('\n' + '='.repeat(60))
if (hasErrors) {
  console.error('❌ Tests échoués - Veuillez corriger les erreurs ci-dessus')
  process.exit(1)
} else {
  console.log('✅ Tous les tests sont passés avec succès !')
  console.log('   Les traductions des catégories fonctionnent correctement.')
}
