/**
 * Service Stats Pipeline KB
 * Fournit les métriques du funnel, comptages par étape, bottlenecks
 */

import { db } from '@/lib/db/postgres'
import type { PipelineStage, PipelineDocument } from './document-pipeline-service'

// =============================================================================
// TYPES
// =============================================================================

export interface PipelineFunnelStats {
  stages: Array<{
    stage: PipelineStage
    label: string
    count: number
    percentage: number
  }>
  total: number
  pendingValidation: number
  rejected: number
  needsRevision: number
}

export interface StageDocumentsResult {
  documents: PipelineDocumentSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PipelineDocumentSummary {
  id: string
  title: string
  category: string
  subcategory: string | null
  language: string
  pipeline_stage: PipelineStage
  pipeline_stage_updated_at: string
  quality_score: number | null
  is_indexed: boolean
  source_file: string | null
  metadata: Record<string, unknown>
  created_at: string
  days_in_stage: number
  web_source_id: string | null
  source_name: string | null
}

export interface PipelineBottleneck {
  stage: PipelineStage
  label: string
  count: number
  avgDaysInStage: number
  oldestDocDate: string | null
}

// =============================================================================
// STAGE LABELS
// =============================================================================

export const STAGE_LABELS: Record<PipelineStage, string> = {
  source_configured: 'Source configurée',
  crawled: 'Crawlé & Extrait',
  content_reviewed: 'Contenu validé',
  classified: 'Classifié',
  indexed: 'Indexé',
  quality_analyzed: 'Qualité analysée',
  rag_active: 'RAG Actif',
  rejected: 'Rejeté',
  needs_revision: 'À réviser',
}

const PIPELINE_ORDER: PipelineStage[] = [
  'source_configured',
  'crawled',
  'content_reviewed',
  'classified',
  'indexed',
  'quality_analyzed',
  'rag_active',
]

// =============================================================================
// FUNNEL STATS
// =============================================================================

export async function getPipelineFunnelStats(): Promise<PipelineFunnelStats> {
  const result = await db.query(
    `SELECT pipeline_stage, COUNT(*) as cnt
    FROM knowledge_base
    WHERE is_active = true OR pipeline_stage = 'rejected'
    GROUP BY pipeline_stage
    ORDER BY pipeline_stage`
  )

  const countMap: Record<string, number> = {}
  let total = 0
  for (const row of result.rows) {
    countMap[row.pipeline_stage] = parseInt(row.cnt)
    total += parseInt(row.cnt)
  }

  const stages = PIPELINE_ORDER.map(stage => ({
    stage,
    label: STAGE_LABELS[stage],
    count: countMap[stage] || 0,
    percentage: total > 0 ? Math.round(((countMap[stage] || 0) / total) * 100) : 0,
  }))

  const pendingValidation = PIPELINE_ORDER
    .filter(s => s !== 'rag_active')
    .reduce((sum, s) => sum + (countMap[s] || 0), 0)

  return {
    stages,
    total,
    pendingValidation,
    rejected: countMap['rejected'] || 0,
    needsRevision: countMap['needs_revision'] || 0,
  }
}

// =============================================================================
// STAGE DOCUMENTS (paginated)
// =============================================================================

export async function getStageDocuments(
  stage: PipelineStage,
  page: number = 1,
  limit: number = 20,
  filters?: {
    search?: string
    category?: string
    language?: string
    sourceId?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }
): Promise<StageDocumentsResult> {
  const offset = (page - 1) * limit
  const conditions: string[] = ['kb.pipeline_stage = $1']
  const params: unknown[] = [stage]
  let paramIdx = 2

  if (filters?.search) {
    conditions.push(`(kb.title ILIKE $${paramIdx} OR kb.source_file ILIKE $${paramIdx})`)
    params.push(`%${filters.search}%`)
    paramIdx++
  }

  if (filters?.category) {
    conditions.push(`kb.category = $${paramIdx}`)
    params.push(filters.category)
    paramIdx++
  }

  if (filters?.language) {
    conditions.push(`kb.language = $${paramIdx}`)
    params.push(filters.language)
    paramIdx++
  }

  if (filters?.sourceId) {
    conditions.push(`ws.id = $${paramIdx}`)
    params.push(filters.sourceId)
    paramIdx++
  }

  const where = conditions.join(' AND ')
  const sortBy = filters?.sortBy || 'pipeline_stage_updated_at'
  const sortOrder = filters?.sortOrder || 'desc'
  const validSortColumns = ['pipeline_stage_updated_at', 'created_at', 'title', 'quality_score', 'category', 'source_name']
  const safeSort = validSortColumns.includes(sortBy) ? sortBy : 'pipeline_stage_updated_at'
  const safeSortCol = safeSort === 'source_name' ? 'ws.name' : `kb.${safeSort}`
  const safeOrder = sortOrder === 'asc' ? 'ASC' : 'DESC'

  const [docsResult, countResult] = await Promise.all([
    db.query(
      `SELECT kb.id, kb.title, kb.category, kb.subcategory, kb.language,
        kb.pipeline_stage, kb.pipeline_stage_updated_at, kb.quality_score,
        kb.is_indexed, kb.source_file, kb.metadata, kb.created_at,
        EXTRACT(EPOCH FROM (NOW() - kb.pipeline_stage_updated_at)) / 86400 as days_in_stage,
        ws.id as web_source_id,
        ws.name as source_name
      FROM knowledge_base kb
      LEFT JOIN web_pages wp ON wp.knowledge_base_id = kb.id
      LEFT JOIN web_sources ws ON wp.web_source_id = ws.id
      WHERE ${where}
      ORDER BY ${safeSortCol} ${safeOrder}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    ),
    db.query(
      `SELECT COUNT(*) as cnt
      FROM knowledge_base kb
      LEFT JOIN web_pages wp ON wp.knowledge_base_id = kb.id
      LEFT JOIN web_sources ws ON wp.web_source_id = ws.id
      WHERE ${where}`,
      params
    ),
  ])

  const total = parseInt(countResult.rows[0].cnt)

  return {
    documents: docsResult.rows.map(row => ({
      ...row,
      days_in_stage: Math.round(parseFloat(row.days_in_stage) * 10) / 10,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

// =============================================================================
// BOTTLENECKS
// =============================================================================

export async function getBottlenecks(): Promise<PipelineBottleneck[]> {
  const result = await db.query(
    `SELECT
      pipeline_stage,
      COUNT(*) as cnt,
      AVG(EXTRACT(EPOCH FROM (NOW() - pipeline_stage_updated_at)) / 86400) as avg_days,
      MIN(pipeline_stage_updated_at) as oldest_doc
    FROM knowledge_base
    WHERE pipeline_stage NOT IN ('rag_active', 'rejected')
      AND is_active = true
    GROUP BY pipeline_stage
    ORDER BY cnt DESC`
  )

  return result.rows.map(row => ({
    stage: row.pipeline_stage as PipelineStage,
    label: STAGE_LABELS[row.pipeline_stage as PipelineStage] || row.pipeline_stage,
    count: parseInt(row.cnt),
    avgDaysInStage: Math.round(parseFloat(row.avg_days || '0') * 10) / 10,
    oldestDocDate: row.oldest_doc,
  }))
}

// =============================================================================
// AVERAGE TIME PER STAGE
// =============================================================================

export async function getAverageTimePerStage(): Promise<Array<{
  stage: string
  avgHours: number
  count: number
}>> {
  const result = await db.query(
    `SELECT
      from_stage,
      to_stage,
      COUNT(*) as cnt,
      AVG(EXTRACT(EPOCH FROM (
        h2.created_at - h1.created_at
      )) / 3600) as avg_hours
    FROM document_pipeline_history h1
    JOIN LATERAL (
      SELECT created_at FROM document_pipeline_history h2
      WHERE h2.knowledge_base_id = h1.knowledge_base_id
        AND h2.created_at > h1.created_at
      ORDER BY h2.created_at ASC
      LIMIT 1
    ) h2 ON true
    WHERE h1.action IN ('admin_approve', 'backfill')
      AND h1.from_stage IS NOT NULL
    GROUP BY from_stage, to_stage
    ORDER BY from_stage`
  )

  return result.rows.map(row => ({
    stage: `${row.from_stage} → ${row.to_stage}`,
    avgHours: Math.round(parseFloat(row.avg_hours || '0') * 10) / 10,
    count: parseInt(row.cnt),
  }))
}
