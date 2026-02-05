/**
 * Utilitaires de calculs pour litiges commerciaux tunisiens
 * Conformité: Code Commerce tunisien + Loi recouvrement 2017
 */

/**
 * Taux Moyen du Marché (TMM) Tunisie
 * Source: Banque Centrale de Tunisie (BCT)
 * Valeur indicative 2026: ~7.5% (variable trimestriellement)
 *
 * ⚠️ À ACTUALISER selon publications BCT
 */
export const TMM_TUNISIE = 7.5 // %

/**
 * Taux intérêts moratoires commerciaux = TMM + 7 points
 * Référence: Code Commerce tunisien
 */
export const TAUX_INTERETS_COMMERCIAUX = TMM_TUNISIE + 7 // 14.5%

/**
 * Indemnité forfaitaire de recouvrement
 * Loi n° 2017-18 du 14 février 2017
 */
export const INDEMNITE_FORFAITAIRE_RECOUVREMENT = 40 // TND

/**
 * Délai d'appel en matière commerciale
 * ⚠️ TRÈS COURT: 10 jours seulement (vs 20j civil)
 */
export const DELAI_APPEL_COMMERCIAL_JOURS = 10

/**
 * Interface pour données calcul créance commerciale
 */
export interface CreanceCommerciale {
  montantPrincipal: number // Créance initiale TND
  dateMiseEnDemeure: Date // Point départ intérêts
  dateCalcul?: Date // Date calcul (défaut: aujourd'hui)
  tauxInteret?: number // Taux custom (défaut: TMM+7)
  includeIndemnite?: boolean // Inclure indemnité forfaitaire (défaut: true)
}

/**
 * Interface résultat calcul
 */
export interface ResultatCalculCreance {
  montantPrincipal: number
  joursRetard: number
  tauxInteret: number
  interetsCalcules: number
  indemniteForfaitaire: number
  totalDu: number
  detail: {
    dateMiseEnDemeure: string
    dateCalcul: string
    formuleInterets: string
  }
}

/**
 * Calculer le nombre de jours entre deux dates
 */
export function calculerJoursRetard(dateDebut: Date, dateFin: Date): number {
  const diff = dateFin.getTime() - dateDebut.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Calculer les intérêts moratoires commerciaux
 *
 * Formule: Principal × (Taux / 100) × (Jours / 365)
 *
 * @param montantPrincipal Créance initiale en TND
 * @param joursRetard Nombre de jours de retard
 * @param tauxInteret Taux annuel (défaut: TMM+7 = 14.5%)
 * @returns Montant des intérêts en TND
 */
export function calculerInterets(
  montantPrincipal: number,
  joursRetard: number,
  tauxInteret: number = TAUX_INTERETS_COMMERCIAUX
): number {
  if (montantPrincipal <= 0 || joursRetard <= 0) return 0
  const interets = montantPrincipal * (tauxInteret / 100) * (joursRetard / 365)
  return Math.round(interets * 1000) / 1000 // Arrondi 3 décimales
}

/**
 * Calculer le total dû d'une créance commerciale
 * Inclut: Principal + Intérêts + Indemnité forfaitaire
 *
 * @param data Données de la créance
 * @returns Résultat détaillé du calcul
 */
export function calculerCreanceCommerciale(
  data: CreanceCommerciale
): ResultatCalculCreance {
  const {
    montantPrincipal,
    dateMiseEnDemeure,
    dateCalcul = new Date(),
    tauxInteret = TAUX_INTERETS_COMMERCIAUX,
    includeIndemnite = true,
  } = data

  // Validation
  if (montantPrincipal <= 0) {
    throw new Error('Le montant principal doit être positif')
  }

  if (dateMiseEnDemeure > dateCalcul) {
    throw new Error('La date de mise en demeure ne peut pas être dans le futur')
  }

  // Calculs
  const joursRetard = calculerJoursRetard(dateMiseEnDemeure, dateCalcul)
  const interetsCalcules = calculerInterets(montantPrincipal, joursRetard, tauxInteret)
  const indemniteForfaitaire = includeIndemnite ? INDEMNITE_FORFAITAIRE_RECOUVREMENT : 0
  const totalDu = montantPrincipal + interetsCalcules + indemniteForfaitaire

  // Formule pour documentation
  const formuleInterets = `${montantPrincipal.toFixed(3)} × (${tauxInteret}% / 100) × (${joursRetard} / 365) = ${interetsCalcules.toFixed(3)} TND`

  return {
    montantPrincipal,
    joursRetard,
    tauxInteret,
    interetsCalcules,
    indemniteForfaitaire,
    totalDu: Math.round(totalDu * 1000) / 1000,
    detail: {
      dateMiseEnDemeure: dateMiseEnDemeure.toISOString().split('T')[0],
      dateCalcul: dateCalcul.toISOString().split('T')[0],
      formuleInterets,
    },
  }
}

/**
 * Calculer les intérêts à une date future (prévision)
 * Utile pour estimer intérêts au jour du jugement
 */
export function prevoirInteretsADate(
  montantPrincipal: number,
  dateMiseEnDemeure: Date,
  dateCible: Date,
  tauxInteret: number = TAUX_INTERETS_COMMERCIAUX
): number {
  const joursRetard = calculerJoursRetard(dateMiseEnDemeure, dateCible)
  return calculerInterets(montantPrincipal, joursRetard, tauxInteret)
}

/**
 * Formater un montant en TND avec 3 décimales
 */
export function formaterMontantTND(montant: number): string {
  return `${montant.toFixed(3)} TND`
}

/**
 * Vérifier si le délai d'appel commercial (10j) est dépassé
 */
export function verifierDelaiAppel(dateJugement: Date, dateVerification: Date = new Date()): {
  estDepasse: boolean
  joursRestants: number
  dateExpiration: Date
} {
  const dateExpiration = new Date(dateJugement)
  dateExpiration.setDate(dateExpiration.getDate() + DELAI_APPEL_COMMERCIAL_JOURS)

  const joursEcoules = calculerJoursRetard(dateJugement, dateVerification)
  const joursRestants = DELAI_APPEL_COMMERCIAL_JOURS - joursEcoules

  return {
    estDepasse: dateVerification > dateExpiration,
    joursRestants: Math.max(0, joursRestants),
    dateExpiration,
  }
}

/**
 * Calculer décompte actualisé pour conclusions
 * Utile pour actualiser les intérêts dans les conclusions
 */
export function genererDecompteActualise(data: CreanceCommerciale): string {
  const resultat = calculerCreanceCommerciale(data)

  let decompte = '=== DÉCOMPTE ACTUALISÉ ===\n\n'
  decompte += `Créance principale: ${formaterMontantTND(resultat.montantPrincipal)}\n`
  decompte += `\nIntérêts moratoires (${resultat.tauxInteret}%):\n`
  decompte += `  Du ${resultat.detail.dateMiseEnDemeure} au ${resultat.detail.dateCalcul}\n`
  decompte += `  ${resultat.joursRetard} jours × ${resultat.tauxInteret}%\n`
  decompte += `  Montant: ${formaterMontantTND(resultat.interetsCalcules)}\n`

  if (resultat.indemniteForfaitaire > 0) {
    decompte += `\nIndemnité forfaitaire (loi 2017): ${formaterMontantTND(resultat.indemniteForfaitaire)}\n`
  }

  decompte += `\n${'='.repeat(40)}\n`
  decompte += `TOTAL DÛ: ${formaterMontantTND(resultat.totalDu)}\n`
  decompte += `${'='.repeat(40)}\n`

  return decompte
}

/**
 * Types de litiges commerciaux courants en Tunisie
 */
export enum TypeLitigeCommercial {
  CHEQUE_SANS_PROVISION = 'cheque_sans_provision',
  RUPTURE_CONTRAT = 'rupture_contrat',
  CONCURRENCE_DELOYALE = 'concurrence_deloyale',
  RECOUVREMENT = 'recouvrement',
  LITIGE_SOCIETES = 'litige_societes',
  FONDS_COMMERCE = 'fonds_commerce',
  BAIL_COMMERCIAL = 'bail_commercial',
}

/**
 * Labels français pour types litiges
 */
export const TYPE_LITIGE_LABELS: Record<TypeLitigeCommercial, string> = {
  [TypeLitigeCommercial.CHEQUE_SANS_PROVISION]: 'Chèque sans provision',
  [TypeLitigeCommercial.RUPTURE_CONTRAT]: 'Rupture de contrat commercial',
  [TypeLitigeCommercial.CONCURRENCE_DELOYALE]: 'Concurrence déloyale',
  [TypeLitigeCommercial.RECOUVREMENT]: 'Recouvrement de créances',
  [TypeLitigeCommercial.LITIGE_SOCIETES]: 'Litige entre associés',
  [TypeLitigeCommercial.FONDS_COMMERCE]: 'Cession fonds de commerce',
  [TypeLitigeCommercial.BAIL_COMMERCIAL]: 'Bail commercial',
}
