/**
 * API endpoint pour extraire les données de dossier depuis une conversation chat
 *
 * POST /api/chat/extract-dossier
 * Body: { conversationId, messages }
 *
 * @module app/api/chat/extract-dossier
 * @see Sprint 2 - Workflow Chat → Dossier
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { extractDossierDataFromChat } from '@/lib/ai/chat-to-dossier-extractor'
import { createLogger } from '@/lib/logger'
import type { ChatMessage } from '@/components/assistant-ia'

const log = createLogger('API:ExtractDossier')

export async function POST(request: NextRequest) {
  try {
    // Authentification
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Parser le body
    const body = await request.json()
    const { conversationId, messages } = body as {
      conversationId: string
      messages: ChatMessage[]
    }

    // Validation
    if (!conversationId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'conversationId et messages requis' },
        { status: 400 }
      )
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'La conversation est vide' },
        { status: 400 }
      )
    }

    log.info('Extracting dossier data from chat', {
      userId: session.user.id,
      conversationId,
      messageCount: messages.length,
    })

    // Extraire les données
    const extractedData = await extractDossierDataFromChat(conversationId, messages)

    log.info('Extraction completed', {
      conversationId,
      confidence: extractedData.confidence,
      factsCount: extractedData.faitsExtraits.length,
    })

    return NextResponse.json(extractedData)
  } catch (error) {
    log.error('Extraction failed', { error })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne' },
      { status: 500 }
    )
  }
}
