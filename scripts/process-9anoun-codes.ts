#!/usr/bin/env npx tsx
/**
 * Script générique pour traiter tous les codes 9anoun.tn
 *
 * Pour chaque code : crée le legal_document, lie les web_pages,
 * puis consolide le texte.
 *
 * Usage:
 *   npx tsx scripts/process-9anoun-codes.ts --all              # Tous les codes (>= 10 pages)
 *   npx tsx scripts/process-9anoun-codes.ts --code code-travail # Un seul code
 *   npx tsx scripts/process-9anoun-codes.ts --all --dry-run     # Aperçu sans modifier la DB
 *   npx tsx scripts/process-9anoun-codes.ts --all --force       # Retraiter même les existants
 */

import { db } from '@/lib/db/postgres'
import {
  findOrCreateDocument,
  linkPageToDocument,
  getDocumentByCitationKey,
} from '@/lib/legal-documents/document-service'
import {
  extractArticleNumberFromUrl,
  getCodeMetadata,
} from '@/lib/legal-documents/citation-key-extractor'
import { consolidateDocument } from '@/lib/legal-documents/content-consolidation-service'
import { NINEANOUN_CODE_DOMAINS } from '@/lib/web-scraper/9anoun-code-domains'

// =============================================================================
// CONFIG
// =============================================================================

const MIN_PAGES = 10
// Les 2 web_sources 9anoun existantes
const NINEANOUN_SOURCE_IDS = [
  '4319d2d1-569c-4107-8f52-d71e2a2e9fe9', // KB
  '26b1b332-71b8-4508-be7d-8e0f15e80a2e', // Codes
]

// =============================================================================
// TYPES
// =============================================================================

interface CodeInfo {
  slug: string
  citationKey: string
  nameFr: string
  nameAr: string
  pageCount: number
  hasDocument: boolean
}

interface ProcessResult {
  slug: string
  citationKey: string
  status: 'created' | 'skipped' | 'error'
  pagesLinked: number
  articlesFound: number
  totalWords: number
  consolidatedLength: number
  error?: string
}

// =============================================================================
// CLI PARSING
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2)
  const flags = {
    all: args.includes('--all'),
    code: '',
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
  }

  const codeIdx = args.indexOf('--code')
  if (codeIdx !== -1 && args[codeIdx + 1]) {
    flags.code = args[codeIdx + 1]
  }

  if (!flags.all && !flags.code) {
    console.error('Usage:')
    console.error('  npx tsx scripts/process-9anoun-codes.ts --all [--dry-run] [--force]')
    console.error('  npx tsx scripts/process-9anoun-codes.ts --code <slug> [--dry-run] [--force]')
    console.error('')
    console.error('Exemples de slugs: code-travail, code-commerce, code-penal')
    process.exit(1)
  }

  return flags
}

// =============================================================================
// DISCOVERY
// =============================================================================

/**
 * Lister tous les codes avec leur nombre de pages crawlées
 */
async function discoverCodes(): Promise<CodeInfo[]> {
  const codes: CodeInfo[] = []

  for (const [slug, def] of Object.entries(NINEANOUN_CODE_DOMAINS)) {
    const meta = getCodeMetadata(slug)
    if (!meta) continue

    // Compter les pages crawlées pour ce code
    const countResult = await db.query<any>(
      `SELECT COUNT(*) as count
       FROM web_pages
       WHERE web_source_id = ANY($1)
         AND url LIKE $2
         AND status IN ('crawled', 'indexed')`,
      [NINEANOUN_SOURCE_IDS, `%/kb/codes/${slug}/%`]
    )

    const pageCount = parseInt(countResult.rows[0].count, 10)

    // Vérifier si un legal_document existe déjà
    const existing = await getDocumentByCitationKey(meta.citationKey)

    codes.push({
      slug,
      citationKey: meta.citationKey,
      nameFr: def.nameFr,
      nameAr: def.nameAr,
      pageCount,
      hasDocument: existing !== null,
    })
  }

  // Trier par nombre de pages décroissant
  codes.sort((a, b) => b.pageCount - a.pageCount)
  return codes
}

// =============================================================================
// PROCESSING
// =============================================================================

/**
 * Traiter un code : créer le document, lier les pages, consolider
 */
async function processCode(slug: string, dryRun: boolean): Promise<ProcessResult> {
  const meta = getCodeMetadata(slug)
  if (!meta) {
    return {
      slug,
      citationKey: slug,
      status: 'error',
      pagesLinked: 0,
      articlesFound: 0,
      totalWords: 0,
      consolidatedLength: 0,
      error: `Métadonnées non trouvées pour "${slug}"`,
    }
  }

  const result: ProcessResult = {
    slug,
    citationKey: meta.citationKey,
    status: 'created',
    pagesLinked: 0,
    articlesFound: 0,
    totalWords: 0,
    consolidatedLength: 0,
  }

  try {
    // --- Étape 1 : Créer le document ---
    if (dryRun) {
      console.log(`  [DRY-RUN] Créerait document: ${meta.citationKey}`)
    }

    const document = dryRun
      ? { id: 'dry-run-id' }
      : await findOrCreateDocument({
          citationKey: meta.citationKey,
          documentType: meta.documentType,
          officialTitleAr: meta.officialTitleAr,
          officialTitleFr: meta.officialTitleFr,
          primaryCategory: meta.primaryCategory,
          secondaryCategories: ['legislation'],
          tags: [slug, meta.legalDomains[0], 'tunisie'].filter(Boolean),
          legalDomains: meta.legalDomains,
          canonicalSourceId: NINEANOUN_SOURCE_IDS[0],
          sourceUrls: [`https://9anoun.tn/kb/codes/${slug}`],
        })

    // --- Étape 2 : Lier les pages ---
    const pagesResult = await db.query<any>(
      `SELECT id, url, title, word_count
       FROM web_pages
       WHERE web_source_id = ANY($1)
         AND url LIKE $2
         AND status IN ('crawled', 'indexed')
       ORDER BY url ASC`,
      [NINEANOUN_SOURCE_IDS, `%/kb/codes/${slug}/%`]
    )

    for (const page of pagesResult.rows) {
      const articleNumber = extractArticleNumberFromUrl(page.url)
      if (articleNumber) result.articlesFound++

      const contributionType = articleNumber ? 'article' : 'chapter'
      let pageOrder: number | null = null
      if (articleNumber) {
        const numMatch = articleNumber.match(/^(\d+)/)
        if (numMatch) pageOrder = parseInt(numMatch[1], 10)
      }

      if (!dryRun) {
        try {
          await linkPageToDocument(
            page.id,
            document.id,
            articleNumber,
            pageOrder,
            contributionType,
            false
          )
          result.pagesLinked++
        } catch {
          // Page déjà liée ou erreur de contrainte, on continue
          result.pagesLinked++
        }
      } else {
        result.pagesLinked++
      }
    }

    if (dryRun) {
      console.log(`  [DRY-RUN] Lierait ${result.pagesLinked} pages (${result.articlesFound} articles)`)
      return result
    }

    // --- Étape 3 : Consolider ---
    console.log(`  🔄 Consolidation...`)
    const consolidation = await consolidateDocument(document.id)

    if (consolidation.success) {
      result.totalWords = consolidation.totalWords
      result.consolidatedLength = consolidation.consolidatedTextLength
      result.articlesFound = consolidation.totalArticles
    } else {
      result.status = 'error'
      result.error = consolidation.errors.join('; ')
    }

    return result
  } catch (err: any) {
    return {
      ...result,
      status: 'error',
      error: err.message,
    }
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const flags = parseArgs()

  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║   Traitement des codes juridiques 9anoun.tn            ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log()

  if (flags.dryRun) console.log('🔍 Mode DRY-RUN : aucune modification en base\n')

  // Découvrir les codes disponibles
  console.log('📡 Découverte des codes crawlés...\n')
  const allCodes = await discoverCodes()

  // Filtrer selon les arguments
  let codesToProcess: CodeInfo[]

  if (flags.code) {
    const found = allCodes.find(c => c.slug === flags.code)
    if (!found) {
      console.error(`❌ Code "${flags.code}" non trouvé dans NINEANOUN_CODE_DOMAINS`)
      console.error(`   Slugs disponibles: ${allCodes.map(c => c.slug).join(', ')}`)
      process.exit(1)
    }
    codesToProcess = [found]
  } else {
    // --all : filtrer les codes avec assez de pages
    codesToProcess = allCodes.filter(c => c.pageCount >= MIN_PAGES)
  }

  // Afficher le résumé
  console.log(`📊 Codes trouvés: ${allCodes.length} total, ${codesToProcess.length} à traiter (>= ${MIN_PAGES} pages)\n`)

  // Afficher le tableau des codes
  console.log('┌─────────────────────────────────────────────────────┬────────┬──────────┐')
  console.log('│ Code                                                │ Pages  │ Status   │')
  console.log('├─────────────────────────────────────────────────────┼────────┼──────────┤')

  for (const code of codesToProcess) {
    const name = code.nameFr.substring(0, 49).padEnd(49)
    const pages = String(code.pageCount).padStart(4)
    const status = code.hasDocument
      ? (flags.force ? '🔄 force' : '⏭ skip ')
      : '🆕 new  '
    console.log(`│ ${name} │ ${pages}   │ ${status} │`)
  }

  console.log('└─────────────────────────────────────────────────────┴────────┴──────────┘')
  console.log()

  // Filtrer les codes déjà traités (sauf --force)
  if (!flags.force) {
    const before = codesToProcess.length
    codesToProcess = codesToProcess.filter(c => !c.hasDocument)
    if (before !== codesToProcess.length) {
      console.log(`⏭ ${before - codesToProcess.length} codes déjà traités (utiliser --force pour retraiter)\n`)
    }
  }

  if (codesToProcess.length === 0) {
    console.log('✅ Aucun code à traiter.')
    process.exit(0)
  }

  // Traiter chaque code
  const results: ProcessResult[] = []
  let processed = 0

  for (const code of codesToProcess) {
    processed++
    console.log(`\n[${processed}/${codesToProcess.length}] 📖 ${code.nameFr} (${code.slug})`)
    console.log(`   ${code.nameAr}`)
    console.log(`   Pages crawlées: ${code.pageCount}`)

    const result = await processCode(code.slug, flags.dryRun)
    results.push(result)

    if (result.status === 'created') {
      console.log(`   ✅ Traité: ${result.pagesLinked} pages, ${result.articlesFound} articles, ${result.totalWords} mots`)
      console.log(`   📄 Texte consolidé: ${result.consolidatedLength} caractères`)
    } else if (result.status === 'error') {
      console.log(`   ❌ Erreur: ${result.error}`)
    }
  }

  // Résumé final
  console.log('\n' + '═'.repeat(60))
  console.log('📊 RÉSUMÉ FINAL')
  console.log('═'.repeat(60))

  const created = results.filter(r => r.status === 'created')
  const errors = results.filter(r => r.status === 'error')
  const skipped = results.filter(r => r.status === 'skipped')

  console.log(`   ✅ Créés/consolidés : ${created.length}`)
  if (skipped.length > 0) console.log(`   ⏭ Ignorés (existants) : ${skipped.length}`)
  if (errors.length > 0) console.log(`   ❌ Erreurs : ${errors.length}`)
  console.log(`   📄 Articles totaux : ${results.reduce((s, r) => s + r.articlesFound, 0)}`)
  console.log(`   📝 Mots totaux : ${results.reduce((s, r) => s + r.totalWords, 0)}`)
  console.log()

  if (errors.length > 0) {
    console.log('❌ Codes en erreur:')
    for (const e of errors) {
      console.log(`   - ${e.slug}: ${e.error}`)
    }
    console.log()
  }

  if (!flags.dryRun && created.length > 0) {
    console.log('👉 Prochaines étapes:')
    console.log('   1. Vérifier dans /super-admin/legal-documents')
    console.log('   2. Approuver manuellement les documents validés')
    console.log('   3. L\'indexation RAG se fait automatiquement après approbation')
  }

  process.exit(errors.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err)
  process.exit(1)
})
