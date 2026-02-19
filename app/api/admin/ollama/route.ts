/**
 * API - Contrôle Ollama (Start/Stop)
 *
 * GET  → Statut Ollama (running, memoryMB)
 * POST → Démarrer/Arrêter Ollama { action: "start"|"stop" }
 *
 * Proxy vers le cron-trigger-server (port 9998) sur le host VPS
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

function getTriggerServerBaseUrl(): string {
  const triggerUrl = process.env.CRON_TRIGGER_SERVER_URL || ''
  // CRON_TRIGGER_SERVER_URL = http://host.docker.internal:9998/trigger
  // On veut juste la base: http://host.docker.internal:9998
  try {
    const url = new URL(triggerUrl)
    return `${url.protocol}//${url.host}`
  } catch {
    return 'http://host.docker.internal:9998'
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const baseUrl = getTriggerServerBaseUrl()
    const response = await fetch(`${baseUrl}/ollama-status`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Trigger server error', status: response.status },
        { status: 502 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[ollama-api] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to reach trigger server', running: false, status: 'unknown' },
      { status: 502 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    if (action !== 'start' && action !== 'stop') {
      return NextResponse.json(
        { error: 'action must be "start" or "stop"' },
        { status: 400 }
      )
    }

    const baseUrl = getTriggerServerBaseUrl()
    const response = await fetch(`${baseUrl}/ollama-control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
      signal: AbortSignal.timeout(35000),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: 'Trigger server error', ...errorData },
        { status: 502 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[ollama-api] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to reach trigger server' },
      { status: 502 }
    )
  }
}
