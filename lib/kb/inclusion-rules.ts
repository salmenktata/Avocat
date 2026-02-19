/**
 * Service de règles d'inclusion/exclusion pour la Knowledge Base
 *
 * Filtre les documents avant indexation selon des critères de qualité :
 * - Longueur minimale du contenu
 * - Ratio signal/bruit (trop de boilerplate)
 * - Doublons détectés (similarité titre/contenu)
 * - Catégories exclues / obligatoires
 *
 * @module lib/kb/inclusion-rules
 */

import { db } from '@/lib/db/postgres'

// =============================================================================
// TYPES
// =============================================================================

export interface InclusionRule {
  name: string
  check: (doc: DocumentCandidate) => RuleResult
}

export interface DocumentCandidate {
  title: string
  fullText: string
  category?: string
  subcategory?: string
  sourceUrl?: string
  language?: string
  metadata?: Record<string, unknown>
}

export interface RuleResult {
  passed: boolean
  reason: string
  severity: 'block' | 'warn'
}

export interface InclusionCheckResult {
  accepted: boolean
  ruleResults: Array<{ rule: string } & RuleResult>
  blockers: string[]
  warnings: string[]
}

// =============================================================================
// SEUILS
// =============================================================================

const THRESHOLDS = {
  /** Nombre minimum de caractères pour un document valide */
  MIN_CONTENT_LENGTH: 100,
  /** Nombre maximum de caractères (au-delà, probablement concaténation abusive) */
  MAX_CONTENT_LENGTH: 500_000,
  /** Ratio max de lignes vides ou boilerplate autorisé */
  MAX_NOISE_RATIO: 0.70,
  /** Nombre min de mots significatifs */
  MIN_WORD_COUNT: 20,
  /** Titre min length */
  MIN_TITLE_LENGTH: 5,
}

// =============================================================================
// RÈGLES
// =============================================================================

const NOISE_PATTERNS = [
  /^[\s\-=_*#]+$/,            // Lignes de séparateurs
  /^(copyright|©|tous droits)/i,
  /^(page|صفحة)\s*\d+/i,
  /^(loading|chargement)/i,
  /^\s*$/,                     // Lignes vides
]

const rules: InclusionRule[] = [
  {
    name: 'content_length_min',
    check: (doc) => ({
      passed: doc.fullText.length >= THRESHOLDS.MIN_CONTENT_LENGTH,
      reason: `Contenu trop court: ${doc.fullText.length} chars < ${THRESHOLDS.MIN_CONTENT_LENGTH}`,
      severity: 'block',
    }),
  },
  {
    name: 'content_length_max',
    check: (doc) => ({
      passed: doc.fullText.length <= THRESHOLDS.MAX_CONTENT_LENGTH,
      reason: `Contenu trop long: ${doc.fullText.length} chars > ${THRESHOLDS.MAX_CONTENT_LENGTH}`,
      severity: 'warn',
    }),
  },
  {
    name: 'word_count',
    check: (doc) => {
      const wordCount = doc.fullText.split(/\s+/).filter(w => w.length > 1).length
      return {
        passed: wordCount >= THRESHOLDS.MIN_WORD_COUNT,
        reason: `Trop peu de mots: ${wordCount} < ${THRESHOLDS.MIN_WORD_COUNT}`,
        severity: 'block',
      }
    },
  },
  {
    name: 'title_present',
    check: (doc) => ({
      passed: doc.title.trim().length >= THRESHOLDS.MIN_TITLE_LENGTH,
      reason: `Titre manquant ou trop court: "${doc.title}"`,
      severity: 'warn',
    }),
  },
  {
    name: 'noise_ratio',
    check: (doc) => {
      const lines = doc.fullText.split('\n')
      if (lines.length === 0) return { passed: true, reason: '', severity: 'warn' as const }
      const noiseLines = lines.filter(l => NOISE_PATTERNS.some(p => p.test(l))).length
      const ratio = noiseLines / lines.length
      return {
        passed: ratio <= THRESHOLDS.MAX_NOISE_RATIO,
        reason: `Ratio bruit trop élevé: ${(ratio * 100).toFixed(0)}% > ${THRESHOLDS.MAX_NOISE_RATIO * 100}%`,
        severity: 'warn',
      }
    },
  },
  {
    name: 'not_error_page',
    check: (doc) => {
      const errorPatterns = [
        /404\s*(not found|page non trouvée)/i,
        /403\s*forbidden/i,
        /500\s*internal server error/i,
        /access denied/i,
        /page introuvable/i,
      ]
      const isError = errorPatterns.some(p => p.test(doc.fullText.substring(0, 500)))
      return {
        passed: !isError,
        reason: 'Page d\'erreur détectée (404/403/500)',
        severity: 'block',
      }
    },
  },
  {
    name: 'not_login_page',
    check: (doc) => {
      const loginPatterns = [
        /\b(connectez-vous|se connecter|sign in|log in|تسجيل الدخول)\b/i,
      ]
      const textSample = doc.fullText.substring(0, 1000)
      const hasLogin = loginPatterns.some(p => p.test(textSample))
      const isShort = doc.fullText.length < 500
      return {
        passed: !(hasLogin && isShort),
        reason: 'Page de connexion détectée',
        severity: 'block',
      }
    },
  },
]

// =============================================================================
// API PUBLIQUE
// =============================================================================

/**
 * Vérifie si un document candidat passe les règles d'inclusion
 */
export function checkDocumentInclusion(doc: DocumentCandidate): InclusionCheckResult {
  const ruleResults = rules.map(rule => ({
    rule: rule.name,
    ...rule.check(doc),
  }))

  const blockers = ruleResults.filter(r => !r.passed && r.severity === 'block').map(r => r.reason)
  const warnings = ruleResults.filter(r => !r.passed && r.severity === 'warn').map(r => r.reason)

  return {
    accepted: blockers.length === 0,
    ruleResults,
    blockers,
    warnings,
  }
}

/**
 * Vérifie la similarité titre avec les documents existants (détection doublons)
 */
export async function checkDuplicateTitle(
  title: string,
  excludeId?: string
): Promise<{ isDuplicate: boolean; existingId?: string; existingTitle?: string }> {
  try {
    const query = excludeId
      ? `SELECT id, title FROM knowledge_base WHERE title = $1 AND id != $2 AND is_indexed = true LIMIT 1`
      : `SELECT id, title FROM knowledge_base WHERE title = $1 AND is_indexed = true LIMIT 1`

    const params = excludeId ? [title.trim(), excludeId] : [title.trim()]
    const result = await db.query(query, params)

    if (result.rows.length > 0) {
      return {
        isDuplicate: true,
        existingId: result.rows[0].id,
        existingTitle: result.rows[0].title,
      }
    }
    return { isDuplicate: false }
  } catch {
    return { isDuplicate: false }
  }
}

/**
 * Récupère les statistiques d'exclusion (pour monitoring)
 */
export async function getExclusionStats(daysBack: number = 30): Promise<{
  totalExcluded: number
  byReason: Record<string, number>
}> {
  try {
    const result = await db.query(
      `SELECT
         metadata->>'exclusion_reason' as reason,
         COUNT(*) as cnt
       FROM knowledge_base
       WHERE is_indexed = false
         AND metadata->>'exclusion_reason' IS NOT NULL
         AND updated_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY metadata->>'exclusion_reason'
       ORDER BY cnt DESC`,
      [daysBack]
    )

    const byReason: Record<string, number> = {}
    let totalExcluded = 0
    for (const row of result.rows) {
      byReason[row.reason] = parseInt(row.cnt)
      totalExcluded += parseInt(row.cnt)
    }

    return { totalExcluded, byReason }
  } catch {
    return { totalExcluded: 0, byReason: {} }
  }
}
