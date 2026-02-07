#!/usr/bin/env node

/**
 * Script de vérification de synchronisation des fichiers .env
 * Vérifie que les clés API sont cohérentes entre dev et prod
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')

// Fichiers à comparer
const ENV_FILES = {
  source: '.env',
  dev: '.env.local',
  prod: '.env.production',
}

// Clés critiques qui doivent être synchronisées
const CRITICAL_KEYS = [
  'GROQ_API_KEY',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'BREVO_API_KEY',
  'NEXTAUTH_SECRET',
  'CRON_SECRET',
]

// Placeholders à détecter (indiquent une clé non configurée)
const PLACEHOLDERS = [
  'CHANGE_ME',
  'VOTRE',
  'your_',
  'YOUR_',
  'xxxx',
  'generate-with',
]

function parseEnvFile(filePath) {
  const fullPath = path.join(ROOT, filePath)
  if (!fs.existsSync(fullPath)) {
    return null
  }

  const content = fs.readFileSync(fullPath, 'utf-8')
  const env = {}

  content.split('\n').forEach((line) => {
    // Ignorer commentaires et lignes vides
    if (line.startsWith('#') || !line.includes('=')) return

    const [key, ...valueParts] = line.split('=')
    const value = valueParts.join('=').trim()

    if (key && value) {
      env[key.trim()] = value
    }
  })

  return env
}

function isPlaceholder(value) {
  if (!value) return true
  return PLACEHOLDERS.some((p) => value.includes(p))
}

function maskValue(value) {
  if (!value || value.length <= 12) return '***'
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

function checkSync() {
  console.log('\n🔍 Vérification synchronisation des fichiers .env\n')
  console.log('='.repeat(60))

  const envs = {}
  let hasErrors = false
  let hasWarnings = false

  // Charger tous les fichiers
  for (const [name, file] of Object.entries(ENV_FILES)) {
    envs[name] = parseEnvFile(file)
    if (envs[name]) {
      console.log(`✅ ${file} chargé (${Object.keys(envs[name]).length} clés)`)
    } else {
      console.log(`⚠️  ${file} non trouvé`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📋 Vérification des clés critiques\n')

  // Tableau de résultats
  const results = []

  for (const key of CRITICAL_KEYS) {
    const values = {
      source: envs.source?.[key],
      dev: envs.dev?.[key],
      prod: envs.prod?.[key],
    }

    const isSourceOk = values.source && !isPlaceholder(values.source)
    const isDevOk = values.dev && !isPlaceholder(values.dev)
    const isProdOk = values.prod && !isPlaceholder(values.prod)

    // Vérifier si les valeurs sont identiques (quand elles existent)
    const realValues = [values.source, values.dev, values.prod].filter(
      (v) => v && !isPlaceholder(v)
    )
    const allSame = realValues.length > 0 && realValues.every((v) => v === realValues[0])

    let status = '✅'
    let issue = ''

    if (!isDevOk && !isProdOk) {
      status = '❌'
      issue = 'Non configuré'
      hasErrors = true
    } else if (!isDevOk) {
      status = '⚠️'
      issue = 'Manquant en DEV'
      hasWarnings = true
    } else if (!isProdOk) {
      status = '⚠️'
      issue = 'Manquant en PROD'
      hasWarnings = true
    } else if (!allSame) {
      status = '⚠️'
      issue = 'Valeurs différentes'
      hasWarnings = true
    }

    results.push({
      key,
      status,
      dev: isDevOk ? maskValue(values.dev) : '❌',
      prod: isProdOk ? maskValue(values.prod) : '❌',
      issue,
    })
  }

  // Afficher le tableau
  console.log('Clé'.padEnd(20) + 'DEV'.padEnd(20) + 'PROD'.padEnd(20) + 'Status')
  console.log('-'.repeat(70))

  for (const r of results) {
    console.log(
      `${r.key.padEnd(20)}${r.dev.padEnd(20)}${r.prod.padEnd(20)}${r.status} ${r.issue}`
    )
  }

  console.log('\n' + '='.repeat(60))

  // Résumé
  if (hasErrors) {
    console.log('❌ Des clés critiques ne sont pas configurées!')
    process.exit(1)
  } else if (hasWarnings) {
    console.log('⚠️  Attention: certaines clés nécessitent une vérification')
    process.exit(0)
  } else {
    console.log('✅ Toutes les clés critiques sont synchronisées!')
    process.exit(0)
  }
}

// Commande pour synchroniser (copie de .env vers les autres)
function syncFromSource() {
  console.log('\n🔄 Synchronisation depuis .env\n')

  const source = parseEnvFile('.env')
  if (!source) {
    console.error('❌ Fichier .env non trouvé')
    process.exit(1)
  }

  for (const key of CRITICAL_KEYS) {
    const value = source[key]
    if (value && !isPlaceholder(value)) {
      console.log(`  ${key}: ${maskValue(value)}`)
    }
  }

  console.log('\n✅ Utilisez ces valeurs pour mettre à jour .env.local et .env.production')
}

// Main
const command = process.argv[2]

if (command === 'sync') {
  syncFromSource()
} else {
  checkSync()
}
