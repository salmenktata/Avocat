#!/usr/bin/env tsx
/**
 * Tests Phase 3 : Chunking Article-Level
 *
 * Valide le chunking par article pour codes juridiques FR et AR
 */

import { chunkTextByArticles, chunkText } from '../lib/ai/chunking-service'

console.log('🧪 Tests Phase 3 : Chunking Article-Level\n')

// =============================================================================
// DONNÉES DE TEST
// =============================================================================

const CODE_PENAL_FR = `
Code pénal

Article 1
Nul ne peut être puni qu'en vertu d'une disposition légale antérieure au fait.

Article 2
La peine privative de liberté ne peut être prononcée que lorsqu'elle est expressément prévue.

Article 258
Quiconque, volontairement, fait des blessures ou porte des coups à autrui, est puni d'un emprisonnement d'un an et d'une amende de mille dinars.

Article 259
Si les violences mentionnées à l'article précédent ont occasionné une maladie ou une incapacité totale de travail personnel pendant plus de vingt jours, la peine est de cinq ans d'emprisonnement et de dix mille dinars d'amende.
`

const MAJALLA_JAZAIYA_AR = `
المجلة الجزائية

الفصل 1
لا يؤاخذ أحد إلا بمقتضى قانون منطبق على الواقعة المؤاخذ من أجلها.

الفصل 2
لا تطبق العقوبة السالبة للحرية إلا في الصور المبينة بالقانون.

الفصل 258
من أحدث عمدا بغيره جرحا أو ضربا يعاقب بالسجن مدة عام وبخطية قدرها ألف دينار.

الفصل 259
إذا أدت الضربات المذكورة بالفصل السابق إلى مرض أو عجز تام عن العمل الشخصي لمدة تتجاوز عشرين يوما فتكون العقوبة السجن مدة خمسة أعوام وخطية قدرها عشرة آلاف دينار.

الفصل 259 مكرر
إذا كانت الضربات بواسطة آلة حادة فإن العقوبة تضاعف.
`

const MIXED_DOCUMENT = `
Ce document mélange du texte normal avec des articles.

Article 42
Premier article du document.

Paragraphe normal sans numéro d'article.

Article 43 bis
Deuxième article avec bis.

Conclusion du document.
`

// =============================================================================
// TESTS
// =============================================================================

interface TestResult {
  name: string
  success: boolean
  expected: any
  actual: any
  error?: string
}

const results: TestResult[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    results.push({ name, success: true, expected: null, actual: null })
    console.log(`✅ ${name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    results.push({ name, success: false, expected: null, actual: null, error: message })
    console.log(`❌ ${name}`)
    console.log(`   Erreur: ${message}`)
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message || `Attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`
    )
  }
}

function assertGreaterThan(actual: number, expected: number, message?: string) {
  if (actual <= expected) {
    throw new Error(message || `Attendu > ${expected}, obtenu ${actual}`)
  }
}

function assertContains(text: string, substring: string, message?: string) {
  if (!text.includes(substring)) {
    throw new Error(message || `"${text}" ne contient pas "${substring}"`)
  }
}

console.log('='.repeat(70))
console.log('Test 1: Détection articles français')
console.log('='.repeat(70))

test('Détecte 4 articles français', () => {
  const chunks = chunkTextByArticles(CODE_PENAL_FR, { language: 'fr' })
  assertEqual(chunks.length, 4, `Attendu 4 articles, obtenu ${chunks.length}`)
})

test('Premier chunk contient Article 1', () => {
  const chunks = chunkTextByArticles(CODE_PENAL_FR, { language: 'fr' })
  assertContains(chunks[0].content, 'Article 1')
  assertContains(chunks[0].content, 'antérieure au fait')
})

test('Métadonnées articleNumber correctes FR', () => {
  const chunks = chunkTextByArticles(CODE_PENAL_FR, { language: 'fr' })
  assertEqual(chunks[0].metadata.articleNumber, '1')
  assertEqual(chunks[1].metadata.articleNumber, '2')
  assertEqual(chunks[2].metadata.articleNumber, '258')
  assertEqual(chunks[3].metadata.articleNumber, '259')
})

test('Stratégie chunking = article', () => {
  const chunks = chunkTextByArticles(CODE_PENAL_FR, { language: 'fr' })
  assertEqual(chunks[0].metadata.chunkingStrategy, 'article')
})

console.log('\n' + '='.repeat(70))
console.log('Test 2: Détection articles arabes')
console.log('='.repeat(70))

test('Détecte 5 articles arabes (incluant مكرر)', () => {
  const chunks = chunkTextByArticles(MAJALLA_JAZAIYA_AR, { language: 'ar' })
  assertEqual(chunks.length, 5, `Attendu 5 articles, obtenu ${chunks.length}`)
})

test('Premier chunk contient الفصل 1', () => {
  const chunks = chunkTextByArticles(MAJALLA_JAZAIYA_AR, { language: 'ar' })
  assertContains(chunks[0].content, 'الفصل 1')
  assertContains(chunks[0].content, 'لا يؤاخذ أحد')
})

test('Détecte article مكرر (259 مكرر)', () => {
  const chunks = chunkTextByArticles(MAJALLA_JAZAIYA_AR, { language: 'ar' })
  const article259bis = chunks.find((c) => c.metadata.articleNumber === '259 مكرر')
  if (!article259bis) {
    throw new Error('Article 259 مكرر non détecté')
  }
  assertContains(article259bis.content, 'آلة حادة')
})

test('Métadonnées articleNumber correctes AR', () => {
  const chunks = chunkTextByArticles(MAJALLA_JAZAIYA_AR, { language: 'ar' })
  assertEqual(chunks[0].metadata.articleNumber, '1')
  assertEqual(chunks[2].metadata.articleNumber, '258')
  assertEqual(chunks[4].metadata.articleNumber, '259 مكرر')
})

console.log('\n' + '='.repeat(70))
console.log('Test 3: Auto-détection langue')
console.log('='.repeat(70))

test('Auto-détecte français', () => {
  const chunks = chunkTextByArticles(CODE_PENAL_FR) // Pas de langue fournie
  assertGreaterThan(chunks.length, 0, 'Aucun article détecté')
  assertEqual(chunks.length, 4)
})

test('Auto-détecte arabe', () => {
  const chunks = chunkTextByArticles(MAJALLA_JAZAIYA_AR) // Pas de langue fournie
  assertGreaterThan(chunks.length, 0, 'Aucun article détecté')
  assertEqual(chunks.length, 5)
})

console.log('\n' + '='.repeat(70))
console.log('Test 4: Fallback chunking adaptatif')
console.log('='.repeat(70))

test('Document sans articles retourne vide', () => {
  const text = 'Ce texte ne contient aucun article juridique'
  const chunks = chunkTextByArticles(text, { language: 'fr' })
  assertEqual(chunks.length, 0)
})

test('Texte mixte détecte seulement articles', () => {
  const chunks = chunkTextByArticles(MIXED_DOCUMENT, { language: 'fr' })
  assertEqual(chunks.length, 2) // Articles 42 et 43 bis
  assertContains(chunks[0].content, 'Article 42')
  assertContains(chunks[1].content, 'Article 43 bis')
})

console.log('\n' + '='.repeat(70))
console.log('Test 5: Articles longs (split)')
console.log('='.repeat(70))

test('Article long splité en sous-chunks', () => {
  // Créer un article artificiel très long
  const longArticle = `Article 1000\n${'Lorem ipsum dolor sit amet. '.repeat(500)}`
  const chunks = chunkTextByArticles(longArticle, {
    language: 'fr',
    maxChunkWords: 200, // Forcer split
  })

  assertGreaterThan(chunks.length, 1, 'Article long devrait être splité')

  // Tous les sous-chunks ont le même articleNumber
  chunks.forEach((chunk) => {
    assertEqual(chunk.metadata.articleNumber, '1000')
  })
})

console.log('\n' + '='.repeat(70))
console.log('Test 6: Comparaison adaptive vs article')
console.log('='.repeat(70))

test('Adaptive produit plus de chunks que article-level', () => {
  const adaptiveChunks = chunkText(CODE_PENAL_FR, {
    chunkSize: 100,
    overlap: 20,
    category: 'codes',
  })

  const articleChunks = chunkTextByArticles(CODE_PENAL_FR, { language: 'fr' })

  console.log(`   Adaptive: ${adaptiveChunks.length} chunks`)
  console.log(`   Article:  ${articleChunks.length} chunks`)

  // Article-level devrait produire moins de chunks (1 par article)
  assertGreaterThan(adaptiveChunks.length, articleChunks.length)
})

test('Article-level préserve contexte complet article', () => {
  const chunks = chunkTextByArticles(CODE_PENAL_FR, { language: 'fr' })

  // Article 258 complet dans un seul chunk
  const article258 = chunks.find((c) => c.metadata.articleNumber === '258')
  if (!article258) {
    throw new Error('Article 258 non trouvé')
  }

  assertContains(article258.content, 'Quiconque')
  assertContains(article258.content, 'volontairement')
  assertContains(article258.content, 'mille dinars')
})

// =============================================================================
// RÉSUMÉ
// =============================================================================

console.log('\n' + '='.repeat(70))
console.log('📊 RÉSULTATS DES TESTS')
console.log('='.repeat(70))

const totalTests = results.length
const successfulTests = results.filter((r) => r.success).length
const failedTests = results.filter((r) => !r.success).length

console.log(`\nTotal tests: ${totalTests}`)
console.log(`  ✅ Succès: ${successfulTests}`)
console.log(`  ❌ Échecs: ${failedTests}`)

if (failedTests > 0) {
  console.log('\n❌ Tests en échec:')
  results
    .filter((r) => !r.success)
    .forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name}`)
      console.log(`     ${r.error}`)
    })
}

console.log('\n' + '='.repeat(70))

if (failedTests > 0) {
  console.log('\n❌ ÉCHEC : Certains tests ont échoué')
  process.exit(1)
} else {
  console.log('\n✅ SUCCÈS : Tous les tests passent')
  console.log('\n💡 Prochaine étape: Exécuter réindexation sur codes juridiques')
  console.log('   npx tsx scripts/reindex-with-article-chunking.ts --category=codes --dry-run')
  process.exit(0)
}
