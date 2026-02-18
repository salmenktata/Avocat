import { z } from 'zod'

/**
 * Schéma de validation Zod pour les dossiers structurés
 * Assure la cohérence des données retournées par l'IA
 */

const extractedFactSchema = z.object({
  fait: z.string().min(1).optional().default('Fait non spécifié'),
  label: z.string().optional(),
  valeur: z.unknown().optional(), // Peut être string, number, object
  type: z.unknown().optional(), // Peut être string ou enum
  categorie: z.enum(['fait_juridique', 'interpretation', 'ressenti']).optional().default('fait_juridique'),
  dateApproximative: z.string().nullable().optional(),
  confidence: z.number().min(0).max(100).optional().default(50),
  source: z.string().nullable().optional(),
  preuve: z.string().nullable().optional(),
  importance: z.enum(['decisif', 'important', 'contexte']).optional().default('contexte'),
}).passthrough() // Accepte tous les champs supplémentaires

const legalAnalysisSchema = z.object({
  diagnostic: z.unknown().optional(), // Très permissif (string, object, array)
  qualification: z.unknown().optional(), // Accepte string OU object
  risques: z.union([z.array(z.string()), z.array(z.unknown())]).optional(), // Array de strings OU objets
  opportunites: z.union([z.array(z.string()), z.array(z.unknown())]).optional(),
  fondement: z.unknown().optional(), // Accepte string OU object
  recommandation: z.unknown().optional(), // Accepte string OU object
  // Champs supplémentaires des 7 phases
  syllogisme: z.unknown().optional(),
  recevabilite: z.unknown().optional(),
  competence: z.unknown().optional(),
  strategiePreuve: z.unknown().optional(),
  strategieGlobale: z.unknown().optional(),
  argumentation: z.unknown().optional(),
  analyseFaits: z.unknown().optional(),
  prochainesEtapes: z.unknown().optional(),
  recommandationStrategique: z.unknown().optional(),
}).passthrough() // Accepte TOUS les champs supplémentaires

const extractedChildSchema = z.object({
  prenom: z.string(),
  age: z.number().int().min(0).max(30),
  estMineur: z.boolean(),
})

const legalCalculationSchema = z.object({
  type: z.enum([
    'moutaa',
    'pension_alimentaire',
    'pension_epouse',
    'interets_moratoires',
    'indemnite_forfaitaire',
    'autre',
  ]),
  label: z.string(),
  montant: z.number().min(0),
  formule: z.string(),
  reference: z.string(),
  details: z.string().nullable().optional(),
})

const timelineStepSchema = z.object({
  etape: z.string().min(1),
  delaiJours: z.number().int().min(0),
  description: z.string(),
  obligatoire: z.boolean(),
  alertes: z.array(z.string()).nullable().optional(),
})

const suggestedActionSchema = z.object({
  titre: z.string().min(1),
  description: z.string().nullable().optional(),
  priorite: z.enum(['urgent', 'haute', 'moyenne', 'basse']),
  delaiJours: z.number().int().min(0).nullable().optional(),
  checked: z.boolean().default(false),
})

const legalReferenceSchema = z.object({
  type: z.enum(['code', 'jurisprudence', 'doctrine']),
  titre: z.string(),
  article: z.string().nullable().optional(),
  extrait: z.string().nullable().optional(),
  pertinence: z.number().min(0).max(100),
})

const partySchema = z.object({
  nom: z.string().min(1).default('Non spécifié'),
  prenom: z.string().nullable().optional(),
  role: z.enum(['demandeur', 'defendeur']).default('demandeur'),
  profession: z.string().nullable().optional(),
  revenus: z.number().nullable().optional(),
  adresse: z.string().nullable().optional(),
}).passthrough()

/**
 * Schéma principal pour un dossier structuré
 */
export const structuredDossierSchema = z.object({
  confidence: z.number().min(0).max(100).default(50),
  langue: z.enum(['ar', 'fr']).default('ar'),
  typeProcedure: z.enum([
    'civil_premiere_instance',
    'divorce',
    'commercial',
    'refere',
    'cassation',
    'penal',
    'administratif',
    'social',
    'autre',
  ]),
  sousType: z.string().nullable().optional(),
  analyseJuridique: legalAnalysisSchema.nullable().optional(),
  client: partySchema.optional().default({
    nom: 'Client',
    prenom: null,
    role: 'demandeur',
    profession: null,
    revenus: null,
    adresse: null,
  }),
  partieAdverse: partySchema.optional().default({
    nom: 'Partie adverse',
    prenom: null,
    role: 'defendeur',
    profession: null,
    revenus: null,
    adresse: null,
  }),
  faitsExtraits: z.array(extractedFactSchema).default([]),
  enfants: z.array(extractedChildSchema).nullable().optional(),
  calculs: z.array(legalCalculationSchema).default([]),
  timeline: z.array(timelineStepSchema).default([]),
  actionsSuggerees: z.array(suggestedActionSchema).default([]),
  references: z.array(legalReferenceSchema).default([]),
  titrePropose: z.string().min(1).optional().default('Nouveau dossier'),
  resumeCourt: z.string().default(''),
  donneesSpecifiques: z.record(z.unknown()).optional().default({}),
}).passthrough() // Accepte les champs supplémentaires non définis

/**
 * Type TypeScript inféré du schéma Zod
 */
export type StructuredDossierValidated = z.infer<typeof structuredDossierSchema>

/**
 * Fonction helper pour valider avec des erreurs détaillées
 */
export function validateStructuredDossier(data: unknown) {
  const result = structuredDossierSchema.safeParse(data)

  if (!result.success) {
    const errors = result.error.flatten()
    console.error('[Validation Zod] Erreurs:', {
      fieldErrors: errors.fieldErrors,
      formErrors: errors.formErrors,
    })
  }

  return result
}
