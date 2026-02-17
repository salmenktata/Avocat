# Guide Administrateur - Système de Classification Juridique

## Vue d'ensemble

Le système de classification juridique de Qadhya analyse automatiquement les documents juridiques (web scraping, Google Drive, uploads) et les catégorise selon 15 catégories du droit tunisien.

## Accès

**URL** : `/super-admin/classification`
**Rôle requis** : Super-Admin
**Navigation** : Menu Super-Admin → Classification Juridique

---

## Onglets du Dashboard

### 1. Traitement par lots (Batch)

**Fonction** : Lance une classification AI sur un ensemble de documents.

**Actions disponibles** :
- **Analyser nouveaux documents** : Classifie les documents sans classification
- **Reclassifier la sélection** : Reclassifie des documents spécifiques
- **Configurer les seuils** : Ajuste les seuils de confiance par catégorie

**Paramètres batch** :
| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| Limite | 100 | Nombre max de docs à traiter |
| Seuil confiance | 0.70 | Confiance minimale pour valider automatiquement |
| Provider LLM | Auto | Gemini (défaut), OpenAI (fallback) |

**Surveillance en temps réel** :
- Barre de progression (docs traités / total)
- Taux de succès en live
- Logs d'erreurs instantanés

---

### 2. File de Révision (Review Queue)

**Fonction** : Liste les documents avec classification incertaine nécessitant une validation humaine.

**Critères d'inclusion dans la queue** :
- Confiance < 0.70 (seuil configurable)
- Conflit entre règles et LLM
- Documents marqués `requires_validation = true`

**Actions par document** :
- **Valider** : Accepte la classification suggérée
- **Corriger** : Ouvre le modal de correction
- **Rejeter** : Marque comme non classifiable
- **Ignorer** : Retire de la queue temporairement

**Modal de Correction** :
1. Affiche : Titre, extrait du contenu, classification actuelle
2. Champs modifiables : Catégorie, Sous-catégorie, Domaine de droit, Pays
3. **Bouton "Valider et créer une règle"** : Si le pattern est récurrent, génère automatiquement une règle
4. Sauvegarde dans `legal_classifications` + log dans `classification_validations`

---

### 3. Historique des Corrections

**Fonction** : Timeline de toutes les corrections effectuées par les admins.

**Informations affichées** :
- Admin ayant effectué la correction
- Document concerné (titre + URL)
- Classification avant/après
- Date et heure
- Règle générée (si applicable)

**Filtres** :
- Par admin
- Par catégorie modifiée
- Par période (7j, 30j, 90j, tout)
- Par type de correction (nouvelle classification / correction)

**Statistiques** :
- Taux de validation (% documents validés sans correction)
- Catégories les plus corrigées (top 5)
- Temps moyen de révision
- Admins les plus actifs

---

### 4. Règles Générées

**Fonction** : Liste les règles de classification auto-apprises depuis les corrections admins.

**Types de règles** :

| Type | Exemple | Priorité |
|------|---------|----------|
| URL Pattern | `/jurisprudence/cassation/` → `jurisprudence` | Haute |
| Keyword | "Cour de cassation" → `jurisprudence`, confiance 0.95 | Moyenne |
| Domain | `legislation.tn` → `legislation` | Haute |
| Metadata | `source=google_drive` + `extension=pdf` → `codes` | Basse |

**Actions** :
- **Approuver** : Active la règle pour les futures classifications
- **Éditer** : Modifie le pattern/seuil de confiance
- **Supprimer** : Désactive définitivement
- **Tester** : Simule la règle sur un échantillon de documents

**Format règle** :
```json
{
  "type": "url_pattern",
  "pattern": "/jurisprudence/cassation/",
  "target_category": "jurisprudence",
  "confidence": 0.95,
  "created_from": "admin_correction",
  "approved_by": "admin@qadhya.tn",
  "created_at": "2026-02-16T10:30:00Z"
}
```

---

### 5. Analytiques

**Fonction** : Graphiques de performance du système de classification.

**Graphiques disponibles** :

**Distribution de confiance** (histogramme) :
- Axe X : Intervalles (0-0.3, 0.3-0.5, 0.5-0.7, 0.7-0.9, 0.9-1.0)
- Axe Y : Nombre de documents
- Idéal : 90%+ dans l'intervalle 0.7-1.0

**Répartition par catégorie** (camembert) :
- Les 15 catégories juridiques
- Pourcentage de chaque catégorie dans le corpus

**Évolution validation 30j** (ligne) :
- Taux de validation automatique (sans correction admin)
- Taux de correction admins
- Objectif : 85%+ validation automatique

**Comparaison LLM vs Règles** (barre groupée) :
- Accuracy LLM par catégorie (%)
- Accuracy Règles par catégorie (%)
- Catégories où les règles surpassent le LLM → potentiel de new rules

---

## Catégories Juridiques

Les 15 catégories disponibles (fichier central : `lib/categories/legal-categories.ts`) :

| ID | Nom FR | Nom AR |
|----|--------|--------|
| `jurisprudence` | Jurisprudence | قضاء |
| `legislation` | Législation | تشريع |
| `codes` | Codes Juridiques | مجلات قانونية |
| `doctrine` | Doctrine | فقه قانوني |
| `procedures` | Procédures | إجراءات |
| `contrats` | Contrats & Actes | عقود |
| `fiscal` | Droit Fiscal | قانون جبائي |
| `commercial` | Droit Commercial | قانون تجاري |
| `penal` | Droit Pénal | قانون جزائي |
| `travail` | Droit du Travail | قانون الشغل |
| `immobilier` | Droit Immobilier | قانون عقاري |
| `famille` | Droit de la Famille | قانون الأسرة |
| `administratif` | Droit Administratif | قانون إداري |
| `international` | Droit International | قانون دولي |
| `autre` | Autre | أخرى |

---

## Workflow de Classification

### Processus automatique (sans intervention admin)

```
Document ajouté
      ↓
Extraction contenu (OCR/parsing)
      ↓
Analyse règles URL/domain (si match ≥ 0.8 → classification directe)
      ↓
Classification LLM (Gemini/OpenAI)
      ↓
Confiance ≥ 0.70 ?
  OUI → Validation automatique → Indexation KB
  NON → Ajout à la Review Queue → Attente validation admin
```

### Processus avec correction admin

```
Document dans Review Queue
      ↓
Admin examine le document
      ↓
Correction catégorie/sous-catégorie
      ↓
Validation → Sauvegarde classification
      ↓
Pattern récurrent détecté ?
  OUI → Création règle automatique (soumise à approbation)
  NON → Correction enregistrée seulement
      ↓
Règle approuvée → Active pour futures classifications
```

---

## Bonnes Pratiques

### Quand corriger une classification ?

1. **Toujours corriger** si :
   - La catégorie est clairement erronée (ex: arrêt de cassation classé en "legislation")
   - La confiance est < 0.5

2. **Corriger si possible** si :
   - Sous-catégorie incorrecte (mais catégorie principale OK)
   - Document multilingue mal catégorisé

3. **Laisser tel quel** si :
   - Catégorie correcte avec confiance > 0.7
   - Document ambigu appartenant à plusieurs catégories (utiliser la dominante)

### Gestion des règles

- **Approuver** les règles URL/domain en priorité (très fiables)
- **Tester** avant d'approuver les règles keyword (risque de faux positifs)
- **Réviser mensuellement** les règles avec faible taux de succès (<80%)
- **Ne pas créer** de règles pour des cas isolés (< 5 occurrences similaires)

### Seuils recommandés par catégorie

| Catégorie | Seuil auto-validation | Raison |
|-----------|----------------------|--------|
| `jurisprudence` | 0.75 | Contenu standardisé (formule arrêts) |
| `codes` | 0.80 | Très distinctif (numéros articles) |
| `legislation` | 0.70 | Formule légale claire |
| `doctrine` | 0.65 | Plus variée (articles, thèses) |
| `autre` | 0.60 | Fourre-tout, moins critique |

---

## Gestion des Cas Spéciaux

### Documents arabes

Les documents en arabe utilisent des seuils différents (plus bas) car les embeddings arabes ont des scores intrinsèquement plus faibles :
- Seuil recherche : 0.30 (vs 0.50 français)
- Les règles keyword fonctionnent bien en arabe

### Documents multilingues (AR + FR)

- La classification principale se fait sur la langue dominante
- Le champ `language_detected` dans la DB indique la langue principale
- Les documents bilingues sont souvent mieux classifiés par les règles domain

### Documents Google Drive

- Souvent des PDFs scannés → qualité OCR variable
- Catégorie par défaut : `autre` si OCR < 50 chars
- Recommandation : Vérifier les docs GDrive avec score < 0.6

---

## APIs Techniques

Pour les développeurs, les endpoints utilisés par le dashboard :

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/admin/classification/[id]/validate` | PATCH | Valider/corriger une classification |
| `/api/admin/classification/rules` | GET/POST | Lister/créer règles |
| `/api/admin/classification/queue` | GET | File de révision |
| `/api/admin/classification/history` | GET | Historique corrections |
| `/api/admin/classification/analytics` | GET | Métriques analytiques |

---

## Troubleshooting

**Le batch ne démarre pas**
- Vérifier que les crons `cron-reanalyze-kb-failures.sh` ne tournent pas simultanément
- Vérifier les logs : `/var/log/qadhya/crons.log`
- Maximum 1 batch actif à la fois (verrou Redis)

**La queue ne se vide pas**
- Vérifier le seuil de confiance (peut-être trop élevé)
- Examiner les documents bloqués : catégorie `autre` + score < 0.3 = documents non classifiables
- Utiliser "Rejeter" pour les documents sans contenu juridique

**Les règles ne s'appliquent pas**
- Vérifier que la règle est `approved = true` dans la DB
- Vérifier la priorité (règles URL > Domain > Keyword)
- Les nouvelles règles s'appliquent uniquement aux FUTURS documents (pas rétroactivement sauf relance batch)
