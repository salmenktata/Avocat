/**
 * Cron Logger Library - TypeScript Version
 * Helpers pour tracker l'exécution des crons TypeScript
 */

const CRON_API_BASE = process.env.CRON_API_BASE || 'https://qadhya.tn'
const CRON_SECRET = process.env.CRON_SECRET || ''

let currentExecutionId: string | null = null
let startTime: number = 0

interface CronStartResponse {
  success: boolean
  executionId: string
  cronName: string
  startedAt: string
}

interface CronCompleteRequest {
  executionId: string
  status: 'completed' | 'failed' | 'cancelled'
  durationMs?: number
  output?: Record<string, any>
  errorMessage?: string
  exitCode?: number
}

/**
 * Déclare le démarrage d'un cron
 */
export async function cronStart(
  cronName: string,
  triggerType: 'scheduled' | 'manual' = 'scheduled'
): Promise<string> {
  if (!CRON_SECRET) {
    console.warn('[Cron Logger] CRON_SECRET not set, skipping API call')
    return 'no-tracking'
  }

  startTime = Date.now()

  try {
    const response = await fetch(`${CRON_API_BASE}/api/admin/cron-executions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': CRON_SECRET,
      },
      body: JSON.stringify({ cronName, triggerType }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Cron Start] API error:', error)
      return 'error-tracking'
    }

    const data: CronStartResponse = await response.json()
    currentExecutionId = data.executionId

    console.log(`[Cron Start] ${cronName} (execution: ${currentExecutionId})`)

    return currentExecutionId
  } catch (error) {
    console.error('[Cron Start] Failed:', error)
    return 'error-tracking'
  }
}

/**
 * Déclare le succès d'un cron
 */
export async function cronComplete(output: Record<string, any> = {}): Promise<void> {
  if (!currentExecutionId || currentExecutionId === 'no-tracking' || currentExecutionId === 'error-tracking') {
    console.warn('[Cron Logger] No execution ID, skipping complete call')
    return
  }

  const durationMs = Date.now() - startTime

  const payload: CronCompleteRequest = {
    executionId: currentExecutionId,
    status: 'completed',
    durationMs,
    output,
    exitCode: 0,
  }

  try {
    const response = await fetch(`${CRON_API_BASE}/api/admin/cron-executions/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': CRON_SECRET,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Cron Complete] API error:', error)
      return
    }

    console.log(`[Cron Complete] Success (${durationMs}ms)`)
  } catch (error) {
    console.error('[Cron Complete] Failed:', error)
  }
}

/**
 * Déclare l'échec d'un cron
 */
export async function cronFail(
  errorMessage: string,
  exitCode: number = 1
): Promise<void> {
  if (!currentExecutionId || currentExecutionId === 'no-tracking' || currentExecutionId === 'error-tracking') {
    console.warn('[Cron Logger] No execution ID, skipping fail call')
    return
  }

  const durationMs = Date.now() - startTime

  const payload: CronCompleteRequest = {
    executionId: currentExecutionId,
    status: 'failed',
    durationMs,
    errorMessage,
    exitCode,
  }

  try {
    const response = await fetch(`${CRON_API_BASE}/api/admin/cron-executions/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': CRON_SECRET,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Cron Fail] API error:', error)
      return
    }

    console.log(`[Cron Fail] ${errorMessage} (exit ${exitCode}, ${durationMs}ms)`)
  } catch (error) {
    console.error('[Cron Fail] Failed:', error)
  }
}

/**
 * Wrapper qui gère automatiquement start/complete/fail
 */
export async function cronWrap<T>(
  cronName: string,
  triggerType: 'scheduled' | 'manual' = 'scheduled',
  fn: () => Promise<T>
): Promise<T> {
  await cronStart(cronName, triggerType)

  try {
    const result = await fn()

    // Si result est un objet, l'utiliser comme output
    if (typeof result === 'object' && result !== null) {
      await cronComplete(result as any)
    } else {
      await cronComplete({ result })
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await cronFail(errorMessage, 1)
    throw error
  }
}
