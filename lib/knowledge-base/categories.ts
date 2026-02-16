/**
 * Définition des catégories et sous-catégories de la base de connaissance
 * Structure hiérarchique adaptée au droit tunisien
 *
 * NOTE: Ce fichier utilise le système central de catégories (@/lib/categories/legal-categories)
 * avec une couche de compatibilité pour les anciennes catégories
 */

import type { KnowledgeCategory as _KnowledgeCategory } from '@/lib/categories/legal-categories'
import { normalizeLegalCategory, LEGAL_CATEGORY_TRANSLATIONS, LEGAL_CATEGORY_BADGE_COLORS, LEGAL_CATEGORY_ICONS } from '@/lib/categories/legal-categories'

export type KnowledgeCategory =
  | _KnowledgeCategory
  // Anciennes catégories (rétrocompatibilité)
  | 'code'
  | 'modele';

export type LegislationSubcategory =
  | 'coc'
  | 'code_penal'
  | 'code_commerce'
  | 'code_travail'
  | 'csp'
  | 'code_fiscal'
  | 'constitution'
  | 'loi_organique'
  | 'decret_loi'
  | 'decret'
  | 'arrete'
  | 'circulaire';

export type JurisprudenceSubcategory =
  | 'cassation'
  // Cours d'appel (11 total)
  | 'appel_tunis'
  | 'appel_nabeul'
  | 'appel_bizerte'
  | 'appel_kef'
  | 'appel_sousse'
  | 'appel_monastir'
  | 'appel_kairouan'
  | 'appel_sfax'
  | 'appel_gafsa'
  | 'appel_gabes'
  | 'appel_medenine'
  // Autres tribunaux
  | 'premiere_instance'
  | 'tribunal_immobilier'
  | 'tribunal_administratif'
  | 'tribunal_commerce'
  | 'tribunal_travail'
  | 'conseil_constitutionnel';

export type DoctrineSubcategory =
  | 'article'
  | 'these'
  | 'commentaire'
  | 'ouvrage'
  | 'note_arret'
  | 'revue_juridique';

export type ModelesSubcategory =
  | 'contrat'
  | 'requete'
  | 'conclusions'
  | 'correspondance'
  | 'acte_notarie'
  | 'procuration';

export type ProceduresSubcategory =
  | 'proc_civile'
  | 'proc_penale'
  | 'proc_commerciale'
  | 'proc_administrative'
  | 'proc_immobiliere'
  | 'proc_statut_personnel';

export type JortSubcategory =
  | 'jort_lois'
  | 'jort_decrets'
  | 'jort_arretes'
  | 'jort_avis'
  | 'jort_nominations';

export type FormulairesSubcategory =
  | 'form_tribunal'
  | 'form_recette_finances'
  | 'form_conservation_fonciere'
  | 'form_greffe'
  | 'form_municipalite';

export type KnowledgeSubcategory =
  | LegislationSubcategory
  | JurisprudenceSubcategory
  | DoctrineSubcategory
  | ModelesSubcategory
  | ProceduresSubcategory
  | JortSubcategory
  | FormulairesSubcategory;

export interface CategoryInfo {
  id: KnowledgeCategory;
  labelFr: string;
  labelAr: string;
  icon: string;
  description?: string;
  subcategories: SubcategoryInfo[];
}

export interface SubcategoryInfo {
  id: string;
  labelFr: string;
  labelAr: string;
}

/**
 * Map des labels pour lookup rapide
 * Utilise le système central avec rétrocompatibilité pour anciennes catégories
 */
export const CATEGORY_LABELS: Record<string, { fr: string; ar: string }> = {
  ...LEGAL_CATEGORY_TRANSLATIONS,
  // Anciennes catégories (rétrocompatibilité)
  code: { fr: 'Code', ar: 'مجلة' },
  modele: { fr: 'Modèle', ar: 'نموذج' },
};

/**
 * Structure complète des catégories avec leurs sous-catégories
 */
export const KNOWLEDGE_CATEGORIES: CategoryInfo[] = [
  {
    id: 'legislation',
    labelFr: CATEGORY_LABELS.legislation.fr,
    labelAr: CATEGORY_LABELS.legislation.ar,
    icon: 'scale',
    description: 'Textes législatifs et réglementaires tunisiens',
    subcategories: [
      { id: 'coc', labelFr: 'Code des Obligations et Contrats', labelAr: 'مجلة الالتزامات والعقود' },
      { id: 'code_penal', labelFr: 'Code Pénal', labelAr: 'المجلة الجزائية' },
      { id: 'code_commerce', labelFr: 'Code de Commerce', labelAr: 'المجلة التجارية' },
      { id: 'code_travail', labelFr: 'Code du Travail', labelAr: 'مجلة الشغل' },
      { id: 'csp', labelFr: 'Code du Statut Personnel', labelAr: 'مجلة الأحوال الشخصية' },
      { id: 'code_fiscal', labelFr: 'Code Fiscal', labelAr: 'مجلة الجباية' },
      { id: 'constitution', labelFr: 'Constitution', labelAr: 'الدستور' },
      { id: 'loi_organique', labelFr: 'Loi Organique', labelAr: 'قانون أساسي' },
      { id: 'decret_loi', labelFr: 'Décret-Loi', labelAr: 'مرسوم' },
      { id: 'decret', labelFr: 'Décret', labelAr: 'أمر' },
      { id: 'arrete', labelFr: 'Arrêté', labelAr: 'قرار' },
      { id: 'circulaire', labelFr: 'Circulaire', labelAr: 'منشور' },
    ],
  },
  {
    id: 'jurisprudence',
    labelFr: CATEGORY_LABELS.jurisprudence.fr,
    labelAr: CATEGORY_LABELS.jurisprudence.ar,
    icon: 'gavel',
    description: 'Décisions de justice tunisiennes',
    subcategories: [
      { id: 'cassation', labelFr: 'Cour de Cassation', labelAr: 'محكمة التعقيب' },

      // Cours d'appel (ordre alphabétique ville)
      { id: 'appel_bizerte', labelFr: "Cour d'Appel de Bizerte", labelAr: 'محكمة الاستئناف ببنزرت' },
      { id: 'appel_gabes', labelFr: "Cour d'Appel de Gabès", labelAr: 'محكمة الاستئناف بقابس' },
      { id: 'appel_gafsa', labelFr: "Cour d'Appel de Gafsa", labelAr: 'محكمة الاستئناف بقفصة' },
      { id: 'appel_kairouan', labelFr: "Cour d'Appel de Kairouan", labelAr: 'محكمة الاستئناف بالقيروان' },
      { id: 'appel_medenine', labelFr: "Cour d'Appel de Médenine", labelAr: 'محكمة الاستئناف بمدنين' },
      { id: 'appel_monastir', labelFr: "Cour d'Appel de Monastir", labelAr: 'محكمة الاستئناف بالمنستير' },
      { id: 'appel_nabeul', labelFr: "Cour d'Appel de Nabeul", labelAr: 'محكمة الاستئناف بنابل' },
      { id: 'appel_sfax', labelFr: "Cour d'Appel de Sfax", labelAr: 'محكمة الاستئناف بصفاقس' },
      { id: 'appel_sousse', labelFr: "Cour d'Appel de Sousse", labelAr: 'محكمة الاستئناف بسوسة' },
      { id: 'appel_tunis', labelFr: "Cour d'Appel de Tunis", labelAr: 'محكمة الاستئناف بتونس' },
      { id: 'appel_kef', labelFr: "Cour d'Appel du Kef", labelAr: 'محكمة الاستئناف بالكاف' },

      // Tribunaux de première instance
      { id: 'premiere_instance', labelFr: 'Première Instance', labelAr: 'المحكمة الابتدائية' },

      // Juridictions spécialisées
      { id: 'tribunal_immobilier', labelFr: 'Tribunal Immobilier', labelAr: 'المحكمة العقارية' },
      { id: 'tribunal_administratif', labelFr: 'Tribunal Administratif', labelAr: 'المحكمة الإدارية' },
      { id: 'tribunal_commerce', labelFr: 'Tribunal de Commerce', labelAr: 'المحكمة التجارية' },
      { id: 'tribunal_travail', labelFr: 'Tribunal du Travail', labelAr: 'محكمة الشغل' },

      // Haute juridiction
      { id: 'conseil_constitutionnel', labelFr: 'Conseil Constitutionnel', labelAr: 'المجلس الدستوري' },
    ],
  },
  {
    id: 'doctrine',
    labelFr: CATEGORY_LABELS.doctrine.fr,
    labelAr: CATEGORY_LABELS.doctrine.ar,
    icon: 'book-open',
    description: 'Travaux académiques et commentaires juridiques',
    subcategories: [
      { id: 'article', labelFr: 'Article', labelAr: 'مقال' },
      { id: 'these', labelFr: 'Thèse', labelAr: 'أطروحة' },
      { id: 'commentaire', labelFr: 'Commentaire', labelAr: 'تعليق' },
      { id: 'ouvrage', labelFr: 'Ouvrage', labelAr: 'مؤلف' },
      { id: 'note_arret', labelFr: "Note d'Arrêt", labelAr: 'تعليق على حكم' },
      { id: 'revue_juridique', labelFr: 'Revue Juridique Tunisienne', labelAr: 'المجلة القانونية التونسية' },
    ],
  },
  {
    id: 'modeles',
    labelFr: CATEGORY_LABELS.modeles.fr,
    labelAr: CATEGORY_LABELS.modeles.ar,
    icon: 'file-text',
    description: 'Modèles de documents juridiques',
    subcategories: [
      { id: 'contrat', labelFr: 'Contrat', labelAr: 'عقد' },
      { id: 'requete', labelFr: 'Requête', labelAr: 'مطلب' },
      { id: 'conclusions', labelFr: 'Conclusions', labelAr: 'ملحوظات' },
      { id: 'correspondance', labelFr: 'Correspondance', labelAr: 'مراسلة' },
      { id: 'acte_notarie', labelFr: 'Acte Notarié', labelAr: 'عقد موثق' },
      { id: 'procuration', labelFr: 'Procuration', labelAr: 'توكيل' },
    ],
  },
  {
    id: 'procedures',
    labelFr: CATEGORY_LABELS.procedures.fr,
    labelAr: CATEGORY_LABELS.procedures.ar,
    icon: 'clipboard-list',
    description: 'Guides procéduraux par matière',
    subcategories: [
      { id: 'proc_civile', labelFr: 'Procédure Civile', labelAr: 'الإجراءات المدنية' },
      { id: 'proc_penale', labelFr: 'Procédure Pénale', labelAr: 'الإجراءات الجزائية' },
      { id: 'proc_commerciale', labelFr: 'Procédure Commerciale', labelAr: 'الإجراءات التجارية' },
      { id: 'proc_administrative', labelFr: 'Procédure Administrative', labelAr: 'الإجراءات الإدارية' },
      { id: 'proc_immobiliere', labelFr: 'Procédure Immobilière', labelAr: 'الإجراءات العقارية' },
      { id: 'proc_statut_personnel', labelFr: 'Statut Personnel', labelAr: 'الأحوال الشخصية' },
    ],
  },
  {
    id: 'jort',
    labelFr: CATEGORY_LABELS.jort.fr,
    labelAr: CATEGORY_LABELS.jort.ar,
    icon: 'newspaper',
    description: 'Journal Officiel de la République Tunisienne',
    subcategories: [
      { id: 'jort_lois', labelFr: 'Lois', labelAr: 'القوانين' },
      { id: 'jort_decrets', labelFr: 'Décrets', labelAr: 'الأوامر' },
      { id: 'jort_arretes', labelFr: 'Arrêtés', labelAr: 'القرارات' },
      { id: 'jort_avis', labelFr: 'Avis', labelAr: 'الإعلانات' },
      { id: 'jort_nominations', labelFr: 'Nominations', labelAr: 'التسميات' },
    ],
  },
  {
    id: 'formulaires',
    labelFr: CATEGORY_LABELS.formulaires.fr,
    labelAr: CATEGORY_LABELS.formulaires.ar,
    icon: 'file-input',
    description: 'Formulaires officiels tunisiens',
    subcategories: [
      { id: 'form_tribunal', labelFr: 'Tribunal', labelAr: 'المحكمة' },
      { id: 'form_recette_finances', labelFr: 'Recette des Finances', labelAr: 'القباضة المالية' },
      { id: 'form_conservation_fonciere', labelFr: 'Conservation Foncière', labelAr: 'إدارة الملكية العقارية' },
      { id: 'form_greffe', labelFr: 'Greffe', labelAr: 'كتابة المحكمة' },
      { id: 'form_municipalite', labelFr: 'Municipalité', labelAr: 'البلدية' },
    ],
  },
];

/**
 * Map des sous-catégories pour lookup rapide
 */
export const SUBCATEGORY_LABELS: Record<string, { fr: string; ar: string }> = {};

// Peupler SUBCATEGORY_LABELS
KNOWLEDGE_CATEGORIES.forEach((cat) => {
  cat.subcategories.forEach((sub) => {
    SUBCATEGORY_LABELS[sub.id] = { fr: sub.labelFr, ar: sub.labelAr };
  });
});

/**
 * Récupérer la catégorie parente d'une sous-catégorie
 */
export function getParentCategory(subcategoryId: string): KnowledgeCategory | null {
  for (const cat of KNOWLEDGE_CATEGORIES) {
    if (cat.subcategories.some((sub) => sub.id === subcategoryId)) {
      return cat.id;
    }
  }
  return null;
}

/**
 * Récupérer les sous-catégories d'une catégorie
 */
export function getSubcategories(categoryId: KnowledgeCategory): SubcategoryInfo[] {
  const category = KNOWLEDGE_CATEGORIES.find((c) => c.id === categoryId);
  return category?.subcategories || [];
}

/**
 * Récupérer le label bilingue d'une catégorie : "عربي (Français)"
 */
export function getCategoryLabel(categoryId: string, _lang?: 'fr' | 'ar'): string {
  const labels = CATEGORY_LABELS[categoryId];
  if (!labels) return categoryId;
  return `${labels.ar} (${labels.fr})`;
}

/**
 * Récupérer le label bilingue d'une sous-catégorie : "عربي (Français)"
 */
export function getSubcategoryLabel(subcategoryId: string, _lang?: 'fr' | 'ar'): string {
  const labels = SUBCATEGORY_LABELS[subcategoryId];
  if (!labels) return subcategoryId;
  return `${labels.ar} (${labels.fr})`;
}

/**
 * Vérifier si une sous-catégorie appartient à une catégorie
 */
export function isValidSubcategory(categoryId: string, subcategoryId: string): boolean {
  const category = KNOWLEDGE_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return false;
  return category.subcategories.some((sub) => sub.id === subcategoryId);
}

/**
 * Liste plate de toutes les catégories pour les selects
 */
export function getAllCategoriesFlat(): Array<{ value: string; labelFr: string; labelAr: string; isSubcategory: boolean; parent?: string }> {
  const result: Array<{ value: string; labelFr: string; labelAr: string; isSubcategory: boolean; parent?: string }> = [];

  KNOWLEDGE_CATEGORIES.forEach((cat) => {
    result.push({
      value: cat.id,
      labelFr: cat.labelFr,
      labelAr: cat.labelAr,
      isSubcategory: false,
    });

    cat.subcategories.forEach((sub) => {
      result.push({
        value: sub.id,
        labelFr: sub.labelFr,
        labelAr: sub.labelAr,
        isSubcategory: true,
        parent: cat.id,
      });
    });
  });

  return result;
}

/**
 * @deprecated Utiliser LEGAL_CATEGORY_BADGE_COLORS depuis @/lib/categories/legal-categories
 */
export const CATEGORY_COLORS: Record<string, string> = {
  ...(LEGAL_CATEGORY_BADGE_COLORS as Record<string, string>),
  // Rétrocompatibilité anciennes catégories
  code: LEGAL_CATEGORY_BADGE_COLORS.codes,
  modele: LEGAL_CATEGORY_BADGE_COLORS.modeles,
};

/**
 * @deprecated Utiliser LEGAL_CATEGORY_ICONS depuis @/lib/categories/legal-categories
 */
export const CATEGORY_ICONS: Record<string, string> = {
  ...(LEGAL_CATEGORY_ICONS as Record<string, string>),
  // Rétrocompatibilité anciennes catégories
  code: LEGAL_CATEGORY_ICONS.codes,
  modele: LEGAL_CATEGORY_ICONS.modeles,
};
