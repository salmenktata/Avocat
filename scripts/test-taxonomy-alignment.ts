/**
 * Script de test : Alignement Catégories TS ↔ Taxonomie DB
 *
 * Vérifie :
 * 1. Chaque LegalCategory TS existe en DB comme type='category'
 * 2. Chaque domaine DB a un LegalDomain TS correspondant (avec mapping)
 * 3. Labels FR/AR identiques entre TS et DB
 * 4. Module pont fonctionne correctement
 *
 * Usage : npx tsx scripts/test-taxonomy-alignment.ts
 */

import {
  LEGAL_CATEGORY_TRANSLATIONS,
  LEGACY_DOMAIN_MAPPING,
  isValidLegalCategory,
  type LegalCategory,
} from '../lib/categories/legal-categories'

import {
  LEGAL_DOMAIN_TRANSLATIONS,
  type LegalDomain,
} from '../lib/web-scraper/types'

import {
  normalizeDomainFromDB,
  domainToDBCode,
  getUnifiedLabel,
  getArabicLabel,
  getFrenchLabel,
  isTSCategory,
  isTSDomain,
  getAllCategoriesWithLabels,
  getAllDomainsWithLabels,
} from '../lib/categories/taxonomy-bridge'

// ============================================================================
// Helpers
// ============================================================================

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`)
    passed++
  } else {
    console.error(`  ❌ ${message}`)
    failed++
  }
}

// ============================================================================
// Test 1 : Toutes les catégories TS sont définies
// ============================================================================

console.log('\n📋 Test 1 : Catégories TS complètes')
console.log('─'.repeat(50))

const expectedCategories: LegalCategory[] = [
  'legislation', 'jurisprudence', 'doctrine', 'jort', 'modeles',
  'procedures', 'formulaires', 'codes', 'constitution', 'conventions',
  'guides', 'lexique', 'actualites', 'google_drive', 'autre',
]

assert(
  Object.keys(LEGAL_CATEGORY_TRANSLATIONS).length === 15,
  `15 catégories dans LEGAL_CATEGORY_TRANSLATIONS (trouvé: ${Object.keys(LEGAL_CATEGORY_TRANSLATIONS).length})`
)

for (const cat of expectedCategories) {
  assert(
    cat in LEGAL_CATEGORY_TRANSLATIONS,
    `Catégorie '${cat}' existe dans LEGAL_CATEGORY_TRANSLATIONS`
  )
}

// ============================================================================
// Test 2 : Chaque catégorie a des traductions FR et AR
// ============================================================================

console.log('\n🌐 Test 2 : Traductions bilingues FR/AR des catégories')
console.log('─'.repeat(50))

for (const [code, trans] of Object.entries(LEGAL_CATEGORY_TRANSLATIONS)) {
  assert(
    typeof trans.fr === 'string' && trans.fr.length > 0,
    `Catégorie '${code}' a un label FR: "${trans.fr}"`
  )
  assert(
    typeof trans.ar === 'string' && trans.ar.length > 0,
    `Catégorie '${code}' a un label AR: "${trans.ar}"`
  )
}

// ============================================================================
// Test 3 : Domaines TS incluent les 3 nouveaux (societes, donnees_personnelles, energie)
// ============================================================================

console.log('\n🏛️ Test 3 : Domaines TS enrichis')
console.log('─'.repeat(50))

const requiredNewDomains: LegalDomain[] = ['societes', 'donnees_personnelles', 'energie']

for (const domain of requiredNewDomains) {
  assert(
    domain in LEGAL_DOMAIN_TRANSLATIONS,
    `Domaine '${domain}' existe dans LEGAL_DOMAIN_TRANSLATIONS`
  )
  if (domain in LEGAL_DOMAIN_TRANSLATIONS) {
    const trans = LEGAL_DOMAIN_TRANSLATIONS[domain]
    assert(
      typeof trans.fr === 'string' && trans.fr.length > 0,
      `  → FR: "${trans.fr}"`
    )
    assert(
      typeof trans.ar === 'string' && trans.ar.length > 0,
      `  → AR: "${trans.ar}"`
    )
  }
}

// ============================================================================
// Test 4 : Mapping legacy domaines (travail → social)
// ============================================================================

console.log('\n🔄 Test 4 : Mapping legacy domaines')
console.log('─'.repeat(50))

assert(
  LEGACY_DOMAIN_MAPPING['travail'] === 'social',
  `LEGACY_DOMAIN_MAPPING['travail'] → 'social'`
)

assert(
  LEGACY_DOMAIN_MAPPING['droit_travail'] === 'social',
  `LEGACY_DOMAIN_MAPPING['droit_travail'] → 'social'`
)

// ============================================================================
// Test 5 : Module pont taxonomy-bridge
// ============================================================================

console.log('\n🌉 Test 5 : Module pont (taxonomy-bridge.ts)')
console.log('─'.repeat(50))

// normalizeDomainFromDB
assert(
  normalizeDomainFromDB('travail') === 'social',
  `normalizeDomainFromDB('travail') → 'social'`
)
assert(
  normalizeDomainFromDB('civil') === 'civil',
  `normalizeDomainFromDB('civil') → 'civil' (pas de mapping)`
)
assert(
  normalizeDomainFromDB(null) === null,
  `normalizeDomainFromDB(null) → null`
)
assert(
  normalizeDomainFromDB('xyz_inconnu') === 'autre',
  `normalizeDomainFromDB('xyz_inconnu') → 'autre' (fallback)`
)

// domainToDBCode
assert(
  domainToDBCode('social') === 'travail',
  `domainToDBCode('social') → 'travail'`
)
assert(
  domainToDBCode('civil') === 'civil',
  `domainToDBCode('civil') → 'civil' (pas de mapping)`
)

// getUnifiedLabel - FR
assert(
  getUnifiedLabel('legislation', 'fr') === 'Législation',
  `getUnifiedLabel('legislation', 'fr') → 'Législation'`
)
assert(
  getUnifiedLabel('civil', 'fr') === 'Droit civil',
  `getUnifiedLabel('civil', 'fr') → 'Droit civil'`
)
assert(
  getUnifiedLabel('travail', 'fr') === 'Droit social/travail',
  `getUnifiedLabel('travail', 'fr') → 'Droit social/travail' (résolu via mapping)`
)

// getUnifiedLabel - AR
assert(
  getUnifiedLabel('legislation', 'ar') === 'التشريع',
  `getUnifiedLabel('legislation', 'ar') → 'التشريع'`
)
assert(
  getUnifiedLabel('civil', 'ar') === 'القانون المدني',
  `getUnifiedLabel('civil', 'ar') → 'القانون المدني'`
)
assert(
  getUnifiedLabel('travail', 'ar') === 'القانون الاجتماعي',
  `getUnifiedLabel('travail', 'ar') → 'القانون الاجتماعي' (résolu via mapping)`
)

// getArabicLabel raccourci
assert(
  getArabicLabel('jurisprudence') === 'فقه القضاء',
  `getArabicLabel('jurisprudence') → 'فقه القضاء'`
)
assert(
  getArabicLabel('societes') === 'قانون الشركات',
  `getArabicLabel('societes') → 'قانون الشركات'`
)

// getFrenchLabel raccourci
assert(
  getFrenchLabel('donnees_personnelles') === 'Protection des données personnelles',
  `getFrenchLabel('donnees_personnelles') → 'Protection des données personnelles'`
)

// isTSCategory / isTSDomain
assert(isTSCategory('legislation'), `isTSCategory('legislation') → true`)
assert(!isTSCategory('civil'), `isTSCategory('civil') → false (c'est un domaine)`)
assert(isTSDomain('civil'), `isTSDomain('civil') → true`)
assert(isTSDomain('travail'), `isTSDomain('travail') → true (mapping → social)`)
assert(!isTSDomain('xyz'), `isTSDomain('xyz') → false`)

// ============================================================================
// Test 6 : getAllCategoriesWithLabels / getAllDomainsWithLabels
// ============================================================================

console.log('\n📊 Test 6 : Listes complètes avec labels')
console.log('─'.repeat(50))

const allCats = getAllCategoriesWithLabels()
assert(allCats.length === 15, `getAllCategoriesWithLabels() retourne 15 catégories (trouvé: ${allCats.length})`)

for (const cat of allCats) {
  assert(
    cat.labelFr.length > 0 && cat.labelAr.length > 0,
    `  ${cat.code}: FR="${cat.labelFr}" / AR="${cat.labelAr}"`
  )
}

const allDomains = getAllDomainsWithLabels()
assert(
  allDomains.length >= 28,
  `getAllDomainsWithLabels() retourne ≥28 domaines (trouvé: ${allDomains.length})`
)

// Vérifier les 3 nouveaux domaines dans la liste
const newDomainCodes = allDomains.map(d => d.code)
assert(newDomainCodes.includes('societes'), `Liste domaines contient 'societes'`)
assert(newDomainCodes.includes('donnees_personnelles'), `Liste domaines contient 'donnees_personnelles'`)
assert(newDomainCodes.includes('energie'), `Liste domaines contient 'energie'`)

// ============================================================================
// Résumé
// ============================================================================

console.log('\n' + '═'.repeat(50))
console.log(`📋 Résultat : ${passed} passés, ${failed} échoués`)
console.log('═'.repeat(50))

if (failed > 0) {
  console.error(`\n⚠️  ${failed} test(s) échoué(s) !`)
  process.exit(1)
} else {
  console.log('\n🎉 Tous les tests sont passés !')
  process.exit(0)
}
