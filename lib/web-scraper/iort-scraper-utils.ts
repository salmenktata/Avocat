/**
 * Utilitaires scraper IORT (Journal Officiel - iort.gov.tn)
 *
 * Le site IORT utilise un framework WebDev/WinDev CGI avec sessions dynamiques
 * (CTX tokens), navigation POST-only, et aucune API REST.
 * Ce module fournit un scraper Playwright dédié pour naviguer programmatiquement
 * dans les formulaires de recherche et extraire les textes juridiques.
 */

import type { Page, Browser, BrowserContext } from 'playwright'
import { db } from '@/lib/db/postgres'
import { hashUrl, hashContent, countWords, detectTextLanguage } from './content-extractor'

// =============================================================================
// CONSTANTES
// =============================================================================

/** URL de base du site IORT */
export const IORT_BASE_URL = 'http://www.iort.gov.tn'

/** Types de textes disponibles sur IORT */
export const IORT_TEXT_TYPES = {
  law: { ar: 'قانون', fr: 'Loi', value: 'قانون' },
  decree: { ar: 'مرسوم', fr: 'Décret', value: 'مرسوم' },
  order: { ar: 'أمر', fr: 'Ordre/Arrêté', value: 'أمر' },
  decision: { ar: 'قرار', fr: 'Décision', value: 'قرار' },
  notice: { ar: 'رأي', fr: 'Avis', value: 'رأي' },
} as const

export type IortTextType = keyof typeof IORT_TEXT_TYPES

/** Configuration rate limiting */
export const IORT_RATE_CONFIG = {
  /** Délai minimum entre interactions Playwright (ms) */
  minDelay: 5000,
  /** Pause longue toutes les N pages */
  longPauseEvery: 50,
  /** Durée de la pause longue (ms) */
  longPauseMs: 30000,
  /** Pause entre combos année/type (ms) */
  comboPauseMs: 30000,
  /** Nombre de pages avant refresh contexte Playwright */
  refreshEvery: 200,
  /** Timeout navigation Playwright (ms) */
  navigationTimeout: 60000,
  /** Timeout attente sélecteur (ms) */
  selectorTimeout: 30000,
} as const

/** Résultat parsé d'une entrée de recherche */
export interface IortSearchResult {
  /** Titre du texte */
  title: string
  /** Type de texte (قانون, مرسوم, etc.) */
  textType: string
  /** Date du texte (format arabe ou ISO) */
  date: string | null
  /** Numéro JORT */
  issueNumber: string | null
  /** Index dans la liste de résultats (pour navigation) */
  resultIndex: number
}

/** Résultat d'extraction d'une page de détail */
export interface IortExtractedText {
  /** Titre complet */
  title: string
  /** Texte intégral extrait */
  content: string
  /** Date du texte */
  date: string | null
  /** Numéro JORT */
  issueNumber: string | null
  /** Année */
  year: number
  /** Type de texte */
  textType: string
  /** URL du PDF si disponible */
  pdfUrl: string | null
}

/** Stats de crawl pour un combo année/type */
export interface IortCrawlStats {
  year: number
  textType: string
  totalResults: number
  crawled: number
  skipped: number
  errors: number
}

// =============================================================================
// SESSION MANAGER
// =============================================================================

/**
 * Gère la session Playwright pour naviguer sur IORT
 */
export class IortSessionManager {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private pageCount = 0
  private isInitialized = false

  async init(): Promise<void> {
    const { chromium } = await import('playwright')
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    await this.createContext()
    this.isInitialized = true
    console.log('[IORT] Session Playwright initialisée')
  }

  private async createContext(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {})
    }
    this.context = await this.browser!.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'ar-TN',
      extraHTTPHeaders: {
        'Accept-Language': 'ar-TN,ar;q=0.9,fr-TN;q=0.8,fr;q=0.7',
      },
    })
    this.page = await this.context.newPage()
    this.page.setDefaultTimeout(IORT_RATE_CONFIG.navigationTimeout)
    this.pageCount = 0
  }

  getPage(): Page {
    if (!this.page) throw new Error('[IORT] Session non initialisée. Appeler init() d\'abord.')
    return this.page
  }

  /**
   * Incrémente le compteur et refresh le contexte si nécessaire
   */
  async tick(): Promise<void> {
    this.pageCount++
    if (this.pageCount >= IORT_RATE_CONFIG.refreshEvery) {
      console.log(`[IORT] Refresh contexte Playwright après ${this.pageCount} pages`)
      await this.createContext()
      await this.navigateToSearch()
    }
  }

  /**
   * Vérifie si la session est encore valide (tokens WebDev actifs)
   */
  async isSessionValid(): Promise<boolean> {
    try {
      const page = this.getPage()
      const content = await page.content()
      // WebDev utilise WD_ACTION_ dans ses formulaires
      return content.includes('WD_ACTION_') || content.includes('WD_')
    } catch {
      return false
    }
  }

  /**
   * Navigue vers la page d'accueil et atteint le formulaire de recherche
   */
  async navigateToSearch(): Promise<void> {
    const page = this.getPage()

    // 1. Page d'accueil
    console.log('[IORT] Navigation vers la page d\'accueil...')
    await page.goto(IORT_BASE_URL, {
      waitUntil: 'load',
      timeout: IORT_RATE_CONFIG.navigationTimeout,
    })
    await sleep(3000)

    // 2. Chercher et cliquer sur le lien "الرائد الرسمي القوانين و الأوامر" (JORT Lois & Décrets)
    // Le site WebDev utilise des onclick WD_ACTION, donc on cherche le lien par texte
    const jortLink = await page.$('a:has-text("الرائد الرسمي"), a:has-text("القوانين"), td:has-text("الرائد الرسمي") a')
    if (jortLink) {
      await jortLink.click()
      await page.waitForLoadState('load')
      await sleep(3000)
    } else {
      // Essayer navigation directe si le lien n'est pas trouvé
      console.log('[IORT] Lien JORT non trouvé sur l\'accueil, tentative de navigation directe...')
    }

    // 3. Chercher le lien "البحث عن النص" (Recherche par texte)
    const searchLink = await page.$('a:has-text("البحث"), a:has-text("بحث"), td:has-text("البحث") a')
    if (searchLink) {
      await searchLink.click()
      await page.waitForLoadState('load')
      await sleep(3000)
    }

    console.log('[IORT] Page de recherche atteinte')
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close().catch(() => {})
    if (this.browser) await this.browser.close().catch(() => {})
    this.isInitialized = false
    console.log('[IORT] Session Playwright fermée')
  }

  get initialized(): boolean {
    return this.isInitialized
  }
}

// =============================================================================
// RECHERCHE
// =============================================================================

/**
 * Effectue une recherche par année et type de texte
 * Retourne le nombre total de résultats
 */
export async function searchByYearAndType(
  page: Page,
  year: number,
  textType: IortTextType,
): Promise<number> {
  const typeConfig = IORT_TEXT_TYPES[textType]

  console.log(`[IORT] Recherche: année=${year}, type=${typeConfig.fr} (${typeConfig.ar})`)

  // Sélectionner l'année dans le dropdown
  // WebDev utilise souvent des select classiques ou des divs custom
  const yearSelect = await page.$('select[name*="annee"], select[name*="year"], select[name*="ANNEE"]')
  if (yearSelect) {
    await yearSelect.selectOption(String(year))
    await sleep(1000)
  } else {
    // Essayer de trouver un input texte pour l'année
    const yearInput = await page.$('input[name*="annee"], input[name*="year"], input[name*="ANNEE"]')
    if (yearInput) {
      await yearInput.fill(String(year))
      await sleep(500)
    }
  }

  // Sélectionner le type de texte
  const typeSelect = await page.$('select[name*="type"], select[name*="nature"], select[name*="TYPE"]')
  if (typeSelect) {
    // Essayer de sélectionner par valeur ou par texte
    try {
      await typeSelect.selectOption({ label: typeConfig.ar })
    } catch {
      try {
        await typeSelect.selectOption({ value: typeConfig.value })
      } catch {
        // Chercher l'option contenant le texte arabe
        const options = await typeSelect.$$('option')
        for (const option of options) {
          const text = await option.textContent()
          if (text && text.includes(typeConfig.ar)) {
            const value = await option.getAttribute('value')
            if (value) {
              await typeSelect.selectOption(value)
              break
            }
          }
        }
      }
    }
    await sleep(1000)
  }

  // Soumettre le formulaire
  const submitBtn = await page.$('input[type="submit"], button[type="submit"], input[name*="BTN"], input[value*="بحث"], a:has-text("بحث")')
  if (submitBtn) {
    await submitBtn.click()
  } else {
    // Fallback : appuyer sur Entrée
    await page.keyboard.press('Enter')
  }

  // Attendre les résultats
  await page.waitForLoadState('load')
  await sleep(3000)

  // Parser le nombre total de résultats
  const totalResults = await parseTotalResults(page)
  console.log(`[IORT] ${totalResults} résultats trouvés pour ${year}/${typeConfig.fr}`)

  return totalResults
}

/**
 * Parse le nombre total de résultats depuis la page
 */
async function parseTotalResults(page: Page): Promise<number> {
  const content = await page.content()

  // Chercher des patterns courants pour le nombre total
  // Pattern arabe : "عدد النتائج : 1234" ou "1234 نتيجة"
  const patterns = [
    /عدد\s*(?:ال)?نتائج\s*[:：]\s*(\d+)/,
    /(\d+)\s*نتيجة/,
    /(\d+)\s*résultat/i,
    /total\s*[:：]\s*(\d+)/i,
    /(\d+)\s*(?:enregistrement|texte)/i,
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      return parseInt(match[1], 10)
    }
  }

  // Fallback : compter les lignes de résultat visibles
  const rows = await page.$$('tr[class*="ligne"], tr[class*="result"], table tr:not(:first-child)')
  return rows.length
}

// =============================================================================
// PARSING RÉSULTATS
// =============================================================================

/**
 * Parse les résultats de recherche de la page courante
 */
export async function parseSearchResults(page: Page): Promise<IortSearchResult[]> {
  const results: IortSearchResult[] = []

  // WebDev affiche les résultats en tableau
  // Chercher les lignes de résultat
  const rows = await page.$$('tr[class*="ligne"], tr[class*="Ligne"], table.result tr, table tr[bgcolor], table tr[class]')

  let index = 0
  for (const row of rows) {
    try {
      const cells = await row.$$('td')
      if (cells.length < 2) continue

      // Extraire le texte de chaque cellule
      const cellTexts: string[] = []
      for (const cell of cells) {
        const text = await cell.textContent()
        cellTexts.push((text || '').trim())
      }

      // Identifier les champs (l'ordre peut varier)
      const title = cellTexts.find(t => t.length > 20) || cellTexts[0] || ''
      if (!title || title.length < 5) continue

      // Chercher la date (format JJ/MM/AAAA ou AAAA-MM-JJ)
      const dateMatch = cellTexts.join(' ').match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/)
      const date = dateMatch ? dateMatch[1] : null

      // Chercher le numéro JORT
      const jortMatch = cellTexts.join(' ').match(/(?:عدد|n°?|numéro)\s*(\d+)/i)
      const issueNumber = jortMatch ? jortMatch[1] : null

      // Type de texte
      const textType = cellTexts.find(t =>
        Object.values(IORT_TEXT_TYPES).some(tt => t.includes(tt.ar))
      ) || ''

      results.push({
        title: title.replace(/\s+/g, ' ').trim(),
        textType,
        date,
        issueNumber,
        resultIndex: index,
      })

      index++
    } catch (err) {
      console.warn(`[IORT] Erreur parsing ligne ${index}:`, err instanceof Error ? err.message : err)
    }
  }

  return results
}

/**
 * Vérifie s'il y a une page suivante et clique dessus
 * Retourne true si navigation réussie
 */
export async function goToNextPage(page: Page): Promise<boolean> {
  // Chercher le bouton/lien "suivant" ou ">"
  const nextBtn = await page.$(
    'a:has-text("التالي"), a:has-text("suivant"), a:has-text(">"), a:has-text(">>"), ' +
    'input[value*="التالي"], input[value*="suivant"], ' +
    'a[title*="suivant"], a[title*="التالي"], ' +
    // WebDev pagination
    'td.pagination a:last-child, .WD_PAGE a:last-child'
  )

  if (!nextBtn) return false

  // Vérifier que le bouton n'est pas désactivé
  const isDisabled = await nextBtn.getAttribute('disabled')
  const className = await nextBtn.getAttribute('class')
  if (isDisabled || (className && className.includes('disabled'))) return false

  try {
    await nextBtn.click()
    await page.waitForLoadState('load')
    await sleep(3000)
    return true
  } catch {
    return false
  }
}

// =============================================================================
// EXTRACTION DÉTAIL
// =============================================================================

/**
 * Navigue vers la page de détail d'un résultat et extrait le texte complet
 */
export async function extractTextDetail(
  page: Page,
  result: IortSearchResult,
  year: number,
  textType: IortTextType,
): Promise<IortExtractedText | null> {
  try {
    // Cliquer sur le lien du résultat
    // WebDev utilise souvent des onclick sur les lignes de tableau
    const rows = await page.$$('tr[class*="ligne"], tr[class*="Ligne"], table.result tr, table tr[bgcolor], table tr[class]')

    let targetRow = rows[result.resultIndex]
    if (!targetRow) {
      // Fallback : chercher par titre
      for (const row of rows) {
        const text = await row.textContent()
        if (text && text.includes(result.title.substring(0, 30))) {
          targetRow = row
          break
        }
      }
    }

    if (!targetRow) {
      console.warn(`[IORT] Ligne résultat #${result.resultIndex} non trouvée`)
      return null
    }

    // Cliquer sur la ligne ou le lien dans la ligne
    const link = await targetRow.$('a, td[onclick], tr[onclick]')
    if (link) {
      await link.click()
    } else {
      await targetRow.click()
    }

    await page.waitForLoadState('load')
    await sleep(3000)

    // Extraire le contenu de la page de détail
    const content = await page.content()
    const cheerio = await import('cheerio')
    const $ = cheerio.load(content)

    // Supprimer les éléments de navigation
    $('script, style, nav, header, footer, .menu, .navigation, [class*="menu"]').remove()

    // Extraire le titre
    let title = $('h1, h2, .titre, .title, td.titre').first().text().trim()
    if (!title) title = result.title

    // Extraire le texte principal
    // WebDev met souvent le contenu dans des tables avec des classes spécifiques
    let textContent = ''
    const contentSelectors = [
      '.contenu', '.content', '.texte', '.text',
      'td.texte', 'td.contenu', 'div.texte',
      'table.detail td', 'table.contenu',
    ]

    for (const selector of contentSelectors) {
      const el = $(selector)
      if (el.length && el.text().trim().length > 100) {
        textContent = el.text().trim()
        break
      }
    }

    // Fallback : prendre le body entier nettoyé
    if (!textContent || textContent.length < 100) {
      textContent = $('body').text().trim()
    }

    // Nettoyer le texte
    textContent = textContent
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (textContent.length < 50) {
      console.warn(`[IORT] Contenu trop court pour "${title}" (${textContent.length} chars)`)
      return null
    }

    // Chercher un lien PDF
    let pdfUrl: string | null = null
    const pdfLink = $('a[href*=".pdf"], a[href*="PDF"], a:has-text("PDF"), a:has-text("تحميل")')
    if (pdfLink.length) {
      const href = pdfLink.first().attr('href')
      if (href) {
        pdfUrl = href.startsWith('http') ? href : `${IORT_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`
      }
    }

    // Extraire le numéro JORT depuis le contenu
    let issueNumber = result.issueNumber
    if (!issueNumber) {
      const jortMatch = textContent.match(/(?:الرائد الرسمي|JORT)\s*(?:عدد|n°?)\s*(\d+)/i)
      if (jortMatch) issueNumber = jortMatch[1]
    }

    // Extraire la date
    let date = result.date
    if (!date) {
      const dateMatch = textContent.match(/(?:المؤرخ في|بتاريخ|en date du)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i)
      if (dateMatch) date = dateMatch[1]
    }

    return {
      title,
      content: textContent,
      date,
      issueNumber,
      year,
      textType: IORT_TEXT_TYPES[textType].ar,
      pdfUrl,
    }
  } catch (err) {
    console.error(`[IORT] Erreur extraction détail "${result.title}":`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Retourne à la page de résultats depuis une page de détail
 */
export async function goBackToResults(page: Page): Promise<void> {
  // Essayer le bouton retour WebDev
  const backBtn = await page.$('a:has-text("رجوع"), a:has-text("العودة"), a:has-text("retour"), input[value*="رجوع"]')
  if (backBtn) {
    await backBtn.click()
    await page.waitForLoadState('load')
    await sleep(2000)
    return
  }

  // Fallback : navigation arrière du navigateur
  await page.goBack({ waitUntil: 'load' })
  await sleep(2000)
}

// =============================================================================
// TÉLÉCHARGEMENT PDF
// =============================================================================

/**
 * Télécharge un PDF JORT via Playwright (gestion des téléchargements WebDev)
 */
export async function downloadJortPdf(
  page: Page,
  pdfUrl: string,
  sourceId: string,
  pageTitle: string,
): Promise<{ minioPath: string; size: number } | null> {
  try {
    const { uploadFile } = await import('@/lib/storage/minio')

    // Télécharger le PDF
    const { downloadFile } = await import('./scraper-service')
    const result = await downloadFile(pdfUrl, { timeout: 120000 })

    if (!result.success || !result.buffer) {
      console.warn(`[IORT] Échec téléchargement PDF: ${result.error}`)
      return null
    }

    // Générer un nom de fichier propre
    const slug = pageTitle
      .replace(/[^\w\u0600-\u06FF\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80)
    const filename = `iort/${sourceId}/${slug}.pdf`

    // Upload vers MinIO
    await uploadFile(result.buffer, filename, { contentType: 'application/pdf' }, 'web-files')

    console.log(`[IORT] PDF uploadé: ${filename} (${Math.round(result.size! / 1024)} KB)`)

    return {
      minioPath: filename,
      size: result.size!,
    }
  } catch (err) {
    console.error(`[IORT] Erreur téléchargement PDF:`, err instanceof Error ? err.message : err)
    return null
  }
}

// =============================================================================
// SAUVEGARDE EN DB
// =============================================================================

/**
 * Génère une URL synthétique stable pour un texte IORT
 * (les URLs WebDev avec CTX expirent)
 */
export function generateIortUrl(
  year: number,
  issueNumber: string | null,
  textType: string,
  title: string,
): string {
  const slug = title
    .replace(/[^\w\u0600-\u06FF\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 100)
  const issue = issueNumber || 'unknown'
  const typeSlug = textType.replace(/\s+/g, '-')
  return `${IORT_BASE_URL}/jort/${year}/${issue}/${typeSlug}/${slug}`
}

/**
 * Sauvegarde un texte IORT dans web_pages
 * Vérifie d'abord si l'URL existe déjà (résumabilité)
 */
export async function saveIortPage(
  sourceId: string,
  extracted: IortExtractedText,
  pdfInfo: { minioPath: string; size: number } | null,
): Promise<{ id: string; skipped: boolean }> {
  const url = generateIortUrl(
    extracted.year,
    extracted.issueNumber,
    extracted.textType,
    extracted.title,
  )
  const urlHash = hashUrl(url)

  // Vérifier si déjà crawlé
  const existing = await db.query(
    'SELECT id FROM web_pages WHERE url_hash = $1',
    [urlHash],
  )

  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, skipped: true }
  }

  const contentHash = hashContent(extracted.content)
  const wordCount = countWords(extracted.content)
  const language = detectTextLanguage(extracted.content)

  const linkedFiles = pdfInfo
    ? JSON.stringify([{
        url: url,
        type: 'pdf',
        filename: pdfInfo.minioPath.split('/').pop(),
        minioPath: pdfInfo.minioPath,
        size: pdfInfo.size,
        contentType: 'application/pdf',
      }])
    : '[]'

  const structuredData = JSON.stringify({
    year: extracted.year,
    textType: extracted.textType,
    issueNumber: extracted.issueNumber,
    date: extracted.date,
    source: 'iort',
  })

  const result = await db.query(
    `INSERT INTO web_pages (
      web_source_id, url, url_hash, canonical_url,
      title, content_hash, extracted_text, word_count, language_detected,
      meta_description, meta_date, structured_data,
      linked_files,
      status, crawl_depth, last_crawled_at, first_seen_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8, $9,
      $10, $11, $12,
      $13,
      'crawled', 0, NOW(), NOW()
    ) RETURNING id`,
    [
      sourceId,
      url,
      urlHash,
      url,
      extracted.title,
      contentHash,
      extracted.content,
      wordCount,
      language,
      `${extracted.textType} - ${extracted.title}`.substring(0, 500),
      extracted.date,
      structuredData,
      linkedFiles,
    ],
  )

  const pageId = result.rows[0]?.id as string

  // Créer la version initiale
  if (pageId) {
    try {
      const { createWebPageVersion } = await import('./source-service')
      await createWebPageVersion(pageId, 'initial_crawl')
    } catch (err) {
      console.error('[IORT] Erreur création version initiale:', err)
    }
  }

  return { id: pageId, skipped: false }
}

/**
 * Met à jour les compteurs de la source IORT
 */
export async function updateIortSourceStats(sourceId: string): Promise<void> {
  await db.query(
    `UPDATE web_sources SET
      total_pages_crawled = (SELECT COUNT(*) FROM web_pages WHERE web_source_id = $1),
      total_pages_indexed = (SELECT COUNT(*) FROM web_pages WHERE web_source_id = $1 AND is_indexed = true),
      last_crawl_at = NOW(),
      updated_at = NOW()
    WHERE id = $1`,
    [sourceId],
  )
}

// =============================================================================
// CRAWL PRINCIPAL
// =============================================================================

/**
 * Crawle tous les textes IORT pour un combo année/type
 */
export async function crawlYearType(
  session: IortSessionManager,
  sourceId: string,
  year: number,
  textType: IortTextType,
  signal?: AbortSignal,
): Promise<IortCrawlStats> {
  const stats: IortCrawlStats = {
    year,
    textType: IORT_TEXT_TYPES[textType].fr,
    totalResults: 0,
    crawled: 0,
    skipped: 0,
    errors: 0,
  }

  const page = session.getPage()

  // Vérifier session et re-naviguer si nécessaire
  const valid = await session.isSessionValid()
  if (!valid) {
    console.log('[IORT] Session expirée, re-navigation...')
    await session.navigateToSearch()
  }

  // Effectuer la recherche
  const totalResults = await searchByYearAndType(page, year, textType)
  stats.totalResults = totalResults

  if (totalResults === 0) {
    console.log(`[IORT] Aucun résultat pour ${year}/${IORT_TEXT_TYPES[textType].fr}`)
    return stats
  }

  // Itérer les pages de résultats
  let hasNextPage = true
  let pageNum = 1

  while (hasNextPage) {
    if (signal?.aborted) {
      console.log('[IORT] Signal d\'arrêt reçu')
      break
    }

    const results = await parseSearchResults(page)
    console.log(`[IORT] Page ${pageNum}: ${results.length} résultats à traiter`)

    for (const result of results) {
      if (signal?.aborted) break

      try {
        // Extraire le détail
        const extracted = await extractTextDetail(page, result, year, textType)
        if (!extracted) {
          stats.errors++
          await goBackToResults(page)
          await sleep(IORT_RATE_CONFIG.minDelay)
          continue
        }

        // Télécharger le PDF si disponible
        let pdfInfo = null
        if (extracted.pdfUrl) {
          pdfInfo = await downloadJortPdf(page, extracted.pdfUrl, sourceId, extracted.title)
        }

        // Sauvegarder
        const { skipped } = await saveIortPage(sourceId, extracted, pdfInfo)

        if (skipped) {
          stats.skipped++
        } else {
          stats.crawled++
        }

        // Retourner aux résultats
        await goBackToResults(page)

        // Rate limiting
        await sleep(IORT_RATE_CONFIG.minDelay)
        await session.tick()

        // Pause longue périodique
        if ((stats.crawled + stats.skipped) % IORT_RATE_CONFIG.longPauseEvery === 0) {
          console.log(`[IORT] Pause longue après ${stats.crawled + stats.skipped} pages...`)
          await sleep(IORT_RATE_CONFIG.longPauseMs)
        }
      } catch (err) {
        stats.errors++
        console.error(`[IORT] Erreur traitement "${result.title}":`, err instanceof Error ? err.message : err)

        // Essayer de revenir aux résultats
        try {
          await goBackToResults(page)
        } catch {
          // Session probablement cassée, re-naviguer
          console.log('[IORT] Re-navigation après erreur...')
          await session.navigateToSearch()
          await searchByYearAndType(page, year, textType)
          // Sauter cette page de résultats
          break
        }

        await sleep(IORT_RATE_CONFIG.minDelay)
      }
    }

    // Page suivante
    hasNextPage = await goToNextPage(page)
    pageNum++
  }

  console.log(
    `[IORT] Terminé ${year}/${IORT_TEXT_TYPES[textType].fr}: ` +
    `${stats.crawled} crawlés, ${stats.skipped} existants, ${stats.errors} erreurs ` +
    `(sur ${stats.totalResults} total)`
  )

  return stats
}

// =============================================================================
// UTILITAIRES
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Récupère ou crée la source IORT en DB
 */
export async function getOrCreateIortSource(): Promise<string> {
  // Chercher par base_url
  const result = await db.query(
    "SELECT id FROM web_sources WHERE base_url ILIKE '%iort%'",
  )

  if (result.rows.length > 0) {
    return result.rows[0].id as string
  }

  // Créer la source
  const { createWebSource } = await import('./source-service')
  const adminResult = await db.query(
    "SELECT id FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1",
  )
  const adminId = adminResult.rows[0]?.id

  const source = await createWebSource(
    {
      name: 'IORT - Journal Officiel de la République Tunisienne',
      baseUrl: IORT_BASE_URL,
      description: 'Site officiel de l\'Imprimerie Officielle (IORT) - Journal Officiel (JORT). 204,775 textes depuis 1956.',
      category: 'jort',
      language: 'ar',
      priority: 9,
      requiresJavascript: true,
      respectRobotsTxt: false,
      downloadFiles: true,
      autoIndexFiles: true,
      rateLimitMs: 5000,
      crawlFrequency: '7 days',
      maxDepth: 3,
      maxPages: 50000,
    },
    adminId,
  )

  console.log(`[IORT] Source créée: ${source.id}`)
  return source.id
}
