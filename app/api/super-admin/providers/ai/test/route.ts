/**
 * API Route: Test provider IA
 *
 * POST /api/super-admin/providers/ai/test
 * Body: { provider: 'deepseek' | 'groq' | 'openai' | 'anthropic' | 'ollama' }
 *
 * Teste la connexion au provider IA spécifié
 * Réservé aux super admins
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db/postgres'
import { getConfig } from '@/lib/config/platform-config'
import { type AIProvider } from '@/lib/config/provider-config'

/**
 * POST - Tester un provider IA
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier super admin
    const adminCheck = await db.query(
      `SELECT is_super_admin FROM users WHERE id = $1`,
      [session.user.id]
    )

    if (!adminCheck.rows[0]?.is_super_admin) {
      return NextResponse.json(
        { error: 'Accès réservé aux super admins' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { provider } = body as { provider: AIProvider }

    // Valider le provider
    if (!provider || !['deepseek', 'groq', 'openai', 'anthropic', 'ollama'].includes(provider)) {
      return NextResponse.json(
        { error: 'Provider invalide' },
        { status: 400 }
      )
    }

    let testResult: { success: boolean; message?: string; error?: string; details?: Record<string, unknown> }

    if (provider === 'ollama') {
      // Test Ollama
      const baseUrl = await getConfig('OLLAMA_BASE_URL') || 'http://localhost:11434'

      try {
        const response = await Promise.race([
          fetch(`${baseUrl}/api/tags`),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000)
          ),
        ])

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        const models = data.models || []

        testResult = {
          success: true,
          message: `Ollama accessible avec ${models.length} modèle(s)`,
          details: {
            baseUrl,
            modelsCount: models.length,
            models: models.slice(0, 5).map((m: { name: string }) => m.name),
          },
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
        testResult = {
          success: false,
          error: `Ollama non accessible: ${errorMessage}`,
        }
      }
    } else {
      // Test providers cloud (DeepSeek, Groq, OpenAI, Anthropic)
      const keyMap: Record<string, string> = {
        deepseek: 'DEEPSEEK_API_KEY',
        groq: 'GROQ_API_KEY',
        openai: 'OPENAI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
      }

      const apiKey = await getConfig(keyMap[provider])

      if (!apiKey) {
        testResult = {
          success: false,
          error: `Clé API ${provider} non configurée`,
        }
      } else {
        try {
          // Test simple selon le provider
          if (provider === 'deepseek') {
            const response = await fetch('https://api.deepseek.com/v1/models', {
              headers: { Authorization: `Bearer ${apiKey}` },
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data = await response.json()
            testResult = {
              success: true,
              message: 'DeepSeek accessible',
              details: { modelsCount: data.data?.length || 0 },
            }
          } else if (provider === 'groq') {
            const response = await fetch('https://api.groq.com/openai/v1/models', {
              headers: { Authorization: `Bearer ${apiKey}` },
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data = await response.json()
            testResult = {
              success: true,
              message: 'Groq accessible',
              details: { modelsCount: data.data?.length || 0 },
            }
          } else if (provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/models', {
              headers: { Authorization: `Bearer ${apiKey}` },
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            testResult = {
              success: true,
              message: 'OpenAI accessible',
            }
          } else if (provider === 'anthropic') {
            // Anthropic n'a pas d'endpoint /models, on fait un appel minimal
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hi' }],
              }),
            })
            // 200 = succès, 400 = clé valide mais requête invalide (OK pour test)
            if (response.status !== 200 && response.status !== 400) {
              throw new Error(`HTTP ${response.status}`)
            }
            testResult = {
              success: true,
              message: 'Anthropic accessible',
            }
          } else {
            testResult = { success: false, error: 'Provider non supporté' }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
          testResult = {
            success: false,
            error: `Erreur connexion ${provider}: ${errorMessage}`,
          }
        }
      }
    }

    // Logger l'action
    try {
      await db.query(
        `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          session.user.id,
          'test_ai_provider',
          'platform_config',
          provider,
          JSON.stringify(testResult),
        ]
      )
    } catch (logError) {
      console.error('[Test AI] Erreur log audit:', logError)
    }

    if (testResult.success) {
      return NextResponse.json(testResult)
    }

    return NextResponse.json(testResult, { status: 400 })
  } catch (error) {
    console.error('[Test AI] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
