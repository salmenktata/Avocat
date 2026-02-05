/**
 * Service de classification automatique des documents
 *
 * Ce service permet de:
 * - Classifier automatiquement les documents entrants
 * - Extraire les informations clés (dates, montants, noms)
 * - Suggérer un dossier de liaison
 */

import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db/postgres'
import { extractText } from './document-parser'
import { generateEmbedding, formatEmbeddingForPostgres } from './embeddings-service'
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

export interface DocumentClassification {
  documentType: DocumentType
  confidence: number
  extractedInfo: ExtractedInfo
  suggestedDossiers: SuggestedDossier[]
}

export type DocumentType =
  | 'assignation'
  | 'jugement'
  | 'arret'
  | 'contrat'
  | 'correspondance'
  | 'piece_identite'
  | 'facture'
  | 'attestation'
  | 'procuration'
  | 'requete'
  | 'conclusions'
  | 'notification'
  | 'autre'

export interface ExtractedInfo {
  dates: Array<{ type: string; value: string }>
  parties: Array<{ name: string; role: string }>
  montants: Array<{ value: number; currency: string; description: string }>
  references: string[]
  tribunal?: string
  numeroDossier?: string
  summary: string
}

export interface SuggestedDossier {
  dossierId: string
  dossierNumero: string
  clientNom: string
  matchScore: number
  matchReason: string
}

// =============================================================================
// CLASSIFICATION
// =============================================================================

/**
 * Classifie un document et extrait les informations clés
 */
export async function classifyDocument(
  buffer: Buffer,
  mimeType: string,
  userId: string
): Promise<DocumentClassification> {
  if (!isChatEnabled()) {
    throw new Error('Classification IA désactivée')
  }

  // 1. Extraire le texte
  const parseResult = await extractText(buffer, mimeType)
  const text = parseResult.text

  if (!text || text.trim().length < 50) {
    throw new Error('Texte insuffisant pour classification')
  }

  const client = getAnthropicClient()

  // 2. Classifier et extraire via Claude
  const truncatedText = text.substring(0, 8000)

  const prompt = `Analyse ce document juridique et extrait les informations.

TEXTE DU DOCUMENT:
${truncatedText}

TÂCHES:
1. Détermine le type de document parmi: assignation, jugement, arret, contrat, correspondance, piece_identite, facture, attestation, procuration, requete, conclusions, notification, autre
2. Extrait les informations clés

Réponds en JSON avec ce format:
{
  "documentType": "...",
  "confidence": 0.95,
  "extractedInfo": {
    "dates": [{"type": "date_document", "value": "2024-01-15"}],
    "parties": [{"name": "Mohamed Ben Ali", "role": "demandeur"}],
    "montants": [{"value": 15000, "currency": "TND", "description": "montant réclamé"}],
    "references": ["Dossier n°123/2024"],
    "tribunal": "Tribunal de Première Instance de Tunis",
    "numeroDossier": "123/2024",
    "summary": "Assignation en paiement pour créance impayée..."
  }
}`

  const response = await client.messages.create({
    model: aiConfig.anthropic.model,
    max_tokens: 2000,
    system: SYSTEM_PROMPTS.documentClassification,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  })

  const responseText =
    response.content[0].type === 'text' ? response.content[0].text : ''

  let classification: Partial<DocumentClassification>

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      classification = JSON.parse(jsonMatch[0])
    } else {
      throw new Error('Pas de JSON')
    }
  } catch {
    classification = {
      documentType: 'autre',
      confidence: 0.5,
      extractedInfo: {
        dates: [],
        parties: [],
        montants: [],
        references: [],
        summary: 'Classification automatique échouée',
      },
    }
  }

  // 3. Trouver les dossiers correspondants
  const suggestedDossiers = await findMatchingDossiers(
    text,
    classification.extractedInfo || {},
    userId
  )

  return {
    documentType: (classification.documentType || 'autre') as DocumentType,
    confidence: classification.confidence || 0.5,
    extractedInfo: {
      dates: classification.extractedInfo?.dates || [],
      parties: classification.extractedInfo?.parties || [],
      montants: classification.extractedInfo?.montants || [],
      references: classification.extractedInfo?.references || [],
      tribunal: classification.extractedInfo?.tribunal,
      numeroDossier: classification.extractedInfo?.numeroDossier,
      summary: classification.extractedInfo?.summary || '',
    },
    suggestedDossiers,
  }
}

// =============================================================================
// MATCHING DOSSIERS
// =============================================================================

/**
 * Trouve les dossiers qui correspondent au document
 */
async function findMatchingDossiers(
  documentText: string,
  extractedInfo: Partial<ExtractedInfo>,
  userId: string
): Promise<SuggestedDossier[]> {
  const suggestions: SuggestedDossier[] = []

  // 1. Recherche par numéro de dossier extrait
  if (extractedInfo.numeroDossier) {
    const exactMatch = await db.query(
      `SELECT d.id, d.numero, c.nom as client_nom, c.prenom as client_prenom
       FROM dossiers d
       LEFT JOIN clients c ON d.client_id = c.id
       WHERE d.user_id = $1 AND d.numero ILIKE $2`,
      [userId, `%${extractedInfo.numeroDossier}%`]
    )

    for (const row of exactMatch.rows) {
      suggestions.push({
        dossierId: row.id,
        dossierNumero: row.numero,
        clientNom: row.client_prenom
          ? `${row.client_nom} ${row.client_prenom}`.trim()
          : row.client_nom,
        matchScore: 1.0,
        matchReason: 'Numéro de dossier correspondant',
      })
    }
  }

  // 2. Recherche par noms des parties
  if (extractedInfo.parties && extractedInfo.parties.length > 0) {
    for (const party of extractedInfo.parties) {
      const nameMatch = await db.query(
        `SELECT d.id, d.numero, c.nom as client_nom, c.prenom as client_prenom
         FROM dossiers d
         LEFT JOIN clients c ON d.client_id = c.id
         WHERE d.user_id = $1
           AND (c.nom ILIKE $2 OR d.adverse_partie ILIKE $2)
         LIMIT 3`,
        [userId, `%${party.name}%`]
      )

      for (const row of nameMatch.rows) {
        // Éviter les doublons
        if (!suggestions.find((s) => s.dossierId === row.id)) {
          suggestions.push({
            dossierId: row.id,
            dossierNumero: row.numero,
            clientNom: row.client_prenom
              ? `${row.client_nom} ${row.client_prenom}`.trim()
              : row.client_nom,
            matchScore: 0.8,
            matchReason: `Partie mentionnée: ${party.name}`,
          })
        }
      }
    }
  }

  // 3. Recherche sémantique si pas assez de résultats
  if (suggestions.length < 3) {
    try {
      const queryText = extractedInfo.summary || documentText.substring(0, 1000)
      const queryEmbedding = await generateEmbedding(queryText)

      const semanticMatch = await db.query(
        `SELECT DISTINCT d.id, d.numero, c.nom as client_nom, c.prenom as client_prenom,
                (1 - (de.embedding <=> $1::vector)) as similarity
         FROM document_embeddings de
         JOIN documents doc ON de.document_id = doc.id
         JOIN dossiers d ON doc.dossier_id = d.id
         LEFT JOIN clients c ON d.client_id = c.id
         WHERE de.user_id = $2
         ORDER BY de.embedding <=> $1::vector
         LIMIT 5`,
        [formatEmbeddingForPostgres(queryEmbedding.embedding), userId]
      )

      for (const row of semanticMatch.rows) {
        if (!suggestions.find((s) => s.dossierId === row.id)) {
          suggestions.push({
            dossierId: row.id,
            dossierNumero: row.numero,
            clientNom: row.client_prenom
              ? `${row.client_nom} ${row.client_prenom}`.trim()
              : row.client_nom || 'N/A',
            matchScore: parseFloat(row.similarity) * 0.7,
            matchReason: 'Similarité avec documents existants',
          })
        }
      }
    } catch (error) {
      console.error('Erreur recherche sémantique:', error)
    }
  }

  // Trier par score décroissant et limiter
  return suggestions
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5)
}

// =============================================================================
// CLASSIFICATION SIMPLE (sans extraction complète)
// =============================================================================

/**
 * Classification rapide sans extraction détaillée
 * Utile pour le tri automatique
 */
export async function quickClassify(
  text: string
): Promise<{ type: DocumentType; confidence: number }> {
  // Patterns simples pour classification rapide
  const patterns: Array<{ type: DocumentType; patterns: RegExp[] }> = [
    {
      type: 'assignation',
      patterns: [/assigne/i, /assignation/i, /citation à comparaître/i],
    },
    {
      type: 'jugement',
      patterns: [/au nom du peuple tunisien/i, /le tribunal.*juge/i, /par ces motifs/i],
    },
    {
      type: 'arret',
      patterns: [/cour.*arrêt/i, /la cour.*décide/i, /au nom du peuple/i],
    },
    {
      type: 'contrat',
      patterns: [/contrat de/i, /convention/i, /les parties conviennent/i],
    },
    {
      type: 'facture',
      patterns: [/facture n°/i, /montant ttc/i, /conditions de paiement/i],
    },
    {
      type: 'piece_identite',
      patterns: [/carte.*identité/i, /passeport/i, /permis de conduire/i],
    },
    {
      type: 'procuration',
      patterns: [/procuration/i, /donne pouvoir/i, /mandataire/i],
    },
    {
      type: 'requete',
      patterns: [/requête/i, /plaise au tribunal/i],
    },
    {
      type: 'conclusions',
      patterns: [/conclusions/i, /plaise au tribunal/i, /en conséquence/i],
    },
    {
      type: 'notification',
      patterns: [/notification/i, /notifié/i, /accusé de réception/i],
    },
    {
      type: 'attestation',
      patterns: [/atteste/i, /j'atteste/i, /attestation/i],
    },
    {
      type: 'correspondance',
      patterns: [/madame.*monsieur/i, /cher.*maître/i, /veuillez agréer/i],
    },
  ]

  let bestMatch: { type: DocumentType; confidence: number } = {
    type: 'autre',
    confidence: 0.3,
  }

  for (const { type, patterns: typePatterns } of patterns) {
    let matchCount = 0
    for (const pattern of typePatterns) {
      if (pattern.test(text)) {
        matchCount++
      }
    }

    if (matchCount > 0) {
      const confidence = Math.min(0.5 + matchCount * 0.2, 0.95)
      if (confidence > bestMatch.confidence) {
        bestMatch = { type, confidence }
      }
    }
  }

  return bestMatch
}

// =============================================================================
// LABELS FRANÇAIS
// =============================================================================

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  assignation: 'Assignation',
  jugement: 'Jugement',
  arret: 'Arrêt',
  contrat: 'Contrat',
  correspondance: 'Correspondance',
  piece_identite: "Pièce d'identité",
  facture: 'Facture',
  attestation: 'Attestation',
  procuration: 'Procuration',
  requete: 'Requête',
  conclusions: 'Conclusions',
  notification: 'Notification',
  autre: 'Autre',
}
