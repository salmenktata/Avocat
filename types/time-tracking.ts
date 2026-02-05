// Types pour le time tracking

export interface TimeEntry {
  id: string
  date: string
  heure_debut: string | null
  heure_fin: string | null
  duree_minutes: number
  description: string | null
  notes: string | null
  taux_horaire: number | null
  montant_calcule: string | null
  facture_id: string | null
  facturable: boolean
  dossier_id: string | null
  user_id: string
  created_at?: string
  updated_at?: string
  dossiers?: {
    numero: string
    objet: string
  }
}

export interface ActiveTimer {
  id: string
  date: string
  heure_debut: string
  description: string | null
  dossier_id: string | null
  user_id: string
  dossiers?: {
    numero?: string
    objet?: string
    clients?: {
      type_client: string
      nom: string
      prenom?: string | null
    }
  }
}
