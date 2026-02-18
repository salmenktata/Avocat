/**
 * Client Groq Batch API
 *
 * Permet de soumettre des milliers de requêtes en mode asynchrone :
 * - Fenêtre de traitement 24h (jusqu'à 7j)
 * - -50% de coût vs API sync
 * - Aucun impact sur les rate limits standard
 *
 * Doc : https://console.groq.com/docs/batch
 */

const GROQ_API_BASE = 'https://api.groq.com/openai/v1'

// =============================================================================
// TYPES
// =============================================================================

export interface GroqBatchRequest {
  /** Identifiant unique pour retrouver la requête dans les résultats */
  custom_id: string
  method: 'POST'
  url: '/v1/chat/completions'
  body: {
    model: string
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    temperature?: number
    max_tokens?: number
    /** Force la sortie en JSON valide (nécessite "json" dans les messages) */
    response_format?: { type: 'json_object' }
  }
}

export interface GroqBatchStatus {
  id: string
  object: 'batch'
  endpoint: string
  input_file_id: string
  output_file_id?: string
  error_file_id?: string
  status: 'validating' | 'failed' | 'in_progress' | 'finalizing' | 'completed' | 'expired' | 'cancelling' | 'cancelled'
  request_counts: {
    total: number
    completed: number
    failed: number
  }
  created_at: number
  completed_at?: number
  expires_at?: number
}

export interface GroqBatchResult {
  id: string
  custom_id: string
  response?: {
    status_code: number
    body: {
      choices: Array<{
        message: {
          role: string
          content: string
        }
        finish_reason: string
      }>
      usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
    }
  }
  error?: {
    code: string
    message: string
  }
}

// =============================================================================
// HELPERS INTERNES
// =============================================================================

function getApiKey(): string {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY manquante dans les variables d\'environnement')
  return key
}

async function groqFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${GROQ_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Groq Batch API erreur ${res.status}: ${body}`)
  }

  return res
}

// =============================================================================
// FONCTIONS PUBLIQUES
// =============================================================================

/**
 * Upload un fichier JSONL de requêtes batch sur Groq
 * @returns file_id à passer à createBatch()
 */
export async function uploadBatchFile(requests: GroqBatchRequest[]): Promise<string> {
  if (requests.length === 0) throw new Error('Aucune requête à uploader')
  if (requests.length > 50000) throw new Error(`Limite Groq Batch : 50 000 requêtes max (reçu: ${requests.length})`)

  const jsonl = requests.map(r => JSON.stringify(r)).join('\n')
  const blob = new Blob([jsonl], { type: 'application/octet-stream' })

  const formData = new FormData()
  formData.append('file', blob, 'batch_requests.jsonl')
  formData.append('purpose', 'batch')

  const res = await groqFetch('/files', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  console.log(`[Groq Batch] Fichier uploadé: ${data.id} (${requests.length} requêtes, ${jsonl.length} bytes)`)
  return data.id
}

/**
 * Crée un job batch Groq à partir d'un fichier JSONL uploadé
 */
export async function createBatch(inputFileId: string): Promise<GroqBatchStatus> {
  const res = await groqFetch('/batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input_file_id: inputFileId,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
    }),
  })

  const batch: GroqBatchStatus = await res.json()
  console.log(`[Groq Batch] Job créé: ${batch.id} (status: ${batch.status})`)
  return batch
}

/**
 * Récupère le statut actuel d'un job batch
 */
export async function getBatchStatus(batchId: string): Promise<GroqBatchStatus> {
  const res = await groqFetch(`/batches/${batchId}`)
  return res.json()
}

/**
 * Télécharge et parse les résultats d'un batch complété
 * @returns Tableau de résultats (un par requête soumise)
 */
export async function downloadBatchResults(fileId: string): Promise<GroqBatchResult[]> {
  const res = await groqFetch(`/files/${fileId}/content`)
  const text = await res.text()

  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line) as GroqBatchResult
      } catch {
        console.error('[Groq Batch] Ligne JSONL invalide:', line.substring(0, 100))
        return null
      }
    })
    .filter((r): r is GroqBatchResult => r !== null)
}

/**
 * Liste les jobs batch Groq actifs/récents
 */
export async function listBatches(limit = 20): Promise<GroqBatchStatus[]> {
  const res = await groqFetch(`/batches?limit=${limit}`)
  const data = await res.json()
  return data.data || []
}
