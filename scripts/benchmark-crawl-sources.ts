/**
 * Benchmark & Diagnostic du Crawling des Sources Web
 *
 * Mesure objectivement les performances de crawling sur :
 *   - cassation.tn  (TYPO3 + CSRF + SSL invalide)
 *   - da5ira.com    (Blogger via sitemap)
 *   - jibaya.tn     (site inconnu, auto-détection)
 *
 * Usage :
 *   npx tsx scripts/benchmark-crawl-sources.ts
 *   npx tsx scripts/benchmark-crawl-sources.ts --source cassation
 *   npx tsx scripts/benchmark-crawl-sources.ts --source da5ira
 *   npx tsx scripts/benchmark-crawl-sources.ts --source jibaya
 *
 * Rapport généré dans : tmp/benchmark-crawl-{date}.md
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import * as cheerio from 'cheerio'

import { fetchHtml, downloadFile } from '@/lib/web-scraper/scraper-service'
import { extractContent } from '@/lib/web-scraper/content-extractor'
import { detectBan } from '@/lib/web-scraper/anti-ban-utils'
import { detectAndParseSitemap } from '@/lib/web-scraper/sitemap-auto-detector'
import { parseFile } from '@/lib/web-scraper/file-parser-service'
import {
  extractCsrfTokens,
  buildSearchPostBody,
  CASSATION_THEMES,
} from '@/lib/web-scraper/typo3-csrf-utils'

// ============================================================================
// TYPES
// ============================================================================

interface Phase1Result {
  success: boolean
  latencyMs: number
  statusCode?: number
  sslError: boolean
  sslFixed: boolean
  serverHeader?: string
  poweredByHeader?: string
  detectedFramework: string
  hasSitemap: boolean
  sitemapUrl?: string
  sitemapPageUrls?: string[] // Mis en cache pour éviter le double parsing phase1→phase2
  robotsTxtOk: boolean
  banDetected: boolean
  banReason?: string
  issues: string[]
  recommendations: string[]
}

interface PageResult {
  url: string
  success: boolean
  statusCode?: number
  latencyMs: number
  contentLength: number
  arabicRatio: number
  contentQuality: number
  pdfUrlsFound: number
  issue?: string
}

interface Phase2Result {
  pagesTried: number
  pagesSucceeded: number
  successRate: number
  avgContentLength: number
  avgArabicRatio: number
  avgContentQuality: number
  pagesPerSecond: number
  totalPdfUrlsFound: number
  issues: Array<'ban' | 'timeout' | 'csrf_failed' | 'typo3_error' | 'empty_content'>
  pages: PageResult[]
}

interface PdfResult {
  url: string
  success: boolean
  sizekb: number
  downloadMs: number
  charsExtracted: number
  pageCount: number
  ocrUsed: boolean
  arabicRatio: number
  issue?: string
}

interface Phase3Result {
  pdfsTested: number
  pdfsSuccess: number
  avgSizeKb: number
  avgDownloadMs: number
  avgCharsExtracted: number
  ocrUsedCount: number
  avgArabicRatio: number
  pdfs: PdfResult[]
}

interface SourceResult {
  name: string
  url: string
  globalTimeoutMs: number
  durationMs: number
  timedOut: boolean
  phase1: Phase1Result
  phase2: Phase2Result
  phase3: Phase3Result
  score: number
  grade: string
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const SOURCES_CONFIG = {
  cassation: {
    label: 'cassation.tn',
    url: 'http://www.cassation.tn',
    globalTimeoutMs: 120_000,
    phase2: {
      maxPages: 10,
      fetchOptions: { ignoreSSLErrors: true, stealthMode: true, timeout: 30_000 },
      rateLimitMs: 2000,
    },
    phase3: {
      maxPdfs: 3,
      filterSameDomain: true, // Uniquement PDFs hébergés sur cassation.tn
      pdfPatterns: [/\/fileadmin\/.*\.pdf/i, /\.pdf$/i],
    },
  },
  da5ira: {
    label: 'da5ira.com',
    url: 'https://www.da5ira.com',
    globalTimeoutMs: 120_000,
    phase2: {
      maxPages: 10,
      useSitemap: true,
      fetchOptions: { timeout: 30_000 },
      rateLimitMs: 500,
    },
    phase3: {
      maxPdfs: 3,
      filterSameDomain: true, // Exclure les PDFs sur legislation.tn, etc.
      pdfPatterns: [/\.pdf$/i],
    },
  },
  jibaya: {
    label: 'jibaya.tn',
    url: 'https://jibaya.tn',
    globalTimeoutMs: 300_000, // 5 min — PDFs garbled nécessitent OCR (~4 min/doc)
    phase2: {
      maxPages: 10,
      useSitemap: true,
      fetchOptions: { timeout: 30_000 },
      rateLimitMs: 1500, // Pages lentes (2-3s), augmenter le délai
    },
    phase3: {
      maxPdfs: 2,            // Limiter à 2 (OCR massif)
      maxPdfSizeBytes: 500 * 1024, // 500 KB max — éviter les PDF 67 pages (1.7 MB)
      pdfPatterns: [/\.pdf$/i, /circulaire/i, /instruction/i],
    },
  },
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateArabicRatio(text: string): number {
  if (!text || text.length === 0) return 0
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length
  return arabicChars / text.length
}

function extractPdfUrls(
  html: string,
  baseUrl: string,
  patterns: RegExp[],
  filterSameDomain = false
): string[] {
  const $ = cheerio.load(html)
  const urls = new Set<string>()
  const base = new URL(baseUrl)

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    if (!href) return

    const isMatch = patterns.some(p => p.test(href))
    if (!isMatch) return

    try {
      const absolute = href.startsWith('http')
        ? href
        : href.startsWith('//')
          ? `${base.protocol}${href}`
          : `${base.origin}${href.startsWith('/') ? '' : '/'}${href}`

      // Filtre domaine : exclure les PDFs hébergés sur d'autres domaines
      if (filterSameDomain) {
        const pdfHost = new URL(absolute).hostname
        const sourceHost = base.hostname
        // Accepter si même domaine ou sous-domaine de la source
        if (pdfHost !== sourceHost && !pdfHost.endsWith('.' + sourceHost) && !sourceHost.endsWith('.' + pdfHost)) {
          return
        }
      }

      urls.add(absolute)
    } catch {
      // ignore malformed
    }
  })

  return Array.from(urls)
}

function extractInternalLinks(html: string, baseUrl: string, maxLinks = 30): string[] {
  const $ = cheerio.load(html)
  const urls = new Set<string>()
  const base = new URL(baseUrl)

  $('a[href]').each((_, el) => {
    if (urls.size >= maxLinks) return

    const href = $(el).attr('href') || ''
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return

    try {
      let absolute: string
      if (href.startsWith('http')) {
        absolute = href
      } else if (href.startsWith('//')) {
        absolute = `${base.protocol}${href}`
      } else {
        absolute = `${base.origin}${href.startsWith('/') ? '' : '/'}${href}`
      }

      const parsed = new URL(absolute)
      if (parsed.hostname === base.hostname) {
        urls.add(absolute)
      }
    } catch {
      // ignore
    }
  })

  return Array.from(urls)
}

function detectFrameworkFromHtml(html: string): string {
  if (html.includes('typo3') || html.includes('TYPO3') || html.includes('tx_')) return 'TYPO3'
  if (html.includes('blogspot') || html.includes('blogger.com') || html.includes('Blogger')) return 'Blogger'
  if (html.includes('livewire') || html.includes('Laravel')) return 'Laravel/Livewire'
  if (html.includes('wp-content') || html.includes('wp-includes')) return 'WordPress'
  if (html.includes('drupal') || html.includes('Drupal')) return 'Drupal'
  if (html.includes('joomla') || html.includes('Joomla')) return 'Joomla'
  if (html.includes('angular') || html.includes('ng-app')) return 'Angular'
  if (html.includes('__nuxt') || html.includes('_nuxt')) return 'Nuxt.js'
  if (html.includes('__next') || html.includes('_next')) return 'Next.js'
  return 'Inconnu'
}

function sleep(ms: number): Promise<void> {
  const jitter = ms * 0.2 * (Math.random() - 0.5) * 2
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms + jitter)))
}

async function withGlobalTimeout<T>(
  promise: Promise<T>,
  ms: number,
  defaultValue: T
): Promise<{ value: T; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('GLOBAL_TIMEOUT')), ms)
  })

  try {
    const value = await Promise.race([promise, timeout])
    clearTimeout(timer!)
    return { value, timedOut: false }
  } catch (err) {
    clearTimeout(timer!)
    if (err instanceof Error && err.message === 'GLOBAL_TIMEOUT') {
      return { value: defaultValue, timedOut: true }
    }
    throw err
  }
}

function calcContentQuality(content: string): number {
  if (!content || content.length < 50) return 0
  let score = 0

  // Longueur
  if (content.length > 2000) score += 30
  else if (content.length > 500) score += 20
  else if (content.length > 100) score += 10

  // Ratio arabe
  const ar = calculateArabicRatio(content)
  if (ar > 0.5) score += 30
  else if (ar > 0.2) score += 20
  else if (ar > 0.05) score += 10

  // Diversité (au moins 5 lignes)
  const lines = content.split('\n').filter(l => l.trim().length > 20)
  if (lines.length >= 10) score += 20
  else if (lines.length >= 5) score += 15
  else if (lines.length >= 2) score += 5

  // Pas de contenu erreur
  const errorPatterns = /404|not found|access denied|forbidden/i
  if (!errorPatterns.test(content)) score += 20

  return Math.min(100, score)
}

// ============================================================================
// PHASE 1 : CONNECTIVITÉ
// ============================================================================

async function runPhase1(
  sourceUrl: string,
  label: string
): Promise<Phase1Result> {
  console.log(`\n  [Phase 1] Connectivité ${label}...`)

  const result: Phase1Result = {
    success: false,
    latencyMs: 0,
    sslError: false,
    sslFixed: false,
    detectedFramework: 'Inconnu',
    hasSitemap: false,
    robotsTxtOk: false,
    banDetected: false,
    issues: [],
    recommendations: [],
  }

  // Test initial sans ignoreSSL
  const t0 = Date.now()
  const r1 = await fetchHtml(sourceUrl, {
    timeout: 15_000,
    stealthMode: false,
    respectRobotsTxt: false,
  })
  result.latencyMs = Date.now() - t0

  if (!r1.success && (r1.error?.includes('SSL') || r1.error?.includes('certificate') || r1.error?.includes('cert'))) {
    result.sslError = true
    result.issues.push('Certificat SSL invalide')

    // Retry avec ignoreSSL
    console.log(`    → SSL error, retry avec ignoreSSLErrors=true`)
    const t1 = Date.now()
    const r2 = await fetchHtml(sourceUrl, {
      timeout: 15_000,
      stealthMode: false,
      ignoreSSLErrors: true,
      respectRobotsTxt: false,
    })
    result.latencyMs = Date.now() - t1

    if (r2.success) {
      result.sslFixed = true
      result.success = true
      result.statusCode = r2.statusCode
      result.recommendations.push('Utiliser `ignoreSSLErrors: true` pour ce site')

      if (r2.html) {
        result.serverHeader = ''
        result.detectedFramework = detectFrameworkFromHtml(r2.html)
        const ban = detectBan(r2.html, r2.statusCode, r2.finalUrl)
        if (ban.isBanned) {
          result.banDetected = true
          result.banReason = ban.reason
          result.issues.push(`Ban détecté: ${ban.reason}`)
        }
      }
    } else {
      result.issues.push(`Connexion impossible même avec ignoreSSL: ${r2.error}`)
    }
  } else if (r1.success) {
    result.success = true
    result.statusCode = r1.statusCode

    if (r1.html) {
      result.detectedFramework = detectFrameworkFromHtml(r1.html)
      const ban = detectBan(r1.html, r1.statusCode, r1.finalUrl)
      if (ban.isBanned) {
        result.banDetected = true
        result.banReason = ban.reason
        result.issues.push(`Ban détecté: ${ban.reason}`)
        result.recommendations.push('Utiliser `stealthMode: true`')
      }
    }
  } else {
    result.issues.push(`Connexion échouée: ${r1.error || 'erreur inconnue'}`)
  }

  // Diagnostics de latence
  if (result.latencyMs > 5000) {
    result.issues.push(`Latence élevée: ${result.latencyMs}ms`)
    result.recommendations.push('Augmenter les timeouts (>30s)')
  } else if (result.latencyMs > 3000) {
    result.recommendations.push('Latence modérée, considérer timeout 30s')
  }

  // Ban → stealth
  if (result.banDetected && !result.recommendations.some(r => r.includes('stealth'))) {
    result.recommendations.push('Utiliser `stealthMode: true` pour éviter les bans')
  }

  // Test robots.txt
  try {
    const robotsUrl = new URL('/robots.txt', sourceUrl).href
    const robotsRes = await fetchHtml(robotsUrl, { timeout: 8_000, respectRobotsTxt: false })
    result.robotsTxtOk = robotsRes.success && !!robotsRes.html && robotsRes.html.includes('User-agent')
  } catch {
    // ignore
  }

  // Test sitemap — résultat mis en cache dans phase1 pour éviter le double parsing en phase2
  try {
    const sitemapResult = await detectAndParseSitemap(sourceUrl)
    result.hasSitemap = sitemapResult.hasSitemap
    result.sitemapUrl = sitemapResult.sitemapUrls[0]
    result.sitemapPageUrls = sitemapResult.pageUrls
  } catch {
    // ignore
  }

  console.log(`    → Latence: ${result.latencyMs}ms | Framework: ${result.detectedFramework} | Sitemap: ${result.hasSitemap}`)
  return result
}

// ============================================================================
// PHASE 2 : CRAWL LÉGER
// ============================================================================

async function runPhase2Cassation(
  config: typeof SOURCES_CONFIG.cassation
): Promise<Phase2Result> {
  const result: Phase2Result = {
    pagesTried: 0,
    pagesSucceeded: 0,
    successRate: 0,
    avgContentLength: 0,
    avgArabicRatio: 0,
    avgContentQuality: 0,
    pagesPerSecond: 0,
    totalPdfUrlsFound: 0,
    issues: [],
    pages: [],
  }

  console.log(`    → Flow CSRF TYPO3 cassation.tn`)
  const JURISPRUDENCE_URL = 'http://www.cassation.tn/fr/%D9%81%D9%82%D9%87-%D8%A7%D9%84%D9%82%D8%B6%D8%A7%D8%A1/'
  const csrfResult = await extractCsrfTokens(JURISPRUDENCE_URL, { ignoreSSLErrors: true })

  if (!csrfResult) {
    console.log(`    → CSRF échoué, fallback crawl statique`)
    result.issues.push('csrf_failed')

    // Fallback : crawl statique des pages principales
    const staticPages = [
      'http://www.cassation.tn/fr/',
      'http://www.cassation.tn/ar/',
    ]

    const t0 = Date.now()
    for (const url of staticPages.slice(0, config.phase2.maxPages)) {
      await sleep(config.phase2.rateLimitMs)
      result.pagesTried++

      const tPage = Date.now()
      const r = await fetchHtml(url, {
        ...config.phase2.fetchOptions,
        respectRobotsTxt: false,
      })

      const page: PageResult = {
        url,
        success: r.success,
        statusCode: r.statusCode,
        latencyMs: Date.now() - tPage,
        contentLength: 0,
        arabicRatio: 0,
        contentQuality: 0,
        pdfUrlsFound: 0,
      }

      if (r.success && r.html) {
        const extracted = extractContent(r.html, url)
        page.contentLength = extracted.content.length
        page.arabicRatio = calculateArabicRatio(extracted.content)
        page.contentQuality = calcContentQuality(extracted.content)
        page.pdfUrlsFound = extractPdfUrls(r.html, url, config.phase3.pdfPatterns, config.phase3.filterSameDomain).length
        result.totalPdfUrlsFound += page.pdfUrlsFound
        result.pagesSucceeded++
      } else {
        page.issue = r.error || 'erreur inconnue'
        const ban = detectBan(r.html || '', r.statusCode, r.finalUrl)
        if (ban.isBanned && !result.issues.includes('ban')) {
          result.issues.push('ban')
        }
      }

      result.pages.push(page)
    }

    const elapsed = (Date.now() - t0) / 1000
    result.pagesPerSecond = result.pagesSucceeded / Math.max(elapsed, 0.1)
  } else {
    console.log(`    → CSRF réussi, itération sur ${Math.min(3, config.phase2.maxPages)} thèmes`)
    const { tokens, sessionCookies } = csrfResult
    if (sessionCookies) {
      console.log(`    → Cookies session: ${sessionCookies.substring(0, 60)}…`)
    } else {
      console.log(`    → Aucun cookie session reçu (site peut rejeter le POST)`)
    }
    const themeKeys = Object.keys(CASSATION_THEMES).slice(0, 3)

    const t0 = Date.now()
    for (const theme of themeKeys) {
      await sleep(config.phase2.rateLimitMs)
      result.pagesTried++

      const body = buildSearchPostBody(tokens, { theme })
      const tPage = Date.now()

      // Inclure les cookies de session + Referer pour éviter le 403 TYPO3
      const postHeaders: Record<string, string> = {
        'Referer': 'http://www.cassation.tn/fr/%D9%81%D9%82%D9%87-%D8%A7%D9%84%D9%82%D8%B6%D8%A7%D8%A1/',
        'Origin': 'http://www.cassation.tn',
      }
      if (sessionCookies) postHeaders['Cookie'] = sessionCookies

      const r = await fetchHtml(tokens.formAction, {
        method: 'POST',
        body,
        ...config.phase2.fetchOptions,
        headers: postHeaders,
        respectRobotsTxt: false,
      })

      const themeLabel = CASSATION_THEMES[theme]?.fr || theme
      const page: PageResult = {
        url: `${tokens.formAction}?theme=${theme}`,
        success: r.success,
        statusCode: r.statusCode,
        latencyMs: Date.now() - tPage,
        contentLength: 0,
        arabicRatio: 0,
        contentQuality: 0,
        pdfUrlsFound: 0,
      }

      if (r.success && r.html) {
        const extracted = extractContent(r.html, tokens.formAction)
        page.contentLength = extracted.content.length
        page.arabicRatio = calculateArabicRatio(extracted.content)
        page.contentQuality = calcContentQuality(extracted.content)
        page.pdfUrlsFound = extractPdfUrls(r.html, config.url, config.phase3.pdfPatterns, config.phase3.filterSameDomain).length
        result.totalPdfUrlsFound += page.pdfUrlsFound
        result.pagesSucceeded++

        // Vérifier TYPO3 error
        if (r.html.includes('TYPO3 CMS') && extracted.content.length < 100) {
          page.issue = 'TYPO3_ERROR'
          result.issues.push('typo3_error')
          page.success = false
          result.pagesSucceeded--
        }
      } else {
        page.issue = r.error || 'erreur inconnue'
      }

      console.log(`      · Thème ${themeLabel}: ${page.success ? '✓' : '✗'} (${page.contentLength} chars, ${page.latencyMs}ms)`)
      result.pages.push(page)
    }

    // Pages additionnelles via BFS si on n'a pas atteint maxPages
    if (result.pagesTried < config.phase2.maxPages && csrfResult.html) {
      const internalLinks = extractInternalLinks(csrfResult.html, config.url, config.phase2.maxPages - result.pagesTried)
      for (const url of internalLinks) {
        if (result.pagesTried >= config.phase2.maxPages) break
        await sleep(config.phase2.rateLimitMs)
        result.pagesTried++

        const tPage = Date.now()
        const r = await fetchHtml(url, {
          ...config.phase2.fetchOptions,
          respectRobotsTxt: false,
        })

        const page: PageResult = {
          url,
          success: r.success,
          statusCode: r.statusCode,
          latencyMs: Date.now() - tPage,
          contentLength: 0,
          arabicRatio: 0,
          contentQuality: 0,
          pdfUrlsFound: 0,
        }

        if (r.success && r.html) {
          const extracted = extractContent(r.html, url)
          page.contentLength = extracted.content.length
          page.arabicRatio = calculateArabicRatio(extracted.content)
          page.contentQuality = calcContentQuality(extracted.content)
          page.pdfUrlsFound = extractPdfUrls(r.html, config.url, config.phase3.pdfPatterns, config.phase3.filterSameDomain).length
          result.totalPdfUrlsFound += page.pdfUrlsFound
          result.pagesSucceeded++
        } else {
          page.issue = r.error || 'erreur inconnue'
        }

        result.pages.push(page)
      }
    }

    const elapsed = (Date.now() - t0) / 1000
    result.pagesPerSecond = result.pagesSucceeded / Math.max(elapsed, 0.1)
  }

  computePhase2Averages(result)
  return result
}

async function runPhase2SitemapBased(
  config: typeof SOURCES_CONFIG.da5ira | typeof SOURCES_CONFIG.jibaya,
  phase1: Phase1Result
): Promise<Phase2Result> {
  const result: Phase2Result = {
    pagesTried: 0,
    pagesSucceeded: 0,
    successRate: 0,
    avgContentLength: 0,
    avgArabicRatio: 0,
    avgContentQuality: 0,
    pagesPerSecond: 0,
    totalPdfUrlsFound: 0,
    issues: [],
    pages: [],
  }

  // Récupérer les URLs sources — réutiliser le cache de phase1 pour éviter le double parsing
  let urlsToProcess: string[] = []

  if (phase1.hasSitemap) {
    if (phase1.sitemapPageUrls && phase1.sitemapPageUrls.length > 0) {
      // Cache phase1 disponible → pas de re-parse
      urlsToProcess = phase1.sitemapPageUrls.slice(0, config.phase2.maxPages)
      console.log(`    → ${urlsToProcess.length} URLs depuis cache sitemap (phase 1)`)
    } else {
      console.log(`    → Sitemap détecté, récupération des URLs`)
      try {
        const sitemapResult = await detectAndParseSitemap(config.url)
        urlsToProcess = sitemapResult.pageUrls.slice(0, config.phase2.maxPages)
        console.log(`    → ${urlsToProcess.length} URLs depuis sitemap`)
      } catch {
        console.log(`    → Erreur sitemap, fallback homepage`)
      }
    }
  }

  if (urlsToProcess.length === 0) {
    // BFS depuis homepage
    console.log(`    → BFS depuis homepage`)
    const r = await fetchHtml(config.url, {
      ...config.phase2.fetchOptions,
      respectRobotsTxt: false,
    })
    if (r.success && r.html) {
      urlsToProcess = extractInternalLinks(r.html, config.url, config.phase2.maxPages)
    }
  }

  if (urlsToProcess.length === 0) {
    urlsToProcess = [config.url]
  }

  const t0 = Date.now()
  for (const url of urlsToProcess.slice(0, config.phase2.maxPages)) {
    await sleep(config.phase2.rateLimitMs)
    result.pagesTried++

    const tPage = Date.now()
    const r = await fetchHtml(url, {
      ...config.phase2.fetchOptions,
      respectRobotsTxt: false,
    })

    const page: PageResult = {
      url,
      success: r.success,
      statusCode: r.statusCode,
      latencyMs: Date.now() - tPage,
      contentLength: 0,
      arabicRatio: 0,
      contentQuality: 0,
      pdfUrlsFound: 0,
    }

    if (r.success && r.html) {
      const extracted = extractContent(r.html, url)
      page.contentLength = extracted.content.length
      page.arabicRatio = calculateArabicRatio(extracted.content)
      page.contentQuality = calcContentQuality(extracted.content)
      page.pdfUrlsFound = extractPdfUrls(r.html, url, config.phase3.pdfPatterns, config.phase3.filterSameDomain).length
      result.totalPdfUrlsFound += page.pdfUrlsFound
      result.pagesSucceeded++

      const ban = detectBan(r.html, r.statusCode, r.finalUrl)
      if (ban.isBanned && !result.issues.includes('ban')) {
        result.issues.push('ban')
        page.issue = `Ban: ${ban.reason}`
      }

      if (page.contentLength < 50 && !result.issues.includes('empty_content')) {
        result.issues.push('empty_content')
        page.issue = 'Contenu vide ou quasi-vide'
      }
    } else {
      page.issue = r.error || 'erreur inconnue'
      if (r.error?.includes('timeout') && !result.issues.includes('timeout')) {
        result.issues.push('timeout')
      }
    }

    console.log(`      · ${url.substring(0, 60)}: ${page.success ? '✓' : '✗'} (${page.contentLength} chars)`)
    result.pages.push(page)
  }

  const elapsed = (Date.now() - t0) / 1000
  result.pagesPerSecond = result.pagesSucceeded / Math.max(elapsed, 0.1)

  computePhase2Averages(result)
  return result
}

function computePhase2Averages(result: Phase2Result) {
  const succeeded = result.pages.filter(p => p.success)
  result.successRate = result.pagesTried > 0 ? result.pagesSucceeded / result.pagesTried : 0
  result.avgContentLength = succeeded.length > 0
    ? succeeded.reduce((s, p) => s + p.contentLength, 0) / succeeded.length
    : 0
  result.avgArabicRatio = succeeded.length > 0
    ? succeeded.reduce((s, p) => s + p.arabicRatio, 0) / succeeded.length
    : 0
  result.avgContentQuality = succeeded.length > 0
    ? succeeded.reduce((s, p) => s + p.contentQuality, 0) / succeeded.length
    : 0
}

// ============================================================================
// PHASE 3 : TEST PDF
// ============================================================================

async function runPhase3(
  sourceUrl: string,
  phase2Result: Phase2Result,
  config: { maxPdfs: number; maxPdfSizeBytes?: number; filterSameDomain?: boolean; pdfPatterns: RegExp[] }
): Promise<Phase3Result> {
  const result: Phase3Result = {
    pdfsTested: 0,
    pdfsSuccess: 0,
    avgSizeKb: 0,
    avgDownloadMs: 0,
    avgCharsExtracted: 0,
    ocrUsedCount: 0,
    avgArabicRatio: 0,
    pdfs: [],
  }

  const maxSize = config.maxPdfSizeBytes ?? 20 * 1024 * 1024 // 20 MB par défaut
  const isCassation = sourceUrl.includes('cassation')
  const allPdfUrls = new Set<string>()

  // Candidats : pages qui avaient déjà des PDFs détectés lors du crawl
  const pagesWithPdfs = phase2Result.pages.filter(p => p.success && p.pdfUrlsFound > 0).slice(0, 3)

  // Toujours tenter la homepage de la source en premier (source primaire de PDFs)
  // Utile pour cassation.tn dont les PDFs sont sur la homepage, pas dans les résultats TYPO3
  const homepagesToTry = [sourceUrl, `${sourceUrl}/fr/`, `${sourceUrl}/ar/`]
    .filter((u, i, arr) => arr.indexOf(u) === i) // déduplique

  const pagesToFetch = [
    ...homepagesToTry.map(url => ({ url })),
    ...pagesWithPdfs,
    // Fallback : 2 premières pages réussies si toujours rien
    ...phase2Result.pages.filter(p => p.success).slice(0, 2),
  ]

  for (const page of pagesToFetch) {
    if (allPdfUrls.size >= config.maxPdfs) break

    const r = await fetchHtml(page.url, {
      timeout: 20_000,
      ignoreSSLErrors: isCassation,
      stealthMode: isCassation,
      respectRobotsTxt: false,
    })

    if (r.success && r.html) {
      const pdfs = extractPdfUrls(r.html, sourceUrl, config.pdfPatterns, config.filterSameDomain)
      pdfs.forEach(u => allPdfUrls.add(u))
    }
  }

  const pdfUrls = Array.from(allPdfUrls).slice(0, config.maxPdfs)
  console.log(`    → ${pdfUrls.length} PDF(s) à tester (max taille: ${Math.round(maxSize / 1024)}KB)`)

  for (const pdfUrl of pdfUrls) {
    result.pdfsTested++
    console.log(`      · Téléchargement: ${pdfUrl.substring(0, 70)}`)

    const tDl = Date.now()
    const dlResult = await downloadFile(pdfUrl, {
      timeout: 60_000,
      maxSize,
    })
    const downloadMs = Date.now() - tDl

    const pdf: PdfResult = {
      url: pdfUrl,
      success: false,
      sizekb: 0,
      downloadMs,
      charsExtracted: 0,
      pageCount: 0,
      ocrUsed: false,
      arabicRatio: 0,
    }

    if (!dlResult.success || !dlResult.buffer) {
      pdf.issue = dlResult.error || 'Téléchargement échoué'
      console.log(`        ✗ Erreur: ${pdf.issue}`)
    } else {
      pdf.sizekb = Math.round(dlResult.buffer.length / 1024)
      console.log(`        Taille: ${pdf.sizekb}KB, parsing...`)

      const parseResult = await parseFile(dlResult.buffer, 'pdf')

      if (parseResult.success) {
        pdf.success = true
        pdf.charsExtracted = parseResult.text.length
        pdf.pageCount = parseResult.metadata.pageCount || 0
        pdf.ocrUsed = parseResult.metadata.ocrApplied || false
        pdf.arabicRatio = calculateArabicRatio(parseResult.text)
        result.pdfsSuccess++

        if (pdf.ocrUsed) result.ocrUsedCount++
        console.log(`        ✓ ${pdf.charsExtracted} chars, ${pdf.pageCount} pages, OCR: ${pdf.ocrUsed}`)
      } else {
        pdf.issue = parseResult.error || 'Parsing échoué'
        console.log(`        ✗ Parse error: ${pdf.issue}`)
      }
    }

    result.pdfs.push(pdf)
  }

  // Moyennes
  const succeeded = result.pdfs.filter(p => p.success)
  if (succeeded.length > 0) {
    result.avgSizeKb = succeeded.reduce((s, p) => s + p.sizekb, 0) / succeeded.length
    result.avgDownloadMs = succeeded.reduce((s, p) => s + p.downloadMs, 0) / succeeded.length
    result.avgCharsExtracted = succeeded.reduce((s, p) => s + p.charsExtracted, 0) / succeeded.length
    result.avgArabicRatio = succeeded.reduce((s, p) => s + p.arabicRatio, 0) / succeeded.length
  }

  return result
}

// ============================================================================
// SCORE GLOBAL
// ============================================================================

function calculateScore(p1: Phase1Result, p2: Phase2Result, p3: Phase3Result): number {
  let score = 0

  // Connectivité (20 pts)
  if (p1.success) {
    score += 10
    if (p1.latencyMs < 1000) score += 5
    else if (p1.latencyMs < 3000) score += 3
    if (!p1.sslError) score += 3
    if (!p1.banDetected) score += 2
  }

  // Taux succès crawl (20 pts)
  score += Math.round(p2.successRate * 20)

  // Qualité contenu (15 pts)
  score += Math.round(p2.avgContentQuality * 0.15)

  // Vitesse (10 pts)
  if (p2.pagesPerSecond > 0.5) score += 10
  else if (p2.pagesPerSecond > 0.2) score += 6
  else if (p2.pagesPerSecond > 0) score += 3

  // PDFs découverts (5 pts)
  if (p2.totalPdfUrlsFound >= 3) score += 5
  else if (p2.totalPdfUrlsFound >= 1) score += 3

  // Extraction PDF (12 pts)
  if (p3.pdfsSuccess > 0) {
    score += 6
    if (p3.avgCharsExtracted > 1000) score += 6
    else if (p3.avgCharsExtracted > 100) score += 3
  }

  // Ratio arabe PDF (4 pts)
  if (p3.avgArabicRatio > 0.4) score += 4
  else if (p3.avgArabicRatio > 0.2) score += 2

  // Bonus arabe global (10 pts)
  score += Math.round(p2.avgArabicRatio * 10)
  score += Math.round(p3.avgArabicRatio * 4)

  return Math.min(100, Math.max(0, score))
}

function getGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

// ============================================================================
// BENCHMARK PAR SOURCE
// ============================================================================

async function benchmarkSource(key: keyof typeof SOURCES_CONFIG): Promise<SourceResult> {
  const config = SOURCES_CONFIG[key]
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Benchmark: ${config.label}`)
  console.log('='.repeat(60))

  const tGlobal = Date.now()

  // Default phase results
  const defaultPhase1: Phase1Result = {
    success: false, latencyMs: 0, sslError: false, sslFixed: false,
    detectedFramework: 'Inconnu', hasSitemap: false, robotsTxtOk: false,
    banDetected: false, issues: ['Timeout global'], recommendations: [],
  }
  const defaultPhase2: Phase2Result = {
    pagesTried: 0, pagesSucceeded: 0, successRate: 0, avgContentLength: 0,
    avgArabicRatio: 0, avgContentQuality: 0, pagesPerSecond: 0,
    totalPdfUrlsFound: 0, issues: [], pages: [],
  }
  const defaultPhase3: Phase3Result = {
    pdfsTested: 0, pdfsSuccess: 0, avgSizeKb: 0, avgDownloadMs: 0,
    avgCharsExtracted: 0, ocrUsedCount: 0, avgArabicRatio: 0, pdfs: [],
  }

  let phase1 = defaultPhase1
  let phase2 = defaultPhase2
  let phase3 = defaultPhase3
  let timedOut = false

  try {
    // Phase 1
    const { value: p1, timedOut: to1 } = await withGlobalTimeout(
      runPhase1(config.url, config.label),
      30_000,
      defaultPhase1
    )
    if (to1) { timedOut = true }
    else { phase1 = p1 }

    if (!timedOut) {
      // Phase 2
      console.log(`\n  [Phase 2] Crawl léger (max ${config.phase2.maxPages} pages)...`)
      const remainingMs = config.globalTimeoutMs - (Date.now() - tGlobal) - 30_000 // réserver 30s pour phase3

      let p2Promise: Promise<Phase2Result>
      if (key === 'cassation') {
        p2Promise = runPhase2Cassation(config as typeof SOURCES_CONFIG.cassation)
      } else {
        p2Promise = runPhase2SitemapBased(
          config as typeof SOURCES_CONFIG.da5ira | typeof SOURCES_CONFIG.jibaya,
          phase1
        )
      }

      const { value: p2, timedOut: to2 } = await withGlobalTimeout(p2Promise, Math.max(remainingMs, 20_000), defaultPhase2)
      if (to2) { timedOut = true }
      else { phase2 = p2 }

      console.log(`    → ${phase2.pagesSucceeded}/${phase2.pagesTried} pages OK | ${(phase2.avgArabicRatio * 100).toFixed(1)}% arabe | ${phase2.pagesPerSecond.toFixed(2)} p/s`)
    }

    if (!timedOut) {
      // Phase 3
      console.log(`\n  [Phase 3] Test PDF (max ${config.phase3.maxPdfs})...`)
      const remainingMs = config.globalTimeoutMs - (Date.now() - tGlobal)

      const { value: p3, timedOut: to3 } = await withGlobalTimeout(
        runPhase3(config.url, phase2, config.phase3),
        Math.max(remainingMs, 15_000),
        defaultPhase3
      )
      if (to3) { timedOut = true }
      else { phase3 = p3 }
    }
  } catch (err) {
    console.error(`  ✗ Erreur inattendue: ${err}`)
  }

  const durationMs = Date.now() - tGlobal
  const score = calculateScore(phase1, phase2, phase3)
  const grade = getGrade(score)

  console.log(`\n  Score: ${score}/100 (Grade: ${grade}) | Durée: ${(durationMs / 1000).toFixed(1)}s`)

  return {
    name: config.label,
    url: config.url,
    globalTimeoutMs: config.globalTimeoutMs,
    durationMs,
    timedOut,
    phase1,
    phase2,
    phase3,
    score,
    grade,
  }
}

// ============================================================================
// GÉNÉRATION DU RAPPORT
// ============================================================================

function generateReport(results: SourceResult[]): string {
  const date = new Date().toISOString().split('T')[0]
  const lines: string[] = []

  lines.push(`# Benchmark Crawl Sources - Rapport Comparatif`)
  lines.push(``)
  lines.push(`**Date** : ${new Date().toLocaleString('fr-FR')}  `)
  lines.push(`**Sources testées** : ${results.map(r => r.name).join(', ')}`)
  lines.push(``)

  // ---- Section 1 : Résumé Comparatif ----
  lines.push(`## 1. Résumé Comparatif Global`)
  lines.push(``)
  lines.push(`| Source | Score | Grade | Latence (ms) | Succès | Arabe | PDFs | Timeout |`)
  lines.push(`|--------|-------|-------|-------------|--------|-------|------|---------|`)

  for (const r of results) {
    const latence = r.phase1.latencyMs > 0 ? `${r.phase1.latencyMs}ms` : 'N/A'
    const succès = r.phase2.pagesTried > 0
      ? `${r.phase2.pagesSucceeded}/${r.phase2.pagesTried} (${(r.phase2.successRate * 100).toFixed(0)}%)`
      : 'N/A'
    const arabe = `${(r.phase2.avgArabicRatio * 100).toFixed(1)}%`
    const pdfs = `${r.phase3.pdfsTested} testés / ${r.phase3.pdfsSuccess} OK`
    const timeout = r.timedOut ? '⚠️ Oui' : '✅ Non'

    lines.push(`| ${r.name} | **${r.score}** | **${r.grade}** | ${latence} | ${succès} | ${arabe} | ${pdfs} | ${timeout} |`)
  }

  lines.push(``)

  // ---- Section 2 : Détail par source ----
  lines.push(`## 2. Détail par Source`)
  lines.push(``)

  for (const r of results) {
    lines.push(`---`)
    lines.push(``)
    lines.push(`### ${r.name}`)
    lines.push(``)
    lines.push(`**URL** : \`${r.url}\`  `)
    lines.push(`**Score** : ${r.score}/100 — Grade **${r.grade}**  `)
    lines.push(`**Durée totale** : ${(r.durationMs / 1000).toFixed(1)}s ${r.timedOut ? '⚠️ (timeout global atteint)' : ''}`)
    lines.push(``)

    // Phase 1
    lines.push(`#### Phase 1 — Connectivité`)
    lines.push(``)
    lines.push(`| Métrique | Valeur |`)
    lines.push(`|----------|--------|`)
    lines.push(`| Connexion | ${r.phase1.success ? '✅ OK' : '❌ Échoué'} |`)
    lines.push(`| Latence | ${r.phase1.latencyMs}ms |`)
    lines.push(`| Status HTTP | ${r.phase1.statusCode ?? 'N/A'} |`)
    lines.push(`| SSL invalide | ${r.phase1.sslError ? '⚠️ Oui' : 'Non'} |`)
    lines.push(`| SSL corrigé | ${r.phase1.sslFixed ? '✅ ignoreSSL=true' : 'N/A'} |`)
    lines.push(`| Framework détecté | ${r.phase1.detectedFramework} |`)
    lines.push(`| Sitemap présent | ${r.phase1.hasSitemap ? `✅ Oui (${r.phase1.sitemapUrl || ''})` : 'Non'} |`)
    lines.push(`| robots.txt | ${r.phase1.robotsTxtOk ? '✅ Présent' : '⚠️ Absent ou inaccessible'} |`)
    lines.push(`| Ban détecté | ${r.phase1.banDetected ? `⚠️ Oui — ${r.phase1.banReason}` : 'Non'} |`)
    lines.push(``)

    // Phase 2
    lines.push(`#### Phase 2 — Crawl Léger`)
    lines.push(``)
    lines.push(`| Métrique | Valeur |`)
    lines.push(`|----------|--------|`)
    lines.push(`| Pages tentées | ${r.phase2.pagesTried} |`)
    lines.push(`| Pages réussies | ${r.phase2.pagesSucceeded} |`)
    lines.push(`| Taux de succès | ${(r.phase2.successRate * 100).toFixed(1)}% |`)
    lines.push(`| Contenu moyen | ${Math.round(r.phase2.avgContentLength)} chars |`)
    lines.push(`| Ratio arabe moyen | ${(r.phase2.avgArabicRatio * 100).toFixed(1)}% |`)
    lines.push(`| Score qualité moyen | ${r.phase2.avgContentQuality.toFixed(1)}/100 |`)
    lines.push(`| Vitesse | ${r.phase2.pagesPerSecond.toFixed(2)} pages/s |`)
    lines.push(`| PDFs détectés | ${r.phase2.totalPdfUrlsFound} |`)
    lines.push(``)

    if (r.phase2.issues.length > 0) {
      lines.push(`**Issues détectées** : ${r.phase2.issues.join(', ')}`)
      lines.push(``)
    }

    if (r.phase2.pages.length > 0) {
      lines.push(`<details>`)
      lines.push(`<summary>Détail des pages crawlées (${r.phase2.pages.length})</summary>`)
      lines.push(``)
      lines.push(`| URL | Status | Latence | Chars | Arabe | Qualité | PDFs | Issue |`)
      lines.push(`|-----|--------|---------|-------|-------|---------|------|-------|`)
      for (const p of r.phase2.pages) {
        const url = p.url.length > 50 ? p.url.substring(0, 47) + '...' : p.url
        lines.push(`| ${url} | ${p.success ? '✅' : '❌'} ${p.statusCode ?? ''} | ${p.latencyMs}ms | ${p.contentLength} | ${(p.arabicRatio * 100).toFixed(0)}% | ${p.contentQuality.toFixed(0)} | ${p.pdfUrlsFound} | ${p.issue || '-'} |`)
      }
      lines.push(``)
      lines.push(`</details>`)
      lines.push(``)
    }

    // Phase 3
    lines.push(`#### Phase 3 — Test PDF`)
    lines.push(``)
    lines.push(`| Métrique | Valeur |`)
    lines.push(`|----------|--------|`)
    lines.push(`| PDFs testés | ${r.phase3.pdfsTested} |`)
    lines.push(`| PDFs réussis | ${r.phase3.pdfsSuccess} |`)
    lines.push(`| Taille moyenne | ${r.phase3.avgSizeKb.toFixed(0)} KB |`)
    lines.push(`| Téléchargement moyen | ${r.phase3.avgDownloadMs.toFixed(0)}ms |`)
    lines.push(`| Chars extraits moyens | ${Math.round(r.phase3.avgCharsExtracted)} |`)
    lines.push(`| OCR utilisé | ${r.phase3.ocrUsedCount > 0 ? `⚠️ ${r.phase3.ocrUsedCount} PDF(s) — PDFs scannés détectés` : 'Non'} |`)
    lines.push(`| Ratio arabe moyen | ${(r.phase3.avgArabicRatio * 100).toFixed(1)}% |`)
    lines.push(``)

    if (r.phase3.pdfs.length > 0) {
      for (const pdf of r.phase3.pdfs) {
        lines.push(`**PDF** : \`${pdf.url.substring(0, 80)}\``)
        lines.push(`- Taille : ${pdf.sizekb}KB | Téléchargement : ${pdf.downloadMs}ms`)
        lines.push(`- Extraction : ${pdf.charsExtracted} chars, ${pdf.pageCount} pages`)
        lines.push(`- OCR : ${pdf.ocrUsed ? '⚠️ Oui (PDF scanné)' : 'Non'} | Ratio arabe : ${(pdf.arabicRatio * 100).toFixed(1)}%`)
        if (pdf.issue) lines.push(`- ❌ Issue : ${pdf.issue}`)
        lines.push(``)
      }
    }

    // Problèmes et recommandations
    const allIssues = [
      ...r.phase1.issues,
      ...r.phase2.issues.map(i => ({
        ban: 'Ban détecté lors du crawl',
        timeout: 'Timeouts fréquents',
        csrf_failed: 'Échec CSRF TYPO3',
        typo3_error: 'Erreur TYPO3 (form non fonctionnel)',
        empty_content: 'Contenu vide ou insuffisant extrait',
      }[i] || i)),
      ...r.phase3.pdfs.filter(p => p.issue).map(p => `PDF: ${p.issue}`),
      ...(r.phase3.ocrUsedCount > 0 ? ['PDFs scannés détectés (OCR nécessaire)'] : []),
    ]

    if (allIssues.length > 0) {
      lines.push(`#### Problèmes Détectés`)
      lines.push(``)
      for (const issue of allIssues) {
        lines.push(`- ⚠️ ${issue}`)
      }
      lines.push(``)
    }

    const allRecs = [
      ...r.phase1.recommendations,
      ...(r.phase2.successRate < 0.5 ? ['Vérifier les sélecteurs CSS et la structure du site'] : []),
      ...(r.phase2.avgArabicRatio < 0.1 ? ['Contenu arabe faible — vérifier les pages cibles'] : []),
      ...(r.phase3.ocrUsedCount > 0 ? ['Améliorer le support OCR pour PDFs arabes scannés'] : []),
      ...(r.phase3.pdfsTested === 0 ? ['Aucun PDF trouvé — vérifier les patterns de détection PDF'] : []),
    ]

    if (allRecs.length > 0) {
      lines.push(`#### Recommandations`)
      lines.push(``)
      for (const rec of allRecs) {
        lines.push(`- 💡 ${rec}`)
      }
      lines.push(``)
    }
  }

  // ---- Section 3 : Synthèse ----
  lines.push(`---`)
  lines.push(``)
  lines.push(`## 3. Synthèse et Recommandations Prioritaires`)
  lines.push(``)

  // Classement
  const sorted = [...results].sort((a, b) => b.score - a.score)
  lines.push(`### Classement`)
  lines.push(``)
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]
    lines.push(`${i + 1}. **${r.name}** — Score ${r.score}/100 (${r.grade})`)
  }
  lines.push(``)

  // Actions prioritaires
  lines.push(`### Actions Prioritaires`)
  lines.push(``)

  const allBans = results.filter(r => r.phase1.banDetected || r.phase2.issues.includes('ban'))
  if (allBans.length > 0) {
    lines.push(`**🔴 Anti-ban** : ${allBans.map(r => r.name).join(', ')} détectent des bans → activer \`stealthMode: true\``)
    lines.push(``)
  }

  const sslSites = results.filter(r => r.phase1.sslError)
  if (sslSites.length > 0) {
    lines.push(`**🔴 SSL** : ${sslSites.map(r => r.name).join(', ')} ont des certificats invalides → configurer \`ignoreSSLErrors: true\``)
    lines.push(``)
  }

  const ocrNeeded = results.filter(r => r.phase3.ocrUsedCount > 0)
  if (ocrNeeded.length > 0) {
    lines.push(`**🟡 OCR** : ${ocrNeeded.map(r => r.name).join(', ')} — PDFs scannés détectés → renforcer pipeline OCR`)
    lines.push(``)
  }

  const noPdfs = results.filter(r => r.phase3.pdfsTested === 0 && r.phase2.totalPdfUrlsFound === 0)
  if (noPdfs.length > 0) {
    lines.push(`**🟡 PDFs** : ${noPdfs.map(r => r.name).join(', ')} — aucun PDF détecté → vérifier/ajuster les patterns regex`)
    lines.push(``)
  }

  const slowSites = results.filter(r => r.phase2.pagesPerSecond > 0 && r.phase2.pagesPerSecond < 0.1)
  if (slowSites.length > 0) {
    lines.push(`**🟡 Performance** : ${slowSites.map(r => r.name).join(', ')} — crawl très lent → optimiser rate limits`)
    lines.push(``)
  }

  const unknown = results.filter(r => r.phase1.detectedFramework === 'Inconnu')
  if (unknown.length > 0) {
    lines.push(`**🟢 Framework** : ${unknown.map(r => r.name).join(', ')} — framework non détecté → analyser manuellement et créer profil dédié`)
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(``)
  lines.push(`*Rapport généré par \`scripts/benchmark-crawl-sources.ts\` — ${new Date().toISOString()}*`)

  return lines.join('\n')
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2)
  const sourceIdx = args.indexOf('--source')
  const sourceFilter = sourceIdx !== -1 ? args[sourceIdx + 1]?.toLowerCase() : 'all'

  const availableSources = Object.keys(SOURCES_CONFIG) as Array<keyof typeof SOURCES_CONFIG>
  const sourcesToRun = sourceFilter === 'all' || !sourceFilter
    ? availableSources
    : availableSources.filter(k => k === sourceFilter || SOURCES_CONFIG[k].label.includes(sourceFilter))

  if (sourcesToRun.length === 0) {
    console.error(`❌ Source inconnue: "${sourceFilter}". Valeurs valides: ${availableSources.join(', ')}, all`)
    process.exit(1)
  }

  console.log(`\n${'█'.repeat(60)}`)
  console.log(`  BENCHMARK CRAWL SOURCES — ${new Date().toLocaleString('fr-FR')}`)
  console.log(`  Sources: ${sourcesToRun.map(k => SOURCES_CONFIG[k].label).join(', ')}`)
  console.log(`${'█'.repeat(60)}\n`)

  const results: SourceResult[] = []

  for (const sourceKey of sourcesToRun) {
    try {
      const result = await benchmarkSource(sourceKey)
      results.push(result)
    } catch (err) {
      console.error(`\n❌ Erreur critique sur ${sourceKey}: ${err}`)
    }
  }

  // Générer le rapport
  const report = generateReport(results)

  // Sauvegarder
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportPath = join(process.cwd(), 'tmp', `benchmark-crawl-${date}.md`)

  await mkdir(join(process.cwd(), 'tmp'), { recursive: true })
  await writeFile(reportPath, report, 'utf-8')

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Rapport généré : ${reportPath}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`\nRésumé :`)
  for (const r of results) {
    console.log(`  ${r.name.padEnd(20)} Score: ${String(r.score).padStart(3)}/100  Grade: ${r.grade}`)
  }
  console.log(``)
}

main().catch(err => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
