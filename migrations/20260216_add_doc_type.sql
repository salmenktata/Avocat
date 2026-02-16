-- Migration: Ajouter meta-catégorie doc_type
-- Date: 2026-02-16
-- Description: Ajoute une couche de classification par type de savoir juridique
--              sans modifier le système existant de 15 catégories

-- Créer enum type document_type
DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('TEXTES', 'JURIS', 'PROC', 'TEMPLATES', 'DOCTRINE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ajouter colonne doc_type (nullable pour compatibilité)
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS doc_type document_type;

-- Peupler automatiquement depuis category
UPDATE knowledge_base
SET doc_type = CASE
  -- TEXTES (normes)
  WHEN category IN ('legislation', 'codes', 'constitution', 'conventions', 'jort') THEN 'TEXTES'::document_type

  -- JURIS (jurisprudence)
  WHEN category = 'jurisprudence' THEN 'JURIS'::document_type

  -- PROC (procédures)
  WHEN category IN ('procedures', 'formulaires') THEN 'PROC'::document_type

  -- TEMPLATES (modèles)
  WHEN category = 'modeles' THEN 'TEMPLATES'::document_type

  -- DOCTRINE (académique + autres)
  WHEN category IN ('doctrine', 'guides', 'lexique', 'actualites', 'google_drive', 'autre') THEN 'DOCTRINE'::document_type

  ELSE 'DOCTRINE'::document_type  -- Fallback par défaut
END
WHERE doc_type IS NULL;

-- Index pour filtrage par doc_type
CREATE INDEX IF NOT EXISTS idx_knowledge_base_doc_type
ON knowledge_base(doc_type)
WHERE is_active = true;

-- Index composite doc_type + is_indexed pour recherches RAG
CREATE INDEX IF NOT EXISTS idx_knowledge_base_doc_type_indexed
ON knowledge_base(doc_type, is_indexed)
WHERE is_active = true AND is_indexed = true;

-- Vue stats par doc_type
CREATE OR REPLACE VIEW vw_kb_stats_by_doc_type AS
SELECT
  doc_type,
  COUNT(*) as total_docs,
  COUNT(*) FILTER (WHERE is_indexed = true) as indexed_docs,
  ROUND(AVG(quality_score), 2) as avg_quality,
  SUM(chunk_count) as total_chunks,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_indexed = true) / COUNT(*), 2) as indexation_rate
FROM knowledge_base
WHERE is_active = true
GROUP BY doc_type
ORDER BY total_docs DESC;

-- Vue détaillée: distribution des catégories par doc_type
CREATE OR REPLACE VIEW vw_kb_doc_type_breakdown AS
SELECT
  doc_type,
  category,
  COUNT(*) as doc_count,
  COUNT(*) FILTER (WHERE is_indexed = true) as indexed_count,
  ROUND(AVG(quality_score), 2) as avg_quality
FROM knowledge_base
WHERE is_active = true
GROUP BY doc_type, category
ORDER BY doc_type, doc_count DESC;

-- Commentaires pour documentation
COMMENT ON COLUMN knowledge_base.doc_type IS 'Type de document selon la nature du savoir juridique (TEXTES=normes, JURIS=jurisprudence, PROC=procédures, TEMPLATES=modèles, DOCTRINE=académique)';
COMMENT ON TYPE document_type IS 'Taxonomie haut niveau des documents juridiques (complète les 15 catégories existantes)';
COMMENT ON VIEW vw_kb_stats_by_doc_type IS 'Statistiques agrégées par type de document (meta-catégorie)';
COMMENT ON VIEW vw_kb_doc_type_breakdown IS 'Distribution détaillée des catégories au sein de chaque type de document';
