/**
 * Script d'analyse de l'utilisation du storage
 *
 * Usage:
 *   node -r ts-node/register scripts/analyze-storage.ts
 *
 * Ou dans la console du navigateur:
 *   import('./lib/utils/storage-cleanup').then(m => m.logStorageReport(sessionStorage, 'Session'))
 */

import {
  listStorageItems,
  getStorageSize,
  formatBytes,
  logStorageReport
} from '../lib/utils/storage-cleanup'

// Note: Ce script ne peut être exécuté que dans un environnement navigateur
// Pour l'utiliser, copiez le code suivant dans la console du navigateur

const analyzeScript = `
// Analyse du storage
(function() {
  function getItemSize(key, value) {
    return new Blob([key, value]).size
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  function analyzeStorage(storage, name) {
    const items = []
    let totalSize = 0

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      const value = storage.getItem(key)
      if (!key || !value) continue

      const size = getItemSize(key, value)
      totalSize += size
      items.push({ key, size, value: value.substring(0, 100) })
    }

    items.sort((a, b) => b.size - a.size)

    console.group('📊 ' + name + ' Storage Analysis')
    console.log('Total size:', formatBytes(totalSize))
    console.log('Items count:', items.length)
    console.log('\\nTop 10 largest items:')

    items.slice(0, 10).forEach((item, i) => {
      console.log(\`  \${i+1}. \${item.key}: \${formatBytes(item.size)}\`)
      console.log(\`     Preview: \${item.value}...\`)
    })

    console.groupEnd()
    return { items, totalSize }
  }

  console.clear()
  console.log('🔍 Storage Analysis\\n')

  const session = analyzeStorage(sessionStorage, 'Session')
  const local = analyzeStorage(localStorage, 'Local')

  console.log('\\n📈 Summary')
  console.log('Session Storage:', formatBytes(session.totalSize), '/', session.items.length, 'items')
  console.log('Local Storage:', formatBytes(local.totalSize), '/', local.items.length, 'items')
  console.log('Total:', formatBytes(session.totalSize + local.totalSize))

  // Recommandations
  console.log('\\n💡 Recommendations:')
  if (session.totalSize > 3 * 1024 * 1024) {
    console.warn('⚠️  Session storage > 3MB - Consider cleanup')
  }
  if (local.totalSize > 5 * 1024 * 1024) {
    console.warn('⚠️  Local storage > 5MB - Consider cleanup')
  }
  if (session.items.length > 50) {
    console.warn('⚠️  Too many session items (', session.items.length, ') - Consider reducing')
  }
})()
`

console.log('📋 Script d\'analyse du storage')
console.log('================================\n')
console.log('Copiez-collez le code suivant dans la console du navigateur:\n')
console.log(analyzeScript)
console.log('\n================================')
console.log('Ou utilisez la fonction directement:')
console.log('  logStorageReport(sessionStorage, "Session")')
console.log('  logStorageReport(localStorage, "Local")')
