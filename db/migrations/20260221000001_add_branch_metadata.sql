-- Migration: Ajouter champ `branch` (branche juridique) sur KB
-- Date: 2026-02-21
-- Sprint 1 RAG Audit-Proof — Cause racine isolation domaine
--
-- Objectif: Permettre un filtre dur par branche juridique pour éviter
-- qu'une question marchés_publics retourne مجلة الشغل.

-- =============================================================================
-- 1. ENUM DES BRANCHES JURIDIQUES TUNISIENNES
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE legal_branch AS ENUM (
    'administratif',
    'civil',
    'commercial',
    'pénal',
    'travail',
    'fiscal',
    'procédure',
    'marchés_publics',
    'bancaire',
    'immobilier',
    'famille',
    'autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. COLONNES SUR knowledge_base ET knowledge_base_chunks
-- =============================================================================

ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS branch legal_branch DEFAULT 'autre';

ALTER TABLE knowledge_base_chunks
  ADD COLUMN IF NOT EXISTS branch legal_branch;

COMMENT ON COLUMN knowledge_base.branch IS
'Branche juridique du document (administratif, civil, pénal, travail, marchés_publics...) — permet filtre dur lors du retrieval RAG';

COMMENT ON COLUMN knowledge_base_chunks.branch IS
'Branche juridique du chunk — propagée depuis knowledge_base.branch';

-- =============================================================================
-- 3. INDEX POUR FILTRAGE RAPIDE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_kb_branch
  ON knowledge_base(branch);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_branch
  ON knowledge_base_chunks(branch);

-- Commentaire documentation
COMMENT ON TYPE legal_branch IS
'Branches juridiques tunisiennes — utilisé pour isoler les sources par domaine dans le RAG';
