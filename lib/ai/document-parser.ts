/**
 * Service d'extraction de texte depuis PDF et DOCX
 * Utilise pdf-parse pour les PDF et mammoth pour les DOCX
 */

import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

// =============================================================================
// TYPES
// =============================================================================

export interface ParseResult {
  text: string
  metadata: {
    pageCount?: number
    wordCount: number
    charCount: number
    title?: string
    author?: string
    creationDate?: Date
  }
}

export type SupportedMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/msword'
  | 'text/plain'
  | 'text/html'
  | 'text/markdown'

// =============================================================================
// EXTRACTION PDF
// =============================================================================

/**
 * Extrait le texte d'un fichier PDF
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<ParseResult> {
  try {
    const data = await pdfParse(buffer)

    const text = cleanText(data.text)

    return {
      text,
      metadata: {
        pageCount: data.numpages,
        wordCount: countWords(text),
        charCount: text.length,
        title: data.info?.Title,
        author: data.info?.Author,
        creationDate: data.info?.CreationDate
          ? parseDate(data.info.CreationDate)
          : undefined,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    throw new Error(`Erreur extraction PDF: ${message}`)
  }
}

// =============================================================================
// EXTRACTION DOCX
// =============================================================================

/**
 * Extrait le texte d'un fichier DOCX
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<ParseResult> {
  try {
    const result = await mammoth.extractRawText({ buffer })

    const text = cleanText(result.value)

    return {
      text,
      metadata: {
        wordCount: countWords(text),
        charCount: text.length,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    throw new Error(`Erreur extraction DOCX: ${message}`)
  }
}

/**
 * Extrait le HTML d'un fichier DOCX (conserve la structure)
 */
export async function extractHtmlFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer })
  return result.value
}

// =============================================================================
// EXTRACTION TEXTE BRUT
// =============================================================================

/**
 * Extrait le texte d'un fichier texte brut
 */
export function extractTextFromPlainText(
  buffer: Buffer,
  encoding: BufferEncoding = 'utf-8'
): ParseResult {
  const text = cleanText(buffer.toString(encoding))

  return {
    text,
    metadata: {
      wordCount: countWords(text),
      charCount: text.length,
    },
  }
}

// =============================================================================
// FONCTION PRINCIPALE
// =============================================================================

/**
 * Extrait le texte d'un document selon son type MIME
 * @param buffer - Contenu du fichier
 * @param mimeType - Type MIME du fichier
 * @returns Texte extrait et métadonnées
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<ParseResult> {
  // Normaliser le type MIME
  const normalizedMime = mimeType.toLowerCase().trim()

  // PDF
  if (normalizedMime === 'application/pdf') {
    return extractTextFromPDF(buffer)
  }

  // DOCX
  if (
    normalizedMime ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalizedMime.includes('wordprocessingml')
  ) {
    return extractTextFromDocx(buffer)
  }

  // DOC (ancien format Word) - pas supporté nativement, essayer comme DOCX
  if (normalizedMime === 'application/msword') {
    try {
      return await extractTextFromDocx(buffer)
    } catch {
      throw new Error(
        'Format DOC non supporté - Veuillez convertir en DOCX ou PDF'
      )
    }
  }

  // Texte brut
  if (
    normalizedMime.startsWith('text/') ||
    normalizedMime === 'application/json'
  ) {
    return extractTextFromPlainText(buffer)
  }

  throw new Error(`Type MIME non supporté: ${mimeType}`)
}

/**
 * Vérifie si un type MIME est supporté pour l'extraction
 */
export function isSupportedMimeType(mimeType: string): boolean {
  const supported = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/html',
    'text/markdown',
    'text/csv',
    'application/json',
  ]

  const normalizedMime = mimeType.toLowerCase().trim()
  return (
    supported.includes(normalizedMime) || normalizedMime.startsWith('text/')
  )
}

/**
 * Retourne l'extension de fichier correspondant à un type MIME
 */
export function getExtensionFromMimeType(mimeType: string): string | null {
  const mapping: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'application/msword': 'doc',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/markdown': 'md',
    'text/csv': 'csv',
    'application/json': 'json',
  }

  return mapping[mimeType.toLowerCase()] || null
}

// =============================================================================
// UTILITAIRES
// =============================================================================

/**
 * Nettoie le texte extrait
 * - Supprime les caractères de contrôle
 * - Normalise les espaces
 * - Supprime les lignes vides multiples
 */
function cleanText(text: string): string {
  return (
    text
      // Supprimer les caractères de contrôle sauf newlines et tabs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normaliser les espaces (remplacer tabs, espaces multiples par un seul espace)
      .replace(/[ \t]+/g, ' ')
      // Normaliser les sauts de ligne
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Supprimer les lignes vides multiples (garder max 2 newlines)
      .replace(/\n{3,}/g, '\n\n')
      // Trim
      .trim()
  )
}

/**
 * Compte les mots dans un texte
 */
function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

/**
 * Parse une date depuis les métadonnées PDF
 * Format typique: D:20240115120000+01'00'
 */
function parseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined

  // Format PDF: D:YYYYMMDDHHmmSS
  const match = dateStr.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/)
  if (!match) return undefined

  const [, year, month, day, hour = '00', min = '00', sec = '00'] = match

  try {
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(min),
      parseInt(sec)
    )
  } catch {
    return undefined
  }
}
