/**
 * Service de découpage automatique des documents longs
 * Pour gérer les documents >50KB qui dépassent les limites d'embeddings
 */

export interface DocumentSection {
  index: number
  title: string
  content: string
  startOffset: number
  endOffset: number
  wordCount: number
}

export interface SplitResult {
  success: boolean
  sections: DocumentSection[]
  totalSections: number
  error?: string
}

/**
 * Patterns de détection de sections (FR + AR)
 */
const SECTION_PATTERNS = [
  // Français
  /^(CHAPITRE|PARTIE|SECTION|TITRE)\s+([IVX\d]+|[A-Z])\s*[:.\-]?\s*(.+)$/im,
  /^([IVX\d]+)\.\s+(.+)$/m,
  /^(Introduction|Conclusion|Bibliographie|Annexe|Résumé)/im,

  // Arabe
  /^(الباب|الفصل|الجزء|القسم|المبحث)\s+(الأول|الثاني|الثالث|الرابع|الخامس|[٠-٩]+)\s*[:.\-]?\s*(.+)$/m,
  /^(المقدمة|الخاتمة|المراجع|الملاحق|الفهرس)/m,
]

/**
 * Taille maximale recommandée par section (en caractères)
 */
const MAX_SECTION_SIZE = 45000 // ~6000-8000 tokens, marge de sécurité

/**
 * Taille minimale d'une section (éviter les sections trop petites)
 */
const MIN_SECTION_SIZE = 1000

/**
 * Découper un document long en sections intelligentes
 */
export function splitLongDocument(
  content: string,
  options: {
    maxSectionSize?: number
    minSectionSize?: number
  } = {}
): SplitResult {
  const maxSize = options.maxSectionSize || MAX_SECTION_SIZE
  const minSize = options.minSectionSize || MIN_SECTION_SIZE

  try {
    // Si le document est déjà assez petit, pas besoin de découper
    if (content.length <= maxSize) {
      return {
        success: true,
        sections: [{
          index: 0,
          title: 'Document complet',
          content,
          startOffset: 0,
          endOffset: content.length,
          wordCount: content.split(/\s+/).length,
        }],
        totalSections: 1,
      }
    }

    // Détecter les sections automatiquement
    const sections = detectSections(content, maxSize, minSize)

    if (sections.length === 0) {
      // Pas de sections détectées, découpage par taille fixe
      return splitBySize(content, maxSize, minSize)
    }

    return {
      success: true,
      sections,
      totalSections: sections.length,
    }
  } catch (error) {
    return {
      success: false,
      sections: [],
      totalSections: 0,
      error: error instanceof Error ? error.message : 'Erreur découpage',
    }
  }
}

/**
 * Détecter les sections dans le document
 */
function detectSections(
  content: string,
  maxSize: number,
  minSize: number
): DocumentSection[] {
  const lines = content.split('\n')
  const sections: DocumentSection[] = []
  let currentSection: { title: string; startLine: number; startOffset: number } | null = null
  let currentOffset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lineLength = lines[i].length + 1 // +1 pour \n

    // Tester si cette ligne est un titre de section
    let isSectionTitle = false
    let sectionTitle = line

    for (const pattern of SECTION_PATTERNS) {
      const match = line.match(pattern)
      if (match) {
        isSectionTitle = true
        // Extraire le titre complet (avec numéro et texte)
        sectionTitle = match[0].trim()
        break
      }
    }

    if (isSectionTitle && line.length >= 5 && line.length <= 200) {
      // Fermer la section précédente
      if (currentSection) {
        const sectionContent = lines
          .slice(currentSection.startLine, i)
          .join('\n')

        if (sectionContent.length >= minSize) {
          sections.push({
            index: sections.length,
            title: currentSection.title,
            content: sectionContent.trim(),
            startOffset: currentSection.startOffset,
            endOffset: currentOffset,
            wordCount: sectionContent.split(/\s+/).length,
          })
        }
      }

      // Démarrer nouvelle section
      currentSection = {
        title: sectionTitle,
        startLine: i,
        startOffset: currentOffset,
      }
    }

    currentOffset += lineLength
  }

  // Fermer la dernière section
  if (currentSection) {
    const sectionContent = lines
      .slice(currentSection.startLine)
      .join('\n')

    if (sectionContent.length >= minSize) {
      sections.push({
        index: sections.length,
        title: currentSection.title,
        content: sectionContent.trim(),
        startOffset: currentSection.startOffset,
        endOffset: content.length,
        wordCount: sectionContent.split(/\s+/).length,
      })
    }
  }

  // Si certaines sections sont encore trop grandes, les re-découper
  const finalSections: DocumentSection[] = []
  for (const section of sections) {
    if (section.content.length > maxSize) {
      // Re-découper cette section en sous-sections par taille
      const subSplit = splitBySize(section.content, maxSize, minSize)
      if (subSplit.success) {
        subSplit.sections.forEach((subSection, idx) => {
          finalSections.push({
            ...subSection,
            index: finalSections.length,
            title: `${section.title} - Partie ${idx + 1}`,
          })
        })
      } else {
        finalSections.push(section)
      }
    } else {
      finalSections.push({
        ...section,
        index: finalSections.length,
      })
    }
  }

  return finalSections
}

/**
 * Découpage par taille fixe (fallback si pas de sections détectées)
 */
function splitBySize(
  content: string,
  maxSize: number,
  minSize: number
): SplitResult {
  const sections: DocumentSection[] = []
  let currentOffset = 0
  let sectionIndex = 0

  while (currentOffset < content.length) {
    let endOffset = Math.min(currentOffset + maxSize, content.length)

    // Si pas à la fin, essayer de couper à un saut de paragraphe
    if (endOffset < content.length) {
      const searchStart = Math.max(currentOffset, endOffset - 500)
      const searchArea = content.substring(searchStart, endOffset + 500)

      // Chercher dernier double saut de ligne (paragraphe)
      const lastParagraph = searchArea.lastIndexOf('\n\n')
      if (lastParagraph > 0) {
        endOffset = searchStart + lastParagraph
      } else {
        // Sinon, chercher dernier saut de ligne simple
        const lastNewline = searchArea.lastIndexOf('\n')
        if (lastNewline > 0) {
          endOffset = searchStart + lastNewline
        }
      }
    }

    const sectionContent = content.substring(currentOffset, endOffset).trim()

    if (sectionContent.length >= minSize || currentOffset === 0) {
      sections.push({
        index: sectionIndex,
        title: `Partie ${sectionIndex + 1}`,
        content: sectionContent,
        startOffset: currentOffset,
        endOffset,
        wordCount: sectionContent.split(/\s+/).length,
      })
      sectionIndex++
    }

    currentOffset = endOffset + 1
  }

  return {
    success: true,
    sections,
    totalSections: sections.length,
  }
}

/**
 * Générer métadonnées de parent/enfant pour les sections
 */
export function generateSectionMetadata(
  parentId: string,
  parentTitle: string,
  section: DocumentSection,
  totalSections: number
): {
  parentDocumentId: string
  parentTitle: string
  sectionIndex: number
  sectionTitle: string
  totalSections: number
  isPartialDocument: boolean
} {
  return {
    parentDocumentId: parentId,
    parentTitle,
    sectionIndex: section.index,
    sectionTitle: section.title,
    totalSections,
    isPartialDocument: true,
  }
}
