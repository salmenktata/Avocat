-- =====================================================================
-- Script: Validation Typage Fonctions SQL
-- Date: 2026-02-16
-- Description: Vérifie que les fonctions KB ont le bon typage subcategory
-- =====================================================================

-- 1. VÉRIFIER SIGNATURES FONCTIONS
-- =====================================================================

SELECT
  proname AS function_name,
  pg_get_function_result(oid) AS return_type,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname IN (
  'search_knowledge_base_flexible',
  'search_knowledge_base',
  'search_knowledge_base_hybrid',
  'find_related_documents'
)
AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- 2. VÉRIFIER TYPE COLONNE DB
-- =====================================================================

SELECT
  table_name,
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'knowledge_base'
  AND column_name IN ('category', 'subcategory')
ORDER BY column_name;

-- 3. TEST FONCTIONNEL (nécessite embeddings)
-- =====================================================================

-- Test search_knowledge_base_flexible (si embeddings disponibles)
-- SELECT
--   knowledge_base_id,
--   title,
--   subcategory,
--   pg_typeof(subcategory) as subcategory_type
-- FROM search_knowledge_base_flexible(
--   (SELECT embedding FROM knowledge_base_chunks LIMIT 1),
--   NULL::text,
--   NULL::text,
--   5,
--   0.5,
--   false
-- )
-- LIMIT 1;

-- 4. VÉRIFIER CONTRAINTES CHECK
-- =====================================================================

SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'knowledge_base'::regclass
  AND contype = 'c'
ORDER BY conname;

-- 5. RÉSULTAT ATTENDU
-- =====================================================================

-- Colonnes DB:
--   category: character varying(50)
--   subcategory: character varying(50)

-- Fonctions RETURNS TABLE:
--   search_knowledge_base_flexible: subcategory text
--   search_knowledge_base: subcategory text
--   search_knowledge_base_hybrid: subcategory text
--   find_related_documents: subcategory character varying

-- SELECT dans fonctions:
--   kb.subcategory::text (cast explicite)
