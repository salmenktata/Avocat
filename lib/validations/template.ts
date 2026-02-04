import { z } from 'zod'

export const templateSchema = z.object({
  titre: z.string().min(3, 'Le titre doit contenir au moins 3 caractères'),
  description: z.string().optional(),
  type_document: z.enum([
    'assignation',
    'requete',
    'conclusions_demandeur',
    'conclusions_defenseur',
    'constitution_avocat',
    'mise_en_demeure',
    'appel',
    'refere',
    'procuration',
    'autre',
  ], {
    errorMap: () => ({ message: 'Type de document invalide' }),
  }),
  contenu: z.string().min(10, 'Le contenu doit contenir au moins 10 caractères'),
  variables: z.array(z.string()).default([]),
  est_public: z.boolean().default(false),
})

export type TemplateFormData = z.infer<typeof templateSchema>

export const TYPE_DOCUMENT_LABELS: Record<string, string> = {
  assignation: 'Assignation',
  requete: 'Requête',
  conclusions_demandeur: 'Conclusions (Demandeur)',
  conclusions_defenseur: 'Conclusions (Défenseur)',
  constitution_avocat: 'Constitution d\'avocat',
  mise_en_demeure: 'Mise en demeure',
  appel: 'Déclaration d\'appel',
  refere: 'Référé',
  procuration: 'Procuration',
  autre: 'Autre',
}

// Schéma pour générer un document à partir d'un template
export const generateDocumentSchema = z.object({
  template_id: z.string().uuid('ID de template invalide'),
  dossier_id: z.string().uuid('ID de dossier invalide'),
  variables_values: z.record(z.string(), z.string()), // {variable: valeur}
})

export type GenerateDocumentData = z.infer<typeof generateDocumentSchema>
