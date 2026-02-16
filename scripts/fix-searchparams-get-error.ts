/**
 * Script: Corriger erreur searchParams.get(..., 10)
 * Le script précédent a incorrectement ajouté , 10 comme 2ème argument de .get()
 * au lieu de le mettre dans parseInt()
 */

import * as fs from 'fs'
import { glob } from 'glob'

async function main() {
  console.log('🔧 Correction erreur searchParams.get(..., 10)...\n')

  const files = await glob('app/**/*.ts', {
    ignore: ['**/node_modules/**', '**/.next/**']
  })

  let fixedCount = 0

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8')
    const original = content

    // Pattern: searchParams.get('param', 10) → searchParams.get('param')
    // Remplacer .get('xxx', 10) par .get('xxx')
    content = content.replace(
      /searchParams\.get\((['"][^'"]+['"])\s*,\s*10\)/g,
      'searchParams.get($1)'
    )

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf-8')
      console.log(`✅ Corrigé: ${file}`)
      fixedCount++
    }
  }

  console.log(`\n✅ ${fixedCount} fichiers corrigés`)
}

main().catch(console.error)
