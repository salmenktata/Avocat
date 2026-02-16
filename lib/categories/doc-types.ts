/**
 * Type de document selon la nature du savoir juridique
 * Complète (ne remplace pas) le système de 15 catégories
 */

import { LegalCategory } from './legal-categories'

export type DocumentType =
  | 'TEXTES'      // Normes (lois, codes, constitution, conventions, JORT)
  | 'JURIS'       // Jurisprudence (décisions de justice)
  | 'PROC'        // Procédures (guides procéduraux, formulaires)
  | 'TEMPLATES'   // Modèles de documents
  | 'DOCTRINE'    // Travaux académiques (doctrine, guides, lexique)

/**
 * Mapping 15 catégories → 5 doc_types
 */
export const CATEGORY_TO_DOC_TYPE: Record<LegalCategory, DocumentType> = {
  // TEXTES (normes)
  legislation: 'TEXTES',
  codes: 'TEXTES',
  constitution: 'TEXTES',
  conventions: 'TEXTES',
  jort: 'TEXTES',

  // JURIS (jurisprudence)
  jurisprudence: 'JURIS',

  // PROC (procédures)
  procedures: 'PROC',
  formulaires: 'PROC',

  // TEMPLATES (modèles)
  modeles: 'TEMPLATES',

  // DOCTRINE (académique)
  doctrine: 'DOCTRINE',
  guides: 'DOCTRINE',
  lexique: 'DOCTRINE',

  // Autres (classification contextuelle)
  actualites: 'DOCTRINE',  // Considéré comme analyse
  google_drive: 'TEMPLATES', // Par défaut, à affiner
  autre: 'DOCTRINE',
}

/**
 * Détecter le doc_type depuis une catégorie
 */
export function getDocumentType(category: LegalCategory): DocumentType {
  return CATEGORY_TO_DOC_TYPE[category]
}

/**
 * Traductions doc_types
 */
export const DOC_TYPE_TRANSLATIONS = {
  TEXTES: { ar: 'النصوص القانونية', fr: 'Textes normatifs' },
  JURIS: { ar: 'الاجتهاد القضائي', fr: 'Jurisprudence' },
  PROC: { ar: 'الإجراءات', fr: 'Procédures' },
  TEMPLATES: { ar: 'النماذج', fr: 'Modèles' },
  DOCTRINE: { ar: 'الفقه والتحليل', fr: 'Doctrine et analyses' },
}

/**
 * Liste de tous les types de documents
 */
export const ALL_DOC_TYPES: DocumentType[] = [
  'TEXTES',
  'JURIS',
  'PROC',
  'TEMPLATES',
  'DOCTRINE',
]

/**
 * Obtenir les catégories d'un doc_type donné
 */
export function getCategoriesForDocType(docType: DocumentType): LegalCategory[] {
  return Object.entries(CATEGORY_TO_DOC_TYPE)
    .filter(([_, dt]) => dt === docType)
    .map(([cat]) => cat as LegalCategory)
}

/**
 * Type guard pour DocumentType
 */
export function isDocumentType(value: string): value is DocumentType {
  return ALL_DOC_TYPES.includes(value as DocumentType)
}
