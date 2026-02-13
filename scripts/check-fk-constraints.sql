-- Script SQL pour vérifier les contraintes FK sur web_sources
-- Permet d'identifier ce qui pourrait bloquer la suppression

-- 1. Liste toutes les contraintes FK qui référencent web_sources
SELECT
  tc.table_name AS referencing_table,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'web_sources'
ORDER BY tc.table_name;

-- 2. Vérifier s'il y a des jobs en cours qui pourraient bloquer
SELECT
  id,
  web_source_id,
  job_type,
  status,
  started_at,
  completed_at,
  NOW() - started_at AS duration
FROM web_crawl_jobs
WHERE status IN ('queued', 'running')
ORDER BY started_at DESC;

-- 3. Vérifier les jobs d'indexation en cours
SELECT
  id,
  job_type,
  status,
  source_type,
  source_metadata->>'sourceId' AS source_id,
  created_at,
  started_at,
  NOW() - started_at AS duration
FROM indexing_jobs
WHERE status IN ('queued', 'running')
  AND source_type = 'web_page'
ORDER BY created_at DESC;

-- 4. Compter les dépendances pour une source donnée (remplacer :source_id)
-- SELECT
--   (SELECT COUNT(*) FROM web_pages WHERE web_source_id = :source_id) AS web_pages,
--   (SELECT COUNT(*) FROM web_files WHERE web_source_id = :source_id) AS web_files,
--   (SELECT COUNT(*) FROM web_crawl_jobs WHERE web_source_id = :source_id) AS crawl_jobs,
--   (SELECT COUNT(*) FROM web_crawl_logs WHERE web_source_id = :source_id) AS crawl_logs,
--   (SELECT COUNT(*) FROM knowledge_base WHERE metadata->>'sourceId' = :source_id) AS kb_docs,
--   (SELECT COUNT(*) FROM indexing_jobs WHERE source_metadata->>'sourceId' = :source_id) AS indexing_jobs;
