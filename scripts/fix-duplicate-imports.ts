/**
 * Script: Corriger imports dupliqués/malformés
 * Corrige: import {\nimport { safeParseInt... → Import séparé
 */

import * as fs from 'fs'
import { glob } from 'glob'

async function main() {
  console.log('🔧 Correction imports dupliqués...\n')

  const files = await glob('app/**/*.ts', {
    ignore: ['**/node_modules/**', '**/.next/**']
  })

  let fixedCount = 0

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8')
    const original = content

    // Pattern problématique: import {\nimport { safeParseInt...
    // Chercher les imports malformés
    const badImportPattern = /import\s*{\s*\nimport\s+{\s+safeParseInt\s+}\s+from\s+['"]@\/lib\/utils\/safe-number['"]\s*\n/g

    if (badImportPattern.test(content)) {
      // Extraire la ligne import malformée et la corriger
      content = content.replace(
        /import\s*{\s*\nimport\s+{\s+safeParseInt\s+}\s+from\s+['"]@\/lib\/utils\/safe-number['"]\s*\n\s*(\w+)/g,
        "import { safeParseInt } from '@/lib/utils/safe-number'\nimport {\n  $1"
      )

      fs.writeFileSync(file, content, 'utf-8')
      console.log(`✅ Corrigé: ${file}`)
      fixedCount++
    }
  }

  console.log(`\n✅ ${fixedCount} fichiers corrigés`)
}

main().catch(console.error)
