/**
 * Service de tracking des coûts par conversation
 *
 * Agrège les coûts IA (LLM + embeddings) au niveau de chaque conversation.
 * Permet le suivi budgétaire par utilisateur et par période.
 *
 * Utilise la table ai_usage_logs existante avec context->>'conversation_id'.
 *
 * @module lib/ai/conversation-cost-service
 */

import { db } from '@/lib/db/postgres'
import { calculateCost, type Provider } from './usage-tracker'

// =============================================================================
// TYPES
// =============================================================================

export interface ConversationCost {
  conversationId: string
  totalCostUsd: number
  totalTokensInput: number
  totalTokensOutput: number
  operationCount: number
  byProvider: Record<string, { costUsd: number; operations: number }>
  firstUsage: string
  lastUsage: string
}

export interface CostSummary {
  totalCostUsd: number
  totalConversations: number
  avgCostPerConversation: number
  costByProvider: Record<string, number>
  costByDay: Array<{ date: string; costUsd: number; conversations: number }>
}

// =============================================================================
// TRACKING
// =============================================================================

/**
 * Enregistre le coût d'une opération IA liée à une conversation
 * (wrapper léger autour de ai_usage_logs avec conversation_id dans le context)
 */
export async function trackConversationCost(params: {
  conversationId: string
  userId: string
  provider: Provider
  model: string
  inputTokens: number
  outputTokens: number
  operationType: 'chat' | 'embedding'
}): Promise<void> {
  const cost = calculateCost(params.provider, params.inputTokens, params.outputTokens)

  try {
    await db.query(
      `INSERT INTO ai_usage_logs (
        user_id, operation_type, provider, model,
        input_tokens, output_tokens, estimated_cost_usd, context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.userId,
        params.operationType,
        params.provider,
        params.model,
        params.inputTokens,
        params.outputTokens,
        cost,
        JSON.stringify({ conversation_id: params.conversationId }),
      ]
    )
  } catch (error) {
    console.error('[ConversationCost] Erreur tracking:', error instanceof Error ? error.message : error)
  }
}

// =============================================================================
// REQUÊTES
// =============================================================================

/**
 * Coût total d'une conversation spécifique
 */
export async function getConversationCost(conversationId: string): Promise<ConversationCost | null> {
  try {
    const result = await db.query(
      `SELECT
         context->>'conversation_id' as conversation_id,
         COALESCE(SUM(estimated_cost_usd), 0) as total_cost,
         COALESCE(SUM(input_tokens), 0) as total_input,
         COALESCE(SUM(output_tokens), 0) as total_output,
         COUNT(*) as op_count,
         MIN(created_at) as first_usage,
         MAX(created_at) as last_usage,
         json_object_agg(
           provider,
           json_build_object('costUsd', provider_cost, 'operations', provider_ops)
         ) as by_provider
       FROM (
         SELECT *,
           SUM(estimated_cost_usd) OVER (PARTITION BY provider) as provider_cost,
           COUNT(*) OVER (PARTITION BY provider) as provider_ops
         FROM ai_usage_logs
         WHERE context->>'conversation_id' = $1
       ) sub
       GROUP BY context->>'conversation_id'`,
      [conversationId]
    )

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      conversationId,
      totalCostUsd: parseFloat(row.total_cost),
      totalTokensInput: parseInt(row.total_input),
      totalTokensOutput: parseInt(row.total_output),
      operationCount: parseInt(row.op_count),
      byProvider: row.by_provider || {},
      firstUsage: row.first_usage,
      lastUsage: row.last_usage,
    }
  } catch {
    return null
  }
}

/**
 * Résumé des coûts pour une période donnée
 */
export async function getCostSummary(daysBack: number = 30): Promise<CostSummary> {
  try {
    // Coût total et par provider
    const totalResult = await db.query(
      `SELECT
         COALESCE(SUM(estimated_cost_usd), 0) as total_cost,
         COUNT(DISTINCT context->>'conversation_id') as total_conversations,
         provider,
         COALESCE(SUM(estimated_cost_usd), 0) as provider_cost
       FROM ai_usage_logs
       WHERE context->>'conversation_id' IS NOT NULL
         AND created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY provider`,
      [daysBack]
    )

    let totalCostUsd = 0
    const costByProvider: Record<string, number> = {}
    let totalConversations = 0

    for (const row of totalResult.rows) {
      const providerCost = parseFloat(row.provider_cost)
      costByProvider[row.provider] = providerCost
      totalCostUsd += providerCost
      totalConversations = Math.max(totalConversations, parseInt(row.total_conversations))
    }

    // Tendance journalière
    const dailyResult = await db.query(
      `SELECT
         DATE(created_at) as date,
         COALESCE(SUM(estimated_cost_usd), 0) as cost,
         COUNT(DISTINCT context->>'conversation_id') as conversations
       FROM ai_usage_logs
       WHERE context->>'conversation_id' IS NOT NULL
         AND created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [daysBack]
    )

    return {
      totalCostUsd,
      totalConversations,
      avgCostPerConversation: totalConversations > 0 ? totalCostUsd / totalConversations : 0,
      costByProvider,
      costByDay: dailyResult.rows.map(row => ({
        date: row.date.toISOString().split('T')[0],
        costUsd: parseFloat(row.cost),
        conversations: parseInt(row.conversations),
      })),
    }
  } catch {
    return {
      totalCostUsd: 0,
      totalConversations: 0,
      avgCostPerConversation: 0,
      costByProvider: {},
      costByDay: [],
    }
  }
}

/**
 * Top conversations les plus coûteuses
 */
export async function getTopCostlyConversations(
  limit: number = 10,
  daysBack: number = 30
): Promise<Array<{
  conversationId: string
  totalCostUsd: number
  operationCount: number
  mainProvider: string
}>> {
  try {
    const result = await db.query(
      `SELECT
         context->>'conversation_id' as conversation_id,
         COALESCE(SUM(estimated_cost_usd), 0) as total_cost,
         COUNT(*) as op_count,
         MODE() WITHIN GROUP (ORDER BY provider) as main_provider
       FROM ai_usage_logs
       WHERE context->>'conversation_id' IS NOT NULL
         AND created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY context->>'conversation_id'
       ORDER BY total_cost DESC
       LIMIT $2`,
      [daysBack, limit]
    )

    return result.rows.map(row => ({
      conversationId: row.conversation_id,
      totalCostUsd: parseFloat(row.total_cost),
      operationCount: parseInt(row.op_count),
      mainProvider: row.main_provider,
    }))
  } catch {
    return []
  }
}
