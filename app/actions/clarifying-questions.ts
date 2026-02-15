'use server'

import { getSession } from '@/lib/auth/session'
import { callLLMWithFallback } from '@/lib/ai/llm-fallback-service'
import { detectLanguage } from '@/lib/ai/language-utils'
import type { ClarifyingQuestion } from '@/lib/stores/assistant-store'

const PROMPT_FR = `Assistant juridique tunisien. Identifie 3-4 informations MANQUANTES dans ce récit.

RÈGLES STRICTES:
- Maximum 4 questions
- Question: 1 phrase courte (max 15 mots)
- Hint: max 10 mots
- Répondre en français même si le récit est en arabe

JSON UNIQUEMENT (pas de markdown):
[{"id":"q1","question":"...","hint":"...","required":true}]`

const PROMPT_AR = `مساعد قانوني تونسي. حدّد 3-4 معلومات ناقصة في هذه الرواية.

قواعد صارمة:
- أقصى 4 أسئلة
- السؤال: جملة قصيرة (أقصى 15 كلمة)
- التلميح: أقصى 10 كلمات

JSON فقط (بدون markdown):
[{"id":"q1","question":"...","hint":"...","required":true}]`

export async function generateClarifyingQuestions(
  narratif: string
): Promise<{ success: boolean; data?: ClarifyingQuestion[]; error?: string }> {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { success: false, error: 'Non autorisé' }
    }

    const lang = detectLanguage(narratif)
    const prompt = lang === 'ar' ? PROMPT_AR : PROMPT_FR

    const response = await callLLMWithFallback(
      [
        {
          role: 'user',
          content: `${prompt}\n\nRécit :\n${narratif}`,
        },
      ],
      {
        temperature: 0.3,
        maxTokens: 2000,
        operationName: 'dossiers-assistant',
      }
    )

    const text = response.answer.trim()

    // Extraire le JSON du texte (peut être entouré de ```json...```)
    let jsonStr = text
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    } else {
      // JSON tronqué : tenter de fermer le tableau
      const partialMatch = text.match(/\[[\s\S]*/)
      if (partialMatch) {
        jsonStr = partialMatch[0]
        // Fermer le dernier objet et le tableau si nécessaire
        if (!jsonStr.endsWith(']')) {
          // Trouver le dernier objet complet (se terminant par })
          const lastBrace = jsonStr.lastIndexOf('}')
          if (lastBrace > 0) {
            jsonStr = jsonStr.substring(0, lastBrace + 1) + ']'
          }
        }
      }
    }

    const questions: ClarifyingQuestion[] = JSON.parse(jsonStr)

    // Valider la structure
    const validated = questions
      .filter((q) => q.question && q.id)
      .slice(0, 5)
      .map((q, i) => ({
        id: q.id || `q${i + 1}`,
        question: q.question,
        hint: q.hint || '',
        required: q.required ?? false,
      }))

    if (validated.length === 0) {
      return { success: false, error: 'Aucune question générée' }
    }

    return { success: true, data: validated }
  } catch (error) {
    console.error('[ClarifyingQuestions] Erreur:', error)
    return { success: false, error: 'Erreur génération questions' }
  }
}

export async function enrichNarrativeWithAnswers(
  narratif: string,
  answers: Record<string, string>,
  questions: ClarifyingQuestion[]
): Promise<string> {
  // Construire un narratif enrichi en ajoutant les réponses
  const answeredParts = questions
    .filter((q) => answers[q.id]?.trim())
    .map((q) => `${q.question}\n${answers[q.id].trim()}`)

  if (answeredParts.length === 0) return narratif

  return `${narratif}\n\nInformations complémentaires :\n${answeredParts.join('\n\n')}`
}
