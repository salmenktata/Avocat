# Phase 3.1 - Plan B : Sources Alternatives Abrogations

**Date** : 13 février 2026
**Contexte** : legislation.tn temporairement indisponible
**Objectif** : 100+ abrogations vérifiées via sources alternatives

---

## 🎯 Stratégie Alternative

### Approche Hybride

1. **Analyse KB existante** (20-30 abrogations attendues)
   - Rechercher mentions d'abrogations dans nos 8,735 documents indexés
   - Extraire automatiquement les références

2. **Sources officielles manuelles** (50-70 abrogations)
   - JORT officiel : https://www.iort.gov.tn/
   - Portails juridiques fiables
   - Documentation professionnelle avocats

3. **Validation croisée** (100% qualité)
   - Vérification JORT pour chaque abrogation
   - Traduction AR/FR professionnelle
   - Notes contextuelles

---

## 📚 Sources Prioritaires

### 1. JORT Officiel (Primary Source)

**URL** : https://www.iort.gov.tn/
**Avantages** :
- Source officielle gouvernementale
- Textes intégraux en AR/FR
- Historique complet

**Domaines à Consulter** :
- Fiscal : Lois de finances annuelles (mentionnent abrogations)
- Codes : Code général des impôts, Code du travail (versions consolidées)
- Législation : Recherche par domaine

### 2. Base de Connaissances Qadhya

**Requête SQL** :
```sql
SELECT DISTINCT
  kb.title,
  kb.category,
  kbc.content_chunk
FROM knowledge_base kb
JOIN knowledge_base_chunks kbc ON kb.id = kbc.knowledge_base_id
WHERE kbc.content_chunk ILIKE '%abroge%'
   OR kbc.content_chunk ILIKE '%abrogée%'
   OR kbc.content_chunk ILIKE '%ملغى%'
   OR kbc.content_chunk LIKE '%يلغي%'
LIMIT 200;
```

**Attendu** : 20-50 documents mentionnant abrogations

### 3. Portails Juridiques Tunisiens

- **Avocats.tn** : Analyses juridiques avec références
- **Jurisitetunisie.com** : Jurisprudence commentée
- **Da5ira.com** : Blog juridique (déjà indexé)

### 4. Codes Consolidés

**Codes prioritaires** :
- Code général des impôts (dernière version 2025)
- Code du travail consolidé
- Code de procédure pénale
- Code de commerce

**Recherche** : Sections "Dispositions transitoires" et "Abrogations"

---

## 🔧 Outils à Créer

### Script 1 : Analyse KB pour Abrogations

**Fichier** : `scripts/extract-abrogations-from-kb.ts`
**Fonction** : Recherche dans KB existante, extrait mentions, génère CSV

### Script 2 : Template Saisie Manuelle

**Fichier** : `data/abrogations/template-manual-input.csv`
**Format** :
```csv
abrogated_reference,abrogated_reference_ar,abrogating_reference,abrogating_reference_ar,abrogation_date,scope,affected_articles,jort_url,source_url,notes,domain,verified
Loi n°2010-12,القانون عدد 2010-12,Loi n°2023-45,القانون عدد 2023-45,2023-06-15,total,,https://www.iort.gov.tn/...,https://www.iort.gov.tn/...,Abrogation totale loi fiscale,fiscal,true
```

### Script 3 : Validation JORT Automatique

**Fonction** : Vérifier existence référence sur iort.gov.tn

---

## 📋 Timeline Révisée

### Jour 1 : Extraction KB (2h)
- [x] Créer script extraction KB
- [ ] Exécuter sur production
- [ ] Analyser résultats (~20-30 candidats)

### Jour 2-3 : Recherche Manuelle (6h)
- [ ] JORT : 10 abrogations fiscales
- [ ] JORT : 10 abrogations travail
- [ ] JORT : 10 abrogations administratif
- [ ] Codes consolidés : 15 abrogations
- [ ] Portails juridiques : 10 abrogations

### Jour 4 : Validation (3h)
- [ ] Vérification JORT (100% des entrées)
- [ ] Traductions AR/FR
- [ ] Notes contextuelles
- [ ] Qualité assurance

### Jour 5 : Déploiement (2h)
- [ ] Import CSV en staging
- [ ] Tests détection
- [ ] Déploiement production
- [ ] Monitoring

---

## ✅ Critères de Qualité

### Chaque abrogation doit avoir :

1. **✓ Références complètes**
   - Numéro loi abrogée : `Loi n°YYYY-XX`
   - Numéro loi abrogeante : `Loi n°YYYY-XX`
   - Traductions AR/FR complètes

2. **✓ Métadonnées précises**
   - Date exacte d'abrogation (jour/mois/année)
   - Scope clair : total/partial/implicit
   - Articles affectés si partial

3. **✓ Sources vérifiables**
   - URL JORT obligatoire (80%+)
   - URL source alternative si JORT indisponible
   - Notes contextuelles explicatives

4. **✓ Validation**
   - Colonne `verified=true` seulement si source officielle
   - Domaine juridique assigné
   - Confidence level : high/medium/low

---

## 📊 Répartition Cible par Domaine

| Domaine | Objectif | Source Principale |
|---------|----------|-------------------|
| **Fiscal** | 15 | Lois de finances + CGI |
| **Administratif** | 10 | Codes + JORT |
| **Travail** | 10 | Code du travail consolidé |
| **Bancaire** | 10 | BCT circulaires + lois |
| **Immobilier** | 5 | Code foncier |
| **Santé** | 8 | Ministère santé + JORT |
| **Environnement** | 12 | ANPE + législation |
| **Télécoms** | 5 | INTT + lois |
| **Numérique** | 5 | Loi données personnelles |
| **Famille** | 8 | CSP consolidé |
| **Pénal** | 10 | CPP + codes |
| **Commercial** | 10 | Code commerce |
| **TOTAL** | **108** | Sources mixtes |

---

## 🚀 Prochaines Actions Immédiates

1. **Créer script extraction KB** ✅ (en cours)
2. **Exécuter analyse sur production**
3. **Créer template CSV manuel**
4. **Commencer recherche JORT domaines prioritaires**

---

**Avantages Plan B** :
- ✅ Qualité garantie (100% vérifiées)
- ✅ Sources officielles fiables
- ✅ Traductions professionnelles
- ✅ Indépendant de legislation.tn

**Compromis** :
- ⏱️ Plus de temps manuel (6h vs 2h automatique)
- 📚 Nécessite expertise juridique pour validation

---

**Démarrage** : Immédiat (script extraction KB)
**Livraison** : 5 jours (vs 1 semaine plan A)
**Qualité** : Supérieure (vérification humaine)
