#!/usr/bin/env npx tsx
/**
 * Test du crawl autonome de cassation.tn avec seed URLs + formulaire POST
 *
 * Usage: npx tsx scripts/test-cassation-crawl.ts
 *
 * Ce script :
 * 1. Crée (ou retrouve) la source cassation.tn avec seedUrls + formCrawlConfig
 * 2. Lance un crawl limité (maxPages=10, 2 thèmes seulement)
 * 3. Affiche les résultats
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Charger les variables d'environnement (.env.local en priorité)
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createWebSource, getWebSourceByUrl, updateWebSource } from '@/lib/web-scraper/source-service'
import { crawlSource } from '@/lib/web-scraper/crawler-service'
import type { WebSource } from '@/lib/web-scraper/types'

const CASSATION_BASE_URL = 'http://www.cassation.tn'
const JURISPRUDENCE_SEED = 'http://www.cassation.tn/fr/%D9%81%D9%82%D9%87-%D8%A7%D9%84%D9%82%D8%B6%D8%A7%D8%A1/'

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

function log(msg: string) { console.log(msg) }
function logHeader(msg: string) {
  log(`\n${colors.bold}${colors.blue}${'═'.repeat(60)}${colors.reset}`)
  log(`${colors.bold}${colors.blue}  ${msg}${colors.reset}`)
  log(`${colors.bold}${colors.blue}${'═'.repeat(60)}${colors.reset}`)
}
function logSection(msg: string) { log(`\n${colors.cyan}── ${msg} ──${colors.reset}`) }
function logOk(msg: string) { log(`  ${colors.green}✓${colors.reset} ${msg}`) }
function logErr(msg: string) { log(`  ${colors.red}✗${colors.reset} ${msg}`) }
function logInfo(msg: string) { log(`  ${colors.dim}ℹ${colors.reset} ${msg}`) }

async function main() {
  logHeader('Test Crawl Autonome cassation.tn')
  log(`${colors.dim}Date: ${new Date().toISOString()}${colors.reset}`)

  // ─── Étape 1 : Créer ou retrouver la source ───
  logSection('Étape 1: Configuration de la source')

  let source: WebSource | null = await getWebSourceByUrl(CASSATION_BASE_URL)

  if (source) {
    logOk(`Source existante trouvée: ${source.name} (${source.id})`)

    // Mettre à jour avec seedUrls et formCrawlConfig si pas encore fait
    if (!source.seedUrls?.length || !source.formCrawlConfig) {
      source = await updateWebSource(source.id, {
        seedUrls: [JURISPRUDENCE_SEED],
        formCrawlConfig: { type: 'typo3-cassation', themes: ['TA', 'TF'] },
        ignoreSSLErrors: true,
        downloadFiles: true,
        maxDepth: 3,
        maxPages: 10,
        rateLimitMs: 2000,
      })
      logOk('Source mise à jour avec seedUrls + formCrawlConfig')
    }
  } else {
    logInfo('Source cassation.tn non trouvée, création...')
    try {
      source = await createWebSource({
        name: 'Cour de Cassation - Jurisprudence',
        baseUrl: CASSATION_BASE_URL,
        description: 'محكمة التعقيب التونسية - فقه القضاء (Jurisprudence)',
        category: 'jurisprudence',
        language: 'ar',
        priority: 8,
        maxDepth: 3,
        maxPages: 10,
        rateLimitMs: 2000,
        ignoreSSLErrors: true,
        downloadFiles: true,
        seedUrls: [JURISPRUDENCE_SEED],
        formCrawlConfig: { type: 'typo3-cassation', themes: ['TA', 'TF'] },
        respectRobotsTxt: true,
        crawlFrequency: '7 days',
      }, '38824364-d2b6-42c9-a2b4-f112cd2e47cc')
      logOk(`Source créée: ${source.name} (${source.id})`)
    } catch (err: any) {
      logErr(`Erreur création source: ${err.message}`)
      process.exit(1)
    }
  }

  if (!source) {
    logErr('Source introuvable après création/mise à jour')
    process.exit(1)
  }

  // Afficher la config
  logInfo(`Base URL: ${source.baseUrl}`)
  logInfo(`Seed URLs: ${JSON.stringify(source.seedUrls)}`)
  logInfo(`Form Crawl Config: ${JSON.stringify(source.formCrawlConfig)}`)
  logInfo(`Ignore SSL: ${source.ignoreSSLErrors}`)
  logInfo(`Download Files: ${source.downloadFiles}`)
  logInfo(`Max Pages: ${source.maxPages}, Max Depth: ${source.maxDepth}`)

  // ─── Étape 2 : Lancer le crawl ───
  logSection('Étape 2: Lancement du crawl')
  log('')
  logInfo('Crawl en cours... (limité à 10 pages, 2 thèmes: Civil Général + Pénal)')
  log('')

  const startTime = Date.now()

  try {
    const result = await crawlSource(source, {
      maxPages: 10,
      maxDepth: 3,
      incrementalMode: false, // Mode full pour le test
    })

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1)

    // ─── Étape 3 : Résultats ───
    logSection('Étape 3: Résultats du crawl')

    if (result.success) {
      logOk(`Crawl terminé avec succès en ${durationSec}s`)
    } else {
      logErr(`Crawl terminé avec des erreurs en ${durationSec}s`)
    }

    logInfo(`Pages traitées: ${result.pagesProcessed}`)
    logInfo(`Pages nouvelles: ${result.pagesNew}`)
    logInfo(`Pages modifiées: ${result.pagesChanged}`)
    logInfo(`Pages en erreur: ${result.pagesFailed}`)
    logInfo(`Fichiers téléchargés: ${result.filesDownloaded}`)

    if (result.errors.length > 0) {
      logSection('Erreurs rencontrées')
      for (const err of result.errors.slice(0, 10)) {
        logErr(`${err.url.substring(0, 80)} → ${err.error.substring(0, 100)}`)
      }
      if (result.errors.length > 10) {
        logInfo(`... et ${result.errors.length - 10} autres erreurs`)
      }
    }

    // Vérification des objectifs
    logSection('Vérification des objectifs')

    const seedUrlCrawled = result.pagesProcessed > 1
    const formResultsFound = result.pagesNew > 1 || result.pagesChanged > 0
    const noFatalErrors = !result.errors.some(e => e.error.includes('BAN'))

    if (seedUrlCrawled) logOk('Seed URL crawlée (page de jurisprudence atteinte)')
    else logErr('Seed URL non crawlée')

    if (formResultsFound) logOk('Formulaire soumis et liens de détail enqueués')
    else logErr('Aucun lien de détail trouvé via le formulaire')

    if (noFatalErrors) logOk('Pas de bannissement détecté')
    else logErr('Bannissement détecté !')

    if (result.filesDownloaded > 0) logOk(`${result.filesDownloaded} PDFs téléchargés vers MinIO`)
    else logInfo('Aucun PDF téléchargé (normal si maxPages bas)')

  } catch (err: any) {
    logErr(`Erreur fatale pendant le crawl: ${err.message}`)
    console.error(err.stack)
  }

  log('')
  logHeader('Fin du test')
  process.exit(0)
}

main().catch(err => {
  console.error(`Erreur fatale: ${err.message}`)
  console.error(err.stack)
  process.exit(1)
})
