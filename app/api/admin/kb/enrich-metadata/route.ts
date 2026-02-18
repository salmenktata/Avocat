import { NextRequest, NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { db } from '@/lib/db/postgres'
import { enrichKBDocumentMetadata } from '@/lib/ai/kb-quality-analyzer-service'
import { getSession } from '@/lib/auth/session'

/**
 * POST /api/admin/kb/enrich-metadata
 *
 * Enrichit les métadonnées (description + tags) des documents KB dont la
 * complétude est faible, puis re-déclenche l'analyse qualité.
 *
 * Body params:
 * - batchSize (default: 10) — Nombre de documents à enrichir par batch
 * - category (optional) — Filtrer par catégorie
 * - maxCompletenesScore (default: 70) — Seuil : traiter docs avec completeness < N
 * - reanalyzeAfter (default: true) — Re-analyser la qualité après enrichissement
 * - dryRun (default: false) — Aperçu sans modifications
 *
 * Auth: Session admin ou X-Cron-Secret
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier authentification admin ou cron secret
    const cronSecret = request.headers.get('X-Cron-Secret')
    const isValidCron = cronSecret === process.env.CRON_SECRET

    if (!isValidCron) {
      const session = await getSession()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      }

      const userResult = await db.query('SELECT role FROM users WHERE id = $1', [session.user.id])
      const role = userResult.rows[0]?.role
      if (role !== 'admin' && role !== 'super_admin') {
        return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
      }
    }

    const body = await request.json()
    const batchSize = Math.min(parseInt(body.batchSize || '10', 10), 50)
    const category = body.category || null
    const maxCompletenessScore = parseInt(body.maxCompletenessScore || '70', 10)
    const reanalyzeAfter = body.reanalyzeAfter !== false
    const dryRun = body.dryRun === true

    console.log('[KB Enrich] Démarrage:', { batchSize, category, maxCompletenessScore, reanalyzeAfter, dryRun })

    // Identifier les documents à enrichir :
    // - description absente OU vide
    // - quality_completeness < seuil
    // - contenu suffisant (>= 100 chars)
    let query = `
      SELECT id, title, category, description, tags, quality_completeness, quality_score,
             LENGTH(COALESCE(full_text, '')) as text_length
      FROM knowledge_base
      WHERE is_active = true
        AND is_indexed = true
        AND LENGTH(COALESCE(full_text, '')) >= 100
        AND (description IS NULL OR description = '' OR LENGTH(description) < 30)
        AND (quality_completeness IS NULL OR quality_completeness < $1)
    `

    const params: (string | number)[] = [maxCompletenessScore]
    let paramIndex = 2

    if (category) {
      query += ` AND category = $${paramIndex}`
      params.push(category)
      paramIndex++
    }

    query += ` ORDER BY COALESCE(quality_completeness, 0) ASC LIMIT $${paramIndex}`
    params.push(batchSize)

    const result = await db.query<{
      id: string
      title: string
      category: string
      description: string | null
      tags: string[]
      quality_completeness: number | null
      quality_score: number | null
      text_length: number
    }>(query, params)

    const docs = result.rows

    if (docs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun document à enrichir (critères non satisfaits)',
        enriched: 0,
        results: [],
      })
    }

    console.log(`[KB Enrich] ${docs.length} documents à enrichir`)

    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'Mode DRY RUN — aperçu uniquement',
        count: docs.length,
        preview: docs.map(d => ({
          id: d.id,
          title: d.title.substring(0, 60),
          category: d.category,
          completeness: d.quality_completeness,
          qualityScore: d.quality_score,
          textLength: d.text_length,
          hasDescription: !!d.description,
        })),
      })
    }

    // Enrichir chaque document
    const results: Array<{
      documentId: string
      title: string
      success: boolean
      previousCompleteness?: number | null
      newQualityScore?: number
      error?: string
      processingTimeMs: number
    }> = []

    for (const doc of docs) {
      const startTime = Date.now()

      try {
        console.log(`[KB Enrich] Enrichissement "${doc.title.substring(0, 40)}" (${doc.id})...`)

        const enrichResult = await enrichKBDocumentMetadata(doc.id, reanalyzeAfter)

        results.push({
          documentId: doc.id,
          title: doc.title,
          success: true,
          previousCompleteness: doc.quality_completeness,
          newQualityScore: enrichResult.newQualityScore,
          processingTimeMs: Date.now() - startTime,
        })

        console.log(`   ✅ Enrichi en ${Date.now() - startTime}ms${enrichResult.newQualityScore ? ` → score qualité: ${enrichResult.newQualityScore}` : ''}`)

        // Pause entre chaque doc pour respecter les rate limits
        await new Promise(resolve => setTimeout(resolve, 1500))

      } catch (error) {
        console.error(`[KB Enrich] ❌ ${doc.id}:`, getErrorMessage(error))

        results.push({
          documentId: doc.id,
          title: doc.title,
          success: false,
          error: getErrorMessage(error),
          processingTimeMs: Date.now() - startTime,
        })
      }
    }

    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    const avgNewScore = results
      .filter(r => r.success && r.newQualityScore)
      .reduce((sum, r) => sum + (r.newQualityScore || 0), 0) / Math.max(succeeded, 1)

    return NextResponse.json({
      success: true,
      message: `Enrichissement terminé: ${succeeded}/${docs.length} réussis`,
      enriched: succeeded,
      failed,
      avgNewQualityScore: Math.round(avgNewScore) || null,
      results,
    })

  } catch (error) {
    console.error('[KB Enrich] Erreur:', error)
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error) || 'Erreur lors de l\'enrichissement',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/kb/enrich-metadata
 *
 * Retourne les statistiques des documents éligibles à l'enrichissement
 */
export async function GET() {
  try {
    const stats = await db.query<{
      total_eligible: number
      no_description: number
      low_completeness: number
      avg_completeness: number
      by_category: string
    }>(`
      SELECT
        COUNT(*) FILTER (
          WHERE (description IS NULL OR description = '' OR LENGTH(description) < 30)
            AND (quality_completeness IS NULL OR quality_completeness < 70)
        ) as total_eligible,
        COUNT(*) FILTER (WHERE description IS NULL OR description = '') as no_description,
        COUNT(*) FILTER (WHERE quality_completeness < 70) as low_completeness,
        ROUND(AVG(quality_completeness)) as avg_completeness
      FROM knowledge_base
      WHERE is_active = true AND is_indexed = true
        AND LENGTH(COALESCE(full_text, '')) >= 100
    `)

    const byCategory = await db.query<{ category: string; eligible: number; avg_completeness: number }>(`
      SELECT
        category,
        COUNT(*) FILTER (
          WHERE (description IS NULL OR description = '' OR LENGTH(description) < 30)
            AND (quality_completeness IS NULL OR quality_completeness < 70)
        ) as eligible,
        ROUND(AVG(quality_completeness)) as avg_completeness
      FROM knowledge_base
      WHERE is_active = true AND is_indexed = true
        AND LENGTH(COALESCE(full_text, '')) >= 100
      GROUP BY category
      ORDER BY eligible DESC
    `)

    return NextResponse.json({
      success: true,
      stats: {
        totalEligible: Number(stats.rows[0].total_eligible),
        noDescription: Number(stats.rows[0].no_description),
        lowCompleteness: Number(stats.rows[0].low_completeness),
        avgCompleteness: Number(stats.rows[0].avg_completeness) || 0,
      },
      byCategory: byCategory.rows.map(r => ({
        category: r.category,
        eligible: Number(r.eligible),
        avgCompleteness: Number(r.avg_completeness) || 0,
      })),
    })
  } catch (error) {
    console.error('[KB Enrich] Erreur stats:', error)
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
