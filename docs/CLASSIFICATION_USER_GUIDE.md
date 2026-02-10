# Guide Utilisateur - Système de Classification Juridique

**Version** : 1.0
**Date** : 10 février 2026
**Statut** : Sprint 3 Complété

---

## Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Accéder à l'interface](#accéder-à-linterface)
3. [Tab 1 : À Revoir](#tab-1--à-revoir)
4. [Tab 2 : Historique](#tab-2--historique)
5. [Tab 3 : Règles Auto](#tab-3--règles-auto)
6. [Tab 4 : Analytics](#tab-4--analytics)
7. [Workflow de revue](#workflow-de-revue)
8. [Bonnes pratiques](#bonnes-pratiques)
9. [FAQ](#faq)

---

## Vue d'ensemble

Le système de classification juridique de Qadhya utilise une **intelligence artificielle multi-signaux** pour classifier automatiquement les documents juridiques tunisiens en 3 catégories principales :

- **Législation** : Lois, décrets, arrêtés, circulaires
- **Jurisprudence** : Décisions de justice (Cour de Cassation, tribunaux)
- **Doctrine** : Articles juridiques, thèses, commentaires

### Architecture du système

Le système combine **5 sources d'intelligence** :

1. **Structure du site** (30%) - Analyse URL, sections, hiérarchie
2. **Règles configurées** (40%) - Règles manuelles + auto-générées
3. **Mots-clés juridiques** (15%) - Dictionnaire termes juridiques
4. **LLM Ollama local** (30%) - Classification contextuelle
5. **Enrichissement contextuel** (10%) - Analyse pages similaires

### Quand une classification nécessite revue humaine ?

Le système marque une page comme **requires_validation = true** quand :

- **Confiance < 70%** : Signaux contradictoires
- **Hésitation entre 2 catégories** : Alternatives fortes (>0.55)
- **Contenu ambigu** : < 3 signaux détectés
- **Nouveau type de document** : Jamais vu avant

Ces pages apparaissent dans l'onglet **"À Revoir"**.

---

## Accéder à l'interface

### URL

```
https://qadhya.tn/super-admin/classification
```

### Permissions requises

- Rôle : **Super Admin** uniquement
- Authentification : Session active requise

### Navigation

L'interface contient **4 tabs principales** :

| Tab | Icône | Description |
|-----|-------|-------------|
| **À Revoir** | 📋 | Pages nécessitant revue humaine |
| **Historique** | 📜 | Historique des corrections passées |
| **Règles Auto** | ✨ | Règles auto-générées depuis corrections |
| **Analytics** | 📊 | Métriques et statistiques globales |

---

## Tab 1 : À Revoir

### Vue d'ensemble

Cette tab affiche toutes les pages classifiées avec **requires_validation = true**, triées par **priorité puis date** (FIFO).

### Cartes statistiques (en-tête)

Affiche le nombre de pages par priorité :

| Priorité | Couleur | Signification |
|----------|---------|---------------|
| **Urgent** | 🔴 Rouge | Signaux très contradictoires (3+ catégories suggérées) |
| **High** | 🟠 Orange | Hésitation entre 2 alternatives fortes |
| **Medium** | 🟡 Jaune | Confiance faible (50-70%) |
| **Low** | 🟢 Vert | Probablement hors périmètre juridique |
| **Sans priorité** | ⚪ Gris | Pas encore calculé (anciennes classifications) |

### Filtres disponibles

1. **Recherche texte** 🔍
   - Cherche dans : URL, titre, source
   - Recherche instantanée (debounce 300ms)

2. **Filtre Priorité** 🎯
   - Multi-select : urgent, high, medium, low
   - Défaut : Toutes priorités

3. **Filtre Effort** ⏱️
   - Multi-select : quick, moderate, complex
   - **Quick** : Correction simple (<2 min), ex: hors périmètre évident
   - **Moderate** : Revue standard (2-5 min), ex: hésitation 2 catégories
   - **Complex** : Expertise requise (>5 min), ex: 3+ signaux contradictoires

4. **Filtre Source** 🌐
   - Dropdown : Toutes sources ou source spécifique
   - Utile pour traiter par lot (ex: tous les cassation.tn)

### Table des pages

| Colonne | Description |
|---------|-------------|
| **URL** | Lien cliquable vers la page originale (ouvre nouvel onglet) |
| **Titre** | Titre de la page (tronqué à 60 chars) |
| **Priorité** | Badge coloré avec icône |
| **Confiance** | Score 0-100% (rouge <50%, orange 50-70%, vert >70%) |
| **Raison** | Explication humaine pourquoi revue nécessaire |
| **Actions** | Bouton "Réviser" |

### Action : Réviser une page

Cliquer sur **"Réviser"** ouvre un modal complet avec :

#### Section 1 : Classification actuelle

- **Catégorie** : Législation / Jurisprudence / Doctrine
- **Domaine** : Civil, Pénal, Commercial, etc.
- **Type de document** : Loi, Décret, Arrêt, Article, etc.
- **Score de confiance** : 0-100%

#### Section 2 : Signaux utilisés (Accordion)

Liste détaillée des 5 signaux avec leur contribution :

```
✓ Structure du site (confiance: 0.85)
  Raison: URL contient "/jurisprudence/cassation/"

✓ Règles configurées (confiance: 0.70)
  Règle: "Cassation Civile" → Jurisprudence + Civil

⚠ Mots-clés juridiques (confiance: 0.45)
  Détectés: "arrêt", "chambre civile", "pourvoi"

✗ LLM Ollama (confiance: 0.30)
  Suggestion: Doctrine (CONTRADICTOIRE)

✓ Enrichissement contextuel (confiance: 0.65)
  15 pages similaires classées en Jurisprudence
```

#### Section 3 : Alternatives suggérées (Accordion)

Si le système hésite entre plusieurs catégories :

```
1. Jurisprudence > Civil > Arrêt (confiance: 0.72)
2. Législation > Civil > Code (confiance: 0.58)
3. Doctrine > Civil > Commentaire (confiance: 0.42)
```

#### Section 4 : Formulaire de correction

Sélecteurs avec taxonomie complète :

- **Catégorie** (obligatoire)
  - Législation
  - Jurisprudence
  - Doctrine
  - Autre (hors périmètre)

- **Domaine** (optionnel)
  - Civil, Pénal, Commercial, Administratif, Social, etc.

- **Type de document** (optionnel)
  - Dépend de la catégorie sélectionnée
  - Ex: Si Législation → Loi, Décret, Arrêté, Circulaire, etc.

#### Section 5 : Feedback (optionnel)

Permet d'indiquer si la classification initiale était :

- ✅ **Utile** : Signaux pertinents, correction mineure
- ❌ **Pas utile** : Complètement faux, signaux non pertinents

**Notes texte** (optionnel) : Explications supplémentaires pour améliorer le système.

#### Boutons action

- **Annuler** : Ferme le modal sans sauvegarder
- **Enregistrer correction** : Sauvegarde + déclenche génération règle si applicable

---

## Tab 2 : Historique

### Vue d'ensemble

Affiche toutes les **corrections passées** avec leur impact sur l'apprentissage du système.

### Filtre disponible

**Règle générée ?**
- Toutes
- ✅ Avec règle générée
- ❌ Sans règle générée

### Table historique

| Colonne | Description |
|---------|-------------|
| **Page** | URL + titre de la page corrigée |
| **Classification originale** | Catégorie > Domaine (avant correction) |
| **Flèche** | → |
| **Classification corrigée** | Catégorie > Domaine (après correction) |
| **Règle générée** | Badge vert "✨ Règle générée" si une règle a été créée automatiquement |
| **Corrigé par** | Nom/ID de l'utilisateur |
| **Date** | Date de la correction (format : 10 janv. 2026) |

### Badge "Règle générée"

Une règle est **automatiquement générée** quand :

1. **≥3 corrections** sur la même source avec le même pattern
2. **Pattern détectable** : URL structure, mots-clés communs, section commune
3. **Cohérence** : Toutes les corrections vont dans la même direction

Exemple :
```
3 pages de cassation.tn/civil/* mal classées en Législation
→ Correction vers Jurisprudence + Civil
→ Règle générée : "Si URL contient /civil/ ET source = cassation.tn → Jurisprudence + Civil"
```

### Actions

- **Cliquer sur URL** : Ouvre la page dans nouvel onglet
- **Voir détails** : Affiche signaux utilisés + contexte

---

## Tab 3 : Règles Auto

### Vue d'ensemble

Affiche toutes les **règles auto-générées** depuis les corrections humaines, avec leur **accuracy** en temps réel.

### Cartes statistiques (en-tête)

| Carte | Description |
|-------|-------------|
| **Total Règles** | Nombre total de règles générées |
| **Actives** | Règles actuellement utilisées (is_active = true) |
| **Excellentes** | Règles avec accuracy ≥ 90% |
| **À réviser** | Règles avec accuracy < 70% (après ≥5 utilisations) |

### Filtres disponibles

1. **Recherche texte** 🔍
   - Cherche dans : nom règle, source

2. **Statut** 🎚️
   - Toutes / Actives / Désactivées

3. **Précision minimale** 📊
   - Toutes / ≥90% / ≥70% / ≥50%

### Table des règles

| Colonne | Description |
|---------|-------------|
| **Nom** | Nom descriptif de la règle (ex: "Cassation Civil → Jurisprudence") |
| **Source** | Web source concernée (ex: cassation.tn) |
| **Statut** | Badge coloré avec accuracy |
| **Utilisée** | Nombre de fois où la règle a été appliquée (times_matched) |
| **Correcte** | Nombre de fois où la règle a donné le bon résultat (times_correct) |
| **Précision** | **Accuracy** = (times_correct / times_matched) × 100% |
| **Créée le** | Date de création de la règle |
| **Actions** | Activer/Désactiver + Lien vers édition |

### Badges de statut

| Badge | Couleur | Condition | Action recommandée |
|-------|---------|-----------|-------------------|
| **✅ Excellent** | Vert | accuracy ≥ 90% | Garder active |
| **🔵 Actif** | Bleu | 70% ≤ accuracy < 90% | Surveiller |
| **⚠️ À réviser** | Orange | 50% ≤ accuracy < 70% | Réviser conditions |
| **❌ À désactiver** | Rouge | accuracy < 50% | Désactiver |
| **⚪ Non testé** | Gris | times_matched = 0 | Attendre utilisation |
| **🚫 Désactivé** | Gris foncé | is_active = false | Réactiver si nécessaire |

### Calcul de l'accuracy

```
Accuracy = (times_correct / times_matched) × 100%

Exemple :
- Règle appliquée : 20 fois (times_matched = 20)
- Résultat correct : 18 fois (times_correct = 18)
- Accuracy = (18 / 20) × 100% = 90% ✅ Excellent
```

**Comment times_correct est incrémenté ?**

Lors de chaque classification :
1. Règle appliquée → times_matched++
2. Si classification finale = suggestion de la règle → times_correct++
3. Si utilisateur corrige différemment → times_correct inchangé

### Actions disponibles

1. **Activer / Désactiver** 🎚️
   - Toggle instantané de `is_active`
   - Règle désactivée = non utilisée lors de prochaines classifications
   - Utile pour tester impact d'une règle

2. **Éditer** ✏️ (icône ExternalLink)
   - Ouvre `/super-admin/web-sources/[id]/rules` dans nouvel onglet
   - Permet de modifier conditions, priorité, target classification

### Cas d'usage

#### Scénario 1 : Règle performante
```
Nom: "Législation JORT → Loi"
Source: legislation.tn
Statut: ✅ Excellent (95%)
Utilisée: 50 fois
Correcte: 48 fois
→ Action : Garder active, surveiller
```

#### Scénario 2 : Règle à améliorer
```
Nom: "Cassation pattern → Jurisprudence"
Source: cassation.tn
Statut: ⚠️ À réviser (65%)
Utilisée: 15 fois
Correcte: 10 fois
→ Action : Éditer conditions (trop larges ?), ou désactiver temporairement
```

#### Scénario 3 : Règle défectueuse
```
Nom: "Doctrine universitaire"
Source: da5ira.com
Statut: ❌ À désactiver (40%)
Utilisée: 25 fois
Correcte: 10 fois
→ Action : Désactiver immédiatement, analyser pourquoi elle échoue
```

---

## Tab 4 : Analytics

### Vue d'ensemble

Dashboard global avec **métriques et insights** sur la qualité du système de classification.

### Section 1 : Distribution confiance

**Histogramme** avec buckets de 10% :

```
0-10%:   ███ 15 pages
10-20%:  █████ 32 pages
20-30%:  ████████ 48 pages
...
90-100%: ████████████████████ 120 pages
```

**Interprétation** :
- Pic à gauche (0-30%) : Beaucoup de pages hors périmètre → OK
- Pic au centre (40-60%) : Système hésite → Améliorer signaux
- Pic à droite (80-100%) : Système confiant → Excellent

### Section 2 : Top erreurs

**3 modes de groupement** :

1. **Par domaine**
   ```
   Civil:         45 pages nécessitent revue
   Pénal:         32 pages
   Commercial:    28 pages
   ```

2. **Par source**
   ```
   cassation.tn:     67 pages
   legislation.tn:   34 pages
   da5ira.com:       21 pages
   ```

3. **Par raison**
   ```
   "Hésitation entre 2 alternatives":     89 pages
   "Signaux contradictoires":             56 pages
   "Confiance très faible":               34 pages
   ```

### Section 3 : Heatmap taxonomie

**Matrice usage** des éléments de taxonomie :

| Élément | Catégorie | Utilisé | Jamais utilisé |
|---------|-----------|---------|----------------|
| Loi | Législation | 245 fois | - |
| Décret | Législation | 187 fois | - |
| Arrêté préfectoral | Législation | **0 fois** | ⚠️ |
| Arrêt Cassation | Jurisprudence | 567 fois | - |
| Arrêt Appel | Jurisprudence | 234 fois | - |
| Jugement TPI | Jurisprudence | **0 fois** | ⚠️ |

**Actions recommandées** :
- Éléments jamais utilisés → Vérifier si pertinents pour Tunisie
- Éléments sur-utilisés → Vérifier si trop larges (besoin subdivision)

---

## Workflow de revue

### Workflow complet (étapes)

```
1. Système classifie automatiquement une page
   ↓
2. Si confiance < 70% OU signaux contradictoires
   → requires_validation = true
   → Page apparaît dans "À Revoir"
   ↓
3. Super Admin filtre par priorité (urgent d'abord)
   ↓
4. Clique "Réviser" sur une page
   ↓
5. Modal s'ouvre : analyse signaux + alternatives
   ↓
6. Admin corrige classification si nécessaire
   ↓
7. Admin donne feedback (utile / pas utile)
   ↓
8. Enregistre correction
   ↓
9. Système analyse pattern avec autres corrections
   ↓
10. Si ≥3 corrections similaires → Génère règle auto
   ↓
11. Règle apparaît dans "Règles Auto" (à surveiller)
   ↓
12. Règle appliquée lors de prochaines classifications
   ↓
13. Accuracy calculée en temps réel (times_correct / times_matched)
   ↓
14. Si accuracy < 70% après 10 utilisations
   → Badge "À réviser" dans Règles Auto
   ↓
15. Admin désactive ou améliore la règle
```

### Stratégie de revue recommandée

#### Phase 1 : Traiter urgent (Jour 1-2)
```
Filtres : Priorité = urgent
Objectif : Résoudre contradictions majeures
Temps : ~5-10 min/page (effort = complex)
```

#### Phase 2 : Traiter high (Jour 3-5)
```
Filtres : Priorité = high
Objectif : Trancher hésitations 2 catégories
Temps : ~2-5 min/page (effort = moderate)
```

#### Phase 3 : Traiter medium (Jour 6-7)
```
Filtres : Priorité = medium
Objectif : Confirmer classifications faible confiance
Temps : ~2-5 min/page (effort = moderate)
```

#### Phase 4 : Traiter low (Optionnel)
```
Filtres : Priorité = low
Objectif : Confirmer hors périmètre
Temps : ~1-2 min/page (effort = quick)
```

---

## Bonnes pratiques

### ✅ DO

1. **Traiter par lot de même source**
   - Filtre par source → toutes cassation.tn d'un coup
   - Permet de détecter patterns répétitifs
   - Accélère génération de règles

2. **Toujours donner du feedback**
   - Aide le système à s'améliorer
   - Notes détaillées = meilleure génération règles

3. **Surveiller accuracy des règles**
   - Check hebdomadaire "Règles Auto"
   - Désactiver règles < 50% accuracy

4. **Utiliser les alternatives**
   - Si système propose 2 alternatives fortes
   - Choisir celle qui fait le plus de sens contextuel

5. **Documenter patterns complexes**
   - Si correction non-évidente
   - Ajouter notes explicatives dans feedback

### ❌ DON'T

1. **Ne pas corriger sans analyser signaux**
   - Toujours lire la section "Signaux utilisés"
   - Comprendre pourquoi système a échoué

2. **Ne pas désactiver règles trop vite**
   - Attendre minimum 10 utilisations avant juger
   - Accuracy instable si < 10 samples

3. **Ne pas ignorer low priority**
   - Peuvent révéler bugs de scraping
   - Vérifier échantillon aléatoire mensuel

4. **Ne pas créer règles manuelles redondantes**
   - Vérifier "Règles Auto" avant créer règle manuelle
   - Éviter doublons (règle auto > règle manuelle)

5. **Ne pas corriger en masse sans feedback**
   - Feedback = data pour amélioration
   - 1 correction avec feedback > 10 sans feedback

---

## FAQ

### Q1 : Combien de temps prend une revue complète ?

**Réponse** : Dépend du nombre de pages à revoir.

Estimation avec 100 pages nécessitant revue :
- Urgent (10 pages × 5 min) = 50 min
- High (30 pages × 3 min) = 90 min
- Medium (40 pages × 3 min) = 120 min
- Low (20 pages × 1 min) = 20 min
**Total** : ~4h50

**Avec règles auto** : Temps réduit de 60-80% après 2-3 semaines.

---

### Q2 : Pourquoi une règle avec 95% accuracy est désactivée ?

**Réponse** : Plusieurs raisons possibles :

1. **Trop spécifique** : Règle ne s'applique qu'à 1-2 pages obsolètes
2. **Redondante** : Autre règle plus générale couvre déjà le cas
3. **Source désactivée** : Source web ne crawle plus
4. **Test temporaire** : Admin teste impact de désactiver la règle

Action : Vérifier `corrections_count` et `last_matched_at` pour contexte.

---

### Q3 : Comment améliorer une règle avec 60% accuracy ?

**Approches** :

1. **Analyser échecs** :
   ```sql
   SELECT * FROM classification_learning_log
   WHERE rule_id = '<rule_id>' AND was_correct = false
   LIMIT 10
   ```

2. **Conditions trop larges** :
   - Règle : "URL contient /civil/" → Trop vague
   - Fix : "URL contient /civil/cassation/" → Plus précis

3. **Conditions trop strictes** :
   - Règle : "URL = exact match" → Jamais utilisée
   - Fix : "URL contient pattern flexible"

4. **Target classification incorrecte** :
   - Règle suggère Législation mais devrait être Jurisprudence
   - Éditer `target_category` dans `/super-admin/web-sources/[id]/rules`

---

### Q4 : Que faire si système classe toujours mal une source ?

**Diagnostic en 5 étapes** :

1. **Vérifier configuration source**
   - `/super-admin/web-sources` → Sélectionner source
   - Onglet "Classification Rules" → Vérifier priorité règles

2. **Analyser structure du site**
   - URL patterns cohérents ?
   - Sections HTML bien identifiées ?

3. **Tester extraction contenu**
   - `/super-admin/web-sources/[id]/test` → Tester extraction
   - Vérifier que contenu juridique extrait correctement

4. **Créer règle manuelle temporaire**
   - Règle simple : "source = X → catégorie Y"
   - Priorité 100 (très haute)
   - Tester sur 10-20 pages

5. **Faire corrections manuelles**
   - Corriger 5-10 pages représentatives
   - Système générera règle auto après 3+ corrections

---

### Q5 : Différence entre "Règle manuelle" et "Règle auto" ?

| Aspect | Règle manuelle | Règle auto |
|--------|----------------|------------|
| **Créée par** | Super Admin via UI | Système via corrections |
| **Conditions** | Définies explicitement | Détectées automatiquement |
| **Priorité** | Configurable (0-100) | Auto (basée sur confiance) |
| **Accuracy** | Non trackée | Trackée en temps réel |
| **Édition** | Libre | Édition déconseillée (régénérée) |
| **Cas d'usage** | Patterns connus a priori | Patterns découverts a posteriori |

**Recommandation** : Préférer règles auto (apprentissage continu) sauf si pattern très stable.

---

### Q6 : Comment interpréter "Signaux contradictoires" ?

**Exemple réel** :

```
Page : cassation.tn/civil/decision/2024/123

Signaux détectés :
1. Structure du site → Jurisprudence (confiance: 0.85)
   Raison: URL contient /civil/decision/

2. Mots-clés → Jurisprudence (confiance: 0.75)
   Détectés: "arrêt", "chambre civile", "pourvoi"

3. LLM Ollama → Législation (confiance: 0.60) ← CONTRADICTOIRE
   Raison: Contenu mentionne "Code Civil Article 123"

4. Règles configurées → Aucune règle applicable (0.0)

5. Enrichissement → Jurisprudence (confiance: 0.70)
   12 pages similaires classées en Jurisprudence
```

**Analyse** :
- 4 signaux sur 5 disent "Jurisprudence"
- 1 signal (LLM) dit "Législation" car page cite des articles de loi
- **Résolution** : Page = Jurisprudence commentant législation
- **Action** : Corriger → Jurisprudence + noter dans feedback

---

### Q7 : Quand supprimer une règle auto au lieu de la désactiver ?

**Supprimer si** :
- Règle créée par erreur (bug pattern detection)
- Source web n'existe plus
- Règle redondante avec règle manuelle prioritaire
- Conditions devenues obsolètes (changement structure site)

**Désactiver si** :
- Accuracy temporairement basse (< 70%) → Surveiller évolution
- Test d'impact (activer/désactiver pour comparer)
- Règle saisonnière (ex: lois de finances fin d'année)

**Méthode** :
- Désactiver : UI "Règles Auto" → Toggle switch
- Supprimer : SQL `DELETE FROM source_classification_rules WHERE id = '...'`

---

### Q8 : Comment gérer une catégorie "Mixte" (ex: Doctrine commentant Jurisprudence) ?

**Principe** : Choisir la **catégorie principale** du document.

**Décision tree** :

```
Document commente-t-il une décision de justice ?
├─ OUI → Est-ce un commentaire d'arrêt (doctrine) ?
│  ├─ OUI → Doctrine + Domaine = celui de l'arrêt
│  └─ NON → Jurisprudence (si reproduction intégrale)
└─ NON → Est-ce une analyse générale ?
   ├─ OUI → Doctrine
   └─ NON → Vérifier si loi/décret → Législation
```

**Exemples** :

1. **Article "Commentaire Arrêt Cassation n°123/2024"**
   - Catégorie : **Doctrine**
   - Domaine : Civil (domaine de l'arrêt)
   - Type : Commentaire d'arrêt

2. **Arrêt de Cassation avec motivation détaillée**
   - Catégorie : **Jurisprudence**
   - Domaine : Civil
   - Type : Arrêt

3. **Thèse "Analyse comparative jurisprudence 2020-2025"**
   - Catégorie : **Doctrine**
   - Domaine : Transversal (ou laisser vide)
   - Type : Thèse

---

### Q9 : Performance : Combien de pages peut traiter le système par jour ?

**Capacités actuelles** (VPS 4 CPUs, Option C Ollama local) :

- **Crawling** : ~500-1000 pages/jour (dépend du site)
- **Classification** : ~200-300 pages/jour (Ollama lent)
- **Indexation KB** : ~50-100 documents/jour (avec embeddings)

**Goulots d'étranglement** :

1. **Ollama qwen2.5:3b** : ~20s par classification (CPU-only)
2. **Ollama qwen3-embedding:0.6b** : ~19s par embedding
3. **Playwright (JavaScript sites)** : ~10-15s par page

**Optimisations futures** (Sprint 4+) :

- Batch embeddings (concurrency 2 → 4) : +100% throughput
- Cache classification intelligent : -60% appels LLM
- Parallélisation crawling (3 sources en //) : +200% crawling

**Estimation production** :

Avec 10 sources actives × 50 pages/source/jour :
- **Total** : 500 pages/jour
- **Avec requires_validation** : ~150 pages/jour (30%)
- **Temps revue** : 150 pages × 3 min/page = **7h30/jour**

**Avec règles auto** (après 1 mois) :
- Réduction 60-70% pages nécessitant revue
- **Temps revue** : 50 pages × 3 min = **2h30/jour**

---

### Q10 : Comment exporter les données pour analyse externe ?

**Via API** :

```bash
# Export queue revue (CSV)
curl "https://qadhya.tn/api/super-admin/classification/queue?limit=1000" \
  -H "Cookie: session=..." \
  | jq -r '.items[] | [.url, .title, .review_priority, .confidence_score] | @csv'

# Export corrections (JSON)
curl "https://qadhya.tn/api/super-admin/classification/corrections?limit=1000" \
  -H "Cookie: session=..." \
  > corrections_export.json

# Export règles auto (JSON)
curl "https://qadhya.tn/api/super-admin/classification/generated-rules?limit=1000" \
  -H "Cookie: session=..." \
  > rules_export.json
```

**Via SQL** (accès VPS requis) :

```sql
-- Export pages nécessitant revue
COPY (
  SELECT
    wp.url,
    wp.title,
    lc.primary_category,
    lc.domain,
    lc.confidence_score,
    lc.review_priority,
    lc.review_estimated_effort,
    lc.validation_reason
  FROM legal_classifications lc
  JOIN web_pages wp ON wp.id = lc.web_page_id
  WHERE lc.requires_validation = true
  ORDER BY lc.review_priority, lc.created_at
) TO '/tmp/review_queue.csv' WITH CSV HEADER;

-- Export accuracy règles
COPY (
  SELECT
    scr.name,
    ws.name AS source_name,
    scr.times_matched,
    scr.times_correct,
    ROUND((scr.times_correct::NUMERIC / NULLIF(scr.times_matched, 0)) * 100, 1) AS accuracy,
    scr.is_active,
    scr.created_at
  FROM source_classification_rules scr
  JOIN web_sources ws ON ws.id = scr.web_source_id
  WHERE scr.created_by IS NOT NULL
  ORDER BY accuracy DESC
) TO '/tmp/rules_accuracy.csv' WITH CSV HEADER;
```

---

## Support & Contact

**Questions techniques** : Ouvrir issue GitHub
**Bugs** : Créer ticket avec label `classification`
**Améliorations** : Proposer dans discussions

**Documentation technique** :
- `/docs/CLASSIFICATION_SYSTEM_ARCHITECTURE.md`
- `/docs/CLASSIFICATION_PLAN_SPRINT3.md`
- `/migrations/20260210_review_prioritization.sql`

---

**Version** : 1.0
**Dernière mise à jour** : 10 février 2026
**Auteurs** : Équipe Qadhya + Claude Sonnet 4.5
