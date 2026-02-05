#!/usr/bin/env node

/**
 * Script pour détecter les textes en dur dans les composants
 *
 * Recherche les textes français qui ne sont pas traduits
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan')
log('   RECHERCHE DE TEXTES EN DUR', 'cyan')
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan')

// Patterns à rechercher (textes français courants)
const patterns = [
  // Boutons et actions
  { pattern: '>Enregistrer<', description: 'Bouton "Enregistrer"' },
  { pattern: '>Créer<', description: 'Bouton "Créer"' },
  { pattern: '>Modifier<', description: 'Bouton "Modifier"' },
  { pattern: '>Supprimer<', description: 'Bouton "Supprimer"' },
  { pattern: '>Annuler<', description: 'Bouton "Annuler"' },
  { pattern: '>Confirmer<', description: 'Bouton "Confirmer"' },
  { pattern: '>Ajouter<', description: 'Bouton "Ajouter"' },

  // Messages
  { pattern: 'Aucun.*trouvé', description: 'Message "Aucun ... trouvé"' },
  { pattern: 'Aucune.*trouvée', description: 'Message "Aucune ... trouvée"' },
  { pattern: 'Une erreur est survenue', description: 'Message d\'erreur' },
  { pattern: 'Veuillez', description: 'Message "Veuillez..."' },

  // Labels
  { pattern: '>Nom\\s*<', description: 'Label "Nom"' },
  { pattern: '>Prénom\\s*<', description: 'Label "Prénom"' },
  { pattern: '>Email\\s*<', description: 'Label "Email"' },
  { pattern: '>Téléphone\\s*<', description: 'Label "Téléphone"' },
  { pattern: '>Adresse\\s*<', description: 'Label "Adresse"' },
  { pattern: '>Description\\s*<', description: 'Label "Description"' },
]

const directories = ['app', 'components']
const extensions = ['.tsx', '.ts']

let totalIssues = 0
const issuesByFile = {}

log('🔍 Recherche dans les répertoires:', 'blue')
directories.forEach(dir => log(`   - ${dir}`, 'reset'))
log('')

// Fonction pour rechercher un pattern dans un fichier
function searchInFile(filePath, pattern) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const regex = new RegExp(pattern, 'gi')
    const matches = []
    let match

    while ((match = regex.exec(content)) !== null) {
      // Obtenir le numéro de ligne
      const lines = content.substring(0, match.index).split('\n')
      const lineNumber = lines.length
      const lineContent = lines[lines.length - 1] + match[0]

      matches.push({
        line: lineNumber,
        content: lineContent.trim(),
        match: match[0],
      })
    }

    return matches
  } catch (error) {
    return []
  }
}

// Fonction récursive pour scanner les fichiers
function scanDirectory(dir) {
  const files = fs.readdirSync(dir)

  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      // Ignorer node_modules et .next
      if (file !== 'node_modules' && file !== '.next' && file !== 'dist') {
        scanDirectory(filePath)
      }
    } else if (extensions.some(ext => file.endsWith(ext))) {
      // Scanner chaque pattern
      patterns.forEach(({ pattern, description }) => {
        const matches = searchInFile(filePath, pattern)

        if (matches.length > 0) {
          totalIssues += matches.length

          if (!issuesByFile[filePath]) {
            issuesByFile[filePath] = []
          }

          matches.forEach(match => {
            issuesByFile[filePath].push({
              description,
              pattern,
              ...match,
            })
          })
        }
      })
    }
  })
}

// Scanner les répertoires
directories.forEach(dir => {
  if (fs.existsSync(dir)) {
    scanDirectory(dir)
  }
})

// Afficher les résultats
if (totalIssues === 0) {
  log('✅ SUCCÈS: Aucun texte en dur détecté!', 'green')
  log('   Tous les textes utilisent le système de traduction', 'green')
} else {
  log(`⚠️  AVERTISSEMENT: ${totalIssues} texte(s) potentiellement en dur détecté(s)\n`, 'yellow')

  Object.entries(issuesByFile).forEach(([filePath, issues]) => {
    log(`\n📄 ${filePath}`, 'cyan')
    log(`   ${issues.length} occurrence(s)\n`, 'yellow')

    issues.forEach(({ description, line, content, match }, index) => {
      if (index < 5) {
        // Limiter à 5 par fichier pour la lisibilité
        log(`   Ligne ${line}: ${description}`, 'yellow')
        log(`   Trouvé: "${match}"`, 'red')
        log(`   Code: ${content}\n`, 'reset')
      }
    })

    if (issues.length > 5) {
      log(`   ... et ${issues.length - 5} autre(s) occurrence(s)\n`, 'yellow')
    }
  })

  log('\n💡 Recommandation:', 'blue')
  log('   Remplacez ces textes par des appels à t(\'key\') via useTranslations()', 'blue')
  log('   Exemple: <button>{t(\'buttons.save\')}</button>\n', 'blue')
}

log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan')
log(`\n📊 Résumé:`, 'blue')
log(`   - Fichiers scannés: ${Object.keys(issuesByFile).length || 'Aucun problème'}`)
log(`   - Textes potentiels en dur: ${totalIssues}`)

if (totalIssues > 0) {
  log(`\n⚠️  Ces détections peuvent inclure des faux positifs`, 'yellow')
  log(`   Vérifiez manuellement chaque occurrence\n`, 'yellow')
} else {
  log('')
}
