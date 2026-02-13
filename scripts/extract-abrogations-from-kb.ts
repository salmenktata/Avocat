/**
 * Extraction Automatique des Abrogations depuis KB Qadhya
 *
 * Analyse les 8,735 documents indexés pour trouver mentions d'abrogations
 * Génère CSV pour validation manuelle
 *
 * Usage:
 *   npx tsx scripts/extract-abrogations-from-kb.ts
 *   npx tsx scripts/extract-abrogations-from-kb.ts --export
 *   npx tsx scripts/extract-abrogations-from-kb.ts --production
 */

import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// CONFIGURATION
// =============================================================================

const LOCAL_DB = {
  host: 'localhost',
  port: 5433,
  database: 'moncabinet',
  user: 'moncabinet',
  password: 'moncabinet',
}

const PROD_DB = {
  host: 'localhost',
  port: 5434, // Tunnel SSH
  database: 'qadhya',
  user: 'moncabinet',
  password: process.env.DB_PASSWORD || '',
}

// Patterns regex améliorés pour abrogations
const ABROGATION_PATTERNS = {
  // Français
  fr: [
    // Abrogation explicite : "abroge la loi n°..."
    /(?:abroge|abrogée?s?)\s+(?:la\s+|l[ae]\s+)?(?:loi|décret|arrêté)\s+n°?\s*(\d{4}[-‑]\d+)/gi,

    // Abrogation avec date : "loi n°... du ... est abrogée"
    /(?:loi|décret|arrêté)\s+n°?\s*(\d{4}[-‑]\d+)(?:\s+du\s+[\w\s]+)?\s+(?:est\s+)?abrogée?/gi,

    // Modification/remplacement : "remplace/modifie la loi n°..."
    /(?:remplace|modifie|modifiée?)\s+(?:par\s+)?(?:la\s+)?(?:loi|décret)\s+n°?\s*(\d{4}[-‑]\d+)/gi,

    // Abrogation implicite : "à l'exception de..." / "sauf..."
    /(?:à\s+l'exception\s+de|sauf|excepté)\s+(?:l[ae]s?\s+)?(?:articles?|dispositions)\s+([\d,\s-]+)\s+de\s+(?:la\s+)?(?:loi|décret)\s+n°?\s*(\d{4}[-‑]\d+)/gi,

    // Articles abrogés : "les articles ... de la loi n°... sont abrogés"
    /(?:les?\s+)?articles?\s+([\d,\s-]+)\s+de\s+(?:la\s+)?(?:loi|décret)\s+n°?\s*(\d{4}[-‑]\d+)\s+(?:sont|est)\s+abrogée?s?/gi,
  ],

  // Arabe
  ar: [
    // Abrogation explicite : "يلغي القانون عدد..."
    /(?:يلغي|تلغى|ألغى|ألغيت)\s+(?:القانون|المرسوم|الأمر)\s+عدد\s*(\d{4}[-‑]\d+)/g,

    // Abrogation passive : "ملغى بموجب القانون عدد..."
    /ملغى\s+(?:بموجب|بمقتضى)\s+(?:القانون|المرسوم)\s+عدد\s*(\d{4}[-‑]\d+)/g,

    // Modification : "يعوض ... بالقانون عدد..."
    /(?:يعوض|عوّض|تعويض)\s+(?:بموجب\s+)?(?:القانون|المرسوم)\s+عدد\s*(\d{4}[-‑]\d+)/g,

    // Articles abrogés : "الفصول ... من القانون عدد ... ملغاة"
    /(?:الفصول?|المواد)\s+([\d،\s-]+)\s+من\s+(?:القانون|المرسوم)\s+عدد\s*(\d{4}[-‑]\d+)\s+(?:ملغاة?|ملغى)/g,
  ],
}

// =============================================================================
// TYPES
// =============================================================================

interface AbrogationMention {
  kbId: string
  kbTitle: string
  kbCategory: string
  chunkContent: string
  abrogatedReference?: string
  abrogatingReference?: string
  abrogationDate?: string
  scope: 'total' | 'partial' | 'implicit' | 'unknown'
  affectedArticles?: string[]
  confidence: 'high' | 'medium' | 'low'
  language: 'fr' | 'ar' | 'mixed'
  notes: string
}

interface ExtractionStats {
  totalChunksAnalyzed: number
  chunksWithMatches: number
  candidatesExtracted: number
  byLanguage: Record<string, number>
  byScope: Record<string, number>
  byCategory: Record<string, number>
}

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

/**
 * Extrait numéro de loi depuis texte
 */
function extractLawNumber(text: string, lang: 'fr' | 'ar'): string | null {
  if (lang === 'fr') {
    const match = text.match(/(?:loi|décret|arrêté)\s+n°?\s*(\d{4}[-‑]\d+)/i)
    return match ? `Loi n°${match[1].replace('‑', '-')}` : null
  } else {
    const match = text.match(/(?:القانون|المرسوم|الأمر)\s+عدد\s*(\d{4}[-‑]\d+)/)
    return match ? `القانون عدد ${match[1].replace('‑', '-')}` : null
  }
}

/**
 * Extrait date depuis contexte
 */
function extractDate(context: string): string | null {
  // Format français
  const frDateMatch = context.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i)
  if (frDateMatch) {
    const months: Record<string, number> = {
      'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
      'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
    }
    const month = months[frDateMatch[2].toLowerCase()]
    const date = new Date(parseInt(frDateMatch[3]), month, parseInt(frDateMatch[1]))
    return date.toISOString().split('T')[0]
  }

  // Format ISO
  const isoMatch = context.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return isoMatch[0]
  }

  return null
}

/**
 * Détermine scope abrogation
 */
function determineScope(context: string, affectedArticles?: string[]): 'total' | 'partial' | 'implicit' | 'unknown' {
  const lower = context.toLowerCase()

  if (lower.includes('totale') || lower.includes('intégrale') || lower.includes('entière')) {
    return 'total'
  }

  if (affectedArticles && affectedArticles.length > 0) {
    return 'partial'
  }

  if (lower.includes('partiel') || lower.includes('certains articles') || lower.includes('à l\'exception')) {
    return 'partial'
  }

  if (lower.includes('modifie') || lower.includes('remplace') || lower.includes('يعوض')) {
    return 'implicit'
  }

  if (lower.includes('abroge') || lower.includes('يلغي') || lower.includes('ملغى')) {
    return 'total'
  }

  return 'unknown'
}

/**
 * Extrait articles affectés
 */
function extractAffectedArticles(context: string): string[] | undefined {
  // Français
  const frMatch = context.match(/(?:articles?|dispositions)\s+([\d,\s-]+)/i)
  if (frMatch) {
    return frMatch[1].split(/[,\s]+/).filter(a => a.trim()).map(a => `art. ${a}`)
  }

  // Arabe
  const arMatch = context.match(/(?:الفصول?|المواد)\s+([\d،\s-]+)/)
  if (arMatch) {
    return arMatch[1].split(/[،,\s]+/).filter(a => a.trim()).map(a => `الفصل ${a}`)
  }

  return undefined
}

/**
 * Analyse chunk pour extraire abrogations
 */
function analyzeChunk(
  kbId: string,
  kbTitle: string,
  kbCategory: string,
  content: string
): AbrogationMention[] {
  const mentions: AbrogationMention[] = []

  // Détecter langue dominante
  const hasArabic = /[\u0600-\u06FF]/.test(content)
  const hasFrench = /[a-zàâçéèêëïîôùûüÿœæ]/i.test(content)
  const language = hasArabic && hasFrench ? 'mixed' : hasArabic ? 'ar' : 'fr'

  // Analyser patterns français
  if (hasFrench) {
    for (const pattern of ABROGATION_PATTERNS.fr) {
      const matches = content.matchAll(pattern)

      for (const match of matches) {
        const context = content.substring(
          Math.max(0, match.index! - 300),
          Math.min(content.length, match.index! + 300)
        )

        const lawNumbers = Array.from(context.matchAll(/(?:loi|décret)\s+n°?\s*(\d{4}[-‑]\d+)/gi))
          .map(m => `Loi n°${m[1].replace('‑', '-')}`)

        if (lawNumbers.length >= 1) {
          const abrogated = lawNumbers[0]
          const abrogating = lawNumbers[1] || extractLawNumber(kbTitle, 'fr')

          const affectedArticles = extractAffectedArticles(context)
          const scope = determineScope(context, affectedArticles)

          mentions.push({
            kbId,
            kbTitle,
            kbCategory,
            chunkContent: match[0],
            abrogatedReference: abrogated,
            abrogatingReference: abrogating || undefined,
            abrogationDate: extractDate(context) || undefined,
            scope,
            affectedArticles,
            confidence: abrogating ? 'high' : 'medium',
            language,
            notes: `Détecté automatiquement - Pattern FR: ${pattern.source.substring(0, 50)}...`,
          })
        }
      }
    }
  }

  // Analyser patterns arabes
  if (hasArabic) {
    for (const pattern of ABROGATION_PATTERNS.ar) {
      const matches = content.matchAll(pattern)

      for (const match of matches) {
        const context = content.substring(
          Math.max(0, match.index! - 300),
          Math.min(content.length, match.index! + 300)
        )

        const lawNumbers = Array.from(context.matchAll(/(?:القانون|المرسوم)\s+عدد\s*(\d{4}[-‑]\d+)/g))
          .map(m => `القانون عدد ${m[1].replace('‑', '-')}`)

        if (lawNumbers.length >= 1) {
          const abrogated = lawNumbers[0]
          const abrogating = lawNumbers[1] || extractLawNumber(kbTitle, 'ar')

          const affectedArticles = extractAffectedArticles(context)
          const scope = determineScope(context, affectedArticles)

          mentions.push({
            kbId,
            kbTitle,
            kbCategory,
            chunkContent: match[0],
            abrogatedReference: abrogated,
            abrogatingReference: abrogating || undefined,
            abrogationDate: extractDate(context) || undefined,
            scope,
            affectedArticles,
            confidence: abrogating ? 'high' : 'medium',
            language,
            notes: `Détecté automatiquement - Pattern AR: ${pattern.source.substring(0, 50)}...`,
          })
        }
      }
    }
  }

  return mentions
}

/**
 * Export CSV
 */
function exportToCSV(mentions: AbrogationMention[], outputPath: string) {
  const headers = [
    'kb_id',
    'kb_title',
    'kb_category',
    'abrogated_reference',
    'abrogating_reference',
    'abrogation_date',
    'scope',
    'affected_articles',
    'confidence',
    'language',
    'chunk_excerpt',
    'notes',
  ]

  const rows = mentions.map(m => [
    m.kbId,
    `"${m.kbTitle.replace(/"/g, '""')}"`,
    m.kbCategory,
    m.abrogatedReference || '',
    m.abrogatingReference || '',
    m.abrogationDate || '',
    m.scope,
    m.affectedArticles?.join(';') || '',
    m.confidence,
    m.language,
    `"${m.chunkContent.substring(0, 200).replace(/"/g, '""')}..."`,
    `"${m.notes.replace(/"/g, '""')}"`,
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

  fs.writeFileSync(outputPath, csv, 'utf-8')
  console.log(`\n📄 Export CSV: ${outputPath}`)
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🚀 Extraction Abrogations depuis KB Qadhya\n')

  const args = process.argv.slice(2)
  const isProduction = args.includes('--production')
  const shouldExport = args.includes('--export') || args.includes('--production')

  const dbConfig = isProduction ? PROD_DB : LOCAL_DB
  const pool = new Pool(dbConfig)

  console.log(`📊 Environnement: ${isProduction ? 'PRODUCTION' : 'LOCAL'}`)
  console.log(`   Base: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}\n`)

  try {
    // Requête chunks avec mentions d'abrogation
    console.log('🔍 Recherche chunks avec mentions d\'abrogation...')

    const result = await pool.query(`
      SELECT DISTINCT
        kb.id as kb_id,
        kb.title as kb_title,
        kb.category::text as kb_category,
        kbc.content as chunk_content
      FROM knowledge_base kb
      JOIN knowledge_base_chunks kbc ON kb.id = kbc.knowledge_base_id
      WHERE (
        kbc.content ILIKE '%abroge%'
        OR kbc.content ILIKE '%abrogée%'
        OR kbc.content ILIKE '%abrogés%'
        OR kbc.content LIKE '%ملغى%'
        OR kbc.content LIKE '%يلغي%'
        OR kbc.content LIKE '%ألغى%'
      )
      AND kb.is_active = true
      ORDER BY kb.category, kb.title
      LIMIT 500
    `)

    console.log(`✅ ${result.rows.length} chunks trouvés\n`)

    // Analyser chaque chunk
    const allMentions: AbrogationMention[] = []
    const stats: ExtractionStats = {
      totalChunksAnalyzed: result.rows.length,
      chunksWithMatches: 0,
      candidatesExtracted: 0,
      byLanguage: {},
      byScope: {},
      byCategory: {},
    }

    console.log('🔬 Analyse des chunks...')
    for (const row of result.rows) {
      const mentions = analyzeChunk(
        row.kb_id,
        row.kb_title,
        row.kb_category,
        row.chunk_content
      )

      if (mentions.length > 0) {
        stats.chunksWithMatches++
        allMentions.push(...mentions)

        mentions.forEach(m => {
          stats.byLanguage[m.language] = (stats.byLanguage[m.language] || 0) + 1
          stats.byScope[m.scope] = (stats.byScope[m.scope] || 0) + 1
          stats.byCategory[m.kbCategory] = (stats.byCategory[m.kbCategory] || 0) + 1
        })
      }
    }

    stats.candidatesExtracted = allMentions.length

    // Dédupliquer
    const uniqueMentions = Array.from(
      new Map(
        allMentions.map(m => [
          `${m.abrogatedReference}-${m.abrogatingReference}`,
          m
        ])
      ).values()
    )

    // Afficher résultats
    console.log(`\n📊 RÉSULTATS\n`)
    console.log(`   Chunks analysés: ${stats.totalChunksAnalyzed}`)
    console.log(`   Chunks avec abrogations: ${stats.chunksWithMatches}`)
    console.log(`   Candidats extraits: ${stats.candidatesExtracted}`)
    console.log(`   Candidats uniques: ${uniqueMentions.length}\n`)

    console.log(`📈 PAR LANGUE:`)
    Object.entries(stats.byLanguage).forEach(([lang, count]) => {
      console.log(`   ${lang}: ${count}`)
    })

    console.log(`\n📈 PAR SCOPE:`)
    Object.entries(stats.byScope).forEach(([scope, count]) => {
      console.log(`   ${scope}: ${count}`)
    })

    console.log(`\n📈 PAR CATÉGORIE:`)
    Object.entries(stats.byCategory).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`)
    })

    // Afficher échantillon
    console.log(`\n📝 ÉCHANTILLON (5 premiers):`)
    uniqueMentions.slice(0, 5).forEach((m, i) => {
      console.log(`\n   ${i + 1}. ${m.abrogatedReference || 'N/A'}`)
      console.log(`      Abrogée par: ${m.abrogatingReference || 'N/A'}`)
      console.log(`      Scope: ${m.scope}`)
      console.log(`      Confiance: ${m.confidence}`)
      console.log(`      Source: ${m.kbTitle.substring(0, 60)}...`)
    })

    // Export CSV
    if (shouldExport) {
      const timestamp = Date.now()
      const outputPath = path.join(
        process.cwd(),
        'data',
        'abrogations',
        `kb-abrogations-${isProduction ? 'prod' : 'local'}-${timestamp}.csv`
      )

      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      exportToCSV(uniqueMentions, outputPath)
    } else {
      console.log(`\n💡 Utilisez --export pour exporter en CSV`)
    }

    console.log(`\n✅ Extraction terminée !`)
    console.log(`\n📝 Prochaines étapes:`)
    console.log(`   1. Valider manuellement les ${uniqueMentions.length} candidats`)
    console.log(`   2. Compléter traductions manquantes (AR ↔ FR)`)
    console.log(`   3. Ajouter URLs JORT pour vérification`)
    console.log(`   4. Compléter avec recherche JORT manuelle (objectif 100+)`)

  } catch (error) {
    console.error('❌ Erreur:', error)
  } finally {
    await pool.end()
  }
}

main().catch(console.error)
