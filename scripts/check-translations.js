#!/usr/bin/env node

/**
 * Script de vérification des traductions FR/AR
 *
 * Vérifie :
 * 1. Toutes les clés FR ont leur équivalent AR
 * 2. Même structure dans les deux fichiers
 * 3. Pas de traductions manquantes
 */

const fs = require('fs')
const path = require('path')

// Couleurs pour la console
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

// Charger les fichiers de traduction
const frPath = path.join(__dirname, '../messages/fr.json')
const arPath = path.join(__dirname, '../messages/ar.json')

let frData, arData

try {
  frData = JSON.parse(fs.readFileSync(frPath, 'utf8'))
  log('✓ Fichier FR chargé', 'green')
} catch (error) {
  log(`✗ Erreur lecture messages/fr.json: ${error.message}`, 'red')
  process.exit(1)
}

try {
  arData = JSON.parse(fs.readFileSync(arPath, 'utf8'))
  log('✓ Fichier AR chargé', 'green')
} catch (error) {
  log(`✗ Erreur lecture messages/ar.json: ${error.message}`, 'red')
  process.exit(1)
}

// Fonction récursive pour obtenir toutes les clés
function getAllKeys(obj, prefix = '') {
  let keys = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys = keys.concat(getAllKeys(value, fullKey))
    } else {
      keys.push(fullKey)
    }
  }

  return keys
}

// Fonction pour obtenir une valeur par chemin de clé
function getValueByPath(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan')
log('   VÉRIFICATION DES TRADUCTIONS FR/AR', 'cyan')
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan')

// Obtenir toutes les clés
const frKeys = getAllKeys(frData)
const arKeys = getAllKeys(arData)

log(`📊 Statistiques:`, 'blue')
log(`   - Clés françaises: ${frKeys.length}`)
log(`   - Clés arabes: ${arKeys.length}\n`)

// Vérifier les clés manquantes
const missingInAr = frKeys.filter(key => !arKeys.includes(key))
const missingInFr = arKeys.filter(key => !frKeys.includes(key))

let hasErrors = false

// Clés manquantes dans AR
if (missingInAr.length > 0) {
  hasErrors = true
  log(`\n❌ ERREUR: ${missingInAr.length} clé(s) française(s) manquante(s) en arabe:\n`, 'red')
  missingInAr.forEach(key => {
    const frValue = getValueByPath(frData, key)
    log(`   ${key}`, 'yellow')
    log(`   FR: "${frValue}"`, 'reset')
    log(`   AR: MANQUANT\n`, 'red')
  })
}

// Clés manquantes dans FR
if (missingInFr.length > 0) {
  hasErrors = true
  log(`\n❌ ERREUR: ${missingInFr.length} clé(s) arabe(s) manquante(s) en français:\n`, 'red')
  missingInFr.forEach(key => {
    const arValue = getValueByPath(arData, key)
    log(`   ${key}`, 'yellow')
    log(`   AR: "${arValue}"`, 'reset')
    log(`   FR: MANQUANT\n`, 'red')
  })
}

// Vérifier les traductions vides
log('\n🔍 Vérification des traductions vides...\n', 'blue')

const emptyTranslations = []

frKeys.forEach(key => {
  const frValue = getValueByPath(frData, key)
  const arValue = getValueByPath(arData, key)

  if (typeof frValue === 'string' && frValue.trim() === '') {
    emptyTranslations.push({ key, lang: 'FR', value: frValue })
  }

  if (typeof arValue === 'string' && arValue.trim() === '') {
    emptyTranslations.push({ key, lang: 'AR', value: arValue })
  }
})

if (emptyTranslations.length > 0) {
  hasErrors = true
  log(`❌ AVERTISSEMENT: ${emptyTranslations.length} traduction(s) vide(s):\n`, 'yellow')
  emptyTranslations.forEach(({ key, lang }) => {
    log(`   ${key} (${lang})`, 'yellow')
  })
}

// Vérifier les traductions identiques (possibles oublis)
log('\n🔍 Vérification des traductions identiques FR=AR...\n', 'blue')

const identicalTranslations = []

frKeys.forEach(key => {
  const frValue = getValueByPath(frData, key)
  const arValue = getValueByPath(arData, key)

  if (typeof frValue === 'string' && typeof arValue === 'string' && frValue === arValue && frValue.trim() !== '') {
    // Ignorer les valeurs qui sont naturellement identiques (chiffres, codes, etc.)
    if (!/^\d+$/.test(frValue) && frValue.length > 2) {
      identicalTranslations.push({ key, value: frValue })
    }
  }
})

if (identicalTranslations.length > 0) {
  log(`⚠️  AVERTISSEMENT: ${identicalTranslations.length} traduction(s) identique(s) (possibles oublis):\n`, 'yellow')
  identicalTranslations.slice(0, 10).forEach(({ key, value }) => {
    log(`   ${key}: "${value}"`, 'yellow')
  })
  if (identicalTranslations.length > 10) {
    log(`   ... et ${identicalTranslations.length - 10} autres\n`, 'yellow')
  }
}

// Résultat final
log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan')

if (!hasErrors) {
  log('✅ SUCCÈS: Toutes les traductions sont synchronisées!', 'green')
  log(`   ${frKeys.length} clés vérifiées`, 'green')

  if (identicalTranslations.length > 0) {
    log(`\n⚠️  ${identicalTranslations.length} traduction(s) identique(s) détectée(s)`, 'yellow')
    log('   Vérifiez manuellement ces traductions', 'yellow')
  }

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan')
  process.exit(0)
} else {
  log('❌ ÉCHEC: Des erreurs ont été détectées', 'red')
  log('   Corrigez les erreurs ci-dessus avant de commiter', 'red')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan')
  process.exit(1)
}
