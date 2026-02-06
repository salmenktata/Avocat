/**
 * Service de génération de documents juridiques assistée par IA
 *
 * Ce service permet de:
 * - Générer des suggestions de contenu pour les templates juridiques
 * - Compléter automatiquement les champs d'un document
 * - Proposer des formulations juridiques adaptées au contexte
 */

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { db } from '@/lib/db/postgres'
import { generateEmbedding, formatEmbeddingForPostgres } from './embeddings-service'
import { aiConfig, SYSTEM_PROMPTS, isChatEnabled, getChatProvider } from './config'

// =============================================================================
// CLIENTS LLM (Groq prioritaire)
// =============================================================================

let anthropicClient: Anthropic | null = null
let groqClient: OpenAI | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!aiConfig.anthropic.apiKey) {
      throw new Error('ANTHROPIC_API_KEY non configuré')
    }
    anthropicClient = new Anthropic({ apiKey: aiConfig.anthropic.apiKey })
  }
  return anthropicClient
}

function getGroqClient(): OpenAI {
  if (!groqClient) {
    if (!aiConfig.groq.apiKey) {
      throw new Error('GROQ_API_KEY non configuré')
    }
    groqClient = new OpenAI({
      apiKey: aiConfig.groq.apiKey,
      baseURL: aiConfig.groq.baseUrl,
    })
  }
  return groqClient
}

/**
 * Appelle le LLM configuré (Groq prioritaire, puis Anthropic)
 */
async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const provider = getChatProvider()
  const maxTokens = options.maxTokens || 2000
  const temperature = options.temperature || 0.3

  if (provider === 'groq') {
    const client = getGroqClient()
    const response = await client.chat.completions.create({
      model: aiConfig.groq.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    })
    return {
      text: response.choices[0]?.message?.content || '',
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
    }
  } else {
    const client = getAnthropicClient()
    const response = await client.messages.create({
      model: aiConfig.anthropic.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature,
    })
    return {
      text: response.content[0].type === 'text' ? response.content[0].text : '',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface DocumentContext {
  dossierId?: string
  clientId?: string
  templateType: string
  existingVariables?: Record<string, string>
}

export interface GenerationSuggestion {
  field: string
  suggestion: string
  confidence: number
  source?: string
}

export interface DocumentSuggestions {
  suggestions: GenerationSuggestion[]
  fullTextSuggestion?: string
  tokensUsed: {
    input: number
    output: number
  }
}

// =============================================================================
// RÉCUPÉRATION DU CONTEXTE
// =============================================================================

/**
 * Récupère le contexte du dossier pour la génération
 */
async function getDossierContext(
  dossierId: string,
  userId: string
): Promise<Record<string, any>> {
  // Récupérer le dossier avec client
  const dossierResult = await db.query(
    `SELECT d.*,
      json_build_object(
        'id', c.id,
        'type_client', c.type_client,
        'nom', c.nom,
        'prenom', c.prenom,
        'email', c.email,
        'telephone', c.telephone,
        'adresse', c.adresse,
        'cin', c.cin
      ) as client
    FROM dossiers d
    LEFT JOIN clients c ON d.client_id = c.id
    WHERE d.id = $1 AND d.user_id = $2`,
    [dossierId, userId]
  )

  if (dossierResult.rows.length === 0) {
    throw new Error('Dossier non trouvé')
  }

  const dossier = dossierResult.rows[0]

  // Récupérer le profil (cabinet)
  const profileResult = await db.query(
    `SELECT * FROM profiles WHERE user_id = $1`,
    [userId]
  )
  const profile = profileResult.rows[0] || {}

  // Récupérer les dernières actions
  const actionsResult = await db.query(
    `SELECT * FROM actions
     WHERE dossier_id = $1 AND user_id = $2
     ORDER BY date_action DESC
     LIMIT 5`,
    [dossierId, userId]
  )

  // Récupérer les prochaines échéances
  const echeancesResult = await db.query(
    `SELECT * FROM echeances
     WHERE dossier_id = $1 AND user_id = $2 AND terminee = false
     ORDER BY date_echeance ASC
     LIMIT 3`,
    [dossierId, userId]
  )

  return {
    dossier: {
      numero: dossier.numero,
      objet: dossier.objet,
      type_procedure: dossier.type_procedure,
      statut: dossier.statut,
      tribunal: dossier.tribunal,
      adverse_partie: dossier.adverse_partie,
      date_ouverture: dossier.date_ouverture,
      notes: dossier.notes,
    },
    client: dossier.client,
    cabinet: {
      nom: profile.nom_cabinet,
      adresse: profile.adresse,
      telephone: profile.telephone,
      email: profile.email,
      numero_onat: profile.numero_onat,
    },
    actions: actionsResult.rows,
    echeances: echeancesResult.rows,
  }
}

/**
 * Recherche des extraits de documents pertinents pour le contexte
 */
async function getRelevantDocumentExcerpts(
  dossierId: string,
  userId: string,
  templateType: string
): Promise<string[]> {
  // Générer un embedding pour le type de document
  const queryText = `document juridique ${templateType} modèle contenu`
  const queryEmbedding = await generateEmbedding(queryText)

  const result = await db.query(
    `SELECT de.content_chunk
     FROM document_embeddings de
     JOIN documents d ON de.document_id = d.id
     WHERE de.user_id = $1 AND d.dossier_id = $2
     ORDER BY de.embedding <=> $3::vector
     LIMIT 3`,
    [userId, dossierId, formatEmbeddingForPostgres(queryEmbedding.embedding)]
  )

  return result.rows.map((r) => r.content_chunk)
}

// =============================================================================
// GÉNÉRATION DE SUGGESTIONS
// =============================================================================

/**
 * Génère des suggestions pour les champs d'un template
 */
export async function generateFieldSuggestions(
  userId: string,
  templateId: string,
  context: DocumentContext
): Promise<DocumentSuggestions> {
  if (!isChatEnabled()) {
    throw new Error('Génération IA désactivée (configurer GROQ_API_KEY ou ANTHROPIC_API_KEY)')
  }

  // Récupérer le template
  const templateResult = await db.query(
    `SELECT * FROM templates WHERE id = $1 AND user_id = $2`,
    [templateId, userId]
  )

  if (templateResult.rows.length === 0) {
    throw new Error('Template non trouvé')
  }

  const template = templateResult.rows[0]
  const variables = template.variables || []

  // Récupérer le contexte du dossier si fourni
  let dossierContext: Record<string, any> = {}
  let documentExcerpts: string[] = []

  if (context.dossierId) {
    dossierContext = await getDossierContext(context.dossierId, userId)
    documentExcerpts = await getRelevantDocumentExcerpts(
      context.dossierId,
      userId,
      template.type_document
    )
  }

  // Construire le prompt
  const prompt = `Tu dois suggérer des valeurs pour les variables d'un document juridique tunisien.

TYPE DE DOCUMENT: ${template.type_document}
TITRE: ${template.titre}

VARIABLES À REMPLIR:
${variables.map((v: any) => `- ${v.name}: ${v.description || 'Pas de description'}`).join('\n')}

CONTEXTE DU DOSSIER:
${JSON.stringify(dossierContext, null, 2)}

${
  documentExcerpts.length > 0
    ? `EXTRAITS DE DOCUMENTS DU DOSSIER:\n${documentExcerpts.join('\n---\n')}`
    : ''
}

${
  context.existingVariables
    ? `VALEURS DÉJÀ RENSEIGNÉES:\n${JSON.stringify(context.existingVariables, null, 2)}`
    : ''
}

INSTRUCTIONS:
1. Suggère une valeur appropriée pour chaque variable
2. Base-toi sur le contexte fourni
3. Utilise le vocabulaire juridique tunisien approprié
4. Si une information n'est pas disponible, indique "À compléter"

Réponds en JSON avec le format:
{
  "suggestions": [
    {
      "field": "nom_variable",
      "suggestion": "valeur suggérée",
      "confidence": 0.8,
      "source": "dossier" ou "inféré" ou "défaut"
    }
  ]
}`

  const response = await callLLM(SYSTEM_PROMPTS.documentGeneration, prompt, {
    maxTokens: 2000,
    temperature: 0.3,
  })

  const responseText = response.text

  // Parser la réponse JSON
  let suggestions: GenerationSuggestion[] = []

  try {
    // Extraire le JSON de la réponse
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      suggestions = parsed.suggestions || []
    }
  } catch (e) {
    console.error('Erreur parsing suggestions:', e)
    // Fallback: créer des suggestions vides
    suggestions = variables.map((v: any) => ({
      field: v.name,
      suggestion: 'À compléter',
      confidence: 0,
      source: 'défaut',
    }))
  }

  return {
    suggestions,
    tokensUsed: {
      input: response.inputTokens,
      output: response.outputTokens,
    },
  }
}

/**
 * Génère une suggestion de texte complet pour une section
 */
export async function generateTextSuggestion(
  userId: string,
  sectionType: 'motifs' | 'dispositif' | 'faits' | 'moyens' | 'conclusions',
  context: DocumentContext
): Promise<{ text: string; tokensUsed: { input: number; output: number } }> {
  if (!isChatEnabled()) {
    throw new Error('Génération IA désactivée')
  }

  // Récupérer le contexte
  let dossierContext: Record<string, any> = {}
  if (context.dossierId) {
    dossierContext = await getDossierContext(context.dossierId, userId)
  }

  const sectionDescriptions: Record<string, string> = {
    motifs: 'les motifs juridiques et arguments de droit',
    dispositif: 'le dispositif (ce qui est demandé au tribunal)',
    faits: "l'exposé des faits de l'affaire",
    moyens: 'les moyens de droit invoqués',
    conclusions: 'les conclusions (demandes finales)',
  }

  const prompt = `Rédige ${sectionDescriptions[sectionType]} pour un document juridique tunisien.

TYPE DE PROCÉDURE: ${context.templateType}

CONTEXTE DU DOSSIER:
${JSON.stringify(dossierContext, null, 2)}

INSTRUCTIONS:
1. Utilise le style et le vocabulaire juridique tunisien
2. Cite les articles de loi pertinents (CSP, COC, CPC, etc.)
3. Sois précis et structuré
4. Respecte les formules juridiques d'usage

Rédige directement le texte sans introduction.`

  const response = await callLLM(SYSTEM_PROMPTS.documentGeneration, prompt, {
    maxTokens: 1500,
    temperature: 0.4,
  })

  return {
    text: response.text,
    tokensUsed: {
      input: response.inputTokens,
      output: response.outputTokens,
    },
  }
}

/**
 * Valide un texte juridique et propose des corrections
 */
export async function validateAndSuggestCorrections(
  userId: string,
  text: string,
  documentType: string
): Promise<{
  isValid: boolean
  corrections: Array<{ original: string; suggestion: string; reason: string }>
  tokensUsed: { input: number; output: number }
}> {
  if (!isChatEnabled()) {
    throw new Error('Validation IA désactivée')
  }

  const prompt = `Analyse ce texte juridique tunisien et propose des corrections si nécessaire.

TYPE DE DOCUMENT: ${documentType}

TEXTE À ANALYSER:
${text}

VÉRIFIE:
1. La terminologie juridique tunisienne
2. Les citations d'articles de loi (format correct)
3. Les formules juridiques d'usage
4. La cohérence et la clarté

Réponds en JSON:
{
  "isValid": true/false,
  "corrections": [
    {
      "original": "texte original",
      "suggestion": "texte corrigé",
      "reason": "raison de la correction"
    }
  ]
}`

  const response = await callLLM(SYSTEM_PROMPTS.documentGeneration, prompt, {
    maxTokens: 1500,
    temperature: 0.2,
  })

  let result = { isValid: true, corrections: [] as any[] }

  try {
    const jsonMatch = response.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Erreur parsing validation:', e)
  }

  return {
    ...result,
    tokensUsed: {
      input: response.inputTokens,
      output: response.outputTokens,
    },
  }
}
