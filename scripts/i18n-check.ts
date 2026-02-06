#!/usr/bin/env npx tsx
/**
 * Script de vérification complète des traductions i18n
 *
 * Fonctionnalités:
 * - Comparer fr.json et ar.json (clés manquantes)
 * - Scanner le code pour extraire les clés utilisées
 * - Détecter clés orphelines (définies mais non utilisées)
 * - Vérifier qualité AR (traductions identiques, longueur anormale)
 * - Générer rapport formaté
 */

import * as fs from 'fs'
import * as path from 'path'

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logBold(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors.bold}${colors[color]}${message}${colors.reset}`)
}

// Types
interface TranslationData {
  [key: string]: string | TranslationData
}

interface UsedKey {
  namespace: string
  key: string
  file: string
  line: number
}

interface QualityIssue {
  key: string
  type: 'identical' | 'ratio' | 'latin_chars'
  frValue: string
  arValue: string
  ratio?: number
}

// Chemins
const ROOT_DIR = path.resolve(__dirname, '..')
const MESSAGES_DIR = path.join(ROOT_DIR, 'messages')
const FR_PATH = path.join(MESSAGES_DIR, 'fr.json')
const AR_PATH = path.join(MESSAGES_DIR, 'ar.json')

// Charger les fichiers de traduction
function loadTranslations(): { fr: TranslationData; ar: TranslationData } | null {
  try {
    const frData = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'))
    const arData = JSON.parse(fs.readFileSync(AR_PATH, 'utf8'))
    return { fr: frData, ar: arData }
  } catch (error) {
    log(`Erreur lors du chargement des fichiers de traduction: ${error}`, 'red')
    return null
  }
}

// Extraire toutes les clés d'un objet de traduction
function getAllKeys(obj: TranslationData, prefix = ''): string[] {
  let keys: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys = keys.concat(getAllKeys(value as TranslationData, fullKey))
    } else {
      keys.push(fullKey)
    }
  }

  return keys
}

// Obtenir une valeur par chemin de clé
function getValueByPath(obj: TranslationData, keyPath: string): string | undefined {
  const result = keyPath.split('.').reduce((current: TranslationData | string | undefined, key) => {
    if (current && typeof current === 'object') {
      return (current as TranslationData)[key]
    }
    return undefined
  }, obj)

  return typeof result === 'string' ? result : undefined
}

// Scanner les fichiers pour extraire les clés utilisées
function scanCodeForUsedKeys(): UsedKey[] {
  const usedKeys: UsedKey[] = []
  const dirs = ['app', 'components', 'lib']

  // Pattern pour useTranslations
  const useTranslationsPattern = /useTranslations\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
  // Pattern pour t('key') ou t("key") ou t(`key`)
  const tCallPattern = /\bt\s*\(\s*['"`]([^'"`]+)['"`]/g
  // Pattern pour getTranslations (server components)
  const getTranslationsPattern = /getTranslations\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g

  function scanFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    const namespaces: { namespace: string; lineStart: number }[] = []

    // D'abord, trouver tous les useTranslations et getTranslations
    lines.forEach((line, idx) => {
      let match
      useTranslationsPattern.lastIndex = 0
      while ((match = useTranslationsPattern.exec(line)) !== null) {
        namespaces.push({ namespace: match[1], lineStart: idx })
      }
      getTranslationsPattern.lastIndex = 0
      while ((match = getTranslationsPattern.exec(line)) !== null) {
        namespaces.push({ namespace: match[1], lineStart: idx })
      }
    })

    // Ensuite, trouver tous les appels t('key')
    lines.forEach((line, idx) => {
      let match
      tCallPattern.lastIndex = 0
      while ((match = tCallPattern.exec(line)) !== null) {
        // Trouver le namespace le plus proche (le dernier déclaré avant cette ligne)
        let closestNamespace = ''
        for (const ns of namespaces) {
          if (ns.lineStart <= idx) {
            closestNamespace = ns.namespace
          }
        }

        if (closestNamespace) {
          usedKeys.push({
            namespace: closestNamespace,
            key: match[1],
            file: filePath.replace(ROOT_DIR + '/', ''),
            line: idx + 1,
          })
        }
      }
    })
  }

  function scanDirectory(dir: string) {
    const fullPath = path.join(ROOT_DIR, dir)
    if (!fs.existsSync(fullPath)) return

    const entries = fs.readdirSync(fullPath, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(fullPath, entry.name)

      if (entry.isDirectory()) {
        scanDirectory(path.join(dir, entry.name))
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        scanFile(entryPath)
      }
    }
  }

  dirs.forEach(scanDirectory)

  return usedKeys
}

// Vérifier la qualité des traductions arabes
function checkArabicQuality(fr: TranslationData, ar: TranslationData): QualityIssue[] {
  const issues: QualityIssue[] = []
  const frKeys = getAllKeys(fr)

  // Mots/patterns à ignorer (noms propres, codes, etc.)
  const ignorePatterns = [
    /^\d+$/, // Nombres
    /^[A-Z_]+$/, // Constantes
    /^[a-z]+$/, // Clés courtes en minuscules (ex: "ok", "id")
    /TND$/, // Devise
    /^#/, // Codes couleur
    /^https?:\/\//, // URLs
    /^\{\{.*\}\}$/, // Variables de template
  ]

  for (const key of frKeys) {
    const frValue = getValueByPath(fr, key)
    const arValue = getValueByPath(ar, key)

    if (!frValue || !arValue) continue

    // Ignorer les patterns spéciaux
    if (ignorePatterns.some((p) => p.test(frValue))) continue

    // 1. Traductions identiques (non traduites)
    if (frValue === arValue && frValue.length > 3) {
      // Ignorer les emojis seuls ou avec peu de texte
      const textWithoutEmoji = frValue.replace(
        /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
        ''
      )
      if (textWithoutEmoji.trim().length > 2) {
        issues.push({
          key,
          type: 'identical',
          frValue,
          arValue,
        })
      }
    }

    // 2. Ratio de longueur anormal
    const ratio = arValue.length / frValue.length
    if (frValue.length > 10 && (ratio < 0.3 || ratio > 3.0)) {
      issues.push({
        key,
        type: 'ratio',
        frValue,
        arValue,
        ratio,
      })
    }

    // 3. Présence de caractères latins dans l'arabe (hors variables, chiffres, ponctuation)
    const arWithoutSpecials = arValue
      .replace(/\{\{[^}]+\}\}/g, '') // Variables
      .replace(/\{[^}]+\}/g, '') // Placeholders
      .replace(/[0-9]/g, '') // Chiffres
      .replace(/[.,;:!?()[\]{}'"<>\/\\@#$%^&*+=\-_~`|]/g, '') // Ponctuation
      .replace(/\s+/g, '') // Espaces

    const latinChars = arWithoutSpecials.match(/[a-zA-Z]/g)
    if (latinChars && latinChars.length > 3) {
      issues.push({
        key,
        type: 'latin_chars',
        frValue,
        arValue,
      })
    }
  }

  return issues
}

// Trouver les clés orphelines (définies mais non utilisées)
function findOrphanKeys(
  frKeys: string[],
  usedKeys: UsedKey[]
): { key: string; namespace: string }[] {
  const orphans: { key: string; namespace: string }[] = []

  // Créer un set des clés utilisées (namespace.key)
  const usedSet = new Set(usedKeys.map((uk) => `${uk.namespace}.${uk.key}`))

  // Ajouter aussi les clés parentes utilisées (pour les objets)
  for (const uk of usedKeys) {
    // Si on utilise t('key'), ça peut aussi référencer des sous-clés dynamiques
    const fullKey = `${uk.namespace}.${uk.key}`
    usedSet.add(fullKey)
  }

  for (const key of frKeys) {
    // Extraire le namespace (première partie de la clé)
    const parts = key.split('.')
    const namespace = parts[0]
    const restKey = parts.slice(1).join('.')

    // Vérifier si la clé complète ou une de ses clés parentes est utilisée
    let isUsed = false

    // Vérifier la clé exacte
    if (usedSet.has(key)) {
      isUsed = true
    }

    // Vérifier si c'est une sous-clé d'une clé utilisée dynamiquement
    // Par exemple, si on a t(`types.${type}`), les clés types.* sont utilisées
    for (const usedKey of usedSet) {
      if (key.startsWith(usedKey + '.')) {
        isUsed = true
        break
      }
    }

    if (!isUsed) {
      orphans.push({ key, namespace })
    }
  }

  return orphans
}

// Générer le rapport
function generateReport() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan')
  logBold('   RAPPORT DE TRADUCTIONS I18N', 'cyan')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan')

  // Charger les traductions
  const translations = loadTranslations()
  if (!translations) {
    process.exit(1)
  }

  const { fr, ar } = translations
  const frKeys = getAllKeys(fr)
  const arKeys = getAllKeys(ar)

  // Compter les namespaces
  const namespaces = new Set(frKeys.map((k) => k.split('.')[0]))

  log('📊 RÉSUMÉ', 'blue')
  log(`   Total clés: ${frKeys.length}`)
  log(`   Namespaces: ${namespaces.size}`)

  // Scanner le code
  log('\n🔍 Scan du code source...', 'dim')
  const usedKeys = scanCodeForUsedKeys()
  const scannedFiles = new Set(usedKeys.map((uk) => uk.file)).size
  log(`   Fichiers scannés: ${scannedFiles}`)
  log(`   Clés référencées: ${usedKeys.length}`)

  // Vérifier la synchronisation FR/AR
  log('\n✅ SYNCHRONISATION FR/AR', 'green')
  const missingInAr = frKeys.filter((key) => !arKeys.includes(key))
  const missingInFr = arKeys.filter((key) => !frKeys.includes(key))

  if (missingInAr.length === 0 && missingInFr.length === 0) {
    log('   [OK] Toutes les clés sont synchronisées', 'green')
  } else {
    if (missingInAr.length > 0) {
      log(`\n   ❌ ${missingInAr.length} clé(s) manquante(s) en AR:`, 'red')
      missingInAr.slice(0, 10).forEach((key) => {
        log(`      • ${key}`, 'yellow')
      })
      if (missingInAr.length > 10) {
        log(`      ... et ${missingInAr.length - 10} autres`, 'dim')
      }
    }
    if (missingInFr.length > 0) {
      log(`\n   ❌ ${missingInFr.length} clé(s) manquante(s) en FR:`, 'red')
      missingInFr.slice(0, 10).forEach((key) => {
        log(`      • ${key}`, 'yellow')
      })
      if (missingInFr.length > 10) {
        log(`      ... et ${missingInFr.length - 10} autres`, 'dim')
      }
    }
  }

  // Clés orphelines
  log('\n🔍 CLÉS ORPHELINES (définies mais potentiellement non utilisées)', 'magenta')
  const orphans = findOrphanKeys(frKeys, usedKeys)

  if (orphans.length === 0) {
    log('   [OK] Aucune clé orpheline détectée', 'green')
  } else {
    log(`   ${orphans.length} clé(s) potentiellement orpheline(s):`, 'yellow')

    // Grouper par namespace
    const orphansByNamespace: { [ns: string]: string[] } = {}
    for (const orphan of orphans) {
      if (!orphansByNamespace[orphan.namespace]) {
        orphansByNamespace[orphan.namespace] = []
      }
      orphansByNamespace[orphan.namespace].push(orphan.key)
    }

    // Afficher les 20 premiers par namespace
    let shown = 0
    for (const [ns, keys] of Object.entries(orphansByNamespace)) {
      if (shown >= 20) break
      log(`\n   ${ns}:`, 'cyan')
      for (const key of keys.slice(0, 5)) {
        if (shown >= 20) break
        log(`      • ${key}`, 'dim')
        shown++
      }
      if (keys.length > 5) {
        log(`      ... et ${keys.length - 5} autres dans ce namespace`, 'dim')
      }
    }
    if (orphans.length > 20) {
      log(`\n   ... et ${orphans.length - 20} autres clés`, 'dim')
    }

    log(
      '\n   ℹ️  Note: Certaines clés peuvent être utilisées dynamiquement (t(`key.${var}`))',
      'dim'
    )
  }

  // Qualité des traductions AR
  log('\n⚠️  QUALITÉ TRADUCTIONS AR', 'yellow')
  const qualityIssues = checkArabicQuality(fr, ar)

  const identical = qualityIssues.filter((i) => i.type === 'identical')
  const ratioIssues = qualityIssues.filter((i) => i.type === 'ratio')
  const latinIssues = qualityIssues.filter((i) => i.type === 'latin_chars')

  log(`   Identiques FR=AR: ${identical.length}`)
  if (identical.length > 0) {
    identical.slice(0, 5).forEach((issue) => {
      log(`      • ${issue.key}: "${issue.frValue}"`, 'dim')
    })
    if (identical.length > 5) {
      log(`      ... et ${identical.length - 5} autres`, 'dim')
    }
  }

  log(`   Ratio longueur suspect: ${ratioIssues.length}`)
  if (ratioIssues.length > 0) {
    ratioIssues.slice(0, 3).forEach((issue) => {
      log(`      • ${issue.key} (ratio: ${issue.ratio?.toFixed(2)})`, 'dim')
    })
    if (ratioIssues.length > 3) {
      log(`      ... et ${ratioIssues.length - 3} autres`, 'dim')
    }
  }

  log(`   Caractères latins en AR: ${latinIssues.length}`)
  if (latinIssues.length > 0) {
    latinIssues.slice(0, 3).forEach((issue) => {
      log(`      • ${issue.key}`, 'dim')
    })
    if (latinIssues.length > 3) {
      log(`      ... et ${latinIssues.length - 3} autres`, 'dim')
    }
  }

  // Couverture
  const coverage =
    frKeys.length > 0 ? ((frKeys.length - missingInAr.length) / frKeys.length) * 100 : 100
  log(`\n📈 COUVERTURE: ${coverage.toFixed(1)}%`, 'blue')

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan')

  // Code de sortie
  const hasErrors = missingInAr.length > 0 || missingInFr.length > 0
  if (hasErrors) {
    log('❌ Des clés manquantes ont été détectées', 'red')
    process.exit(1)
  } else {
    log('✅ Vérification terminée avec succès', 'green')
    process.exit(0)
  }
}

// Exécution
generateReport()
