import { z } from 'zod'

export const timeEntrySchema = z.object({
  dossier_id: z.string().uuid('Dossier invalide'),
  description: z.string().min(3, 'La description doit contenir au moins 3 caractères'),
  date: z.string().min(1, 'La date est requise'),
  heure_debut: z.string().optional(),
  heure_fin: z.string().optional(),
  duree_minutes: z.number().int().positive('La durée doit être positive'),
  taux_horaire: z.number().positive('Le taux horaire doit être positif').optional(),
  facturable: z.boolean().default(true),
  notes: z.string().optional(),
})

export const timerSchema = z.object({
  dossier_id: z.string().uuid('Dossier invalide'),
  description: z.string().min(3, 'La description est requise'),
  heure_debut: z.string().min(1, 'L\'heure de début est requise'),
})

export type TimeEntryFormData = z.infer<typeof timeEntrySchema>
export type TimerFormData = z.infer<typeof timerSchema>
