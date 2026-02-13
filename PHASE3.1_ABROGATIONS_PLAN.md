# Phase 3.1 : Extension Base Abrogations - Plan Détaillé

**Date début** : 13 février 2026
**Durée estimée** : 1 semaine
**Objectif** : 16 → 100+ abrogations tunisiennes vérifiées

---

## 📊 État Initial

| Métrique | Valeur |
|----------|--------|
| **Total abrogations** | 16 |
| **Totales** | 9 |
| **Partielles** | 5 |
| **Implicites** | 2 |

---

## 🎯 Objectifs Phase 3.1

### Quantitatifs
- ✅ 100+ abrogations vérifiées (vs 16 actuel)
- ✅ 10+ domaines juridiques couverts
- ✅ Sources JORT référencées pour 80%+
- ✅ Traductions AR pour 100%

### Qualitatifs
- ✅ Validation par sources officielles (JORT, legislation.tn)
- ✅ Articles affectés spécifiés
- ✅ Notes explicatives contextuelles
- ✅ Dates vérifiées

---

## 📚 Domaines Juridiques à Couvrir

### Priorité Haute (50 abrogations)

#### 1. Droit Administratif (10 abrogations)
**Sources** :
- legislation.tn (droit administratif)
- JORT archives 2000-2026

**Lois cibles** :
- Loi sur la fonction publique (réformes multiples)
- Loi sur les marchés publics (abrogations partielles)
- Décrets organisationnels ministères

#### 2. Droit Fiscal (15 abrogations)
**Sources** :
- Code de l'impôt sur le revenu et sociétés (IRPP/IS)
- Code des douanes
- Lois de finances annuelles (2020-2026)

**Lois cibles** :
- Régimes fiscaux abrogés
- Avantages fiscaux supprimés
- Barèmes anciens

#### 3. Droit du Travail (10 abrogations)
**Sources** :
- Code du Travail (réformes 2016-2024)
- Conventions collectives abrogées

**Lois cibles** :
- Anciens régimes retraite
- Dispositions protection travailleur (modifiées)
- Régimes spéciaux sectoriels

#### 4. Droit Bancaire & Financier (10 abrogations)
**Sources** :
- Code des institutions financières
- Lois BCT (Banque Centrale)
- Réglementation change

**Lois cibles** :
- Anciennes régulations bancaires
- Lois sur le crédit (réformées)
- Dispositions anti-blanchiment anciennes

#### 5. Droit Immobilier (5 abrogations)
**Sources** :
- Code des droits réels
- Loi sur la propriété foncière

**Lois cibles** :
- Anciennes lois foncières rurales
- Régimes vente étrangers (modifiés)

### Priorité Moyenne (30 abrogations)

#### 6. Droit de la Santé (8 abrogations)
**Sources** :
- Code de la santé publique
- Réglementations COVID-19 temporaires

#### 7. Droit de l'Environnement (12 abrogations)
**Sources** :
- Code de l'environnement
- Lois protection côtière/forêts

#### 8. Droit des Télécommunications (5 abrogations)
**Sources** :
- Code des télécommunications
- Lois régulation secteur

#### 9. Droit du Numérique (5 abrogations)
**Sources** :
- Lois e-commerce
- Protection données personnelles

### Priorité Basse (20 abrogations)

#### 10. Droit de la Famille (8 abrogations supplémentaires)
**Sources** :
- Code du Statut Personnel (CSP) - réformes

#### 11. Autres Domaines (12 abrogations)
- Droit de l'énergie
- Droit de l'agriculture
- Droit de l'éducation
- Droit sportif

---

## 🔍 Méthodologie Recherche

### Étape 1 : Identification Sources
```bash
# Crawler automatique
1. legislation.tn/fr/search?q="abroge"
2. iort.gov.tn (JORT) - recherche "abroge", "remplace", "modifie"
3. 9anoun.tn - articles abrogations récentes
4. jurisitetunisie.com - notes doctrine
```

### Étape 2 : Extraction Données
Pour chaque abrogation trouvée :
```typescript
{
  abrogated_reference: "Loi n°XX-YY du YYYY-MM-DD",
  abrogated_reference_ar: "القانون عدد XX-YY ...",
  abrogating_reference: "Loi n°ZZ-AA du YYYY-MM-DD",
  abrogating_reference_ar: "القانون عدد ZZ-AA ...",
  abrogation_date: "YYYY-MM-DD",
  scope: "total" | "partial" | "implicit",
  affected_articles: ["art. 1", "art. 5-10"],
  jort_url: "http://www.iort.gov.tn/...",
  source_url: "http://www.legislation.tn/...",
  notes: "Contexte abrogation, raison, impact"
}
```

### Étape 3 : Validation
- ✅ Vérification source JORT si disponible
- ✅ Cross-check legislation.tn
- ✅ Validation dates cohérentes
- ✅ Traduction AR vérifiée

### Étape 4 : Insertion DB
```sql
INSERT INTO legal_abrogations (...) VALUES (...)
ON CONFLICT (abrogated_reference, abrogating_reference)
DO UPDATE SET ...
```

---

## 🛠️ Livrables

### 1. Script Recherche Automatique
**Fichier** : `scripts/research-legal-abrogations.ts`
- Crawler legislation.tn
- Extraction abrogations via patterns regex
- Export CSV brut pour validation manuelle

### 2. Dataset Abrogations
**Fichier** : `data/abrogations/abrogations-tunisiennes-100.csv`
- 100+ abrogations vérifiées
- Format standardisé
- Sources référencées

### 3. Script Seed Étendu
**Fichier** : `scripts/seed-legal-abrogations-extended.ts`
- Import CSV → PostgreSQL
- Validation format
- Gestion doublons
- Logs insertion

### 4. Tests Validation
**Fichier** : `__tests__/legal-abrogations-extended.test.ts`
- Test seed réussi
- Test détection (fuzzy matching)
- Test couverture domaines

### 5. Documentation
**Fichier** : `docs/LEGAL_ABROGATIONS_SOURCES.md`
- Sources utilisées par domaine
- Méthodologie validation
- Statistiques par domaine
- Maintenance future

---

## 📅 Planning Semaine

### Jour 1-2 : Recherche Automatisée (16h)
- [x] Créer script crawler legislation.tn
- [ ] Extraire 50+ abrogations droit fiscal
- [ ] Extraire 30+ abrogations droit administratif
- [ ] Extraire 20+ abrogations autres domaines

### Jour 3 : Validation Manuelle (8h)
- [ ] Vérifier sources JORT (80%+)
- [ ] Traductions AR (100%)
- [ ] Notes contextuelles
- [ ] Export CSV final

### Jour 4 : Implémentation (8h)
- [ ] Script seed étendu
- [ ] Tests validation
- [ ] Documentation sources

### Jour 5 : Déploiement Production (4h)
- [ ] Backup DB
- [ ] Seed production
- [ ] Validation post-import
- [ ] Update monitoring

---

## ✅ Critères de Succès

| Critère | Cible | Mesure |
|---------|-------|--------|
| **Nombre total** | 100+ | COUNT(*) FROM legal_abrogations |
| **Sources JORT** | 80%+ | % avec jort_url |
| **Traductions AR** | 100% | % avec abrogated_reference_ar |
| **Domaines couverts** | 10+ | DISTINCT domaines |
| **Détection amélioration** | +30% | Tests fuzzy matching |

---

## 🔬 Tests Validation

### Test 1 : Couverture Domaines
```sql
SELECT notes, COUNT(*)
FROM legal_abrogations
WHERE notes LIKE '%[domaine]%'
GROUP BY notes;
```

### Test 2 : Qualité Sources
```sql
SELECT
  COUNT(*) FILTER (WHERE jort_url IS NOT NULL) as avec_jort,
  COUNT(*) FILTER (WHERE source_url IS NOT NULL) as avec_source,
  COUNT(*) as total
FROM legal_abrogations;
```

### Test 3 : Détection Assistant IA
```bash
# Tester avec lois abrogées connues
curl https://qadhya.tn/api/chat \
  -d '{"message":"Loi n°72-40 (abrogée 2016)"}'

# Vérifier warning retourné
```

---

## 💰 Coût Estimé

| Poste | Durée | Coût |
|-------|-------|------|
| **Recherche juridique** | 16h | Manuelle |
| **Validation sources** | 8h | Manuelle |
| **Développement** | 8h | Dev |
| **Tests** | 4h | Dev |
| **Total** | 36h | ~1 semaine |

---

## 🎯 Impact Attendu

### Quantitatif
- **Taux détection abrogations** : +500% (16 → 100+)
- **Couverture domaines** : 3 → 10+ domaines
- **Précision warnings** : +30-40%

### Qualitatif
- ✅ Confiance utilisateurs augmentée
- ✅ Compliance juridique renforcée
- ✅ Différenciation compétitive (unique en Tunisie)
- ✅ Base pour ML détection automatique future (Phase 4.1)

---

**Prêt à démarrer !** 🚀
