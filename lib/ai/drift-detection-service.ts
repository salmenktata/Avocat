/**
 * Service de détection de drift (dégradation silencieuse) du RAG
 *
 * Analyse temporelle des métriques RAG pour détecter :
 * - Baisse de similarité moyenne (embeddings/search quality)
 * - Augmentation du taux d'abstention
 * - Augmentation des hallucinations flaggées
 * - Baisse de la satisfaction utilisateur (feedbacks)
 *
 * Peut être appelé par cron hebdomadaire pour alerter proactivement.
 *
 * @module lib/ai/drift-detection-service
 */

import { db } from '@/lib/db/postgres'

// =============================================================================
// TYPES
// =============================================================================

export interface DriftMetrics {
  period: { from: string; to: string }
  metrics: {
    avgSimilarity: number | null
    abstentionRate: number | null
    hallucinationRate: number | null
    avgFeedbackRating: number | null
    satisfactionRate: number | null
    totalConversations: number
  }
}

export interface DriftAlert {
  metric: string
  current: number
  previous: number
  changePercent: number
  severity: 'info' | 'warning' | 'critical'
  message: string
}

export interface DriftReport {
  currentPeriod: DriftMetrics
  previousPeriod: DriftMetrics
  alerts: DriftAlert[]
  overallStatus: 'stable' | 'warning' | 'degraded'
  generatedAt: string
}

// =============================================================================
// SEUILS
// =============================================================================

const DRIFT_THRESHOLDS = {
  /** Baisse de similarité moyenne considérée comme warning (%) */
  SIMILARITY_WARNING: 10,
  /** Baisse de similarité critique (%) */
  SIMILARITY_CRITICAL: 20,
  /** Augmentation du taux d'abstention warning (points de %) */
  ABSTENTION_WARNING: 5,
  /** Augmentation hallucination warning (points de %) */
  HALLUCINATION_WARNING: 5,
  /** Baisse satisfaction warning (points de %) */
  SATISFACTION_WARNING: 10,
}

// =============================================================================
// COLLECTE MÉTRIQUES
// =============================================================================

/**
 * Collecte les métriques RAG pour une période donnée
 */
async function collectMetrics(fromDate: string, toDate: string): Promise<DriftMetrics['metrics']> {
  // 1. Similarité moyenne + abstentions depuis rag_eval_results (si dispo)
  let avgSimilarity: number | null = null
  let abstentionRate: number | null = null

  try {
    const evalResult = await db.query(
      `SELECT
         ROUND(AVG(avg_similarity)::numeric, 4) as avg_sim,
         ROUND(
           (COUNT(*) FILTER (WHERE abstention_reason IS NOT NULL))::numeric /
           NULLIF(COUNT(*), 0) * 100, 2
         ) as abstention_pct
       FROM rag_eval_results
       WHERE created_at >= $1::date AND created_at < $2::date`,
      [fromDate, toDate]
    )
    if (evalResult.rows.length > 0) {
      avgSimilarity = evalResult.rows[0].avg_sim ? parseFloat(evalResult.rows[0].avg_sim) : null
      abstentionRate = evalResult.rows[0].abstention_pct ? parseFloat(evalResult.rows[0].abstention_pct) : null
    }
  } catch {
    // Table peut ne pas exister
  }

  // 2. Taux hallucination
  let hallucinationRate: number | null = null
  try {
    const hallResult = await db.query(
      `SELECT
         ROUND(
           (COUNT(*) FILTER (WHERE flagged = true))::numeric /
           NULLIF(COUNT(*), 0) * 100, 2
         ) as halluc_rate
       FROM rag_hallucination_checks
       WHERE created_at >= $1::date AND created_at < $2::date`,
      [fromDate, toDate]
    )
    if (hallResult.rows.length > 0 && hallResult.rows[0].halluc_rate) {
      hallucinationRate = parseFloat(hallResult.rows[0].halluc_rate)
    }
  } catch {
    // Table peut ne pas exister
  }

  // 3. Feedbacks
  let avgFeedbackRating: number | null = null
  let satisfactionRate: number | null = null
  try {
    const fbResult = await db.query(
      `SELECT
         ROUND(AVG(rating)::numeric, 2) as avg_rating,
         ROUND(
           (COUNT(*) FILTER (WHERE rating >= 4))::numeric /
           NULLIF(COUNT(*), 0) * 100, 2
         ) as satisfaction
       FROM rag_feedback
       WHERE created_at >= $1::date AND created_at < $2::date`,
      [fromDate, toDate]
    )
    if (fbResult.rows.length > 0) {
      avgFeedbackRating = fbResult.rows[0].avg_rating ? parseFloat(fbResult.rows[0].avg_rating) : null
      satisfactionRate = fbResult.rows[0].satisfaction ? parseFloat(fbResult.rows[0].satisfaction) : null
    }
  } catch {
    // Table peut ne pas exister
  }

  // 4. Total conversations
  let totalConversations = 0
  try {
    const convResult = await db.query(
      `SELECT COUNT(DISTINCT id) as total
       FROM conversations
       WHERE created_at >= $1::date AND created_at < $2::date`,
      [fromDate, toDate]
    )
    totalConversations = parseInt(convResult.rows[0]?.total || '0')
  } catch {
    // pas critique
  }

  return {
    avgSimilarity,
    abstentionRate,
    hallucinationRate,
    avgFeedbackRating,
    satisfactionRate,
    totalConversations,
  }
}

// =============================================================================
// DÉTECTION DRIFT
// =============================================================================

function computeAlerts(current: DriftMetrics['metrics'], previous: DriftMetrics['metrics']): DriftAlert[] {
  const alerts: DriftAlert[] = []

  // Similarité : baisse = dégradation
  if (current.avgSimilarity != null && previous.avgSimilarity != null && previous.avgSimilarity > 0) {
    const changePct = ((previous.avgSimilarity - current.avgSimilarity) / previous.avgSimilarity) * 100
    if (changePct >= DRIFT_THRESHOLDS.SIMILARITY_CRITICAL) {
      alerts.push({
        metric: 'avgSimilarity',
        current: current.avgSimilarity,
        previous: previous.avgSimilarity,
        changePercent: -changePct,
        severity: 'critical',
        message: `Similarité moyenne en baisse critique: ${current.avgSimilarity.toFixed(3)} → ${previous.avgSimilarity.toFixed(3)} (-${changePct.toFixed(1)}%)`,
      })
    } else if (changePct >= DRIFT_THRESHOLDS.SIMILARITY_WARNING) {
      alerts.push({
        metric: 'avgSimilarity',
        current: current.avgSimilarity,
        previous: previous.avgSimilarity,
        changePercent: -changePct,
        severity: 'warning',
        message: `Similarité moyenne en baisse: ${current.avgSimilarity.toFixed(3)} → ${previous.avgSimilarity.toFixed(3)} (-${changePct.toFixed(1)}%)`,
      })
    }
  }

  // Abstention : hausse = dégradation
  if (current.abstentionRate != null && previous.abstentionRate != null) {
    const diff = current.abstentionRate - previous.abstentionRate
    if (diff >= DRIFT_THRESHOLDS.ABSTENTION_WARNING) {
      alerts.push({
        metric: 'abstentionRate',
        current: current.abstentionRate,
        previous: previous.abstentionRate,
        changePercent: diff,
        severity: diff >= DRIFT_THRESHOLDS.ABSTENTION_WARNING * 2 ? 'critical' : 'warning',
        message: `Taux d'abstention en hausse: ${previous.abstentionRate.toFixed(1)}% → ${current.abstentionRate.toFixed(1)}% (+${diff.toFixed(1)} pts)`,
      })
    }
  }

  // Hallucination : hausse = dégradation
  if (current.hallucinationRate != null && previous.hallucinationRate != null) {
    const diff = current.hallucinationRate - previous.hallucinationRate
    if (diff >= DRIFT_THRESHOLDS.HALLUCINATION_WARNING) {
      alerts.push({
        metric: 'hallucinationRate',
        current: current.hallucinationRate,
        previous: previous.hallucinationRate,
        changePercent: diff,
        severity: diff >= DRIFT_THRESHOLDS.HALLUCINATION_WARNING * 2 ? 'critical' : 'warning',
        message: `Taux hallucination en hausse: ${previous.hallucinationRate.toFixed(1)}% → ${current.hallucinationRate.toFixed(1)}% (+${diff.toFixed(1)} pts)`,
      })
    }
  }

  // Satisfaction : baisse = dégradation
  if (current.satisfactionRate != null && previous.satisfactionRate != null) {
    const diff = previous.satisfactionRate - current.satisfactionRate
    if (diff >= DRIFT_THRESHOLDS.SATISFACTION_WARNING) {
      alerts.push({
        metric: 'satisfactionRate',
        current: current.satisfactionRate,
        previous: previous.satisfactionRate,
        changePercent: -diff,
        severity: diff >= DRIFT_THRESHOLDS.SATISFACTION_WARNING * 2 ? 'critical' : 'warning',
        message: `Satisfaction en baisse: ${previous.satisfactionRate.toFixed(1)}% → ${current.satisfactionRate.toFixed(1)}% (-${diff.toFixed(1)} pts)`,
      })
    }
  }

  return alerts
}

// =============================================================================
// API PUBLIQUE
// =============================================================================

/**
 * Génère un rapport de drift comparant la période récente avec la précédente
 *
 * @param periodDays - Taille de chaque période en jours (défaut: 7)
 */
export async function generateDriftReport(periodDays: number = 7): Promise<DriftReport> {
  const now = new Date()
  const currentFrom = new Date(now)
  currentFrom.setDate(currentFrom.getDate() - periodDays)
  const previousFrom = new Date(currentFrom)
  previousFrom.setDate(previousFrom.getDate() - periodDays)

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const [currentMetrics, previousMetrics] = await Promise.all([
    collectMetrics(fmt(currentFrom), fmt(now)),
    collectMetrics(fmt(previousFrom), fmt(currentFrom)),
  ])

  const currentPeriod: DriftMetrics = {
    period: { from: fmt(currentFrom), to: fmt(now) },
    metrics: currentMetrics,
  }
  const previousPeriod: DriftMetrics = {
    period: { from: fmt(previousFrom), to: fmt(currentFrom) },
    metrics: previousMetrics,
  }

  const alerts = computeAlerts(currentMetrics, previousMetrics)

  const hasCritical = alerts.some(a => a.severity === 'critical')
  const hasWarning = alerts.some(a => a.severity === 'warning')
  const overallStatus = hasCritical ? 'degraded' : hasWarning ? 'warning' : 'stable'

  return {
    currentPeriod,
    previousPeriod,
    alerts,
    overallStatus,
    generatedAt: now.toISOString(),
  }
}

/**
 * Vérifie le drift et retourne uniquement les alertes (pour cron)
 */
export async function checkDrift(periodDays: number = 7): Promise<{
  status: 'stable' | 'warning' | 'degraded'
  alerts: DriftAlert[]
}> {
  const report = await generateDriftReport(periodDays)
  return { status: report.overallStatus, alerts: report.alerts }
}
