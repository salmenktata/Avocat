# Plan : Framework 7 Phases - Analyse Juridique Tunisienne

**Statut** : ✅ Implémenté (2026-02-08)
**Type** : Enhancement - Logique métier avocat tunisien

---

## Résumé

Ce plan enrichit le framework d'analyse juridique existant pour refléter les **7 phases du raisonnement juridique tunisien**, permettant une analyse plus structurée et complète des dossiers.

---

## Les 7 Phases

### Phase 1 : Qualification Initiale (التكييف الأولي)
- **Séparation Faits/Ressenti/Interprétation**
  - Faits juridiques : Ce qui peut être PROUVÉ
  - Interprétations : Hypothèses à vérifier
  - Ressentis : Éléments sans valeur juridique (à écarter)
- **Objectif Client**
  - Principal : Objectif prioritaire
  - Secondaires : Objectifs négociables
  - Ligne Rouge : Ce qu'on refuse absolument
- **Champs Juridiques**
  - Principal : Domaine dominant (ex: divorce_csp)
  - Satellites : Domaines connexes (ex: pénal_abandon_famille)

### Phase 2 : Analyse Factuelle (التحليل الوقائعي)
- **Chronologie détaillée** : Date, événement, source, preuve, importance
- **Cartographie des acteurs** : Nom, rôle, intérêt (favorable/défavorable/neutre), fiabilité
- **Nœuds décisifs** : 3-5 points qui font GAGNER ou PERDRE l'affaire
- **Test de cohérence** : Déclarations vs pièces (confirme/contredit/non_prouvé)

### Phase 3 : Qualification Juridique (التحليل القانوني)
- **Syllogisme juridique**
  - Majeure : Règle de droit applicable
  - Mineure : Faits qualifiés
  - Conclusion : Demande
- **Qualifications alternatives** avec avantages/inconvénients

### Phase 4 : Analyse Probatoire (التحليل الإثباتي)
- **Hiérarchie des preuves tunisiennes** :
  1. Écrit officiel (acte notarié) → Force ABSOLUE
  2. Écrit privé reconnu → Force FORTE
  3. Témoignage (2H ou 1H+2F) → Force MOYENNE
  4. Expertise → Force MOYENNE
  5. Technique (SMS, emails) → Force FAIBLE
- **Contre-preuves potentielles** avec mitigation

### Phase 5 : Analyse Stratégique (التحليل الاستراتيجي)
- **Matrice des scénarios** : Probabilité × Coût × Délai × Risques
- **Tempo** : urgent / rapide / normal / temporiser
- **Plan B** : Condition de bascule + action alternative

### Phase 6 : Argumentation (بناء الحجة)
- **Moyens hiérarchisés** :
  1. Recevabilité (forme)
  2. Nullités (procédure)
  3. Fond (substantiel)
  4. Quantum (montants)
- **Objections anticipées** : "Si adversaire dit X → répondre Y"

### Phase 7 : Pilotage (التنفيذ)
- Timeline procédurale
- Actions concrètes avec priorité et délai

---

## Fichiers Modifiés

| Fichier | Modifications |
|---------|---------------|
| `lib/ai/dossier-structuring-service.ts` | Types enrichis + constantes tunisiennes |
| `lib/ai/prompts/structuration-prompt.ts` | Prompt 7 phases complet |
| `components/dossiers/assistant/LegalAnalysisSection.tsx` | Nouvelles sections UI |
| `messages/fr.json` | Traductions françaises |
| `messages/ar.json` | Traductions arabes |

---

## Nouveaux Types TypeScript

```typescript
// Phase 1
interface Diagnostic {
  faitsJuridiques: ExtractedFact[]
  interpretations: string[]
  ressentis: string[]
  objectifClient: ClientObjective
  champsJuridiques: LegalFields
}

// Phase 2
interface AnalyseFaits {
  chronologie: ChronologyEvent[]
  acteurs: Actor[]
  noeudsDecisifs: DecisiveNode[]
  coherence: CoherenceCheck[]
}

// Phase 5
interface StrategieGlobale {
  scenarios: StrategicScenario[]
  scenarioRecommande: string
  tempo: 'urgent' | 'rapide' | 'normal' | 'temporiser'
  justificationTempo: string
  planB: PlanB | null
}

// Phase 6
interface Argumentation {
  moyensHierarchises: HierarchizedArgument[]
  objectionsAnticipees: AnticipatedObjection[]
}
```

---

## Constantes Juridiques Tunisiennes Ajoutées

### Juridictions
```typescript
JURIDICTIONS_TUNISIENNES = {
  juge_cantonal: { seuil: 7000 }, // TND
  tribunal_premiere_instance: { chambres: ['civile', 'commerciale', 'famille', 'penale'] },
  cour_appel: { sieges: ['Tunis', 'Sousse', 'Sfax', ...] },
  cour_cassation: { siege: 'Tunis' }
}
```

### Prescriptions
```typescript
PRESCRIPTIONS_TUNISIENNES = {
  civil: { droit_commun: '15 ans', responsabilite_delictuelle: '3 ans' },
  commercial: { effets_commerce: '1 an', cheque_impaye: '6 mois' },
  famille: { divorce: 'imprescriptible', pension: 'imprescriptible' },
  travail: { salaires: '3 ans', licenciement: '1 an' }
}
```

### Codes
```typescript
CODES_TUNISIENS = {
  COC: 'Code des Obligations et Contrats',
  CSP: 'Code du Statut Personnel',
  CPC: 'Code de Procédure Civile et Commerciale',
  CODE_COMMERCE: 'Code de Commerce',
  CODE_PENAL: 'Code Pénal',
  CODE_TRAVAIL: 'Code du Travail'
}
```

---

## Utilisation

Pour ré-implémenter ou modifier ce plan :

```
Implémente le plan dans PLAN_7_PHASES_JURIDIQUE.md
```

Ou pour des modifications spécifiques :

```
Modifie la Phase 5 du plan 7 phases pour ajouter [fonctionnalité]
```

---

## Sources Juridiques Tunisiennes (pour enrichir RAG)

| Source | URL | Priorité |
|--------|-----|----------|
| 9anoun.tn | 9anoun.tn/kb | Haute |
| Cour de Cassation | cassation.tn | Haute |
| Jurisite Tunisie | jurisitetunisie.com | Moyenne |
| Ministère Justice | justice.gov.tn | Moyenne |
| JORT | iort.gov.tn | Basse |

---

## Prochaines Améliorations Possibles

- [ ] Enrichir la base RAG avec les sources tunisiennes
- [ ] Ajouter des templates de documents par type de procédure
- [ ] Intégrer les barèmes de pension alimentaire actualisés
- [ ] Ajouter un module de calcul des délais francs/ouvrables
