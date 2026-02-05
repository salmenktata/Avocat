/**
 * API Route: Suggestions IA pour les templates
 *
 * POST /api/templates/[id]/suggest
 * - Génère des suggestions pour remplir les variables d'un template
 *
 * POST /api/templates/[id]/suggest/section
 * - Génère une suggestion de texte pour une section spécifique
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import {
  generateFieldSuggestions,
  generateTextSuggestion,
  DocumentContext,
} from '@/lib/ai/document-generation-service'
import { isChatEnabled } from '@/lib/ai/config'

// =============================================================================
// POST: Suggestions pour les champs
// =============================================================================

interface SuggestFieldsBody {
  dossierId?: string
  clientId?: string
  existingVariables?: Record<string, string>
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id
    const { id: templateId } = await params

    if (!isChatEnabled()) {
      return NextResponse.json(
        { error: 'Suggestions IA désactivées' },
        { status: 503 }
      )
    }

    const body: SuggestFieldsBody = await request.json()

    // Construire le contexte
    const context: DocumentContext = {
      dossierId: body.dossierId,
      clientId: body.clientId,
      templateType: 'juridique', // Sera enrichi par la fonction
      existingVariables: body.existingVariables,
    }

    const suggestions = await generateFieldSuggestions(
      userId,
      templateId,
      context
    )

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Erreur suggestions template:', error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
