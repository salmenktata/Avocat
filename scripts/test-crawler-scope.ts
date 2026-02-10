#!/usr/bin/env tsx

/**
 * Test de la vérification du scope dans le crawler
 * Vérifie que seules les URLs dans le scope de la baseUrl sont crawlées
 */

// Fonction de test copiée depuis crawler-service.ts
function isUrlInScope(url: string, baseUrl: string): boolean {
  try {
    const urlObj = new URL(url)
    const baseUrlObj = new URL(baseUrl)

    // Vérifier que le domaine est identique
    if (urlObj.hostname !== baseUrlObj.hostname) {
      return false
    }

    // Vérifier que le chemin de l'URL commence par le chemin de la baseUrl
    const urlPath = urlObj.pathname
    const basePath = baseUrlObj.pathname

    // Normaliser les chemins (enlever trailing slash sauf pour la racine)
    const normalizedUrlPath = urlPath === '/'
      ? '/'
      : (urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath)

    const normalizedBasePath = basePath === '/'
      ? '/'
      : (basePath.endsWith('/') ? basePath.slice(0, -1) : basePath)

    // Cas spécial : si la baseUrl est la racine du site, tout est dans le scope
    if (normalizedBasePath === '/') {
      return true
    }

    // L'URL doit commencer par le chemin de base
    return normalizedUrlPath === normalizedBasePath || normalizedUrlPath.startsWith(normalizedBasePath + '/')
  } catch (error) {
    console.error(`Erreur lors de la vérification du scope pour ${url}:`, error)
    return false
  }
}

// Tests
const tests = [
  // Cas nominal : 9anoun.tn/kb/codes
  {
    name: '9anoun.tn/kb/codes - Page principale',
    baseUrl: 'https://9anoun.tn/kb/codes',
    url: 'https://9anoun.tn/kb/codes',
    expected: true,
  },
  {
    name: '9anoun.tn/kb/codes - Sous-page code-penal',
    baseUrl: 'https://9anoun.tn/kb/codes',
    url: 'https://9anoun.tn/kb/codes/code-penal',
    expected: true,
  },
  {
    name: '9anoun.tn/kb/codes - Sous-page code-penal/article-1',
    baseUrl: 'https://9anoun.tn/kb/codes',
    url: 'https://9anoun.tn/kb/codes/code-penal/article-1',
    expected: true,
  },
  {
    name: '9anoun.tn/kb/codes - Avec trailing slash',
    baseUrl: 'https://9anoun.tn/kb/codes',
    url: 'https://9anoun.tn/kb/codes/',
    expected: true,
  },
  {
    name: '9anoun.tn/kb/codes - Jurisprudence (hors scope)',
    baseUrl: 'https://9anoun.tn/kb/codes',
    url: 'https://9anoun.tn/kb/jurisprudence',
    expected: false,
  },
  {
    name: '9anoun.tn/kb/codes - Page racine (hors scope)',
    baseUrl: 'https://9anoun.tn/kb/codes',
    url: 'https://9anoun.tn/',
    expected: false,
  },
  {
    name: '9anoun.tn/kb/codes - /kb (hors scope)',
    baseUrl: 'https://9anoun.tn/kb/codes',
    url: 'https://9anoun.tn/kb',
    expected: false,
  },
  {
    name: '9anoun.tn/kb/codes - Autre domaine (hors scope)',
    baseUrl: 'https://9anoun.tn/kb/codes',
    url: 'https://google.com/kb/codes',
    expected: false,
  },

  // Cas : baseUrl avec trailing slash
  {
    name: 'BaseURL avec trailing slash - Page principale',
    baseUrl: 'https://9anoun.tn/kb/codes/',
    url: 'https://9anoun.tn/kb/codes',
    expected: true,
  },
  {
    name: 'BaseURL avec trailing slash - Sous-page',
    baseUrl: 'https://9anoun.tn/kb/codes/',
    url: 'https://9anoun.tn/kb/codes/code-penal',
    expected: true,
  },

  // Cas : URL partielle qui ressemble
  {
    name: 'URL qui commence par le même préfixe mais diverge',
    baseUrl: 'https://9anoun.tn/kb/codes',
    url: 'https://9anoun.tn/kb/codes-archive',
    expected: false, // codes-archive n'est PAS un sous-chemin de /kb/codes
  },

  // Cas : baseUrl = racine du site
  {
    name: 'BaseURL racine - Page principale',
    baseUrl: 'https://9anoun.tn/',
    url: 'https://9anoun.tn/',
    expected: true,
  },
  {
    name: 'BaseURL racine - Toute sous-page',
    baseUrl: 'https://9anoun.tn/',
    url: 'https://9anoun.tn/kb/codes',
    expected: true,
  },
  {
    name: 'BaseURL racine - Autre domaine',
    baseUrl: 'https://9anoun.tn/',
    url: 'https://google.com/',
    expected: false,
  },
]

console.log('🧪 Test de la vérification du scope dans le crawler\n')
console.log('═'.repeat(80))

let passed = 0
let failed = 0

for (const test of tests) {
  const result = isUrlInScope(test.url, test.baseUrl)
  const success = result === test.expected

  if (success) {
    console.log(`✅ ${test.name}`)
    console.log(`   baseUrl: ${test.baseUrl}`)
    console.log(`   url: ${test.url}`)
    console.log(`   Résultat: ${result} (attendu: ${test.expected})`)
    passed++
  } else {
    console.log(`❌ ${test.name}`)
    console.log(`   baseUrl: ${test.baseUrl}`)
    console.log(`   url: ${test.url}`)
    console.log(`   Résultat: ${result} (attendu: ${test.expected})`)
    failed++
  }
  console.log('')
}

console.log('═'.repeat(80))
console.log(`\n📊 Résultats: ${passed}/${tests.length} tests réussis`)

if (failed > 0) {
  console.log(`❌ ${failed} test(s) échoué(s)`)
  process.exit(1)
} else {
  console.log('✅ Tous les tests sont passés !')
  process.exit(0)
}
