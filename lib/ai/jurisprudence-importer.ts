/**
 * Pipeline d'import et indexation de la jurisprudence tunisienne
 *
 * Ce service permet de:
 * - Importer des décisions de justice depuis des fichiers PDF
 * - Extraire les métadonnées via Claude
 * - Générer les embeddings pour la recherche sémantique
 * - Stocker dans la table jurisprudence
 */

import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db/postgres'
import { extractTextFromPDF } from './document-parser'
import { generateEmbedding, formatEmbeddingForPostgres } from './embeddings-service'
import { chunkText } from './chunking-service'
import { aiConfig, SYSTEM_PROMPTS, isChatEnabled } from './config'

// =============================================================================
// CLIENT ANTHROPIC
// =============================================================================

let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!aiConfig.anthropic.apiKey) {
      throw new Error('ANTHROPIC_API_KEY non configuré')
    }
    anthropicClient = new Anthropic({ apiKey: aiConfig.anthropic.apiKey })
  }
  return anthropicClient
}

// =============================================================================
// TYPES
// =============================================================================

export interface JurisprudenceMetadata {
  court: string
  chamber: string | null
  decisionNumber: string
  decisionDate: string | null
  domain: 'civil' | 'commercial' | 'famille' | 'penal' | 'administratif' | 'social' | 'foncier'
  articlesCited: string[]
  keywords: string[]
  summary: string
}

export interface ImportResult {
  success: boolean
  id?: string
  error?: string
  metadata?: JurisprudenceMetadata
}

// =============================================================================
// EXTRACTION DES MÉTADONNÉES
// =============================================================================

/**
 * Extrait les métadonnées d'une décision de justice via Claude
 */
export async function extractJurisprudenceMetadata(
  text: string
): Promise<JurisprudenceMetadata> {
  if (!isChatEnabled()) {
    throw new Error('Extraction IA désactivée (ANTHROPIC_API_KEY manquant)')
  }

  const client = getAnthropicClient()

  // Limiter le texte pour l'extraction (début du document contient généralement les métadonnées)
  const truncatedText = text.substring(0, 10000)

  const prompt = `Analyse cette décision de justice tunisienne et extrait les métadonnées.

TEXTE DE LA DÉCISION:
${truncatedText}

EXTRAIT LES INFORMATIONS SUIVANTES:
1. court: La juridiction (ex: "Cour de Cassation", "Cour d'Appel de Tunis", "Tribunal de Première Instance de Tunis")
2. chamber: La chambre si mentionnée (ex: "Chambre Civile", "Chambre Commerciale", "Chambre Pénale", null si non spécifiée)
3. decisionNumber: Le numéro de décision/arrêt
4. decisionDate: La date de la décision au format YYYY-MM-DD (null si non trouvée)
5. domain: Le domaine juridique parmi: "civil", "commercial", "famille", "penal", "administratif", "social", "foncier"
6. articlesCited: Liste des articles de loi cités (format: ["CSP Art. 31", "COC Art. 245"])
7. keywords: 5-10 mots-clés pertinents
8. summary: Résumé de la décision en 3-5 phrases

Réponds UNIQUEMENT en JSON valide avec ce format exact:
{
  "court": "...",
  "chamber": "..." ou null,
  "decisionNumber": "...",
  "decisionDate": "YYYY-MM-DD" ou null,
  "domain": "...",
  "articlesCited": ["..."],
  "keywords": ["..."],
  "summary": "..."
}`

  const response = await client.messages.create({
    model: aiConfig.anthropic.model,
    max_tokens: 1500,
    system: SYSTEM_PROMPTS.jurisprudenceExtraction,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  })

  const responseText =
    response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    // Extraire le JSON de la réponse
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Pas de JSON dans la réponse')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Valider et normaliser les données
    return {
      court: parsed.court || 'Juridiction non identifiée',
      chamber: parsed.chamber || null,
      decisionNumber: parsed.decisionNumber || 'Non identifié',
      decisionDate: parsed.decisionDate || null,
      domain: validateDomain(parsed.domain),
      articlesCited: Array.isArray(parsed.articlesCited)
        ? parsed.articlesCited
        : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      summary: parsed.summary || 'Résumé non disponible',
    }
  } catch (error) {
    console.error('Erreur parsing métadonnées:', error)
    throw new Error('Impossible d\'extraire les métadonnées de la décision')
  }
}

function validateDomain(
  domain: string
): 'civil' | 'commercial' | 'famille' | 'penal' | 'administratif' | 'social' | 'foncier' {
  const validDomains = [
    'civil',
    'commercial',
    'famille',
    'penal',
    'administratif',
    'social',
    'foncier',
  ]
  const normalized = domain?.toLowerCase().trim()
  return validDomains.includes(normalized)
    ? (normalized as any)
    : 'civil'
}

// =============================================================================
// IMPORT D'UNE DÉCISION
// =============================================================================

/**
 * Importe une décision de justice depuis un buffer PDF
 */
export async function importJurisprudence(
  pdfBuffer: Buffer,
  sourceFile?: string,
  sourceUrl?: string
): Promise<ImportResult> {
  try {
    // 1. Extraire le texte du PDF
    const parseResult = await extractTextFromPDF(pdfBuffer)
    const text = parseResult.text

    if (!text || text.trim().length < 500) {
      return {
        success: false,
        error: 'Texte extrait trop court pour être une décision de justice',
      }
    }

    // 2. Extraire les métadonnées via Claude
    const metadata = await extractJurisprudenceMetadata(text)

    // 3. Vérifier si la décision existe déjà
    const existingResult = await db.query(
      `SELECT id FROM jurisprudence
       WHERE decision_number = $1 AND court = $2`,
      [metadata.decisionNumber, metadata.court]
    )

    if (existingResult.rows.length > 0) {
      return {
        success: false,
        error: `Décision déjà importée: ${metadata.decisionNumber}`,
        id: existingResult.rows[0].id,
      }
    }

    // 4. Générer l'embedding pour le résumé + début du texte
    const textForEmbedding = `${metadata.summary}\n\n${text.substring(0, 3000)}`
    const embeddingResult = await generateEmbedding(textForEmbedding)

    // 5. Insérer dans la base
    const insertResult = await db.query(
      `INSERT INTO jurisprudence (
        court, chamber, decision_number, decision_date, domain,
        summary, full_text, articles_cited, keywords,
        embedding, source_file, source_url
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10::vector, $11, $12
      ) RETURNING id`,
      [
        metadata.court,
        metadata.chamber,
        metadata.decisionNumber,
        metadata.decisionDate,
        metadata.domain,
        metadata.summary,
        text,
        metadata.articlesCited,
        metadata.keywords,
        formatEmbeddingForPostgres(embeddingResult.embedding),
        sourceFile || null,
        sourceUrl || null,
      ]
    )

    return {
      success: true,
      id: insertResult.rows[0].id,
      metadata,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return {
      success: false,
      error: message,
    }
  }
}

// =============================================================================
// IMPORT BATCH
// =============================================================================

export interface BatchImportResult {
  total: number
  imported: number
  failed: number
  results: ImportResult[]
}

/**
 * Importe plusieurs décisions en batch
 */
export async function importJurisprudenceBatch(
  files: Array<{ buffer: Buffer; name: string }>
): Promise<BatchImportResult> {
  const results: ImportResult[] = []
  let imported = 0
  let failed = 0

  for (const file of files) {
    const result = await importJurisprudence(file.buffer, file.name)
    results.push(result)

    if (result.success) {
      imported++
    } else {
      failed++
    }

    // Petite pause entre les imports pour éviter les rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return {
    total: files.length,
    imported,
    failed,
    results,
  }
}

// =============================================================================
// STATISTIQUES
// =============================================================================

export interface JurisprudenceStats {
  total: number
  byDomain: Record<string, number>
  byCourt: Record<string, number>
  lastImport: Date | null
}

/**
 * Récupère les statistiques de la base de jurisprudence
 */
export async function getJurisprudenceStats(): Promise<JurisprudenceStats> {
  const totalResult = await db.query(
    `SELECT COUNT(*) as count FROM jurisprudence`
  )

  const domainResult = await db.query(
    `SELECT domain, COUNT(*) as count
     FROM jurisprudence
     GROUP BY domain`
  )

  const courtResult = await db.query(
    `SELECT court, COUNT(*) as count
     FROM jurisprudence
     GROUP BY court
     ORDER BY count DESC
     LIMIT 10`
  )

  const lastImportResult = await db.query(
    `SELECT MAX(created_at) as last_import FROM jurisprudence`
  )

  const byDomain: Record<string, number> = {}
  domainResult.rows.forEach((row) => {
    byDomain[row.domain] = parseInt(row.count)
  })

  const byCourt: Record<string, number> = {}
  courtResult.rows.forEach((row) => {
    byCourt[row.court] = parseInt(row.count)
  })

  return {
    total: parseInt(totalResult.rows[0].count),
    byDomain,
    byCourt,
    lastImport: lastImportResult.rows[0].last_import,
  }
}

// =============================================================================
// RECHERCHE DANS LA JURISPRUDENCE
// =============================================================================

export interface JurisprudenceSearchResult {
  id: string
  court: string
  chamber: string | null
  decisionNumber: string
  decisionDate: string | null
  domain: string
  summary: string
  articlesCited: string[]
  similarity: number
}

/**
 * Recherche dans la jurisprudence par similarité sémantique
 */
export async function searchJurisprudence(
  query: string,
  options: {
    domain?: string
    court?: string
    limit?: number
  } = {}
): Promise<JurisprudenceSearchResult[]> {
  const { domain, court, limit = 10 } = options

  const queryEmbedding = await generateEmbedding(query)

  let sql = `
    SELECT
      id, court, chamber, decision_number, decision_date,
      domain, summary, articles_cited,
      (1 - (embedding <=> $1::vector)) as similarity
    FROM jurisprudence
    WHERE embedding IS NOT NULL
  `

  const params: any[] = [formatEmbeddingForPostgres(queryEmbedding.embedding)]
  let paramIndex = 2

  if (domain) {
    sql += ` AND domain = $${paramIndex}`
    params.push(domain)
    paramIndex++
  }

  if (court) {
    sql += ` AND court ILIKE $${paramIndex}`
    params.push(`%${court}%`)
    paramIndex++
  }

  sql += ` ORDER BY embedding <=> $1::vector LIMIT $${paramIndex}`
  params.push(limit)

  const result = await db.query(sql, params)

  return result.rows.map((row) => ({
    id: row.id,
    court: row.court,
    chamber: row.chamber,
    decisionNumber: row.decision_number,
    decisionDate: row.decision_date,
    domain: row.domain,
    summary: row.summary,
    articlesCited: row.articles_cited || [],
    similarity: parseFloat(row.similarity),
  }))
}
