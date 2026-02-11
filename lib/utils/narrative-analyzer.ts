/**
 * Analyseur de narratif local (sans LLM)
 * Fournit des feedbacks progressifs pendant la saisie d'un narratif juridique
 *
 * @module lib/utils/narrative-analyzer
 * @see Sprint 2 - Workflow Assistant → Validation
 */

import { createLogger } from '@/lib/logger'

const log = createLogger('Utils:NarrativeAnalyzer')

/**
 * Résultat d'analyse de narratif
 */
export interface NarrativeAnalysis {
  /**
   * Longueur du narratif en caractères
   */
  length: number

  /**
   * Nombre de mots
   */
  wordCount: number

  /**
   * Langue détectée (heuristique simple)
   */
  detectedLanguage: 'ar' | 'fr' | 'mixed' | 'unknown'

  /**
   * Qualité globale (0-100)
   */
  qualityScore: number

  /**
   * Complétude (0-100)
   */
  completenessScore: number

  /**
   * Suggestions d'amélioration
   */
  suggestions: NarrativeSuggestion[]

  /**
   * Éléments détectés
   */
  detectedElements: DetectedElement[]

  /**
   * Problèmes détectés
   */
  issues: NarrativeIssue[]
}

/**
 * Suggestion d'amélioration
 */
export interface NarrativeSuggestion {
  id: string
  type: 'missing' | 'improve' | 'clarify'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  category: 'parties' | 'dates' | 'montants' | 'faits' | 'contexte'
}

/**
 * Élément détecté dans le narratif
 */
export interface DetectedElement {
  type: 'date' | 'montant' | 'personne' | 'lieu' | 'bien'
  value: string
  confidence: number
  position: number
}

/**
 * Problème détecté
 */
export interface NarrativeIssue {
  type: 'trop_court' | 'manque_dates' | 'manque_parties' | 'vague' | 'incohérent'
  severity: 'error' | 'warning' | 'info'
  message: string
}

/**
 * Analyse un narratif juridique
 */
export function analyzeNarrative(text: string): NarrativeAnalysis {
  const trimmed = text.trim()

  // Métriques de base
  const length = trimmed.length
  const wordCount = countWords(trimmed)
  const detectedLanguage = detectLanguage(trimmed)

  // Éléments détectés
  const detectedElements: DetectedElement[] = [
    ...detectDates(trimmed),
    ...detectAmounts(trimmed),
    ...detectPersons(trimmed),
    ...detectPlaces(trimmed),
  ]

  // Problèmes
  const issues = detectIssues(trimmed, wordCount, detectedElements)

  // Suggestions
  const suggestions = generateSuggestions(trimmed, detectedElements, issues)

  // Scores
  const qualityScore = calculateQualityScore(wordCount, detectedElements, issues)
  const completenessScore = calculateCompletenessScore(detectedElements)

  return {
    length,
    wordCount,
    detectedLanguage,
    qualityScore,
    completenessScore,
    suggestions,
    detectedElements,
    issues,
  }
}

/**
 * Compte les mots
 */
function countWords(text: string): number {
  // Supporte français et arabe
  return text.split(/\s+/).filter((word) => word.length > 0).length
}

/**
 * Détecte la langue (heuristique simple)
 */
function detectLanguage(text: string): 'ar' | 'fr' | 'mixed' | 'unknown' {
  if (text.length < 10) return 'unknown'

  const arabicChars = text.match(/[\u0600-\u06FF]/g)?.length || 0
  const frenchChars = text.match(/[a-zA-ZàâäéèêëïîôùûüÿæœçÀÂÄÉÈÊËÏÎÔÙÛÜŸÆŒÇ]/g)?.length || 0

  const totalChars = text.replace(/\s/g, '').length
  const arabicRatio = arabicChars / totalChars
  const frenchRatio = frenchChars / totalChars

  if (arabicRatio > 0.6) return 'ar'
  if (frenchRatio > 0.6) return 'fr'
  if (arabicRatio > 0.2 && frenchRatio > 0.2) return 'mixed'
  return 'unknown'
}

/**
 * Détecte les dates
 */
function detectDates(text: string): DetectedElement[] {
  const datePatterns = [
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g, // DD/MM/YYYY
    /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g, // YYYY-MM-DD
    /\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})\b/gi, // Mois YYYY
  ]

  const dates: DetectedElement[] = []
  let position = 0

  datePatterns.forEach((pattern) => {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      dates.push({
        type: 'date',
        value: match[0],
        confidence: 0.8,
        position: match.index || position++,
      })
    }
  })

  return dates
}

/**
 * Détecte les montants
 */
function detectAmounts(text: string): DetectedElement[] {
  const amountPatterns = [
    /\b(\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{1,2})?)\s*(TND|dinars?|DT|د\.ت)\b/gi,
    /\b(\d+)\s*(mille|million|milliard)\s*(TND|dinars?|DT|د\.ت)\b/gi,
  ]

  const amounts: DetectedElement[] = []
  let position = 0

  amountPatterns.forEach((pattern) => {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      amounts.push({
        type: 'montant',
        value: match[0],
        confidence: 0.9,
        position: match.index || position++,
      })
    }
  })

  return amounts
}

/**
 * Détecte les personnes (heuristique simple)
 */
function detectPersons(text: string): DetectedElement[] {
  const personPatterns = [
    /\b(M\.|Mme|Mr|Madame|Monsieur)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
    /(demandeur|demanderesse|défendeur|défenderesse|client|cliente)/gi,
  ]

  const persons: DetectedElement[] = []
  let position = 0

  personPatterns.forEach((pattern) => {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      persons.push({
        type: 'personne',
        value: match[0],
        confidence: 0.6,
        position: match.index || position++,
      })
    }
  })

  return persons
}

/**
 * Détecte les lieux
 */
function detectPlaces(text: string): DetectedElement[] {
  // Villes tunisiennes communes
  const tunisianCities = [
    'Tunis',
    'Sfax',
    'Sousse',
    'Kairouan',
    'Bizerte',
    'Gabès',
    'Ariana',
    'Gafsa',
    'Monastir',
    'Ben Arous',
  ]

  const places: DetectedElement[] = []

  tunisianCities.forEach((city) => {
    const regex = new RegExp(`\\b${city}\\b`, 'gi')
    const matches = text.matchAll(regex)
    for (const match of matches) {
      places.push({
        type: 'lieu',
        value: match[0],
        confidence: 0.7,
        position: match.index || 0,
      })
    }
  })

  return places
}

/**
 * Détecte les problèmes
 */
function detectIssues(
  text: string,
  wordCount: number,
  elements: DetectedElement[]
): NarrativeIssue[] {
  const issues: NarrativeIssue[] = []

  // Trop court
  if (wordCount < 50) {
    issues.push({
      type: 'trop_court',
      severity: 'error',
      message: 'Le narratif est trop court. Minimum recommandé : 50 mots.',
    })
  } else if (wordCount < 100) {
    issues.push({
      type: 'trop_court',
      severity: 'warning',
      message: 'Le narratif pourrait être plus détaillé. Recommandé : 100+ mots.',
    })
  }

  // Manque de dates
  const dates = elements.filter((e) => e.type === 'date')
  if (dates.length === 0) {
    issues.push({
      type: 'manque_dates',
      severity: 'warning',
      message: 'Aucune date détectée. Les dates sont importantes pour établir la chronologie.',
    })
  }

  // Manque de parties
  const persons = elements.filter((e) => e.type === 'personne')
  if (persons.length < 2) {
    issues.push({
      type: 'manque_parties',
      severity: 'warning',
      message: 'Identifiez clairement les parties (demandeur et défendeur).',
    })
  }

  // Texte trop vague
  const vagueWords = ['peut-être', 'je pense', 'probablement', 'environ']
  const hasVagueWords = vagueWords.some((word) => text.toLowerCase().includes(word))
  if (hasVagueWords) {
    issues.push({
      type: 'vague',
      severity: 'info',
      message: 'Le récit contient des termes vagues. Soyez aussi précis que possible.',
    })
  }

  return issues
}

/**
 * Génère des suggestions
 */
function generateSuggestions(
  text: string,
  elements: DetectedElement[],
  issues: NarrativeIssue[]
): NarrativeSuggestion[] {
  const suggestions: NarrativeSuggestion[] = []

  // Suggestions basées sur les éléments manquants
  const dates = elements.filter((e) => e.type === 'date')
  const amounts = elements.filter((e) => e.type === 'montant')
  const persons = elements.filter((e) => e.type === 'personne')

  if (dates.length === 0) {
    suggestions.push({
      id: 'add-dates',
      type: 'missing',
      severity: 'high',
      title: 'Ajouter des dates',
      description: 'Précisez les dates importantes (mariage, incident, etc.)',
      category: 'dates',
    })
  }

  if (amounts.length === 0 && text.toLowerCase().includes('pension')) {
    suggestions.push({
      id: 'add-amounts',
      type: 'missing',
      severity: 'high',
      title: 'Préciser les montants',
      description: 'Indiquez les montants en TND (pension, revenus, etc.)',
      category: 'montants',
    })
  }

  if (persons.length < 2) {
    suggestions.push({
      id: 'add-parties',
      type: 'missing',
      severity: 'high',
      title: 'Identifier les parties',
      description: 'Nommez clairement le demandeur et le défendeur',
      category: 'parties',
    })
  }

  // Suggestion contexte
  if (text.length < 500) {
    suggestions.push({
      id: 'add-context',
      type: 'improve',
      severity: 'medium',
      title: 'Enrichir le contexte',
      description: 'Ajoutez des détails sur le contexte, la situation actuelle, et vos objectifs',
      category: 'contexte',
    })
  }

  return suggestions
}

/**
 * Calcule le score de qualité
 */
function calculateQualityScore(
  wordCount: number,
  elements: DetectedElement[],
  issues: NarrativeIssue[]
): number {
  let score = 0

  // Longueur (max 30 points)
  if (wordCount >= 200) score += 30
  else if (wordCount >= 100) score += 20
  else if (wordCount >= 50) score += 10

  // Éléments détectés (max 40 points)
  const dates = elements.filter((e) => e.type === 'date').length
  const amounts = elements.filter((e) => e.type === 'montant').length
  const persons = elements.filter((e) => e.type === 'personne').length

  score += Math.min(dates * 5, 15) // Max 15 points
  score += Math.min(amounts * 5, 10) // Max 10 points
  score += Math.min(persons * 5, 15) // Max 15 points

  // Pénalités pour problèmes (max -30 points)
  issues.forEach((issue) => {
    if (issue.severity === 'error') score -= 15
    else if (issue.severity === 'warning') score -= 5
  })

  return Math.max(0, Math.min(100, score))
}

/**
 * Calcule le score de complétude
 */
function calculateCompletenessScore(elements: DetectedElement[]): number {
  const categories = ['date', 'montant', 'personne', 'lieu']
  const detected = new Set(elements.map((e) => e.type))

  const score = (detected.size / categories.length) * 100
  return Math.round(score)
}
