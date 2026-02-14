#!/usr/bin/env tsx
/**
 * Génère docs/ENV_VARIABLES_REFERENCE.md depuis env-schema.json
 *
 * Format:
 * - Table Markdown triée par criticité
 * - Exemples Dev vs Prod
 * - Impact si mal configuré
 * - Historique incidents
 * - Commandes fix rapides
 *
 * Usage:
 *   npm run docs:env
 *
 * Auto-run via .husky/pre-commit si env-schema.json modifié
 */

import fs from 'fs/promises'
import path from 'path'
import schema from '@/docs/env-schema.json'

/**
 * Génère documentation Markdown
 */
async function generateDocs(): Promise<string> {
  let markdown = `# Variables d'Environnement - Référence Complète\n\n`
  markdown += `> 🤖 **Auto-généré** depuis \`docs/env-schema.json\` le ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}\n`
  markdown += `>\n`
  markdown += `> ⚠️ **Ne PAS éditer manuellement** - Modifier le schéma JSON à la place puis exécuter \`npm run docs:env\`\n\n`

  markdown += `## Métadonnées\n\n`
  markdown += `- **Version schéma**: ${schema.version}\n`
  markdown += `- **Dernière mise à jour**: ${schema.lastUpdated}\n`
  markdown += `- **Total variables**: ${schema.categories.reduce((sum, cat) => sum + cat.variables.length, 0)}\n\n`

  // Table des matières
  markdown += `## Table des Matières\n\n`
  schema.categories.forEach((cat) => {
    markdown += `- [${cat.name}](#${cat.name.toLowerCase().replace(/\s+/g, '-')})\n`
  })
  markdown += `- [Règles de Validation](#règles-de-validation)\n`
  markdown += `- [Historique Incidents](#historique-incidents)\n`
  markdown += `- [Commandes Utiles](#commandes-utiles)\n\n`

  // Sections par catégorie
  schema.categories.forEach((cat) => {
    markdown += `## ${cat.name}\n\n`
    markdown += `${cat.description}\n\n`

    // Table variables
    markdown += `| Variable | Type | Criticité | Dev | Prod | Description |\n`
    markdown += `|----------|------|-----------|-----|------|-------------|\n`

    cat.variables.forEach((v) => {
      const devVal = v.secret ? '`***`' : v.devValue !== null && v.devValue !== undefined ? `\`${v.devValue}\`` : '-'
      const prodVal = v.secret ? '`***`' : v.prodValue !== null && v.prodValue !== undefined ? `\`${v.prodValue}\`` : '-'

      markdown += `| \`${v.name}\` | ${v.type} | **${v.criticality}** | ${devVal} | ${prodVal} | ${v.description} |\n`
    })

    markdown += `\n`
  })

  // Section règles validation
  markdown += `## Règles de Validation\n\n`
  markdown += `Ces règles sont évaluées automatiquement lors de la validation (pré-deploy, post-deploy).\n\n`

  schema.validationRules.forEach((rule) => {
    markdown += `### ${rule.id}\n\n`
    markdown += `**Severity**: ${rule.severity}\n\n`
    markdown += `**Condition**:\n\`\`\`\n${rule.condition}\n\`\`\`\n\n`
    markdown += `**Message**: ${rule.message}\n\n`

    if (rule.solutions && rule.solutions.length > 0) {
      markdown += `**Solutions**:\n\n`
      rule.solutions.forEach((sol) => (markdown += `- ${sol}\n`))
      markdown += `\n`
    }
  })

  // Section historique incidents
  markdown += `## Historique Incidents\n\n`
  markdown += `Historique des problèmes de configuration rencontrés en production.\n\n`

  const incidents = schema.categories
    .flatMap((cat) => cat.variables)
    .filter((v) => v.relatedIncidents && v.relatedIncidents.length > 0)
    .flatMap((v) =>
      (v.relatedIncidents || []).map((inc) => ({
        ...inc,
        variable: v.name,
        criticality: v.criticality,
      }))
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  if (incidents.length === 0) {
    markdown += `Aucun incident documenté.\n\n`
  } else {
    incidents.forEach((inc) => {
      markdown += `### ${inc.date}: \`${inc.variable}\` (${inc.criticality})\n\n`
      markdown += `- **Problème**: ${inc.issue}\n`
      markdown += `- **Impact**: ${inc.impact}\n`
      markdown += `- **Résolution**: ${inc.resolution}\n\n`
    })
  }

  // Section commandes utiles
  markdown += `## Commandes Utiles\n\n`
  markdown += `### Validation Configuration\n\n`
  markdown += `\`\`\`bash\n`
  markdown += `# Auditer divergences .env.production vs template\n`
  markdown += `npm run audit:env\n\n`
  markdown += `# Valider contre schéma JSON (bloque si CRITICAL)\n`
  markdown += `npm run validate:env\n\n`
  markdown += `# Mode strict (warnings bloquent aussi)\n`
  markdown += `npm run validate:env:strict\n\n`
  markdown += `# Avec test connectivity API keys\n`
  markdown += `npm run validate:env:connectivity\n`
  markdown += `\`\`\`\n\n`

  markdown += `### Synchronisation Dev ↔ Prod\n\n`
  markdown += `\`\`\`bash\n`
  markdown += `# Comparer dev vs prod\n`
  markdown += `npm run diff-env\n\n`
  markdown += `# Mode verbose (affiche toutes variables)\n`
  markdown += `npm run diff-env:verbose\n\n`
  markdown += `# Avec test connectivity\n`
  markdown += `npm run diff-env:check\n\n`
  markdown += `# Synchroniser (wizard interactif)\n`
  markdown += `npm run sync-env-interactive\n`
  markdown += `\`\`\`\n\n`

  markdown += `### Fix Production Directement\n\n`
  markdown += `\`\`\`bash\n`
  markdown += `# Fix variable production (SSH + restart + health check)\n`
  markdown += `bash scripts/fix-prod-config.sh VARIABLE_NAME NEW_VALUE\n\n`
  markdown += `# Exemples\n`
  markdown += `bash scripts/fix-prod-config.sh OLLAMA_ENABLED true\n`
  markdown += `bash scripts/fix-prod-config.sh RAG_MAX_RESULTS 10\n`
  markdown += `\`\`\`\n\n`

  markdown += `### Génération Documentation\n\n`
  markdown += `\`\`\`bash\n`
  markdown += `# Régénérer ce fichier depuis env-schema.json\n`
  markdown += `npm run docs:env\n`
  markdown += `\`\`\`\n\n`

  markdown += `---\n\n`
  markdown += `**Documentation générée le**: ${new Date().toLocaleString('fr-FR')}\n\n`
  markdown += `**Schéma source**: \`docs/env-schema.json\` (version ${schema.version})\n\n`
  markdown += `**Outils**:\n`
  markdown += `- Validation: \`scripts/validate-env-schema.ts\`\n`
  markdown += `- Audit: \`scripts/audit-env-divergences.ts\`\n`
  markdown += `- Diff: \`scripts/diff-env.ts\`\n`
  markdown += `- Fix: \`scripts/fix-prod-config.sh\`\n`

  return markdown
}

/**
 * Main
 */
async function main() {
  console.log('📝 Génération documentation environnement...\n')

  const markdown = await generateDocs()

  const outputPath = path.join(__dirname, '..', 'docs', 'ENV_VARIABLES_REFERENCE.md')

  await fs.writeFile(outputPath, markdown, 'utf-8')

  console.log(`✅ Documentation générée: ${outputPath}`)
  console.log(`   Taille: ${markdown.length} caractères`)
  console.log(`   Variables: ${schema.categories.reduce((sum, cat) => sum + cat.variables.length, 0)}`)
  console.log(`   Catégories: ${schema.categories.length}`)
  console.log('')
  console.log('💡 Prochaines étapes:')
  console.log('   git add docs/ENV_VARIABLES_REFERENCE.md')
  console.log('   git commit -m "docs: régénération documentation environnement"')
  console.log('')
}

main().catch((error) => {
  console.error('❌ Erreur:', error.message)
  process.exit(1)
})
