/**
 * Script SQL - Ajouter source web IORT (Tribunal Administratif) en PRODUCTION
 *
 * IORT = Instance Organisatrice de la Révision des Textes
 * Site officiel du Tribunal Administratif tunisien
 *
 * Exécution sur VPS:
 *   docker exec -i qadhya-postgres psql -U moncabinet -d qadhya < scripts/add-iort-source-prod.sql
 */

-- Vérifier si la source existe déjà
DO $$
DECLARE
  source_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO source_count
  FROM web_sources
  WHERE base_url LIKE '%iort.gov.tn%';

  IF source_count > 0 THEN
    RAISE NOTICE '⚠️  Source IORT existe déjà (% entrée(s))', source_count;
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
      'IORT - Tribunal Administratif Tunisien',
      'https://www.iort.gov.tn',
      'jurisprudence',
      'Instance Organisatrice de la Révision des Textes. Jurisprudence administrative tunisienne : décisions du Tribunal Administratif, contentieux administratif, litiges État-citoyens.',
      true,
      jsonb_build_object(
        'max_depth', 3,
        'max_pages', 200,
        'rate_limit_ms', 2000,
        'start_urls', jsonb_build_array(
          'https://www.iort.gov.tn/',
          'https://www.iort.gov.tn/WD120AWP/WD120Awp.exe/CTX_5-762-aSpKCRuXOA-1-3?SYNC=1707924360'
        ),
        'url_patterns', jsonb_build_array(
          'https://www.iort.gov.tn/*/decision*',
          'https://www.iort.gov.tn/*/jugement*',
          'https://www.iort.gov.tn/*/arret*',
          'https://www.iort.gov.tn/WD120AWP/*'
        ),
        'exclude_patterns', jsonb_build_array(
          '/recherche',
          '/contact',
          '/login'
        ),
        'requires_javascript', false,
        'timeout', 30000,
        'use_sitemap', false
      ),
      NOW(),
      NOW()
    );

    RAISE NOTICE '✅ Source IORT créée avec succès !';
  END IF;
END $$;

SELECT id, name, base_url, category FROM web_sources 
WHERE category = 'jurisprudence' OR base_url LIKE '%iort%'
ORDER BY created_at DESC;
