-- Migration: Enrichir les métadonnées de la base de connaissances
-- Date: 2026-02-16
-- Description: Ajoute les champs manquants identifiés dans le plan d'amélioration RAG
--              (status juridique, citations standardisées, reliability, version tracking)

-- =============================================================================
-- 1. STATUS JURIDIQUE
-- =============================================================================

-- Créer enum pour le status juridique
DO $$ BEGIN
    CREATE TYPE legal_status AS ENUM ('en_vigueur', 'abroge', 'modifie', 'suspendu', 'inconnu');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ajouter colonne status (défaut: en_vigueur pour rétrocompat)
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS status legal_status DEFAULT 'en_vigueur';

-- Index pour filtrage par status
CREATE INDEX IF NOT EXISTS idx_knowledge_base_status
ON knowledge_base(status)
WHERE is_active = true;

-- Commentaire
COMMENT ON COLUMN knowledge_base.status IS 'Status juridique du document : en_vigueur (actif), abroge (abrogé), modifie (modifié récemment), suspendu (temporairement suspendu), inconnu (status non déterminé)';

-- =============================================================================
-- 2. CITATIONS STANDARDISÉES
-- =============================================================================

-- Citations au format standardisé (bilingue)
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS citation TEXT,
ADD COLUMN IF NOT EXISTS citation_ar TEXT;

-- Index pour recherche full-text des citations
CREATE INDEX IF NOT EXISTS idx_knowledge_base_citation_tsvector
ON knowledge_base USING GIN (to_tsvector('french', COALESCE(citation, '')));

CREATE INDEX IF NOT EXISTS idx_knowledge_base_citation_ar_tsvector
ON knowledge_base USING GIN (to_tsvector('arabic', COALESCE(citation_ar, '')));

-- Commentaires
COMMENT ON COLUMN knowledge_base.citation IS 'Citation standardisée en français (ex: "Code pénal, art. 258" ou "Arrêt Cour de Cassation n°12345 du 15/01/2024")';
COMMENT ON COLUMN knowledge_base.citation_ar IS 'Citation standardisée en arabe (ex: "المجلة الجزائية، الفصل 258" ou "قرار تعقيبي عدد 12345 بتاريخ 15/01/2024")';

-- =============================================================================
-- 3. ARTICLE ID (Si applicable)
-- =============================================================================

-- Identifiant article pour codes juridiques
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS article_id TEXT;

-- Index pour recherche rapide par article
CREATE INDEX IF NOT EXISTS idx_knowledge_base_article_id
ON knowledge_base(article_id)
WHERE article_id IS NOT NULL;

-- Commentaire
COMMENT ON COLUMN knowledge_base.article_id IS 'Identifiant unique de l''article si applicable (ex: "art_258", "article_42_bis", "فصل_12")';

-- =============================================================================
-- 4. RELIABILITY (Fiabilité de la source)
-- =============================================================================

-- Créer enum pour la fiabilité
DO $$ BEGIN
    CREATE TYPE source_reliability AS ENUM ('officiel', 'verifie', 'interne', 'commentaire', 'non_verifie');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ajouter colonne reliability (défaut: verifie)
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS reliability source_reliability DEFAULT 'verifie';

-- Index pour filtrage par fiabilité
CREATE INDEX IF NOT EXISTS idx_knowledge_base_reliability
ON knowledge_base(reliability)
WHERE is_active = true;

-- Commentaire
COMMENT ON COLUMN knowledge_base.reliability IS 'Fiabilité de la source : officiel (sources officielles JORT), verifie (sources vérifiées jurisprudence/codes), interne (documents internes cabinet), commentaire (doctrine/analyses), non_verifie (sources non vérifiées)';

-- =============================================================================
-- 5. VERSION TRACKING (Gestion des versions)
-- =============================================================================

-- Date de version (pour textes modifiés)
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS version_date DATE;

-- Références de supersession (chaînage versions)
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES knowledge_base(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS superseded_by_id UUID REFERENCES knowledge_base(id) ON DELETE SET NULL;

-- Index pour vérifier version la plus récente
CREATE INDEX IF NOT EXISTS idx_knowledge_base_supersedes
ON knowledge_base(supersedes_id)
WHERE supersedes_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_superseded_by
ON knowledge_base(superseded_by_id)
WHERE superseded_by_id IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN knowledge_base.version_date IS 'Date de la version du document (pour textes modifiés)';
COMMENT ON COLUMN knowledge_base.supersedes_id IS 'ID du document que cette version remplace (référence version précédente)';
COMMENT ON COLUMN knowledge_base.superseded_by_id IS 'ID du document qui remplace cette version (référence version suivante)';

-- =============================================================================
-- 6. VUES STATISTIQUES ENRICHIES
-- =============================================================================

-- Vue: Distribution par status juridique
CREATE OR REPLACE VIEW vw_kb_stats_by_status AS
SELECT
  status,
  COUNT(*) as total_docs,
  COUNT(*) FILTER (WHERE is_indexed = true) as indexed_docs,
  ROUND(AVG(quality_score), 2) as avg_quality,
  SUM(chunk_count) as total_chunks,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_indexed = true) / COUNT(*), 2) as indexation_rate
FROM knowledge_base
WHERE is_active = true
GROUP BY status
ORDER BY total_docs DESC;

COMMENT ON VIEW vw_kb_stats_by_status IS 'Statistiques agrégées par status juridique (en_vigueur, abroge, modifie, etc.)';

-- Vue: Distribution par fiabilité
CREATE OR REPLACE VIEW vw_kb_stats_by_reliability AS
SELECT
  reliability,
  COUNT(*) as total_docs,
  COUNT(*) FILTER (WHERE is_indexed = true) as indexed_docs,
  ROUND(AVG(quality_score), 2) as avg_quality,
  SUM(chunk_count) as total_chunks,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_indexed = true) / COUNT(*), 2) as indexation_rate
FROM knowledge_base
WHERE is_active = true
GROUP BY reliability
ORDER BY total_docs DESC;

COMMENT ON VIEW vw_kb_stats_by_reliability IS 'Statistiques agrégées par niveau de fiabilité des sources';

-- Vue: Documents avec chaîne de versions
CREATE OR REPLACE VIEW vw_kb_version_chains AS
SELECT
  kb.id,
  kb.title,
  kb.category,
  kb.version_date,
  kb.status,
  kb.supersedes_id,
  kb.superseded_by_id,
  prev.title as supersedes_title,
  prev.version_date as supersedes_date,
  next.title as superseded_by_title,
  next.version_date as superseded_by_date
FROM knowledge_base kb
LEFT JOIN knowledge_base prev ON kb.supersedes_id = prev.id
LEFT JOIN knowledge_base next ON kb.superseded_by_id = next.id
WHERE kb.is_active = true
  AND (kb.supersedes_id IS NOT NULL OR kb.superseded_by_id IS NOT NULL)
ORDER BY kb.version_date DESC NULLS LAST;

COMMENT ON VIEW vw_kb_version_chains IS 'Documents avec leurs versions précédentes et suivantes (chaîne de supersession)';

-- Vue: Documents abrogés nécessitant mise à jour status
CREATE OR REPLACE VIEW vw_kb_abrogated_candidates AS
SELECT
  kb.id,
  kb.title,
  kb.category,
  kb.status,
  kb.citation,
  la.abrogating_reference,
  la.jort_url,
  la.confidence
FROM knowledge_base kb
INNER JOIN legal_abrogations la
  ON la.abrogated_reference_normalized ILIKE '%' || kb.title || '%'
WHERE kb.is_active = true
  AND kb.status != 'abroge'
  AND la.confidence = 'high'
ORDER BY la.abrogation_date DESC;

COMMENT ON VIEW vw_kb_abrogated_candidates IS 'Documents actifs qui semblent abrogés selon legal_abrogations mais pas encore marqués status=abroge';

-- =============================================================================
-- 7. FONCTIONS UTILITAIRES
-- =============================================================================

-- Fonction: Marquer un document comme abrogé
CREATE OR REPLACE FUNCTION mark_document_as_abrogated(
  p_document_id UUID,
  p_abrogation_source TEXT,
  p_version_date DATE DEFAULT CURRENT_DATE
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE knowledge_base
  SET
    status = 'abroge',
    version_date = p_version_date,
    updated_at = CURRENT_TIMESTAMP,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{abrogation_info}',
      jsonb_build_object(
        'marked_at', CURRENT_TIMESTAMP,
        'source', p_abrogation_source
      )
    )
  WHERE id = p_document_id
    AND is_active = true;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_document_as_abrogated IS 'Marque un document comme abrogé avec source et date d''abrogation';

-- Fonction: Créer chaîne de version (lien supersession)
CREATE OR REPLACE FUNCTION link_document_versions(
  p_new_version_id UUID,
  p_old_version_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Lier nouvelle version → ancienne version
  UPDATE knowledge_base
  SET supersedes_id = p_old_version_id
  WHERE id = p_new_version_id;

  -- Lier ancienne version → nouvelle version
  UPDATE knowledge_base
  SET superseded_by_id = p_new_version_id
  WHERE id = p_old_version_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION link_document_versions IS 'Crée un lien de supersession bidirectionnel entre deux versions d''un document';

-- =============================================================================
-- 8. POPULATION AUTOMATIQUE DEPUIS EXISTANT
-- =============================================================================

-- Peupler reliability depuis category
UPDATE knowledge_base
SET reliability = CASE
  -- Sources officielles
  WHEN category IN ('codes', 'constitution', 'jort', 'legislation') THEN 'officiel'::source_reliability

  -- Sources vérifiées
  WHEN category IN ('jurisprudence', 'conventions') THEN 'verifie'::source_reliability

  -- Documents internes
  WHEN category = 'google_drive' THEN 'interne'::source_reliability

  -- Doctrine et analyses
  WHEN category IN ('doctrine', 'guides', 'actualites') THEN 'commentaire'::source_reliability

  -- Autres
  ELSE 'verifie'::source_reliability
END
WHERE reliability = 'verifie'; -- Seulement ceux non encore modifiés

-- Peupler status depuis legal_abrogations (documents abrogés)
UPDATE knowledge_base kb
SET status = 'abroge'::legal_status
WHERE EXISTS (
  SELECT 1
  FROM legal_abrogations la
  WHERE la.abrogated_reference_normalized ILIKE '%' || kb.title || '%'
    AND la.confidence = 'high'
)
AND kb.status = 'en_vigueur';

-- Peupler article_id depuis title (extraction pattern article)
UPDATE knowledge_base
SET article_id = (
  SELECT CASE
    -- Pattern français: "Article 258", "art. 42 bis"
    WHEN title ~* 'article?\s+(\d+)(?:\s+(bis|ter|quater))?' THEN
      'art_' || regexp_replace(
        regexp_replace(title, '.*article?\s+(\d+(?:\s+(?:bis|ter|quater))?)', '\1', 'i'),
        '\s+', '_', 'g'
      )
    -- Pattern arabe: "الفصل 258", "فصل 12 مكرر"
    WHEN title ~ 'الفصل\s+(\d+)(?:\s+مكرر)?' THEN
      'fasl_' || regexp_replace(title, '.*الفصل\s+(\d+).*', '\1')
    ELSE NULL
  END
)
WHERE article_id IS NULL
  AND category IN ('codes', 'legislation', 'constitution')
  AND (title ~* 'article?' OR title ~ 'الفصل|فصل');

-- =============================================================================
-- 9. CONTRAINTES ET VALIDATIONS
-- =============================================================================

-- Contrainte: Un document ne peut pas se superseder lui-même
ALTER TABLE knowledge_base
ADD CONSTRAINT chk_no_self_supersession
CHECK (supersedes_id IS NULL OR supersedes_id != id);

-- Contrainte: version_date ne peut pas être dans le futur
ALTER TABLE knowledge_base
ADD CONSTRAINT chk_version_date_not_future
CHECK (version_date IS NULL OR version_date <= CURRENT_DATE);

-- =============================================================================
-- RÉSUMÉ DE LA MIGRATION
-- =============================================================================

-- Afficher résumé des changements
DO $$
DECLARE
  v_total_docs INTEGER;
  v_with_citation INTEGER;
  v_with_article_id INTEGER;
  v_abrogated INTEGER;
  v_official INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_docs FROM knowledge_base WHERE is_active = true;
  SELECT COUNT(*) INTO v_with_citation FROM knowledge_base WHERE citation IS NOT NULL;
  SELECT COUNT(*) INTO v_with_article_id FROM knowledge_base WHERE article_id IS NOT NULL;
  SELECT COUNT(*) INTO v_abrogated FROM knowledge_base WHERE status = 'abroge';
  SELECT COUNT(*) INTO v_official FROM knowledge_base WHERE reliability = 'officiel';

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Migration enrichissement métadonnées - Résumé';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total documents actifs: %', v_total_docs;
  RAISE NOTICE 'Avec citations: %', v_with_citation;
  RAISE NOTICE 'Avec article_id: %', v_with_article_id;
  RAISE NOTICE 'Status abrogé: %', v_abrogated;
  RAISE NOTICE 'Fiabilité officielle: %', v_official;
  RAISE NOTICE '=================================================================';
END $$;
