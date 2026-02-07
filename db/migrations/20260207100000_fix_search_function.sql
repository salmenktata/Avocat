-- Migration: Corriger les fonctions search_knowledge_base en conflit
-- Date: 2026-02-07
-- Description: Supprime les anciennes versions et crée une fonction unifiée

-- Supprimer toutes les anciennes versions de la fonction
DROP FUNCTION IF EXISTS search_knowledge_base(vector(1536), TEXT, INTEGER, FLOAT);
DROP FUNCTION IF EXISTS search_knowledge_base(vector(1024), TEXT, INTEGER, FLOAT);
DROP FUNCTION IF EXISTS search_knowledge_base(vector(1536), TEXT, TEXT, INTEGER, FLOAT);
DROP FUNCTION IF EXISTS search_knowledge_base(vector(1024), TEXT, TEXT, INTEGER, FLOAT);
DROP FUNCTION IF EXISTS search_knowledge_base(vector, TEXT, INTEGER, FLOAT);
DROP FUNCTION IF EXISTS search_knowledge_base(vector, TEXT, TEXT, INTEGER, FLOAT);

-- Créer une fonction unifiée qui accepte n'importe quelle dimension de vecteur
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_embedding vector,
  p_category TEXT DEFAULT NULL,
  p_subcategory TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  knowledge_base_id UUID,
  chunk_id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  subcategory VARCHAR(50),
  language VARCHAR(5),
  chunk_content TEXT,
  chunk_index INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id AS knowledge_base_id,
    c.id AS chunk_id,
    kb.title,
    kb.description,
    kb.category,
    kb.subcategory,
    kb.language,
    c.content AS chunk_content,
    c.chunk_index,
    (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity
  FROM knowledge_base_chunks c
  JOIN knowledge_base kb ON kb.id = c.knowledge_base_id
  WHERE kb.is_active = TRUE
    AND kb.is_indexed = TRUE
    AND (p_category IS NULL OR kb.category = p_category)
    AND (p_subcategory IS NULL OR kb.subcategory = p_subcategory)
    AND (1 - (c.embedding <=> query_embedding)) >= p_threshold
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;

-- Ajouter un commentaire
COMMENT ON FUNCTION search_knowledge_base(vector, TEXT, TEXT, INTEGER, FLOAT) IS
  'Recherche sémantique dans la base de connaissances. Accepte les embeddings Ollama (1024) et OpenAI (1536).';
