/**
 * Service KB Quality Analysis — Mode Batch Groq
 *
 * Remplace les appels sync LLM (90s timeout, rate-limit) par l'API Batch Groq :
 * - Traitement asynchrone sur 24h
 * - -50% de coût (plan Startup)
 * - Aucun impact sur les rate limits standard de l'API sync
 *
 * Flow :
 *   submitKBQualityBatch()         → sélectionne docs → JSONL → upload → createBatch → stocke en DB
 *   checkAndProcessPendingBatches() → poll Groq → si complété → download → saveKBQualityScores
 */

import { db } from '@/lib/db/postgres'
import {
  uploadBatchFile,
  createBatch,
  getBatchStatus,
  downloadBatchResults,
  type GroqBatchRequest,
  type GroqBatchResult,
} from '@/lib/ai/groq-batch-client'
import {
  KB_QUALITY_ANALYSIS_SYSTEM_PROMPT,
  KB_QUALITY_ANALYSIS_USER_PROMPT,
  formatPrompt,
  truncateContent,
} from '@/lib/ai/prompts/legal-analysis'
import { parseKBQualityResponse } from '@/lib/ai/kb-quality-analyzer-service'

// =============================================================================
// TYPES
// =============================================================================

export interface KBBatchSubmitOptions {
  /** Nombre max de documents à inclure dans le batch (défaut: 500) */
  batchSize?: number
  /** Filtrer par catégorie */
  category?: string
  /** Si true, ignore les docs déjà analysés (défaut: true) */
  skipAnalyzed?: boolean
  /** Si true, inclut les docs avec score = 50 (échecs précédents) */
  includeFailedScores?: boolean
}

export interface KBBatchSubmitResult {
  success: boolean
  batchJobId: string
  groqBatchId: string
  totalDocuments: number
  message: string
}

export interface KBBatchProcessResult {
  batchJobId: string
  groqBatchId: string
  status: string
  processed?: number
  succeeded?: number
  failed?: number
  message: string
}

// Préfixe des custom_id pour identifier nos requêtes KB quality
const CUSTOM_ID_PREFIX = 'kb-quality-'

// =============================================================================
// SOUMISSION D'UN BATCH
// =============================================================================

/**
 * Sélectionne des documents KB, construit les requêtes JSONL,
 * les uploade sur Groq et crée un job batch.
 */
export async function submitKBQualityBatch(
  options: KBBatchSubmitOptions = {}
): Promise<KBBatchSubmitResult> {
  const {
    batchSize = 500,
    category = null,
    skipAnalyzed = true,
    includeFailedScores = false,
  } = options

  // 1. Sélectionner les documents à analyser
  const params: unknown[] = []
  let paramIdx = 1
  let whereClause = 'WHERE is_active = true AND (full_text IS NOT NULL AND length(full_text) >= 100)'

  if (category) {
    whereClause += ` AND category = $${paramIdx++}`
    params.push(category)
  }

  if (skipAnalyzed) {
    if (includeFailedScores) {
      // Docs sans score OU avec score = 50 (échecs précédents)
      whereClause += ` AND (quality_score IS NULL OR quality_score = 50)`
    } else {
      whereClause += ` AND quality_score IS NULL`
    }
  }

  params.push(batchSize)
  const query = `
    SELECT id, title, category, language, description, tags, full_text
    FROM knowledge_base
    ${whereClause}
    ORDER BY quality_assessed_at ASC NULLS FIRST
    LIMIT $${paramIdx}
  `

  const docsResult = await db.query<{
    id: string
    title: string
    category: string
    language: string
    description: string | null
    tags: string[] | null
    full_text: string
  }>(query, params)

  const docs = docsResult.rows

  if (docs.length === 0) {
    throw new Error('Aucun document à analyser avec les critères fournis')
  }

  console.log(`[KB Batch] ${docs.length} documents sélectionnés pour batch`)

  // 2. Construire les requêtes JSONL
  const requests: GroqBatchRequest[] = docs.map(doc => {
    const userPrompt = formatPrompt(KB_QUALITY_ANALYSIS_USER_PROMPT, {
      title: doc.title || 'Sans titre',
      category: doc.category || 'autre',
      language: doc.language || 'ar',
      description: doc.description || 'Aucune description',
      tags: (doc.tags || []).join(', ') || 'Aucun tag',
      content: truncateContent(doc.full_text, 12000),
    })

    return {
      custom_id: `${CUSTOM_ID_PREFIX}${doc.id}`,
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: KB_QUALITY_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      },
    }
  })

  // 3. Upload JSONL + créer le batch Groq
  const fileId = await uploadBatchFile(requests)
  const batchStatus = await createBatch(fileId)

  // 4. Persister en DB pour tracking
  const documentIds = docs.map(d => d.id)
  const insertResult = await db.query<{ id: string }>(
    `INSERT INTO groq_batch_jobs
       (groq_batch_id, groq_file_id, operation, document_ids, status, total_requests)
     VALUES ($1, $2, 'kb-quality-analysis', $3, $4, $5)
     RETURNING id`,
    [
      batchStatus.id,
      fileId,
      JSON.stringify(documentIds),
      batchStatus.status,
      docs.length,
    ]
  )

  const batchJobId = insertResult.rows[0].id
  console.log(`[KB Batch] Job créé en DB: ${batchJobId} → Groq: ${batchStatus.id}`)

  return {
    success: true,
    batchJobId,
    groqBatchId: batchStatus.id,
    totalDocuments: docs.length,
    message: `Batch soumis : ${docs.length} documents en cours de traitement (24h window)`,
  }
}

// =============================================================================
// POLLING & TRAITEMENT DES RÉSULTATS
// =============================================================================

/**
 * Vérifie le statut d'un batch et traite les résultats s'il est complété
 */
export async function checkAndProcessBatch(batchJobId: string): Promise<KBBatchProcessResult> {
  // Récupérer le job en DB
  const jobResult = await db.query<{
    id: string
    groq_batch_id: string
    status: string
    document_ids: string[]
  }>(
    `SELECT id, groq_batch_id, status, document_ids FROM groq_batch_jobs WHERE id = $1`,
    [batchJobId]
  )

  if (jobResult.rows.length === 0) {
    throw new Error(`Job batch non trouvé: ${batchJobId}`)
  }

  const job = jobResult.rows[0]

  if (job.status === 'completed') {
    return {
      batchJobId,
      groqBatchId: job.groq_batch_id,
      status: 'completed',
      message: 'Ce batch a déjà été traité',
    }
  }

  if (['failed', 'expired', 'cancelled'].includes(job.status)) {
    return {
      batchJobId,
      groqBatchId: job.groq_batch_id,
      status: job.status,
      message: `Batch terminé avec statut: ${job.status}`,
    }
  }

  // Interroger Groq pour le statut actuel
  const groqStatus = await getBatchStatus(job.groq_batch_id)

  // Mettre à jour le statut en DB
  await db.query(
    `UPDATE groq_batch_jobs SET
       status = $1,
       completed_requests = $2,
       failed_requests = $3,
       result_file_id = $4,
       error_file_id = $5
     WHERE id = $6`,
    [
      groqStatus.status,
      groqStatus.request_counts.completed,
      groqStatus.request_counts.failed,
      groqStatus.output_file_id || null,
      groqStatus.error_file_id || null,
      batchJobId,
    ]
  )

  // Si pas encore terminé → retourner le statut courant
  if (groqStatus.status !== 'completed') {
    return {
      batchJobId,
      groqBatchId: job.groq_batch_id,
      status: groqStatus.status,
      message: `En cours : ${groqStatus.request_counts.completed}/${groqStatus.request_counts.total} complétées`,
    }
  }

  // Le batch est complété → télécharger et traiter les résultats
  if (!groqStatus.output_file_id) {
    throw new Error(`Batch complété mais pas de fichier résultat: ${job.groq_batch_id}`)
  }

  const results = await downloadBatchResults(groqStatus.output_file_id)
  console.log(`[KB Batch] ${results.length} résultats téléchargés`)

  const processingResults = await saveQualityResultsToDB(results)

  // Marquer le job comme complété en DB
  await db.query(
    `UPDATE groq_batch_jobs SET
       status = 'completed',
       completed_at = NOW(),
       completed_requests = $1,
       failed_requests = $2
     WHERE id = $3`,
    [processingResults.succeeded, processingResults.failed, batchJobId]
  )

  console.log(`[KB Batch] ✅ Batch ${batchJobId} traité: ${processingResults.succeeded} OK, ${processingResults.failed} échecs`)

  return {
    batchJobId,
    groqBatchId: job.groq_batch_id,
    status: 'completed',
    processed: results.length,
    succeeded: processingResults.succeeded,
    failed: processingResults.failed,
    message: `Batch traité : ${processingResults.succeeded} scores sauvegardés, ${processingResults.failed} échecs`,
  }
}

/**
 * Vérifie tous les batches en attente et traite ceux qui sont complétés.
 * Appelé par le cron ou manuellement.
 */
export async function checkAndProcessAllPendingBatches(): Promise<KBBatchProcessResult[]> {
  const pendingResult = await db.query<{ id: string }>(
    `SELECT id FROM groq_batch_jobs
     WHERE status IN ('submitted', 'validating', 'in_progress', 'finalizing')
     ORDER BY created_at ASC`
  )

  if (pendingResult.rows.length === 0) {
    console.log('[KB Batch] Aucun batch en attente')
    return []
  }

  console.log(`[KB Batch] ${pendingResult.rows.length} batch(es) en attente à vérifier`)

  const results: KBBatchProcessResult[] = []
  for (const row of pendingResult.rows) {
    try {
      const result = await checkAndProcessBatch(row.id)
      results.push(result)
    } catch (error) {
      console.error(`[KB Batch] Erreur traitement batch ${row.id}:`, error)
      results.push({
        batchJobId: row.id,
        groqBatchId: '',
        status: 'error',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      })
    }
  }

  return results
}

// =============================================================================
// SAUVEGARDE DES RÉSULTATS EN DB
// =============================================================================

async function saveQualityResultsToDB(
  results: GroqBatchResult[]
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0
  let failed = 0

  const safeRound = (val: unknown): number =>
    Math.round(parseFloat(String(val || 0)))

  for (const result of results) {
    // Extraire le documentId depuis le custom_id
    if (!result.custom_id?.startsWith(CUSTOM_ID_PREFIX)) {
      console.warn('[KB Batch] custom_id inattendu:', result.custom_id)
      failed++
      continue
    }

    const documentId = result.custom_id.slice(CUSTOM_ID_PREFIX.length)

    // Erreur Groq côté requête
    if (result.error || !result.response) {
      console.error(`[KB Batch] Requête échouée pour doc ${documentId}:`, result.error)
      failed++
      continue
    }

    if (result.response.status_code !== 200) {
      console.error(`[KB Batch] Status ${result.response.status_code} pour doc ${documentId}`)
      failed++
      continue
    }

    const content = result.response.body.choices?.[0]?.message?.content
    if (!content) {
      console.error(`[KB Batch] Contenu vide pour doc ${documentId}`)
      failed++
      continue
    }

    try {
      const parsed = parseKBQualityResponse(content)

      await db.query(
        `UPDATE knowledge_base SET
          quality_score = $1,
          quality_clarity = $2,
          quality_structure = $3,
          quality_completeness = $4,
          quality_reliability = $5,
          quality_analysis_summary = $6,
          quality_detected_issues = $7,
          quality_recommendations = $8,
          quality_requires_review = $9,
          quality_assessed_at = NOW(),
          quality_llm_provider = 'groq',
          quality_llm_model = 'llama-3.3-70b-versatile (batch)',
          updated_at = NOW()
        WHERE id = $10`,
        [
          safeRound(parsed.overall_score),
          safeRound(parsed.clarity_score),
          safeRound(parsed.structure_score),
          safeRound(parsed.completeness_score),
          safeRound(parsed.reliability_score),
          parsed.analysis_summary,
          JSON.stringify(parsed.detected_issues || []),
          JSON.stringify(parsed.recommendations || []),
          parsed.requires_review || parsed.overall_score < 60,
          documentId,
        ]
      )

      succeeded++
    } catch (error) {
      console.error(`[KB Batch] Erreur parsing/save pour doc ${documentId}:`, error)
      failed++
    }
  }

  return { succeeded, failed }
}
