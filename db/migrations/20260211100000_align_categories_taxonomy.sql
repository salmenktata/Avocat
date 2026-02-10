-- ============================================================================
-- Migration : Alignement Catégories TS ↔ Taxonomie DB
-- Date : 2026-02-11
-- Objectif : Synchroniser les 15 catégories TS (legal-categories.ts) avec la DB
-- ============================================================================
-- Contexte :
--   - TS définit 15 catégories (source de vérité)
--   - DB n'en a que 9 (manquent: constitution, formulaires, lexique, actualites, google_drive, autre)
--   - Le code `constitution` existe déjà comme document_type → le renommer d'abord
--   - Labels FR/AR harmonisés avec les traductions TS
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1 : Résoudre le conflit `constitution` (UNIQUE constraint sur `code`)
-- ============================================================================

-- 1a. Renommer le document_type `constitution` en `doc_constitution`
-- pour libérer le code pour la catégorie
UPDATE legal_taxonomy
SET code = 'doc_constitution',
    updated_at = NOW()
WHERE code = 'constitution' AND type = 'document_type';

-- 1b. Mettre à jour les parent_code qui référençaient `constitution`
UPDATE legal_taxonomy
SET parent_code = 'doc_constitution',
    updated_at = NOW()
WHERE parent_code = 'constitution';

-- ============================================================================
-- PHASE 2 : Insérer les 6 catégories manquantes (bilingue FR/AR)
-- ============================================================================

-- Insérer les 10 catégories potentiellement manquantes (ON CONFLICT = idempotent)
INSERT INTO legal_taxonomy (type, code, label_fr, label_ar, description, is_system, is_active, sort_order)
VALUES
  ('category', 'constitution', 'Constitution', 'الدستور',
   'Constitution de la République Tunisienne / دستور الجمهورية التونسية', true, true, 5),
  ('category', 'conventions', 'Conventions internationales', 'الاتفاقيات الدولية',
   'Conventions et traités internationaux / الاتفاقيات والمعاهدات الدولية', true, true, 6),
  ('category', 'modeles', 'Modèles', 'النماذج',
   'Modèles de documents juridiques / نماذج الوثائق القانونية', true, true, 7),
  ('category', 'formulaires', 'Formulaires', 'الاستمارات',
   'Formulaires officiels tunisiens / الاستمارات الرسمية التونسية', true, true, 8),
  ('category', 'procedures', 'Procédures', 'الإجراءات',
   'Guides procéduraux / أدلة الإجراءات القضائية', true, true, 9),
  ('category', 'guides', 'Guides pratiques', 'الأدلة',
   'Guides pratiques pour avocats / أدلة عملية للمحامين', true, true, 11),
  ('category', 'lexique', 'Lexique juridique', 'المصطلحات',
   'Lexique des termes juridiques / قاموس المصطلحات القانونية', true, true, 12),
  ('category', 'actualites', 'Actualités', 'الأخبار',
   'Actualités et mises à jour juridiques / الأخبار والتحديثات القانونية', true, true, 13),
  ('category', 'google_drive', 'Google Drive', 'مستندات جوجل درايف',
   'Documents depuis Google Drive / مستندات من جوجل درايف', true, true, 14),
  ('category', 'autre', 'Autres', 'أخرى',
   'Autres catégories / فئات أخرى', true, true, 15)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- PHASE 3 : Harmoniser les labels FR/AR de toutes les catégories existantes
-- (TS = source de vérité pour les labels)
-- ============================================================================

-- legislation : "Législation" / "التشريع"
UPDATE legal_taxonomy
SET label_fr = 'Législation', label_ar = 'التشريع',
    description = 'Textes législatifs et réglementaires tunisiens / النصوص التشريعية والتنظيمية التونسية',
    updated_at = NOW()
WHERE code = 'legislation' AND type = 'category';

-- jurisprudence : "Jurisprudence" / "فقه القضاء"
UPDATE legal_taxonomy
SET label_fr = 'Jurisprudence', label_ar = 'فقه القضاء',
    description = 'Décisions de justice tunisiennes / قرارات وأحكام المحاكم التونسية',
    updated_at = NOW()
WHERE code = 'jurisprudence' AND type = 'category';

-- doctrine : "Doctrine" / "الفقه"
UPDATE legal_taxonomy
SET label_fr = 'Doctrine', label_ar = 'الفقه',
    description = 'Travaux académiques et commentaires juridiques / الأعمال الأكاديمية والتعليقات القانونية',
    updated_at = NOW()
WHERE code = 'doctrine' AND type = 'category';

-- codes : "Codes juridiques" / "المجلات القانونية"
UPDATE legal_taxonomy
SET label_fr = 'Codes juridiques', label_ar = 'المجلات القانونية',
    description = 'Codes juridiques tunisiens / المجلات القانونية التونسية',
    updated_at = NOW()
WHERE code = 'codes' AND type = 'category';

-- jort : "JORT" / "الرائد الرسمي"
UPDATE legal_taxonomy
SET label_fr = 'JORT', label_ar = 'الرائد الرسمي',
    description = 'Journal Officiel de la République Tunisienne / الرائد الرسمي للجمهورية التونسية',
    updated_at = NOW()
WHERE code = 'jort' AND type = 'category';

-- conventions : "Conventions internationales" / "الاتفاقيات الدولية"
UPDATE legal_taxonomy
SET label_fr = 'Conventions internationales', label_ar = 'الاتفاقيات الدولية',
    description = 'Conventions et traités internationaux / الاتفاقيات والمعاهدات الدولية',
    updated_at = NOW()
WHERE code = 'conventions' AND type = 'category';

-- modeles : "Modèles" / "النماذج"
UPDATE legal_taxonomy
SET label_fr = 'Modèles', label_ar = 'النماذج',
    description = 'Modèles de documents juridiques / نماذج الوثائق القانونية',
    updated_at = NOW()
WHERE code = 'modeles' AND type = 'category';

-- procedures : "Procédures" / "الإجراءات"
UPDATE legal_taxonomy
SET label_fr = 'Procédures', label_ar = 'الإجراءات',
    description = 'Guides procéduraux / أدلة الإجراءات القضائية',
    updated_at = NOW()
WHERE code = 'procedures' AND type = 'category';

-- guides : "Guides pratiques" / "الأدلة"
UPDATE legal_taxonomy
SET label_fr = 'Guides pratiques', label_ar = 'الأدلة',
    description = 'Guides pratiques pour avocats / أدلة عملية للمحامين',
    updated_at = NOW()
WHERE code = 'guides' AND type = 'category';

-- conventions : "Conventions internationales" / "الاتفاقيات الدولية"
UPDATE legal_taxonomy
SET label_fr = 'Conventions internationales', label_ar = 'الاتفاقيات الدولية',
    description = 'Conventions et traités internationaux / الاتفاقيات والمعاهدات الدولية',
    updated_at = NOW()
WHERE code = 'conventions' AND type = 'category';

-- modeles : "Modèles" / "النماذج"
UPDATE legal_taxonomy
SET label_fr = 'Modèles', label_ar = 'النماذج',
    description = 'Modèles de documents juridiques / نماذج الوثائق القانونية',
    updated_at = NOW()
WHERE code = 'modeles' AND type = 'category';

-- procedures : "Procédures" / "الإجراءات"
UPDATE legal_taxonomy
SET label_fr = 'Procédures', label_ar = 'الإجراءات',
    description = 'Guides procéduraux / أدلة الإجراءات القضائية',
    updated_at = NOW()
WHERE code = 'procedures' AND type = 'category';

-- ============================================================================
-- PHASE 4 : Ajouter les 3 domaines manquants en TS (societes, donnees_personnelles, energie)
-- ============================================================================

INSERT INTO legal_taxonomy (type, code, parent_code, label_fr, label_ar, description, is_system, is_active, sort_order)
VALUES
  ('domain', 'societes', NULL, 'Droit des sociétés', 'قانون الشركات',
   'Droit des sociétés commerciales / قانون الشركات التجارية', true, true, 30),
  ('domain', 'donnees_personnelles', NULL, 'Protection des données personnelles', 'حماية المعطيات الشخصية',
   'Protection des données personnelles / حماية المعطيات الشخصية', true, true, 31),
  ('domain', 'energie', NULL, 'Droit de l''énergie', 'قانون الطاقة',
   'Droit de l''énergie et ressources naturelles / قانون الطاقة والموارد الطبيعية', true, true, 32)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- PHASE 5 : Vérification
-- ============================================================================

-- Vérifier que 15 catégories sont actives
DO $$
DECLARE
  cat_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cat_count
  FROM legal_taxonomy
  WHERE type = 'category' AND is_active = true;

  IF cat_count < 15 THEN
    RAISE WARNING 'Attention: seulement % catégories actives trouvées (attendu: 15)', cat_count;
  ELSE
    RAISE NOTICE '✓ % catégories actives (OK)', cat_count;
  END IF;
END $$;

-- Vérifier que le document_type constitution a été renommé
DO $$
DECLARE
  old_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO old_count
  FROM legal_taxonomy
  WHERE code = 'constitution' AND type = 'document_type';

  IF old_count > 0 THEN
    RAISE WARNING 'ERREUR: document_type "constitution" existe encore (devrait être "doc_constitution")';
  ELSE
    RAISE NOTICE '✓ document_type "constitution" correctement renommé en "doc_constitution"';
  END IF;
END $$;

COMMIT;
