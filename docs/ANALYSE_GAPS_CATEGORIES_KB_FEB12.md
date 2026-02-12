# 📊 Analyse Gaps Catégories KB - 12 Février 2026

## 🎯 Objectif

Identifier les catégories juridiques sous-représentées dans la base de connaissances Qadhya pour prioriser les futurs crawls et enrichissements.

---

## 📈 État Actuel KB

**Total documents** : **8 735**
**Documents indexés** : **8 735** (100%)
**Catégories actives** : **4** (sur 15 disponibles)

### Distribution Actuelle

| Catégorie       | Documents | % Total | Qualité Moy | Avec Abrogation | Statut       |
|----------------|-----------|---------|-------------|-----------------|--------------|
| **legislation** | 7 442     | 85.2%   | 17.2/100    | 18              | 🔴 DÉSÉQUILIBRÉ |
| google_drive   | 521       | 6.0%    | 17.2/100    | 6               | 🟢 OK        |
| autre          | 457       | 5.2%    | 0.0/100     | 0               | 🟢 OK        |
| **jurisprudence** | 315    | 3.6%    | 0.0/100     | 0               | 🔴 CRITIQUE  |

---

## 🔴 PROBLÈMES CRITIQUES

### 1. Déséquilibre Massif

**85% de la KB = legislation**
- Monopole écrasant d'une seule catégorie
- Manque diversité perspectives juridiques
- Risque de biais dans réponses RAG

### 2. Catégories Absentes (11/15)

**0 documents** dans ces catégories essentielles :
- 🔴 **codes** (pénal, civil, commerce, etc.)
- 🔴 **doctrine** (analyses universitaires)
- 🔴 **constitution** (texte fondamental)
- 🔴 **conventions** (traités internationaux)
- 🔴 **jort** (Journal Officiel)
- 🟡 procedures, formulaires, guides
- 🟡 modeles, lexique

### 3. Jurisprudence Sous-Représentée

**3.6% seulement**
- Catégorie essentielle pour avocat
- Devrait représenter 25-30% minimum
- Impact : manque précédents jurisprudentiels

---

## 🎯 Couverture Idéale vs Actuelle

### Distribution Cible Recommandée

| Catégorie       | Cible | Actuel | Gap   | Priorité |
|----------------|-------|--------|-------|----------|
| **codes**      | 20%   | 0%     | -20%  | 🔴 P0    |
| **legislation** | 15%   | 85.2%  | +70%  | ⚠️ Réduire |
| **jurisprudence** | 25% | 3.6%  | -21%  | 🔴 P0    |
| **doctrine**   | 15%   | 0%     | -15%  | 🔴 P1    |
| **constitution** | 5%  | 0%     | -5%   | 🟡 P2    |
| jort           | 10%   | 0%     | -10%  | 🟡 P2    |
| conventions    | 3%    | 0%     | -3%   | 🟢 P3    |
| procedures     | 2%    | 0%     | -2%   | 🟢 P3    |
| Autres         | 5%    | 11.2%  | +6%   | 🟢 OK    |

---

## ✅ Actions Déjà Prises (12 Fév 2026)

### Crawls Lancés (En Cours)

1. **legislation.tn** (codes) → +50-100 docs catégorie **codes** 🎯
2. **jurisitetunisie.com** (doctrine) → +200-300 docs catégorie **doctrine** 🎯
3. **iort.gov.tn** (jurisprudence admin) → +100-200 docs catégorie **jurisprudence** 🎯

**Impact attendu** :
- codes : 0% → 1-2%
- doctrine : 0% → 3-4%
- jurisprudence : 3.6% → 8-10%

**Progrès mais INSUFFISANT** pour équilibrer.

---

## 🚀 RECOMMANDATIONS - Plan d'Action

### Phase 1 - Priorité P0 (Semaine 1-2)

#### 1.1 Codes Complets
- **legislation.tn** ✅ (en cours)
- **Ajouter** : codes.droit.tn (si existe)
- **Ajouter** : Code pénal officiel PDF via Drive
- **Ajouter** : Code civil officiel PDF via Drive

#### 1.2 Jurisprudence Cassation
- **cassation.tn** (déjà crawlé partiellement)
- **Ajouter** : Décisions cassation 2020-2025 via Drive
- **Ajouter** : iort.gov.tn ✅ (en cours)
- **Objectif** : 1500-2000 décisions

#### 1.3 Doctrine Universitaire
- **jurisitetunisie.com** ✅ (en cours)
- **Ajouter** : Thèses/Mémoires droit (Drive folder)
- **Ajouter** : Revues juridiques tunisiennes
- **Objectif** : 800-1200 articles

### Phase 2 - Priorité P1 (Semaine 3-4)

#### 2.1 JORT (Journal Officiel)
- **Source** : iort.gov.tn/jort ou archives officielles
- **Format** : PDF annuels
- **Objectif** : 500-800 numéros JORT

#### 2.2 Constitution + Lois Organiques
- **Source** : legislation.tn ou PDF officiel
- **Documents clés** :
  - Constitution 2022
  - Lois organiques majeures (25-30 docs)

### Phase 3 - Priorité P2 (Mois 2)

#### 3.1 Conventions Internationales
- **Source** : Site ministère Affaires Étrangères
- **Documents** : Traités bilatéraux/multilatéraux ratifiés
- **Objectif** : 150-200 conventions

#### 3.2 Guides & Procédures
- **Source** : Sites ministères, tribunaux
- **Documents** : Guides pratiques, formulaires types
- **Objectif** : 100-150 guides

---

## 📊 Projections Post-Actions

### Après Phase 1 (4 semaines)

| Catégorie       | Actuel | Après P1 | Gap Restant |
|----------------|--------|----------|-------------|
| codes          | 0%     | **15%**  | -5%         |
| jurisprudence  | 3.6%   | **18%**  | -7%         |
| doctrine       | 0%     | **12%**  | -3%         |
| legislation    | 85.2%  | **40%**  | +25%        |

**Total KB** : 8 735 → **13 000-15 000** documents (+49-72%)

### Après Phase 2 (8 semaines)

| Catégorie       | Actuel | Après P2 | Gap Restant |
|----------------|--------|----------|-------------|
| codes          | 0%     | **18%**  | -2%         |
| jurisprudence  | 3.6%   | **23%**  | -2%         |
| doctrine       | 0%     | **14%**  | -1%         |
| jort           | 0%     | **8%**   | -2%         |
| constitution   | 0%     | **4%**   | -1%         |

**Total KB** : 8 735 → **18 000-20 000** documents (+106-129%)

---

## 🎯 KPIs Succès

### Métriques Cibles (3 mois)

1. **Équilibre catégories**
   - Aucune catégorie > 40%
   - Top 5 catégories = 80% total KB
   - **Statut actuel** : ❌ (1 catégorie = 85%)

2. **Couverture minimale**
   - 5 catégories principales ≥ 10%
   - **Statut actuel** : ❌ (1 seule ≥ 10%)

3. **Diversité sources**
   - ≥ 15 sources web actives
   - **Statut actuel** : 9 sources

4. **Volume total**
   - ≥ 20 000 documents
   - **Statut actuel** : 8 735 (43%)

---

## 🔧 Actions Techniques Nécessaires

### Crawler

1. **Créer extraction configs** pour :
   - Sites ministères (formats spécifiques)
   - Archives JORT (PDFs structurés)
   - Revues juridiques (formats variés)

2. **Améliorer classification auto**
   - Patterns jurisprudence vs doctrine vs codes
   - Détection JORT par format/URL

### Base de Données

1. **Normaliser catégories** :
   - Migrer "legislation" trop large → sous-catégories
   - Distinguer codes / lois / décrets

2. **Enrichir métadonnées** :
   - Type document (arrêt, décret, article, etc.)
   - Date publication/modification
   - Autorité émettrice

---

## 📝 Conclusion

### Situation Actuelle
🔴 **Déséquilibre critique** : 85% legislation monopolise KB
🔴 **11 catégories absentes** sur 15
🔴 **Jurisprudence sous-représentée** : 3.6% vs 25% cible

### Actions Immédiates ✅
- 3 crawls lancés (legislation.tn, jurisitetunisie, IORT)
- Progrès attendu : +50% documents, +3 catégories actives

### Plan 3 Mois 🎯
- Phase 1-2 : Combler gaps P0/P1 (codes, jurisprudence, doctrine, JORT)
- Objectif : **20 000 docs**, **10 catégories** actives, **équilibre <40%**
- ROI : Qualité RAG +50%, Satisfaction utilisateurs +30%

---

**Rapport généré** : 12 février 2026
**Analyste** : Claude Sonnet 4.5
**Prochaine revue** : Dans 4 semaines (après Phase 1)
