/**
 * Script SQL - Ajouter source web jurisitetunisie.com en PRODUCTION
 *
 * Exécution sur VPS:
 *   docker exec -i qadhya-postgres psql -U moncabinet -d qadhya < scripts/add-jurisitetunisie-source-prod.sql
 *
 * Ou via SSH:
 *   ssh root@84.247.165.187 "docker exec -i qadhya-postgres psql -U moncabinet -d qadhya" < scripts/add-jurisitetunisie-source-prod.sql
 */

-- Vérifier si la source existe déjà
DO $$
DECLARE
  source_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO source_count
  FROM web_sources
  WHERE base_url LIKE '%jurisitetunisie%';

  IF source_count > 0 THEN
    RAISE NOTICE '⚠️  Source jurisitetunisie.com existe déjà (% entrée(s))', source_count;
  ELSE
    -- Créer la source web
    INSERT INTO web_sources (
      name,
      base_url,
      category,
      description,
      is_active,
      crawl_config,
      created_at,
      updated_at
    ) VALUES (
      'Jurisite Tunisie - Doctrine Juridique',
      'https://www.jurisitetunisie.com',
      'doctrine',
      'Portail tunisien spécialisé en doctrine juridique, articles de recherche, analyses jurisprudentielles et commentaires de lois par des universitaires et praticiens du droit.',
      true,
      jsonb_build_object(
        'max_depth', 3,
        'max_pages', 300,
        'rate_limit_ms', 2000,
        'start_urls', jsonb_build_array(
          'https://www.jurisitetunisie.com/se/',
          'https://www.jurisitetunisie.com/se/doctrine/',
          'https://www.jurisitetunisie.com/se/articles/'
        ),
        'url_patterns', jsonb_build_array(
          'https://www.jurisitetunisie.com/se/article*',
          'https://www.jurisitetunisie.com/se/doctrine/*',
          'https://www.jurisitetunisie.com/*/chronique*',
          'https://www.jurisitetunisie.com/*/commentaire*'
        ),
        'exclude_patterns', jsonb_build_array(
          '/recherche',
          '/login',
          '/register',
          '/contact',
          '/apropos',
          '/publicite',
          '/cgu'
        ),
        'requires_javascript', false,
        'timeout', 30000,
        'use_sitemap', true
      ),
      NOW(),
      NOW()
    );

    RAISE NOTICE '✅ Source jurisitetunisie.com créée avec succès !';
  END IF;
END $$;

-- Afficher les sources doctrine
SELECT
  id,
  name,
  base_url,
  category,
  is_active,
  (crawl_config->>'max_pages')::int as max_pages,
  created_at
FROM web_sources
WHERE category = 'doctrine'
   OR base_url LIKE '%jurisite%'
   OR name LIKE '%doctrine%'
ORDER BY created_at DESC;
