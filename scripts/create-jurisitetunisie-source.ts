/**
 * Script - Créer source web jurisitetunisie.com
 *
 * Crée une source web pour crawler les articles de doctrine
 * depuis le portail jurisitetunisie.com
 *
 * Usage : npx tsx scripts/create-jurisitetunisie-source.ts
 */

import { query } from '@/lib/db/postgres'

async function main() {
  console.log('🚀 Création source web jurisitetunisie.com\n')

  try {
    // 1. Vérifier si la source existe déjà
    const existing = await query(
      `SELECT id, name FROM web_sources WHERE base_url LIKE '%jurisitetunisie%'`
    )

    if (existing.rows.length > 0) {
      console.log('⚠️  Source jurisitetunisie.com existe déjà:', existing.rows[0])
      console.log('ID:', existing.rows[0].id)
      process.exit(0)
    }

    // 2. Créer la source web
    const result = await query(
      `INSERT INTO web_sources (
        name,
        base_url,
        category,
        description,
        is_active,
        crawl_config,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, name, base_url`,
      [
        'Jurisite Tunisie - Doctrine Juridique',
        'https://www.jurisitetunisie.com',
        'doctrine',
        'Portail tunisien spécialisé en doctrine juridique, articles de recherche, analyses jurisprudentielles et commentaires de lois par des universitaires et praticiens du droit.',
        true,
        JSON.stringify({
          // Config crawl
          max_depth: 3,
          max_pages: 300,
          rate_limit_ms: 2000,

          // Pages de démarrage
          start_urls: [
            'https://www.jurisitetunisie.com/se/',
            'https://www.jurisitetunisie.com/se/doctrine/',
            'https://www.jurisitetunisie.com/se/articles/',
          ],

          // Patterns URL à crawler
          url_patterns: [
            'https://www.jurisitetunisie.com/se/article*',
            'https://www.jurisitetunisie.com/se/doctrine/*',
            'https://www.jurisitetunisie.com/*/chronique*',
            'https://www.jurisitetunisie.com/*/commentaire*',
          ],

          // Patterns URL à exclure
          exclude_patterns: [
            '/recherche',
            '/login',
            '/register',
            '/contact',
            '/apropos',
            '/publicite',
            '/cgu',
          ],

          // JavaScript non requis
          requires_javascript: false,

          // Timeout navigation
          timeout: 30000,

          // Utiliser sitemap si disponible
          use_sitemap: true,
        }),
      ]
    )

    console.log('✅ Source créée avec succès !')
    console.log('   ID:', result.rows[0].id)
    console.log('   Nom:', result.rows[0].name)
    console.log('   URL:', result.rows[0].base_url)
    console.log('')

    console.log('📋 Prochaines étapes :')
    console.log('1. Configuration extraction déjà ajoutée dans lib/web-scraper/content-extractor.ts')
    console.log('2. Lancer crawl initial')
    console.log('3. Indexer documents dans KB')
    console.log('')

    process.exit(0)
  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }
}

main()
