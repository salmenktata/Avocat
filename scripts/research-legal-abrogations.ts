/**
 * Script de Recherche Automatique des Abrogations Juridiques Tunisiennes
 *
 * Objectif : Crawler legislation.tn et extraire 100+ abrogations
 *
 * Usage:
 *   npx tsx scripts/research-legal-abrogations.ts
 *   npx tsx scripts/research-legal-abrogations.ts --domain fiscal
 *   npx tsx scripts/research-legal-abrogations.ts --export csv
 */

import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// TYPES
// =============================================================================

interface AbrogationCandidate {
  abrogatedReference: string
  abrogatedReferenceAr?: string
  abrogatingReference: string
  abrogatingReferenceAr?: string
  abrogationDate: string
  scope: 'total' | 'partial' | 'implicit'
  affectedArticles?: string[]
  jortUrl?: string
  sourceUrl: string
  notes: string
  domain: string
  confidence: 'high' | 'medium' | 'low'
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DOMAINS = {
  fiscal: {
    keywords: ['impôt', 'taxe', 'fiscale', 'TVA', 'IRPP', 'IS', 'douane'],
    urls: [
      'http://www.legislation.tn/fr/search?q=abroge+impot',
      'http://www.legislation.tn/fr/search?q=abroge+fiscale',
    ]
  },
  administratif: {
    keywords: ['administratif', 'fonction publique', 'marchés publics', 'collectivité'],
    urls: [
      'http://www.legislation.tn/fr/search?q=abroge+administratif',
      'http://www.legislation.tn/fr/search?q=abroge+fonction+publique',
    ]
  },
  travail: {
    keywords: ['travail', 'emploi', 'salarié', 'retraite', 'sécurité sociale'],
    urls: [
      'http://www.legislation.tn/fr/search?q=abroge+travail',
      'http://www.legislation.tn/fr/search?q=abroge+emploi',
    ]
  },
  bancaire: {
    keywords: ['bancaire', 'financier', 'crédit', 'BCT', 'institution financière'],
    urls: [
      'http://www.legislation.tn/fr/search?q=abroge+bancaire',
      'http://www.legislation.tn/fr/search?q=abroge+financier',
    ]
  },
  immobilier: {
    keywords: ['immobilier', 'foncier', 'propriété', 'terrain'],
    urls: [
      'http://www.legislation.tn/fr/search?q=abroge+foncier',
      'http://www.legislation.tn/fr/search?q=abroge+immobilier',
    ]
  },
  sante: {
    keywords: ['santé', 'médical', 'pharmacie', 'hôpital'],
    urls: [
      'http://www.legislation.tn/fr/search?q=abroge+sante',
    ]
  },
  environnement: {
    keywords: ['environnement', 'pollution', 'protection', 'écologie'],
    urls: [
      'http://www.legislation.tn/fr/search?q=abroge+environnement',
    ]
  },
  telecoms: {
    keywords: ['télécommunications', 'internet', 'réseau', 'opérateur'],
    urls: [
      'http://www.legislation.tn/fr/search?q=abroge+telecommunications',
    ]
  },
  numerique: {
    keywords: ['numérique', 'e-commerce', 'données personnelles', 'cybersécurité'],
    urls: [
      'http://www.legislation.tn/fr/search?q=abroge+numerique',
    ]
  },
  famille: {
    keywords: ['famille', 'mariage', 'divorce', 'filiation', 'statut personnel'],
    urls: [
      'http://www.legislation.tn/fr/search?q=abroge+statut+personnel',
    ]
  }
}

// Patterns regex pour détecter abrogations
const ABROGATION_PATTERNS = [
  // Patterns français
  /(?:abroge|abrogée?s?)\s+(?:la\s+)?loi\s+n°?\s*(\d{4}-\d+)/gi,
  /loi\s+n°?\s*(\d{4}-\d+)\s+(?:du\s+)?(\d{1,2}\s+\w+\s+\d{4})?\s+(?:est\s+)?abrogée?/gi,
  /(?:remplace|modifie)\s+(?:la\s+)?loi\s+n°?\s*(\d{4}-\d+)/gi,

  // Patterns arabes
  /(?:يلغي|ملغى|يعوض)\s+القانون\s+عدد\s*(\d{4}-\d+)/g,
]

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

/**
 * Extrait les abrogations depuis le HTML d'une page
 */
function extractAbrogationsFromHTML(html: string, sourceUrl: string, domain: string): AbrogationCandidate[] {
  const candidates: AbrogationCandidate[] = []

  // Détecter les abrogations via patterns regex
  for (const pattern of ABROGATION_PATTERNS) {
    const matches = html.matchAll(pattern)

    for (const match of matches) {
      const context = html.substring(Math.max(0, match.index! - 200), Math.min(html.length, match.index! + 200))

      // Extraire références loi abrogée/abrogeante
      const lawNumbers = context.match(/loi\s+n°?\s*(\d{4}-\d+)/gi) || []

      if (lawNumbers.length >= 2) {
        const abrogated = lawNumbers[0]
        const abrogating = lawNumbers[1]

        // Extraire date si disponible
        const dateMatch = context.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i)
        let abrogationDate = new Date().toISOString().split('T')[0]

        if (dateMatch) {
          const months: Record<string, number> = {
            'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
            'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
          }
          const month = months[dateMatch[2].toLowerCase()]
          const date = new Date(parseInt(dateMatch[3]), month, parseInt(dateMatch[1]))
          abrogationDate = date.toISOString().split('T')[0]
        }

        // Détecter scope (total/partial/implicit)
        let scope: 'total' | 'partial' | 'implicit' = 'total'
        if (context.match(/partiel|partiellement|certains articles/i)) {
          scope = 'partial'
        } else if (context.match(/modifie|remplace/i) && !context.match(/abroge/i)) {
          scope = 'implicit'
        }

        // Extraire articles affectés si partiel
        const articlesMatch = context.match(/articles?\s+([\d,\s-]+)/i)
        const affectedArticles = articlesMatch ? articlesMatch[1].split(/[,\s]+/).map(a => `art. ${a}`) : undefined

        candidates.push({
          abrogatedReference: abrogated.replace(/loi\s+n°?\s*/i, 'Loi n°'),
          abrogatingReference: abrogating.replace(/loi\s+n°?\s*/i, 'Loi n°'),
          abrogationDate,
          scope,
          affectedArticles,
          sourceUrl,
          notes: `[${domain}] Détecté automatiquement depuis ${sourceUrl}`,
          domain,
          confidence: articlesMatch ? 'high' : 'medium',
        })
      }
    }
  }

  return candidates
}

/**
 * Crawler une URL avec Playwright
 */
async function crawlPage(url: string, domain: string): Promise<AbrogationCandidate[]> {
  console.log(`🔍 Crawling: ${url}`)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000) // Attendre chargement complet

    const html = await page.content()
    const candidates = extractAbrogationsFromHTML(html, url, domain)

    console.log(`✅ Trouvé ${candidates.length} candidats sur ${url}`)

    await browser.close()
    return candidates
  } catch (error) {
    console.error(`❌ Erreur crawl ${url}:`, error)
    await browser.close()
    return []
  }
}

/**
 * Export CSV
 */
function exportToCSV(candidates: AbrogationCandidate[], outputPath: string) {
  const headers = [
    'abrogated_reference',
    'abrogated_reference_ar',
    'abrogating_reference',
    'abrogating_reference_ar',
    'abrogation_date',
    'scope',
    'affected_articles',
    'jort_url',
    'source_url',
    'notes',
    'domain',
    'confidence'
  ]

  const rows = candidates.map(c => [
    c.abrogatedReference,
    c.abrogatedReferenceAr || '',
    c.abrogatingReference,
    c.abrogatingReferenceAr || '',
    c.abrogationDate,
    c.scope,
    c.affectedArticles?.join(';') || '',
    c.jortUrl || '',
    c.sourceUrl,
    c.notes,
    c.domain,
    c.confidence
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

  fs.writeFileSync(outputPath, csv, 'utf-8')
  console.log(`\n📄 Export CSV: ${outputPath}`)
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('🚀 Recherche Automatique Abrogations Juridiques Tunisiennes\n')

  const args = process.argv.slice(2)
  const domainArg = args.find(a => a.startsWith('--domain='))?.split('=')[1]
  const exportArg = args.find(a => a.startsWith('--export='))?.split('=')[1]

  const domainsToSearch = domainArg && DOMAINS[domainArg as keyof typeof DOMAINS]
    ? { [domainArg]: DOMAINS[domainArg as keyof typeof DOMAINS] }
    : DOMAINS

  const allCandidates: AbrogationCandidate[] = []

  // Crawler tous les domaines
  for (const [domainName, config] of Object.entries(domainsToSearch)) {
    console.log(`\n📚 Domaine: ${domainName.toUpperCase()}`)
    console.log(`   URLs: ${config.urls.length}`)

    for (const url of config.urls) {
      const candidates = await crawlPage(url, domainName)
      allCandidates.push(...candidates)

      // Pause entre requêtes pour éviter rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }

  // Dédupliquer
  const uniqueCandidates = Array.from(
    new Map(
      allCandidates.map(c => [
        `${c.abrogatedReference}-${c.abrogatingReference}`,
        c
      ])
    ).values()
  )

  console.log(`\n📊 RÉSUMÉ`)
  console.log(`   Candidats trouvés: ${allCandidates.length}`)
  console.log(`   Candidats uniques: ${uniqueCandidates.length}`)
  console.log(`   Domaines couverts: ${Object.keys(domainsToSearch).length}`)

  // Statistiques par domaine
  const statsByDomain = uniqueCandidates.reduce((acc, c) => {
    acc[c.domain] = (acc[c.domain] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`\n📈 PAR DOMAINE:`)
  for (const [domain, count] of Object.entries(statsByDomain)) {
    console.log(`   ${domain}: ${count} abrogations`)
  }

  // Export CSV si demandé
  if (exportArg === 'csv') {
    const outputPath = path.join(process.cwd(), 'data', 'abrogations', `abrogations-research-${Date.now()}.csv`)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    exportToCSV(uniqueCandidates, outputPath)
  } else {
    console.log(`\n💡 Utilisez --export=csv pour exporter en CSV`)
  }

  console.log(`\n✅ Recherche terminée !`)
  console.log(`\n📝 Prochaines étapes:`)
  console.log(`   1. Valider manuellement les candidats`)
  console.log(`   2. Ajouter traductions AR`)
  console.log(`   3. Vérifier sources JORT`)
  console.log(`   4. Lancer seed production`)
}

main().catch(console.error)
