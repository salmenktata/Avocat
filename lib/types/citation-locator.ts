/**
 * Localisation précise d'un chunk dans son document source.
 * Permet l'audit et la citation précise des passages juridiques.
 *
 * Stocké dans metadata JSONB des chunks (colonne `metadata` de knowledge_base_chunks).
 * Pas de migration SQL nécessaire.
 */

export type CitationLocator =
  | HtmlCitationLocator
  | DocxCitationLocator
  | PdfTextCitationLocator
  | PdfOcrCitationLocator
  | WebCitationLocator

export interface HtmlCitationLocator {
  type: 'html'
  url: string
  anchor?: string      // ID de l'élément HTML le plus proche (ex: "article-332")
  dom_path?: string    // Chemin CSS simplifié (ex: "section#codes > p:nth-child(3)")
}

export interface DocxCitationLocator {
  type: 'docx'
  paragraph_index: number   // Index 0-based du premier paragraphe dans le document
  heading_path?: string     // Chemin de headings parent (ex: "Livre I > Chapitre 3")
}

export interface PdfTextCitationLocator {
  type: 'pdf_text'
  page: number         // Numéro de page 1-based
  line_start?: number  // Ligne de début approximative (1-based)
  line_end?: number    // Ligne de fin approximative (1-based)
}

export interface PdfOcrCitationLocator {
  type: 'pdf_ocr'
  page: number         // Numéro de page 1-based
  confidence_ocr: number  // Confiance OCR pour cette page (0-100)
  line_start?: number
}

export interface WebCitationLocator {
  type: 'web'
  url: string
  crawl_depth?: number
}

/**
 * Seuil de confiance OCR en dessous duquel une page est considérée de faible qualité.
 * Configurable via env: OCR_CONFIDENCE_WARN_THRESHOLD (default: 85)
 */
export const OCR_CONFIDENCE_WARN_THRESHOLD = parseInt(
  process.env.OCR_CONFIDENCE_WARN_THRESHOLD || '85',
  10
)
