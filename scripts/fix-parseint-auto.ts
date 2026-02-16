/**
 * Script: Correction automatique parseInt sans radix
 * Usage: npx tsx scripts/fix-parseint-auto.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { glob } from 'glob'

interface Fix {
  file: string
  line: number
  original: string
  fixed: string
}

const fixes: Fix[] = []

/**
 * Corriger un fichier
 */
function fixFile(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8')
  let modified = content
  let hasChanges = false

  // Pattern 1: parseInt(x || 'default') → parseInt(x || 'default', 10)
  // Pattern 2: parseInt(variable) → parseInt(variable, 10)
  // Pattern 3: parseInt(expression) → parseInt(expression, 10)

  // Regex: Chercher parseInt(...) sans , 10 à la fin
  const parseIntRegex = /parseInt\(([^)]+)\)(?!\s*,\s*10)/g

  let match
  while ((match = parseIntRegex.exec(content)) !== null) {
    const fullMatch = match[0]
    const args = match[1]

    // Vérifier si déjà avec radix (parseInt(x, 10) déjà corrigé)
    if (args.includes(', 10') || args.includes(',10')) {
      continue
    }

    // Remplacer
    const fixed = `parseInt(${args}, 10)`
    modified = modified.replace(fullMatch, fixed)
    hasChanges = true

    fixes.push({
      file: filePath,
      line: content.substring(0, match.index).split('\n').length,
      original: fullMatch,
      fixed
    })
  }

  // Ajouter import si nécessaire et si modifications
  if (hasChanges) {
    // Vérifier si import safe-number existe
    const hasImport = content.includes("from '@/lib/utils/safe-number'")

    if (!hasImport) {
      // Ajouter import après les autres imports
      const importLine = "import { safeParseInt } from '@/lib/utils/safe-number'\n"
      const lastImportIndex = modified.lastIndexOf('\nimport ')

      if (lastImportIndex > 0) {
        const insertPosition = modified.indexOf('\n', lastImportIndex + 1) + 1
        modified = modified.slice(0, insertPosition) + importLine + modified.slice(insertPosition)
      } else {
        // Insérer au début si pas d'import
        modified = importLine + modified
      }
    }

    fs.writeFileSync(filePath, modified, 'utf-8')
    return true
  }

  return false
}

/**
 * Main
 */
async function main() {
  console.log('🔧 Correction automatique parseInt sans radix...\n')

  // Trouver tous les fichiers TypeScript/TSX dans app/ et lib/
  const files = await glob('app/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/.next/**']
  })

  console.log(`📂 Fichiers à analyser: ${files.length}`)

  let modifiedCount = 0
  let totalFixes = 0

  for (const file of files) {
    const wasModified = fixFile(file)
    if (wasModified) {
      modifiedCount++
    }
  }

  // Afficher résumé
  console.log(`\n✅ Correction terminée`)
  console.log(`   Fichiers modifiés: ${modifiedCount}`)
  console.log(`   Corrections appliquées: ${fixes.length}\n`)

  if (fixes.length > 0) {
    console.log('📋 Détails des corrections:\n')

    // Grouper par fichier
    const byFile = fixes.reduce((acc, fix) => {
      if (!acc[fix.file]) acc[fix.file] = []
      acc[fix.file].push(fix)
      return acc
    }, {} as Record<string, Fix[]>)

    Object.entries(byFile).forEach(([file, fileFixes]) => {
      console.log(`  ${file}:`)
      fileFixes.forEach(fix => {
        console.log(`    Ligne ${fix.line}: ${fix.original} → ${fix.fixed}`)
      })
      console.log()
    })
  }

  console.log('\n⚠️  Prochaines étapes:')
  console.log('  1. Vérifier: git diff')
  console.log('  2. Tester: npm run type-check')
  console.log('  3. Tester: npm run dev')
}

main().catch(console.error)
