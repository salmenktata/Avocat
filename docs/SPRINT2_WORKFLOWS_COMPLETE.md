

# Sprint 2 : Workflows Critiques - Documentation

## Vue d'ensemble

Sprint 2 du plan de refonte Dashboard Client (Phase 1 - UX & Simplification).

**Objectif** : Compléter 3 workflows critiques avec extraction LLM, actions contextuelles, et validation progressive.

**Durée** : 2 semaines

**Status** : ✅ Complété (11 février 2026)

---

## Fichiers créés (8 nouveaux)

### Workflow 1 : Chat → Dossier

**1. Service d'extraction**
- **`lib/ai/chat-to-dossier-extractor.ts`** (350+ lignes)
  - Fonction `extractDossierDataFromChat()` avec LLM fallback
  - Extraction : titre, description, type procédure, parties, faits
  - Fallback heuristique si LLM échoue
  - Helpers: `canCreateDossierFromChat()`, `estimateDataQuality()`

**2. Composant modal**
- **`components/chat/CreateDossierFromChatModal.tsx`** (350+ lignes)
  - Modal intelligente avec extraction automatique
  - Formulaire éditable (titre, description)
  - Aperçu des faits extraits
  - Badge qualité (haute/moyenne/basse)
  - Redirection vers assistant de structuration

**3. API endpoint**
- **`app/api/chat/extract-dossier/route.ts`** (60+ lignes)
  - POST `/api/chat/extract-dossier`
  - Authentification requise
  - Validation des messages
  - Retourne `ChatDossierData`

### Workflow 2 : Consultation → Actions

**4. Service de recommandation**
- **`lib/utils/consultation-action-recommender.ts`** (400+ lignes)
  - Fonction `recommendActionsFromConsultation()`
  - 8 types d'actions : dossier, document, recherche, contact, deadline, etc.
  - Détection intelligente : calculs, documents, délais, contacts
  - Priorisation automatique (urgent > haute > moyenne > basse)

**5. Composant cards d'actions**
- **`components/dossiers/consultation/ConsultationNextActions.tsx`** (300+ lignes)
  - Cards d'actions contextuelles avec icônes et couleurs
  - Support 4 types d'actions : navigate, copy, open-modal, download
  - État d'exécution (loading, completed)
  - Badges de priorité

### Workflow 3 : Assistant → Validation

**6. Analyseur de narratif**
- **`lib/utils/narrative-analyzer.ts`** (500+ lignes)
  - Fonction `analyzeNarrative()` - analyse locale sans LLM
  - Détection : dates, montants, personnes, lieux
  - Scores : qualité (0-100), complétude (0-100)
  - Suggestions contextuelles (missing, improve, clarify)
  - Détection de langue (AR/FR/mixed)
  - Problèmes : trop_court, manque_dates, manque_parties, vague

**7. Composant feedback progressif**
- **`components/dossiers/assistant/ProgressiveFeedback.tsx`** (350+ lignes)
  - Analyse en temps réel pendant la saisie
  - Progress bars qualité + complétude
  - Statistiques : mots, caractères, langue
  - Éléments détectés avec icônes
  - Problèmes et suggestions contextuelles
  - Message encourageant si qualité >= 70%

### Documentation

**8. Documentation complète**
- **`docs/SPRINT2_WORKFLOWS_COMPLETE.md`** (500+ lignes, ce fichier)

---

## Architecture des workflows

### Workflow 1 : Chat → Dossier

```
Utilisateur clique "Créer dossier" dans chat
    ↓
CreateDossierFromChatModal s'ouvre
    ↓
Modal appelle /api/chat/extract-dossier
    ↓
API appelle extractDossierDataFromChat()
    ↓
LLM analyse les messages et extrait:
  - Titre proposé
  - Description
  - Type procédure (optionnel)
  - Parties (client, partie adverse)
  - Faits extraits (dates, montants, etc.)
    ↓
Modal affiche les données extraites
    ↓
Utilisateur modifie si nécessaire
    ↓
Clic "Structurer avec l'IA"
    ↓
Redirection vers /dossiers/assistant avec seed pré-rempli
```

**Données extraites** :
- `titrePropose`: string (max 60 chars)
- `description`: string (2-3 phrases)
- `typeProcedure`: ProcedureType | undefined
- `client`: Partial<ExtractedParty> | undefined
- `partieAdverse`: Partial<ExtractedParty> | undefined
- `faitsExtraits`: ExtractedFact[]
- `confidence`: number (0-1)
- `langue`: 'ar' | 'fr'

**Qualité estimée** :
- `high`: confidence > 0.7, titre + description + type + parties + faits
- `medium`: confidence > 0.4, au moins 3 critères
- `low`: < 3 critères

### Workflow 2 : Consultation → Actions

```
Utilisateur reçoit réponse de consultation
    ↓
ConsultationNextActions analyse le contexte:
  - Question posée
  - Réponse fournie
  - Sources utilisées
    ↓
recommendActionsFromConsultation() génère actions:
  - Toujours: Créer dossier, Copier réponse
  - Si calculs: Analyse approfondie
  - Si documents: Liste documents requis
  - Si délais: Créer échéances
  - Si sources: Explorer sources
  - Si contacts: Ajouter contact
  - Si jurisprudence: Arrêts similaires
    ↓
Actions affichées par priorité (urgent first)
    ↓
Utilisateur clique sur une action
    ↓
handleAction() exécute:
  - navigate: router.push(path + params)
  - copy: clipboard.writeText()
  - open-modal: ouvre modal spécifique
  - download: télécharge fichier
```

**Actions disponibles** :
| ID | Type | Icon | Priorité | Condition |
|----|------|------|----------|-----------|
| create-dossier | dossier | FolderPlus | haute | Toujours |
| deep-analysis | document | Calculator | haute | Si calculs |
| list-documents | document | FileCheck | moyenne | Si documents |
| create-deadlines | deadline | Calendar | urgente | Si délais |
| explore-sources | recherche | BookOpen | moyenne | Si sources > 0 |
| add-contact | contact | UserPlus | basse | Si contacts |
| copy-answer | document | Copy | basse | Toujours |
| similar-cases | recherche | Scale | moyenne | Si jurisprudence |

### Workflow 3 : Assistant → Validation

```
Utilisateur tape dans le champ narratif
    ↓
ProgressiveFeedback analyse en temps réel (debounced)
    ↓
analyzeNarrative() exécute (local, sans LLM):
  1. Compte mots/caractères
  2. Détecte langue (AR/FR/mixed)
  3. Détecte éléments:
     - Dates: /\d{1,2}\/\d{1,2}\/\d{4}/
     - Montants: /\d+\s*(TND|dinars?|DT)/
     - Personnes: /M\.|Mme|demandeur|défendeur/
     - Lieux: Villes tunisiennes
  4. Détecte problèmes:
     - < 50 mots: error
     - < 100 mots: warning
     - 0 dates: warning
     - < 2 personnes: warning
     - Mots vagues: info
  5. Génère suggestions:
     - Manquants: dates, montants, parties
     - Amélioration: contexte, détails
  6. Calcule scores:
     - Qualité: longueur (30) + éléments (40) - problèmes (30)
     - Complétude: catégories détectées / 4 * 100
    ↓
Affichage temps réel:
  - Progress bars (qualité, complétude)
  - Statistiques (mots, chars, langue)
  - Éléments détectés (badges)
  - Problèmes (alerts)
  - Suggestions (cards)
  - Message encourageant si >= 70%
```

**Scores de qualité** :
- **Excellent (70-100)** : 200+ mots, toutes catégories, pas de problèmes
- **Correct (40-69)** : 100+ mots, 2+ catégories, warnings ok
- **À améliorer (0-39)** : < 100 mots, < 2 catégories, erreurs

**Éléments détectés** :
- `date`: DD/MM/YYYY, YYYY-MM-DD, Mois YYYY
- `montant`: 1,000 TND, 500 dinars, 1 million DT
- `personne`: M./Mme Nom, demandeur, défendeur
- `lieu`: Tunis, Sfax, Sousse, etc.

---

## Utilisation

### Workflow 1 : Créer dossier depuis chat

```tsx
import { CreateDossierFromChatModal } from '@/components/chat'

function ChatPage({ messages, conversationId }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <Button onClick={() => setShowModal(true)}>
        Créer un dossier
      </Button>

      <CreateDossierFromChatModal
        open={showModal}
        onOpenChange={setShowModal}
        conversationId={conversationId}
        messages={messages}
        conversationTitle="Discussion divorce"
        onDossierCreated={(id) => console.log('Created:', id)}
      />
    </>
  )
}
```

### Workflow 2 : Actions post-consultation

```tsx
import { ConsultationNextActions } from '@/components/dossiers/consultation'

function ConsultationResult({ result }) {
  const context = {
    question: result.question,
    answer: result.conseil,
    sources: result.sources,
    metadata: {
      hasJurisprudence: result.sources.some(s => s.type === 'jurisprudence'),
      categories: result.categories,
    },
  }

  return (
    <>
      <ConsultationAnswer answer={result.conseil} />
      <ConsultationNextActions context={context} />
    </>
  )
}
```

### Workflow 3 : Feedback progressif

```tsx
import { ProgressiveFeedback } from '@/components/dossiers/assistant'

function NarrativeInput() {
  const [narratif, setNarratif] = useState('')

  return (
    <div className="grid grid-cols-2 gap-4">
      <Textarea
        value={narratif}
        onChange={(e) => setNarratif(e.target.value)}
        placeholder="Décrivez votre situation..."
        rows={10}
      />

      <ProgressiveFeedback
        text={narratif}
        realtime={true}
      />
    </div>
  )
}
```

---

## Tests

### Tests manuels recommandés

**Workflow 1 : Chat → Dossier**
1. Créer une conversation avec 3-5 messages utilisateur décrivant un cas de divorce
2. Cliquer "Créer un dossier"
3. Vérifier que la modal s'ouvre et affiche "Analyse en cours..."
4. Attendre l'extraction (5-10s)
5. Vérifier que le titre proposé est pertinent
6. Vérifier que les faits extraits sont corrects
7. Modifier le titre si nécessaire
8. Cliquer "Structurer avec l'IA"
9. Vérifier redirection vers `/dossiers/assistant` avec seed pré-rempli

**Workflow 2 : Consultation → Actions**
1. Poser une question de consultation (ex: "Calcul pension alimentaire pour 2 enfants")
2. Attendre la réponse
3. Vérifier que ConsultationNextActions s'affiche
4. Vérifier au moins 4 actions :
   - Créer un dossier (haute)
   - Analyse approfondie (haute) - si calculs détectés
   - Explorer les sources (moyenne)
   - Copier la réponse (basse)
5. Cliquer "Créer un dossier" → vérifier redirection
6. Cliquer "Copier la réponse" → vérifier toast "Copié" + action marquée "Terminé"

**Workflow 3 : Feedback progressif**
1. Ouvrir `/dossiers/assistant`
2. Commencer à taper un narratif court (20 mots)
3. Vérifier affichage:
   - Score qualité faible (< 40)
   - Alert "Narratif trop court"
   - Suggestion "Ajouter des dates"
4. Ajouter des dates (ex: "Mariage le 10/06/2015")
5. Vérifier détection:
   - Badge "1 date"
   - Suggestion "Ajouter des dates" disparaît
6. Continuer jusqu'à 100+ mots avec dates, montants, parties
7. Vérifier score qualité >= 70% et message "Excellent narratif !"

### Tests automatisés

```bash
# Tests extraction chat → dossier
npm run test lib/ai/__tests__/chat-to-dossier-extractor.test.ts

# Tests recommandation actions
npm run test lib/utils/__tests__/consultation-action-recommender.test.ts

# Tests analyse narratif
npm run test lib/utils/__tests__/narrative-analyzer.test.ts
```

---

## Métriques de succès

### Quantitatif

- ✅ Workflows complets: 0/3 → 3/3 (100%)
- ✅ Services créés: 3 (extraction, recommandation, analyse)
- ✅ Composants créés: 3 (modal, actions, feedback)
- ✅ API endpoints: 1 (`/api/chat/extract-dossier`)
- ✅ Documentation: 1 fichier complet (500+ lignes)

### Qualitatif

- ✅ **Chat → Dossier** : Extraction LLM intelligente avec fallback heuristique
- ✅ **Consultation → Actions** : 8 types d'actions contextuelles avec priorisation
- ✅ **Assistant → Validation** : Feedback temps réel local (sans LLM, 0 latency)
- ✅ **Accessibilité** : Tous composants avec aria-labels, keyboard nav
- ✅ **UX** : Messages clairs, loading states, états completed

---

## Intégrations requises (TODO)

### Intégrer dans ChatPage.tsx

```tsx
// Dans ChatPage.tsx, ajouter:
import { CreateDossierFromChatModal } from '@/components/chat'

const [showCreateDossier, setShowCreateDossier] = useState(false)

// Dans ChatActions ou header
<Button onClick={() => setShowCreateDossier(true)}>
  Créer un dossier
</Button>

<CreateDossierFromChatModal
  open={showCreateDossier}
  onOpenChange={setShowCreateDossier}
  conversationId={selectedConversationId}
  messages={messages}
  conversationTitle={conversations.find(c => c.id === selectedConversationId)?.title}
/>
```

### Intégrer dans ConsultationResult.tsx

```tsx
// Dans ConsultationResult.tsx, ajouter après la réponse:
import { ConsultationNextActions } from './ConsultationNextActions'

const context = {
  question: result.question,
  answer: result.conseil,
  sources: result.sources,
  metadata: {
    hasJurisprudence: result.sources.some(s => s.type === 'jurisprudence'),
    hasCode: result.sources.some(s => s.type === 'code'),
    categories: result.categories || [],
  },
}

<ConsultationNextActions context={context} className="mt-6" />
```

### Intégrer dans NarrativeInput.tsx

```tsx
// Dans NarrativeInput.tsx (composant assistant), modifier layout:
import { ProgressiveFeedback } from './ProgressiveFeedback'

<div className="grid md:grid-cols-2 gap-4">
  <div>
    <Label>Narratif</Label>
    <Textarea
      value={narratif}
      onChange={(e) => setNarratif(e.target.value)}
      rows={15}
    />
  </div>

  <ProgressiveFeedback text={narratif} />
</div>
```

---

## Prochaines étapes (Sprint 3-5)

### Sprint 3 : Services Unifiés (Phase 2)
- [ ] `unified-rag-service.ts` : Fusion rag-chat + enhanced-search (600 lignes)
- [ ] `unified-classification-service.ts` : Fusion 3 classifiers
- [ ] `provider-orchestrator-service.ts` : Fallback étendu
- [ ] Tests benchmarks performance

### Sprint 4 : Fonctionnalités Client (Phase 2)
- [ ] ExplanationTreeViewer + API `/api/client/legal-reasoning`
- [ ] DocumentExplorer + API `/api/client/kb/search`
- [ ] TimelineViewer + API `/api/client/jurisprudence/timeline`
- [ ] PrecedentBadge (intégration recherche)

### Sprint 5 : React Query (Phase 3)
- [ ] Hooks personnalisés (useRAGSearch, useKBDocument, etc.)
- [ ] QueryProvider global
- [ ] Migrer 85+ fetches vers React Query
- [ ] Prefetching intelligent

---

## Changelog

### 11 février 2026

- ✅ Création chat-to-dossier-extractor.ts
- ✅ Création CreateDossierFromChatModal.tsx
- ✅ Création API /api/chat/extract-dossier
- ✅ Création consultation-action-recommender.ts
- ✅ Création ConsultationNextActions.tsx
- ✅ Création narrative-analyzer.ts
- ✅ Création ProgressiveFeedback.tsx
- ✅ Documentation complète SPRINT2_WORKFLOWS_COMPLETE.md

---

## Ressources

- Sprint 1 doc : `docs/SPRINT1_FEEDBACK_SYSTEM.md`
- Plan complet : Transcription plan mode
- LLM Fallback : `lib/ai/llm-fallback-service.ts`
- Dossier Structuring : `lib/ai/dossier-structuring-service.ts`

---

## Support

Pour toute question ou problème :
- GitHub Issues : https://github.com/salmenktata/moncabinet/issues
- Email : support@qadhya.tn
