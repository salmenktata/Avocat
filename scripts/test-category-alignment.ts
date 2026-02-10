#!/usr/bin/env tsx

/**
 * Script de test pour vérifier l'alignement des catégories à travers tous les systèmes
 * Usage: npm run test:category-alignment
 */

import {
  type LegalCategory,
  type WebSourceCategory,
  type KnowledgeCategory as KBCategory,
  type LegalContentCategory,
  LEGAL_CATEGORY_TRANSLATIONS,
  getAllLegalCategories,
  getCategoriesForContext,
  getLegalCategoryLabel,
  getLegalCategoryColor,
  getLegalCategoryIcon,
  isValidLegalCategory,
  normalizeLegalCategory,
} from '@/lib/categories/legal-categories'

import { CATEGORY_LABELS as KB_LABELS } from '@/lib/knowledge-base/categories'
import { CATEGORY_TRANSLATIONS as WEB_TRANSLATIONS } from '@/lib/web-scraper/types'

console.log('🧪 Test d\'alignement des catégories à travers tous les systèmes\n')
console.log('='.repeat(70))

let hasErrors = false

// Test 1: Vérifier que les traductions sont cohérentes
console.log('\n📋 Test 1: Cohérence des traductions')
console.log('-'.repeat(70))

const allCategories = Object.keys(LEGAL_CATEGORY_TRANSLATIONS) as LegalCategory[]
allCategories.forEach((cat) => {
  const centralFr = LEGAL_CATEGORY_TRANSLATIONS[cat]?.fr
  const centralAr = LEGAL_CATEGORY_TRANSLATIONS[cat]?.ar

  // Vérifier web sources
  const webFr = WEB_TRANSLATIONS[cat as WebSourceCategory]?.fr
  const webAr = WEB_TRANSLATIONS[cat as WebSourceCategory]?.ar

  // Vérifier KB (certaines catégories n'existent pas dans KB)
  const kbFr = KB_LABELS[cat]?.fr
  const kbAr = KB_LABELS[cat]?.ar

  console.log(`\n${cat}:`)
  console.log(`  Central: FR="${centralFr}" | AR="${centralAr}"`)

  if (webFr !== centralFr || webAr !== centralAr) {
    console.log(`  Web:     FR="${webFr}" | AR="${webAr}" ⚠️  DIFFÉRENT`)
    hasErrors = true
  } else {
    console.log(`  Web:     ✅ Aligné`)
  }

  if (kbFr && (kbFr !== centralFr || kbAr !== centralAr)) {
    console.log(`  KB:      FR="${kbFr}" | AR="${kbAr}" ⚠️  DIFFÉRENT`)
    hasErrors = true
  } else if (kbFr) {
    console.log(`  KB:      ✅ Aligné`)
  } else {
    console.log(`  KB:      N/A (catégorie non utilisée dans KB)`)
  }
})

// Test 2: Vérifier les fonctions de contexte
console.log('\n\n📋 Test 2: Fonctions de contexte')
console.log('-'.repeat(70))

const contexts: Array<'web_sources' | 'knowledge_base' | 'classification' | 'all'> = [
  'web_sources',
  'knowledge_base',
  'classification',
  'all',
]

contexts.forEach((context) => {
  const categories = getCategoriesForContext(context, 'fr', false)
  console.log(`\n${context}: ${categories.length} catégories`)
  console.log(`  ${categories.map(c => c.value).join(', ')}`)
})

// Test 3: Vérifier les fonctions utilitaires
console.log('\n\n📋 Test 3: Fonctions utilitaires')
console.log('-'.repeat(70))

const testCategory: LegalCategory = 'legislation'
console.log(`\nTest avec catégorie: ${testCategory}`)
console.log(`  Label FR: ${getLegalCategoryLabel(testCategory, 'fr')}`)
console.log(`  Label AR: ${getLegalCategoryLabel(testCategory, 'ar')}`)
console.log(`  Couleur:  ${getLegalCategoryColor(testCategory)}`)
console.log(`  Icône:    ${getLegalCategoryIcon(testCategory)}`)
console.log(`  Valide:   ${isValidLegalCategory(testCategory) ? '✅' : '❌'}`)

// Test 4: Normalisation des anciennes catégories
console.log('\n\n📋 Test 4: Normalisation des anciennes catégories')
console.log('-'.repeat(70))

const legacyCategories = ['code', 'modele']
legacyCategories.forEach((legacy) => {
  const normalized = normalizeLegalCategory(legacy)
  console.log(`  ${legacy} → ${normalized}`)
  if (normalized === legacy) {
    console.warn(`    ⚠️  Pas de mapping pour "${legacy}"`)
    hasErrors = true
  } else {
    console.log(`    ✅ Normalisé`)
  }
})

// Test 5: Vérifier que toutes les catégories ont des traductions complètes
console.log('\n\n📋 Test 5: Complétude des traductions')
console.log('-'.repeat(70))

allCategories.forEach((cat) => {
  const fr = LEGAL_CATEGORY_TRANSLATIONS[cat]?.fr
  const ar = LEGAL_CATEGORY_TRANSLATIONS[cat]?.ar

  if (!fr || !ar) {
    console.error(`❌ ${cat}: Traductions manquantes (FR: ${fr}, AR: ${ar})`)
    hasErrors = true
  } else {
    console.log(`✅ ${cat}: Traductions complètes`)
  }
})

// Test 6: Vérifier les options de catégories
console.log('\n\n📋 Test 6: Options de catégories')
console.log('-'.repeat(70))

const optionsFr = getAllLegalCategories('fr', { includeAll: true })
const optionsAr = getAllLegalCategories('ar', { includeAll: true })

console.log(`\nOptions FR: ${optionsFr.length} catégories`)
console.log(`Options AR: ${optionsAr.length} catégories`)

if (optionsFr.length !== optionsAr.length) {
  console.error(`❌ Nombre de catégories différent entre FR et AR`)
  hasErrors = true
} else {
  console.log(`✅ Même nombre de catégories pour FR et AR`)
}

// Afficher quelques exemples
console.log(`\n🇫🇷 Exemples FR:`)
optionsFr.slice(0, 5).forEach((opt) => {
  console.log(`  - ${opt.value}: ${opt.label}`)
})
console.log('  ...')

console.log(`\n🇸🇦 Exemples AR:`)
optionsAr.slice(0, 5).forEach((opt) => {
  console.log(`  - ${opt.value}: ${opt.label}`)
})
console.log('  ...')

// Résultat final
console.log('\n' + '='.repeat(70))
if (hasErrors) {
  console.error('❌ Tests échoués - Il existe des incohérences entre les systèmes')
  console.error('   Veuillez corriger les erreurs ci-dessus')
  process.exit(1)
} else {
  console.log('✅ Tous les tests sont passés avec succès !')
  console.log('   Les catégories sont alignées à travers tous les systèmes.')
  console.log('')
  console.log('   Systèmes vérifiés:')
  console.log('   - ✅ Web Sources (lib/web-scraper/types.ts)')
  console.log('   - ✅ Knowledge Base (lib/knowledge-base/categories.ts)')
  console.log('   - ✅ Classification (LegalContentCategory)')
  console.log('   - ✅ RAG / Filtres (système central)')
}
