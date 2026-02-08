/**
 * Service de parsing des fichiers (PDF, DOCX, etc.)
 * Extrait le texte des documents pour l'indexation RAG
 * Supporte l'OCR pour les PDFs scannés (images) via Tesseract.js
 *
 * IMPORTANT: Tous les imports de modules natifs sont dynamiques
 * pour éviter les erreurs de build Next.js (File is not defined)
 */

// Tous les modules sont chargés dynamiquement pour éviter les erreurs de build
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mammothModule: typeof import('mammoth') | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PDFParseClass: any = null

async function getMammoth(): Promise<typeof import('mammoth')> {
  if (!mammothModule) {
    mammothModule = await import('mammoth')
  }
  return mammothModule
}

async function getPDFParse() {
  if (!PDFParseClass) {
    const mod = await import('pdf-parse')
    PDFParseClass = mod.PDFParse
  }
  return PDFParseClass
}

// =============================================================================
// CONFIGURATION OCR
// =============================================================================

const OCR_CONFIG = {
  // Seuil minimum de caractères pour considérer qu'un PDF a du texte extractible
  MIN_TEXT_THRESHOLD: 50,
  // Seuil minimum de caractères par page (détecte les PDFs avec peu de texte réparti)
  MIN_CHARS_PER_PAGE: 100,
  // Nombre maximum de pages à traiter avec OCR (performance)
  MAX_OCR_PAGES: 20,
  // Langues supportées pour l'OCR (arabe + français)
  LANGUAGES: 'ara+fra',
  // Scale factor pour pdf-to-img (3.0 ≈ 300 DPI, meilleur pour l'arabe)
  SCALE: 3.0,
  // Seuil minimum de confiance OCR (0-100)
  MIN_OCR_CONFIDENCE: 40,
  // Nombre maximum d'utilisations du worker avant recyclage
  MAX_WORKER_USES: 50,
}

// Modules chargés dynamiquement pour éviter les erreurs de build
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tesseractModule: typeof import('tesseract.js') | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfToImgModule: typeof import('pdf-to-img') | null = null

/**
 * Charge Tesseract.js dynamiquement
 */
async function loadTesseract(): Promise<typeof import('tesseract.js')> {
  if (!tesseractModule) {
    tesseractModule = await import('tesseract.js')
  }
  return tesseractModule
}

/**
 * Charge pdf-to-img dynamiquement
 */
async function loadPdfToImg(): Promise<typeof import('pdf-to-img')> {
  if (!pdfToImgModule) {
    pdfToImgModule = await import('pdf-to-img')
  }
  return pdfToImgModule
}

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedFile {
  success: boolean
  text: string
  metadata: {
    title?: string
    author?: string
    creationDate?: Date
    pageCount?: number
    wordCount: number
    ocrApplied?: boolean
    ocrPagesProcessed?: number
    ocrConfidence?: number
  }
  error?: string
}

export type SupportedFileType = 'pdf' | 'docx' | 'doc' | 'txt'

// =============================================================================
// PARSING PDF
// =============================================================================

/**
 * Extrait le texte d'un fichier PDF
 * Utilise OCR si le texte extrait est insuffisant (PDF scanné)
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedFile> {
  try {
    // pdf-parse v2 utilise une classe PDFParse (import dynamique)
    const PDFParse = await getPDFParse()
    const parser = new PDFParse({ data: buffer })

    // Récupérer le texte avec pdf-parse (rapide)
    const textResult = await parser.getText()
    let text = cleanText(textResult.text)
    let wordCount = countWords(text)

    // Récupérer les métadonnées
    const infoResult = await parser.getInfo()
    const info = infoResult.info
    const pageCount = textResult.total || infoResult.total || 0

    // Vérifier si le PDF nécessite l'OCR (texte insuffisant ou trop peu par page)
    const avgCharsPerPage = pageCount > 0 ? text.length / pageCount : text.length
    const needsOcr = text.length < OCR_CONFIG.MIN_TEXT_THRESHOLD
      || (pageCount > 0 && avgCharsPerPage < OCR_CONFIG.MIN_CHARS_PER_PAGE)

    let ocrApplied = false
    let ocrPagesProcessed = 0
    let ocrConfidence: number | undefined

    if (needsOcr) {
      console.log(
        `[FileParser] PDF avec peu de texte (${text.length} chars, ${avgCharsPerPage.toFixed(0)} chars/page), application de l'OCR...`
      )

      try {
        const ocrResult = await extractTextWithOcr(buffer, pageCount)
        if (ocrResult.text.length > text.length) {
          text = ocrResult.text
          wordCount = countWords(text)
          ocrApplied = true
          ocrPagesProcessed = ocrResult.pagesProcessed
          ocrConfidence = ocrResult.avgConfidence
          console.log(
            `[FileParser] OCR terminé: ${ocrPagesProcessed} pages, ${wordCount} mots, confiance: ${ocrConfidence?.toFixed(1)}%`
          )
        }
      } catch (ocrError) {
        console.error('[FileParser] Erreur OCR (fallback au texte original):', ocrError)
      }
    }

    return {
      success: true,
      text,
      metadata: {
        title: info?.Title || undefined,
        author: info?.Author || undefined,
        creationDate: info?.CreationDate
          ? parsePdfDate(info.CreationDate)
          : undefined,
        pageCount,
        wordCount,
        ocrApplied,
        ocrPagesProcessed: ocrApplied ? ocrPagesProcessed : undefined,
        ocrConfidence: ocrApplied ? ocrConfidence : undefined,
      },
    }
  } catch (error) {
    console.error('[FileParser] Erreur parsing PDF:', error)
    return {
      success: false,
      text: '',
      metadata: { wordCount: 0 },
      error: error instanceof Error ? error.message : 'Erreur parsing PDF',
    }
  }
}

// =============================================================================
// OCR POUR PDFS SCANNÉS
// =============================================================================

// =============================================================================
// POOL WORKER TESSERACT (A6)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tesseractWorker: any = null
let workerUseCount = 0

/**
 * Obtient ou crée un worker Tesseract réutilisable
 * Le worker est recyclé après MAX_WORKER_USES utilisations
 */
async function getOrCreateWorker() {
  if (tesseractWorker && workerUseCount < OCR_CONFIG.MAX_WORKER_USES) {
    workerUseCount++
    return tesseractWorker
  }

  // Terminer l'ancien worker si existant
  if (tesseractWorker) {
    try { await tesseractWorker.terminate() } catch { /* ignore */ }
  }

  const Tesseract = await loadTesseract()
  tesseractWorker = await Tesseract.createWorker(OCR_CONFIG.LANGUAGES, 1)
  workerUseCount = 1
  return tesseractWorker
}

/**
 * Termine le worker Tesseract (pour nettoyage en fin de process)
 */
export async function terminateOcrWorker(): Promise<void> {
  if (tesseractWorker) {
    try { await tesseractWorker.terminate() } catch { /* ignore */ }
    tesseractWorker = null
    workerUseCount = 0
  }
}

// =============================================================================
// PRÉTRAITEMENT D'IMAGE (A2)
// =============================================================================

/**
 * Prétraite une image pour améliorer la qualité OCR
 * Optimisé pour le texte arabe (script connecté, ligatures)
 */
async function preprocessImageForOcr(imageBuffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  return sharp(imageBuffer)
    .greyscale()
    .normalize()
    .sharpen({ sigma: 1.5 })
    .threshold(128)
    .png()
    .toBuffer()
}

// =============================================================================
// EXTRACTION OCR (A1, A4, A5)
// =============================================================================

/**
 * Extrait le texte d'un PDF scanné en utilisant l'OCR
 * Utilise pdf-to-img pour convertir en images + sharp pour prétraitement + Tesseract pour l'OCR
 */
async function extractTextWithOcr(
  buffer: Buffer,
  totalPages: number
): Promise<{ text: string; pagesProcessed: number; avgConfidence: number }> {
  const pagesToProcess = Math.min(totalPages || OCR_CONFIG.MAX_OCR_PAGES, OCR_CONFIG.MAX_OCR_PAGES)
  const textParts: string[] = []
  const confidences: number[] = []

  console.log(`[FileParser] OCR: traitement de ${pagesToProcess} pages (max: ${OCR_CONFIG.MAX_OCR_PAGES})`)

  const { cleanArabicOcrText } = await import('./arabic-text-utils')
  const { pdf } = await loadPdfToImg()

  // Obtenir le worker Tesseract (réutilisable)
  const worker = await getOrCreateWorker()

  let pageIndex = 0
  const doc = await pdf(buffer, { scale: OCR_CONFIG.SCALE })

  for await (const pageImage of doc) {
    if (pageIndex >= pagesToProcess) break

    try {
      // Prétraiter l'image avec sharp (A2)
      const preprocessed = await preprocessImageForOcr(Buffer.from(pageImage))

      // OCR avec Tesseract
      const { data } = await worker.recognize(preprocessed)

      // Vérifier la confiance (A4)
      if (data.confidence < OCR_CONFIG.MIN_OCR_CONFIDENCE) {
        console.warn(`[FileParser] OCR page ${pageIndex + 1} faible confiance: ${data.confidence}%`)
      }
      confidences.push(data.confidence)

      // Nettoyage du texte : cleanText de base + nettoyage post-OCR arabe (A5)
      let pageText = cleanText(data.text)
      pageText = cleanArabicOcrText(pageText)

      if (pageText.length > 0) {
        textParts.push(`--- Page ${pageIndex + 1} ---\n${pageText}`)
      }
    } catch (pageError) {
      console.error(`[FileParser] Erreur OCR page ${pageIndex + 1}:`, pageError)
    }

    pageIndex++
  }

  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0

  return {
    text: textParts.join('\n\n'),
    pagesProcessed: textParts.length,
    avgConfidence,
  }
}

/**
 * Parse une date au format PDF (D:YYYYMMDDHHmmss)
 */
function parsePdfDate(dateStr: string): Date | undefined {
  try {
    // Format: D:YYYYMMDDHHmmss ou D:YYYYMMDDHHmmssZ
    const match = dateStr.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/)
    if (match) {
      const [, year, month, day, hour = '0', min = '0', sec = '0'] = match
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(min),
        parseInt(sec)
      )
    }
  } catch {
    // Ignorer les erreurs de parsing de date
  }
  return undefined
}

// =============================================================================
// PARSING DOCX
// =============================================================================

/**
 * Extrait le texte d'un fichier DOCX
 */
export async function parseDocx(buffer: Buffer): Promise<ParsedFile> {
  try {
    const mammoth = await getMammoth()
    const result = await mammoth.extractRawText({ buffer })

    const text = cleanText(result.value)
    const wordCount = countWords(text)

    return {
      success: true,
      text,
      metadata: {
        wordCount,
      },
    }
  } catch (error) {
    console.error('[FileParser] Erreur parsing DOCX:', error)
    return {
      success: false,
      text: '',
      metadata: { wordCount: 0 },
      error: error instanceof Error ? error.message : 'Erreur parsing DOCX',
    }
  }
}

// =============================================================================
// PARSING TXT
// =============================================================================

/**
 * Parse un fichier texte brut
 */
export function parseTxt(buffer: Buffer): ParsedFile {
  try {
    const text = cleanText(buffer.toString('utf-8'))
    const wordCount = countWords(text)

    return {
      success: true,
      text,
      metadata: { wordCount },
    }
  } catch (error) {
    return {
      success: false,
      text: '',
      metadata: { wordCount: 0 },
      error: error instanceof Error ? error.message : 'Erreur parsing TXT',
    }
  }
}

// =============================================================================
// DISPATCH
// =============================================================================

/**
 * Parse un fichier selon son type
 */
export async function parseFile(
  buffer: Buffer,
  fileType: SupportedFileType | string
): Promise<ParsedFile> {
  const type = fileType.toLowerCase().replace('.', '') as SupportedFileType

  switch (type) {
    case 'pdf':
      return parsePdf(buffer)
    case 'docx':
    case 'doc':
      return parseDocx(buffer)
    case 'txt':
      return parseTxt(buffer)
    default:
      return {
        success: false,
        text: '',
        metadata: { wordCount: 0 },
        error: `Type de fichier non supporté: ${fileType}`,
      }
  }
}

/**
 * Vérifie si un type de fichier est supporté pour l'extraction de texte
 */
export function isTextExtractable(fileType: string): boolean {
  const supported = ['pdf', 'docx', 'doc', 'txt']
  return supported.includes(fileType.toLowerCase().replace('.', ''))
}

// =============================================================================
// UTILITAIRES
// =============================================================================

/**
 * Nettoie le texte extrait
 */
function cleanText(text: string): string {
  return text
    // Normaliser les caractères unicode
    .normalize('NFC')
    // Supprimer les caractères de contrôle (sauf newlines et tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normaliser les espaces multiples
    .replace(/[ \t]+/g, ' ')
    // Normaliser les sauts de ligne multiples
    .replace(/\n{3,}/g, '\n\n')
    // Supprimer les espaces en début/fin de ligne
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim()
}

/**
 * Compte les mots dans un texte
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length
}
