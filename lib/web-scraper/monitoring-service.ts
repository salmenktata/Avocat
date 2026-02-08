/**
 * Service de monitoring et métriques pour le crawler
 * Tracking de la santé, détection de bannissements, alertes
 */

import { db } from '@/lib/db/postgres'
import type { CrawlerHealthStats, SourceBanStatus } from './types'

/**
 * Enregistre une métrique de crawl (succès ou échec)
 */
export async function recordCrawlMetric(
  sourceId: string,
  success: boolean,
  statusCode?: number,
  responseTimeMs?: number,
  isBanDetection: boolean = false
): Promise<void> {
  const now = new Date()
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
  const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)

  try {
    // Récupérer ou créer l'entrée pour cette heure
    await db.query(`
      INSERT INTO crawler_health_metrics (
        web_source_id,
        period_start,
        period_end,
        total_requests,
        successful_requests,
        failed_requests,
        errors_429,
        errors_403,
        errors_503,
        errors_5xx,
        ban_detections,
        pages_this_hour,
        pages_this_day,
        avg_response_time_ms
      )
      VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12)
      ON CONFLICT (web_source_id, period_start, period_end)
      DO UPDATE SET
        total_requests = crawler_health_metrics.total_requests + 1,
        successful_requests = crawler_health_metrics.successful_requests + $4,
        failed_requests = crawler_health_metrics.failed_requests + $5,
        errors_429 = crawler_health_metrics.errors_429 + $6,
        errors_403 = crawler_health_metrics.errors_403 + $7,
        errors_503 = crawler_health_metrics.errors_503 + $8,
        errors_5xx = crawler_health_metrics.errors_5xx + $9,
        ban_detections = crawler_health_metrics.ban_detections + $10,
        pages_this_hour = crawler_health_metrics.pages_this_hour + $11,
        pages_this_day = crawler_health_metrics.pages_this_day + $11,
        avg_response_time_ms = CASE
          WHEN $12 IS NOT NULL THEN
            (COALESCE(crawler_health_metrics.avg_response_time_ms, 0) *
             crawler_health_metrics.total_requests + $12) /
            (crawler_health_metrics.total_requests + 1)
          ELSE crawler_health_metrics.avg_response_time_ms
        END
    `, [
      sourceId,
      hourStart,
      hourEnd,
      success ? 1 : 0,
      success ? 0 : 1,
      statusCode === 429 ? 1 : 0,
      statusCode === 403 ? 1 : 0,
      statusCode === 503 ? 1 : 0,
      (statusCode && statusCode >= 500 && statusCode < 600) ? 1 : 0,
      isBanDetection ? 1 : 0,
      success ? 1 : 0, // pages_this_hour/day
      responseTimeMs || null,
    ])
  } catch (error) {
    console.error('[Monitoring] Erreur enregistrement métrique:', error)
  }
}

/**
 * Récupère les métriques de santé pour une source
 */
export async function getCrawlerHealthStats(
  sourceId: string,
  periodHours: number = 24
): Promise<CrawlerHealthStats | null> {
  try {
    const periodStart = new Date(Date.now() - periodHours * 60 * 60 * 1000)

    const result = await db.query<CrawlerHealthStats>(`
      SELECT
        ws.id as "sourceId",
        ws.name as "sourceName",
        COALESCE(SUM(chm.total_requests), 0)::INTEGER as "totalRequests",
        COALESCE(SUM(chm.successful_requests), 0)::INTEGER as "successfulRequests",
        COALESCE(SUM(chm.failed_requests), 0)::INTEGER as "failedRequests",
        CASE
          WHEN SUM(chm.total_requests) > 0
          THEN (SUM(chm.successful_requests)::NUMERIC / SUM(chm.total_requests)::NUMERIC * 100)::NUMERIC(5,2)
          ELSE 0
        END as "successRate",
        COALESCE(SUM(chm.errors_429), 0)::INTEGER as "errors429",
        COALESCE(SUM(chm.errors_403), 0)::INTEGER as "errors403",
        COALESCE(SUM(chm.errors_503), 0)::INTEGER as "errors503",
        COALESCE(SUM(chm.errors_5xx), 0)::INTEGER as "errors5xx",
        COALESCE(SUM(chm.ban_detections), 0)::INTEGER as "banDetections",
        COALESCE(bs.is_banned, FALSE) as "currentlyBanned",
        bs.banned_at as "lastBanAt",
        COALESCE(AVG(chm.avg_response_time_ms)::INTEGER, 0) as "avgResponseTimeMs",
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY chm.avg_response_time_ms)::INTEGER, 0) as "medianResponseTimeMs",
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY chm.avg_response_time_ms)::INTEGER, 0) as "p95ResponseTimeMs",
        (
          SELECT COALESCE(SUM(pages_this_hour), 0)
          FROM crawler_health_metrics
          WHERE web_source_id = ws.id
            AND period_start >= NOW() - INTERVAL '1 hour'
        )::INTEGER as "pagesThisHour",
        (
          SELECT COALESCE(SUM(pages_this_day), 0)
          FROM crawler_health_metrics
          WHERE web_source_id = ws.id
            AND period_start >= NOW() - INTERVAL '1 day'
        )::INTEGER as "pagesThisDay",
        ws.max_pages_per_hour as "quotaHourlyLimit",
        ws.max_pages_per_day as "quotaDailyLimit",
        (
          (ws.max_pages_per_hour IS NOT NULL AND
           (SELECT COALESCE(SUM(pages_this_hour), 0)
            FROM crawler_health_metrics
            WHERE web_source_id = ws.id
              AND period_start >= NOW() - INTERVAL '1 hour') >= ws.max_pages_per_hour)
          OR
          (ws.max_pages_per_day IS NOT NULL AND
           (SELECT COALESCE(SUM(pages_this_day), 0)
            FROM crawler_health_metrics
            WHERE web_source_id = ws.id
              AND period_start >= NOW() - INTERVAL '1 day') >= ws.max_pages_per_day)
        ) as "quotaExceeded",
        MIN(chm.period_start) as "periodStart",
        MAX(chm.period_end) as "periodEnd",
        ws.last_crawl_at as "lastCrawlAt"
      FROM web_sources ws
      LEFT JOIN crawler_health_metrics chm ON ws.id = chm.web_source_id
        AND chm.period_start >= $2
      LEFT JOIN web_source_ban_status bs ON ws.id = bs.web_source_id
      WHERE ws.id = $1
      GROUP BY ws.id, ws.name, ws.max_pages_per_hour, ws.max_pages_per_day,
               ws.last_crawl_at, bs.is_banned, bs.banned_at
    `, [sourceId, periodStart])

    return result.rows[0] || null
  } catch (error) {
    console.error('[Monitoring] Erreur récupération stats santé:', error)
    return null
  }
}

/**
 * Récupère le statut de bannissement d'une source
 */
export async function getSourceBanStatus(sourceId: string): Promise<SourceBanStatus | null> {
  try {
    const result = await db.query<{
      source_id: string
      is_banned: boolean
      banned_at: Date | null
      retry_after: Date | null
      reason: string | null
      detection_confidence: 'low' | 'medium' | 'high' | null
    }>(`
      SELECT
        web_source_id as source_id,
        is_banned,
        banned_at,
        retry_after,
        reason,
        detection_confidence
      FROM web_source_ban_status
      WHERE web_source_id = $1
    `, [sourceId])

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      sourceId: row.source_id,
      isBanned: row.is_banned,
      bannedAt: row.banned_at || undefined,
      retryAfter: row.retry_after || undefined,
      reason: row.reason || undefined,
      detectionConfidence: row.detection_confidence || undefined,
    }
  } catch (error) {
    console.error('[Monitoring] Erreur récupération statut ban:', error)
    return null
  }
}

/**
 * Marque une source comme bannie
 */
export async function markSourceAsBanned(
  sourceId: string,
  reason: string,
  confidence: 'low' | 'medium' | 'high',
  retryAfterMs: number = 3600000
): Promise<void> {
  try {
    await db.query(
      'SELECT mark_source_as_banned($1, $2, $3, $4)',
      [sourceId, reason, confidence, retryAfterMs]
    )

    console.log(`[Monitoring] Source ${sourceId} marquée comme bannie: ${reason}`)

    // TODO: Envoyer alerte Email/Slack
  } catch (error) {
    console.error('[Monitoring] Erreur marquage bannissement:', error)
    throw error
  }
}

/**
 * Débannit une source
 */
export async function unbanSource(sourceId: string): Promise<void> {
  try {
    await db.query('SELECT unban_source($1)', [sourceId])
    console.log(`[Monitoring] Source ${sourceId} débannie`)
  } catch (error) {
    console.error('[Monitoring] Erreur débannissement:', error)
    throw error
  }
}

/**
 * Vérifie si une source peut crawler (pas bannie, quotas OK)
 */
export async function canSourceCrawl(sourceId: string): Promise<{
  canCrawl: boolean
  reason?: string
}> {
  try {
    // Vérifier bannissement
    const banStatus = await getSourceBanStatus(sourceId)
    if (banStatus?.isBanned) {
      const now = new Date()
      const retryAfter = banStatus.retryAfter ? new Date(banStatus.retryAfter) : null

      if (retryAfter && now < retryAfter) {
        return {
          canCrawl: false,
          reason: `Banni jusqu'à ${retryAfter.toISOString()} (raison: ${banStatus.reason})`,
        }
      } else if (retryAfter && now >= retryAfter) {
        // Débannir automatiquement si délai écoulé
        await unbanSource(sourceId)
      }
    }

    // Vérifier quotas
    const stats = await getCrawlerHealthStats(sourceId, 24)
    if (stats?.quotaExceeded) {
      return {
        canCrawl: false,
        reason: 'Quota journalier ou horaire dépassé',
      }
    }

    return { canCrawl: true }
  } catch (error) {
    console.error('[Monitoring] Erreur vérification canCrawl:', error)
    return { canCrawl: true } // En cas d'erreur, autoriser le crawl
  }
}

/**
 * Récupère toutes les sources avec leur santé
 */
export async function getAllSourcesHealth(
  periodHours: number = 24
): Promise<CrawlerHealthStats[]> {
  try {
    const result = await db.query<{ id: string }>('SELECT id FROM web_sources WHERE is_active = TRUE')

    const healthStats = await Promise.all(
      result.rows.map(row => getCrawlerHealthStats(row.id, periodHours))
    )

    return healthStats.filter((s): s is CrawlerHealthStats => s !== null)
  } catch (error) {
    console.error('[Monitoring] Erreur récupération santé globale:', error)
    return []
  }
}

/**
 * Nettoie les anciennes métriques (conservation 30 jours)
 */
export async function cleanOldMetrics(retentionDays: number = 30): Promise<number> {
  try {
    const result = await db.query(`
      DELETE FROM crawler_health_metrics
      WHERE period_start < NOW() - INTERVAL '${retentionDays} days'
      RETURNING id
    `)

    console.log(`[Monitoring] ${result.rows.length} anciennes métriques supprimées`)
    return result.rows.length
  } catch (error) {
    console.error('[Monitoring] Erreur nettoyage métriques:', error)
    return 0
  }
}
