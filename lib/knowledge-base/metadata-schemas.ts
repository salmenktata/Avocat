/**
 * Schémas de métadonnées structurées par type de document
 * Adapté au droit tunisien
 */

import { z } from 'zod';
import type { KnowledgeCategory } from './categories';

// ============================================================================
// INTERFACES TYPESCRIPT
// ============================================================================

/**
 * Métadonnées pour la législation tunisienne
 */
export interface LegislationMetadata {
  code_name?: string;           // Ex: "Code des Obligations et Contrats"
  article_range?: string;       // Ex: "Art. 1-50"
  jort_number?: string;         // Numéro JORT
  jort_date?: string;           // Date publication JORT
  version_date?: string;        // Version en vigueur
  consolidation_date?: string;  // Date de consolidation
  loi_number?: string;          // Ex: "Loi n°94-36 du 24 février 1994"
  ministry?: string;            // Ministère concerné
  effective_date?: string;      // Date d'entrée en vigueur
}

/**
 * Métadonnées pour la jurisprudence tunisienne
 */
export interface JurisprudenceMetadata {
  court: string;                // Cour de cassation, Cour d'appel de Tunis, etc.
  chamber?: string;             // Chambre civile, commerciale, pénale
  decision_number: string;      // N° arrêt
  decision_date: string;        // Date décision
  parties?: string;             // Parties (anonymisées)
  domain: string;               // Domaine: civil, pénal, commercial, immobilier, statut personnel
  solution?: 'cassation' | 'rejet' | 'renvoi' | 'confirmation' | 'infirmation' | 'autre';
  rapporteur?: string;          // Conseiller rapporteur
  bulletin_ref?: string;        // Référence bulletin de jurisprudence
  legal_basis?: string[];       // Textes de loi appliqués
  key_points?: string[];        // Points de droit importants
}

/**
 * Métadonnées pour la doctrine
 */
export interface DoctrineMetadata {
  author: string;
  co_authors?: string[];
  publication?: string;         // Ex: "Revue Tunisienne de Droit", "Revue Juridique Tunisienne"
  publication_date?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  university?: string;          // Faculté de droit de Tunis, Sfax, Sousse
  supervisor?: string;          // Directeur de thèse
  keywords?: string[];
  abstract_fr?: string;
  abstract_ar?: string;
  isbn?: string;
  issn?: string;
}

/**
 * Métadonnées pour les modèles
 */
export interface ModeleMetadata {
  document_type: string;        // Type: contrat, requête, conclusions
  jurisdiction?: string;        // Tribunal compétent
  gouvernorat?: string;         // Gouvernorat concerné
  last_updated?: string;
  author?: string;
  usage_notes?: string;
  timbre_fiscal?: boolean;      // Nécessite timbre fiscal
  variables?: string[];         // Variables à remplir
  applicable_law?: string[];    // Textes applicables
  complexity?: 'simple' | 'moyen' | 'complexe';
}

/**
 * Métadonnées pour le JORT
 */
export interface JortMetadata {
  jort_number: string;          // Numéro du JORT
  jort_date: string;            // Date de publication
  jort_year: string;            // Année
  page_numbers?: string;        // Pages
  type: 'loi' | 'decret' | 'arrete' | 'avis' | 'nomination';
  ministry?: string;            // Ministère concerné
  reference_number?: string;    // Numéro de référence du texte
}

/**
 * Métadonnées pour les procédures
 */
export interface ProcedureMetadata {
  procedure_type: string;       // civile, pénale, commerciale, immobilière
  jurisdiction: string;         // Tribunal compétent
  gouvernorat?: string;
  steps_count?: number;         // Nombre d'étapes
  estimated_duration?: string;  // Durée estimée
  frais_estimation?: string;    // Estimation des frais
  documents_required?: string[];// Documents nécessaires
  last_verified?: string;       // Dernière vérification
  contact_info?: string;        // Informations de contact
}

/**
 * Métadonnées pour les formulaires
 */
export interface FormulaireMetadata {
  form_name: string;            // Nom officiel du formulaire
  administration: string;       // Administration concernée
  gouvernorat?: string;
  purpose: string;              // Objet du formulaire
  fee?: string;                 // Frais associés
  validity_period?: string;     // Durée de validité
  documents_required?: string[];// Pièces jointes requises
  online_available?: boolean;   // Disponible en ligne
  last_updated?: string;
}

/**
 * Union de tous les types de métadonnées
 */
export type KnowledgeMetadata =
  | LegislationMetadata
  | JurisprudenceMetadata
  | DoctrineMetadata
  | ModeleMetadata
  | JortMetadata
  | ProcedureMetadata
  | FormulaireMetadata
  | Record<string, unknown>; // Pour les catégories sans schéma spécifique

// ============================================================================
// SCHÉMAS ZOD POUR VALIDATION
// ============================================================================

export const legislationSchema = z.object({
  code_name: z.string().optional(),
  article_range: z.string().optional(),
  jort_number: z.string().optional(),
  jort_date: z.string().optional(),
  version_date: z.string().optional(),
  consolidation_date: z.string().optional(),
  loi_number: z.string().optional(),
  ministry: z.string().optional(),
  effective_date: z.string().optional(),
});

export const jurisprudenceSchema = z.object({
  court: z.string().min(1, 'Tribunal requis'),
  chamber: z.string().optional(),
  decision_number: z.string().min(1, 'Numéro de décision requis'),
  decision_date: z.string().min(1, 'Date de décision requise'),
  parties: z.string().optional(),
  domain: z.string().min(1, 'Domaine requis'),
  solution: z.enum(['cassation', 'rejet', 'renvoi', 'confirmation', 'infirmation', 'autre']).optional(),
  rapporteur: z.string().optional(),
  bulletin_ref: z.string().optional(),
  legal_basis: z.array(z.string()).optional(),
  key_points: z.array(z.string()).optional(),
});

export const doctrineSchema = z.object({
  author: z.string().min(1, 'Auteur requis'),
  co_authors: z.array(z.string()).optional(),
  publication: z.string().optional(),
  publication_date: z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  university: z.string().optional(),
  supervisor: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  abstract_fr: z.string().optional(),
  abstract_ar: z.string().optional(),
  isbn: z.string().optional(),
  issn: z.string().optional(),
});

export const modeleSchema = z.object({
  document_type: z.string().min(1, 'Type de document requis'),
  jurisdiction: z.string().optional(),
  gouvernorat: z.string().optional(),
  last_updated: z.string().optional(),
  author: z.string().optional(),
  usage_notes: z.string().optional(),
  timbre_fiscal: z.boolean().optional(),
  variables: z.array(z.string()).optional(),
  applicable_law: z.array(z.string()).optional(),
  complexity: z.enum(['simple', 'moyen', 'complexe']).optional(),
});

export const jortSchema = z.object({
  jort_number: z.string().min(1, 'Numéro JORT requis'),
  jort_date: z.string().min(1, 'Date JORT requise'),
  jort_year: z.string().min(1, 'Année requise'),
  page_numbers: z.string().optional(),
  type: z.enum(['loi', 'decret', 'arrete', 'avis', 'nomination']),
  ministry: z.string().optional(),
  reference_number: z.string().optional(),
});

export const procedureSchema = z.object({
  procedure_type: z.string().min(1, 'Type de procédure requis'),
  jurisdiction: z.string().min(1, 'Juridiction requise'),
  gouvernorat: z.string().optional(),
  steps_count: z.number().optional(),
  estimated_duration: z.string().optional(),
  frais_estimation: z.string().optional(),
  documents_required: z.array(z.string()).optional(),
  last_verified: z.string().optional(),
  contact_info: z.string().optional(),
});

export const formulaireSchema = z.object({
  form_name: z.string().min(1, 'Nom du formulaire requis'),
  administration: z.string().min(1, 'Administration requise'),
  gouvernorat: z.string().optional(),
  purpose: z.string().min(1, 'Objet requis'),
  fee: z.string().optional(),
  validity_period: z.string().optional(),
  documents_required: z.array(z.string()).optional(),
  online_available: z.boolean().optional(),
  last_updated: z.string().optional(),
});

// Schéma générique pour les autres catégories
export const genericSchema = z.record(z.unknown());

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Récupérer le schéma Zod approprié pour une catégorie
 */
export function getMetadataSchema(category: KnowledgeCategory): z.ZodType {
  switch (category) {
    case 'legislation':
    case 'code':
      return legislationSchema;
    case 'jurisprudence':
      return jurisprudenceSchema;
    case 'doctrine':
      return doctrineSchema;
    case 'modeles':
    case 'modele':
      return modeleSchema;
    case 'jort':
      return jortSchema;
    case 'procedures':
      return procedureSchema;
    case 'formulaires':
      return formulaireSchema;
    default:
      return genericSchema;
  }
}

/**
 * Valider les métadonnées selon la catégorie
 */
export function validateMetadata(
  category: KnowledgeCategory,
  metadata: unknown
): { success: true; data: KnowledgeMetadata } | { success: false; errors: string[] } {
  const schema = getMetadataSchema(category);
  const result = schema.safeParse(metadata);

  if (result.success) {
    return { success: true, data: result.data as KnowledgeMetadata };
  }

  const errors = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  return { success: false, errors };
}

/**
 * Définition des champs de métadonnées pour l'UI
 */
export interface MetadataFieldDefinition {
  key: string;
  labelFr: string;
  labelAr: string;
  type: 'text' | 'textarea' | 'date' | 'select' | 'multiselect' | 'boolean' | 'number';
  required?: boolean;
  options?: Array<{ value: string; labelFr: string; labelAr: string }>;
  placeholder?: string;
}

/**
 * Champs de métadonnées par catégorie pour formulaires dynamiques
 */
export const METADATA_FIELDS: Record<string, MetadataFieldDefinition[]> = {
  legislation: [
    { key: 'code_name', labelFr: 'Nom du code', labelAr: 'اسم المجلة', type: 'text' },
    { key: 'loi_number', labelFr: 'Numéro de loi', labelAr: 'رقم القانون', type: 'text', placeholder: 'Ex: Loi n°94-36' },
    { key: 'article_range', labelFr: 'Articles', labelAr: 'الفصول', type: 'text', placeholder: 'Ex: Art. 1-50' },
    { key: 'jort_number', labelFr: 'N° JORT', labelAr: 'عدد الرائد', type: 'text' },
    { key: 'jort_date', labelFr: 'Date JORT', labelAr: 'تاريخ الرائد', type: 'date' },
    { key: 'effective_date', labelFr: "Date d'entrée en vigueur", labelAr: 'تاريخ السريان', type: 'date' },
    { key: 'ministry', labelFr: 'Ministère', labelAr: 'الوزارة', type: 'text' },
  ],
  jurisprudence: [
    {
      key: 'court',
      labelFr: 'Tribunal',
      labelAr: 'المحكمة',
      type: 'select',
      required: true,
      options: [
        { value: 'cassation', labelFr: 'Cour de Cassation', labelAr: 'محكمة التعقيب' },
        { value: 'appel_tunis', labelFr: "Cour d'Appel de Tunis", labelAr: 'محكمة الاستئناف بتونس' },
        { value: 'appel_sousse', labelFr: "Cour d'Appel de Sousse", labelAr: 'محكمة الاستئناف بسوسة' },
        { value: 'appel_sfax', labelFr: "Cour d'Appel de Sfax", labelAr: 'محكمة الاستئناف بصفاقس' },
        { value: 'premiere_instance', labelFr: 'Tribunal de 1ère Instance', labelAr: 'المحكمة الابتدائية' },
        { value: 'tribunal_immobilier', labelFr: 'Tribunal Immobilier', labelAr: 'المحكمة العقارية' },
        { value: 'tribunal_administratif', labelFr: 'Tribunal Administratif', labelAr: 'المحكمة الإدارية' },
      ],
    },
    {
      key: 'chamber',
      labelFr: 'Chambre',
      labelAr: 'الدائرة',
      type: 'select',
      options: [
        { value: 'civile', labelFr: 'Civile', labelAr: 'مدنية' },
        { value: 'commerciale', labelFr: 'Commerciale', labelAr: 'تجارية' },
        { value: 'penale', labelFr: 'Pénale', labelAr: 'جزائية' },
        { value: 'statut_personnel', labelFr: 'Statut Personnel', labelAr: 'أحوال شخصية' },
        { value: 'immobiliere', labelFr: 'Immobilière', labelAr: 'عقارية' },
      ],
    },
    { key: 'decision_number', labelFr: 'N° Décision', labelAr: 'عدد القرار', type: 'text', required: true },
    { key: 'decision_date', labelFr: 'Date Décision', labelAr: 'تاريخ القرار', type: 'date', required: true },
    {
      key: 'domain',
      labelFr: 'Domaine',
      labelAr: 'المجال',
      type: 'select',
      required: true,
      options: [
        { value: 'civil', labelFr: 'Civil', labelAr: 'مدني' },
        { value: 'commercial', labelFr: 'Commercial', labelAr: 'تجاري' },
        { value: 'penal', labelFr: 'Pénal', labelAr: 'جزائي' },
        { value: 'immobilier', labelFr: 'Immobilier', labelAr: 'عقاري' },
        { value: 'statut_personnel', labelFr: 'Statut Personnel', labelAr: 'أحوال شخصية' },
        { value: 'administratif', labelFr: 'Administratif', labelAr: 'إداري' },
        { value: 'fiscal', labelFr: 'Fiscal', labelAr: 'جبائي' },
      ],
    },
    {
      key: 'solution',
      labelFr: 'Solution',
      labelAr: 'الحل',
      type: 'select',
      options: [
        { value: 'cassation', labelFr: 'Cassation', labelAr: 'نقض' },
        { value: 'rejet', labelFr: 'Rejet', labelAr: 'رفض' },
        { value: 'renvoi', labelFr: 'Renvoi', labelAr: 'إحالة' },
        { value: 'confirmation', labelFr: 'Confirmation', labelAr: 'تأييد' },
        { value: 'infirmation', labelFr: 'Infirmation', labelAr: 'إلغاء' },
      ],
    },
    { key: 'parties', labelFr: 'Parties', labelAr: 'الأطراف', type: 'text' },
    { key: 'rapporteur', labelFr: 'Rapporteur', labelAr: 'المقرر', type: 'text' },
    { key: 'bulletin_ref', labelFr: 'Réf. Bulletin', labelAr: 'مرجع النشرية', type: 'text' },
  ],
  doctrine: [
    { key: 'author', labelFr: 'Auteur', labelAr: 'المؤلف', type: 'text', required: true },
    { key: 'publication', labelFr: 'Publication', labelAr: 'المنشور', type: 'text', placeholder: 'Ex: Revue Tunisienne de Droit' },
    { key: 'publication_date', labelFr: 'Date de publication', labelAr: 'تاريخ النشر', type: 'date' },
    { key: 'volume', labelFr: 'Volume', labelAr: 'المجلد', type: 'text' },
    { key: 'pages', labelFr: 'Pages', labelAr: 'الصفحات', type: 'text' },
    { key: 'university', labelFr: 'Université', labelAr: 'الجامعة', type: 'text' },
    { key: 'supervisor', labelFr: 'Directeur de thèse', labelAr: 'المشرف', type: 'text' },
    { key: 'abstract_fr', labelFr: 'Résumé (FR)', labelAr: 'الملخص (فر)', type: 'textarea' },
    { key: 'abstract_ar', labelFr: 'Résumé (AR)', labelAr: 'الملخص (عر)', type: 'textarea' },
  ],
  modeles: [
    { key: 'document_type', labelFr: 'Type de document', labelAr: 'نوع الوثيقة', type: 'text', required: true },
    { key: 'jurisdiction', labelFr: 'Juridiction', labelAr: 'الاختصاص', type: 'text' },
    { key: 'gouvernorat', labelFr: 'Gouvernorat', labelAr: 'الولاية', type: 'text' },
    { key: 'author', labelFr: 'Auteur', labelAr: 'المؤلف', type: 'text' },
    { key: 'usage_notes', labelFr: "Notes d'utilisation", labelAr: 'ملاحظات الاستخدام', type: 'textarea' },
    { key: 'timbre_fiscal', labelFr: 'Timbre fiscal requis', labelAr: 'طابع جبائي مطلوب', type: 'boolean' },
    {
      key: 'complexity',
      labelFr: 'Complexité',
      labelAr: 'التعقيد',
      type: 'select',
      options: [
        { value: 'simple', labelFr: 'Simple', labelAr: 'بسيط' },
        { value: 'moyen', labelFr: 'Moyen', labelAr: 'متوسط' },
        { value: 'complexe', labelFr: 'Complexe', labelAr: 'معقد' },
      ],
    },
  ],
  jort: [
    { key: 'jort_number', labelFr: 'N° JORT', labelAr: 'عدد الرائد', type: 'text', required: true },
    { key: 'jort_date', labelFr: 'Date JORT', labelAr: 'تاريخ الرائد', type: 'date', required: true },
    { key: 'jort_year', labelFr: 'Année', labelAr: 'السنة', type: 'text', required: true },
    { key: 'page_numbers', labelFr: 'Pages', labelAr: 'الصفحات', type: 'text' },
    {
      key: 'type',
      labelFr: 'Type',
      labelAr: 'النوع',
      type: 'select',
      required: true,
      options: [
        { value: 'loi', labelFr: 'Loi', labelAr: 'قانون' },
        { value: 'decret', labelFr: 'Décret', labelAr: 'أمر' },
        { value: 'arrete', labelFr: 'Arrêté', labelAr: 'قرار' },
        { value: 'avis', labelFr: 'Avis', labelAr: 'إعلان' },
        { value: 'nomination', labelFr: 'Nomination', labelAr: 'تسمية' },
      ],
    },
    { key: 'ministry', labelFr: 'Ministère', labelAr: 'الوزارة', type: 'text' },
    { key: 'reference_number', labelFr: 'N° de référence', labelAr: 'رقم المرجع', type: 'text' },
  ],
  procedures: [
    { key: 'procedure_type', labelFr: 'Type de procédure', labelAr: 'نوع الإجراء', type: 'text', required: true },
    { key: 'jurisdiction', labelFr: 'Juridiction', labelAr: 'الاختصاص', type: 'text', required: true },
    { key: 'gouvernorat', labelFr: 'Gouvernorat', labelAr: 'الولاية', type: 'text' },
    { key: 'steps_count', labelFr: "Nombre d'étapes", labelAr: 'عدد المراحل', type: 'number' },
    { key: 'estimated_duration', labelFr: 'Durée estimée', labelAr: 'المدة المقدرة', type: 'text' },
    { key: 'frais_estimation', labelFr: 'Frais estimés', labelAr: 'المصاريف المقدرة', type: 'text' },
    { key: 'last_verified', labelFr: 'Dernière vérification', labelAr: 'آخر تحقق', type: 'date' },
    { key: 'contact_info', labelFr: 'Informations de contact', labelAr: 'معلومات الاتصال', type: 'textarea' },
  ],
  formulaires: [
    { key: 'form_name', labelFr: 'Nom du formulaire', labelAr: 'اسم الاستمارة', type: 'text', required: true },
    { key: 'administration', labelFr: 'Administration', labelAr: 'الإدارة', type: 'text', required: true },
    { key: 'gouvernorat', labelFr: 'Gouvernorat', labelAr: 'الولاية', type: 'text' },
    { key: 'purpose', labelFr: 'Objet', labelAr: 'الغرض', type: 'text', required: true },
    { key: 'fee', labelFr: 'Frais', labelAr: 'المعاليم', type: 'text' },
    { key: 'validity_period', labelFr: 'Durée de validité', labelAr: 'مدة الصلاحية', type: 'text' },
    { key: 'online_available', labelFr: 'Disponible en ligne', labelAr: 'متوفر عبر الإنترنت', type: 'boolean' },
    { key: 'last_updated', labelFr: 'Dernière mise à jour', labelAr: 'آخر تحديث', type: 'date' },
  ],
};

/**
 * Récupérer les champs de métadonnées pour une catégorie
 */
export function getMetadataFields(category: KnowledgeCategory): MetadataFieldDefinition[] {
  // Mapper les anciennes catégories vers les nouvelles
  const mappedCategory = category === 'code' ? 'legislation' : category === 'modele' ? 'modeles' : category;
  return METADATA_FIELDS[mappedCategory] || [];
}

/**
 * Liste des gouvernorats tunisiens
 */
export const GOUVERNORATS = [
  { value: 'ariana', labelFr: 'Ariana', labelAr: 'أريانة' },
  { value: 'beja', labelFr: 'Béja', labelAr: 'باجة' },
  { value: 'ben_arous', labelFr: 'Ben Arous', labelAr: 'بن عروس' },
  { value: 'bizerte', labelFr: 'Bizerte', labelAr: 'بنزرت' },
  { value: 'gabes', labelFr: 'Gabès', labelAr: 'قابس' },
  { value: 'gafsa', labelFr: 'Gafsa', labelAr: 'قفصة' },
  { value: 'jendouba', labelFr: 'Jendouba', labelAr: 'جندوبة' },
  { value: 'kairouan', labelFr: 'Kairouan', labelAr: 'القيروان' },
  { value: 'kasserine', labelFr: 'Kasserine', labelAr: 'القصرين' },
  { value: 'kebili', labelFr: 'Kébili', labelAr: 'قبلي' },
  { value: 'kef', labelFr: 'Le Kef', labelAr: 'الكاف' },
  { value: 'mahdia', labelFr: 'Mahdia', labelAr: 'المهدية' },
  { value: 'manouba', labelFr: 'La Manouba', labelAr: 'منوبة' },
  { value: 'medenine', labelFr: 'Médenine', labelAr: 'مدنين' },
  { value: 'monastir', labelFr: 'Monastir', labelAr: 'المنستير' },
  { value: 'nabeul', labelFr: 'Nabeul', labelAr: 'نابل' },
  { value: 'sfax', labelFr: 'Sfax', labelAr: 'صفاقس' },
  { value: 'sidi_bouzid', labelFr: 'Sidi Bouzid', labelAr: 'سيدي بوزيد' },
  { value: 'siliana', labelFr: 'Siliana', labelAr: 'سليانة' },
  { value: 'sousse', labelFr: 'Sousse', labelAr: 'سوسة' },
  { value: 'tataouine', labelFr: 'Tataouine', labelAr: 'تطاوين' },
  { value: 'tozeur', labelFr: 'Tozeur', labelAr: 'توزر' },
  { value: 'tunis', labelFr: 'Tunis', labelAr: 'تونس' },
  { value: 'zaghouan', labelFr: 'Zaghouan', labelAr: 'زغوان' },
];
