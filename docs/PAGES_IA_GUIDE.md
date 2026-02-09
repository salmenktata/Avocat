# Guide des Pages Intelligence Artificielle - Qadhya

## Vue d'ensemble

Qadhya propose **3 outils IA distincts** pour répondre à différents besoins juridiques :

1. **Qadhya Chat** - Assistant conversationnel avec historique
2. **Structuration IA** - Création automatique de dossiers structurés
3. **Conseil Juridique** - Consultation juridique rapide et actions recommandées

Chaque outil a un **cas d'usage spécifique** et des **fonctionnalités différentes**. Ce guide vous aide à choisir le bon outil selon votre besoin.

---

## 1. Qadhya Chat (`/assistant-ia`)

### Description

**Chat conversationnel** avec intelligence artificielle pour poser plusieurs questions liées et explorer des sujets juridiques en profondeur.

### Caractéristiques principales

- ✅ **Historique persistant** : Toutes vos conversations sont sauvegardées
- ✅ **Contexte multi-tours** : L'IA se souvient de vos questions précédentes
- ✅ **Recherche vectorielle (RAG)** : Recherche sémantique dans la base de connaissances juridiques
- ✅ **Sources juridiques** : Affiche jusqu'à 5 sources avec score de pertinence
- ✅ **Sidebar conversations** : Recherchez et retrouvez vos anciennes conversations
- ✅ **Quota mensuel** : Vérifie votre quota d'utilisation mensuel

### Quand l'utiliser ?

- Vous avez **plusieurs questions liées** sur un même sujet
- Vous voulez **explorer un domaine juridique** (ex: droit immobilier)
- Vous avez besoin de **contexte conversationnel** (l'IA se souvient de vos questions)
- Vous voulez **garder un historique** de vos recherches juridiques

### Exemple d'utilisation

```
Utilisateur : "Quelles sont les conditions de validité d'un contrat en Tunisie ?"

IA : [Réponse détaillée avec articles du Code des Obligations et des Contrats]
     Sources : COC Art. 2, 242, 243...

Utilisateur : "Et qu'en est-il des contrats verbaux ?"

IA : [Réponse en contexte, se référant à la question précédente]
     En complément de ce qui précède concernant les conditions de validité...

Utilisateur : "Cite-moi un arrêt de la Cour de Cassation sur ce sujet"

IA : [Recherche jurisprudentielle avec références précises]
```

### Configuration technique

- **Prompt système** : Ton avocat chevronné tunisien (20 ans d'expérience)
- **Temperature** : 0.7 (créatif mais précis)
- **Max tokens** : 4000
- **Type recherche** : Embeddings vectoriels (similarité sémantique)
- **API** : `POST /api/chat` → `rag-chat-service.ts`

### Fonctionnalités avancées

- **Créer un dossier depuis le chat** : Bouton "Créer un dossier" → redirige vers `/dossiers/assistant`
- **Recherche dans historique** : Barre de recherche dans la sidebar
- **Export conversation** : Possible d'exporter une conversation (future feature)

---

## 2. Structuration IA (`/dossiers/assistant`)

### Description

**Assistant de structuration automatique** qui transforme un récit juridique libre en dossier structuré prêt à l'emploi.

### Caractéristiques principales

- ❌ **Pas d'historique** : Les analyses sont temporaires (stockées en mémoire locale)
- ✅ **Workflow en 3 étapes** : Input → Analyzing → Result
- ❌ **Pas de recherche vectorielle** : Extraction LLM pure (analyse du texte narratif)
- ✅ **Sortie JSON structurée** : Type de dossier, parties, faits, procédures, timeline
- ✅ **Création dossier directe** : Modal de création avec options (actions, échéances, priorité)
- ✅ **Exemples fournis** : 4 exemples narratifs (Divorce, Locatif, Succession, Commercial)

### Quand l'utiliser ?

- Vous avez un **cas juridique concret** à traiter
- Vous voulez **créer un dossier rapidement** sans saisir manuellement
- Vous avez un **récit complet** (faits, parties, dates, enjeux)
- Vous voulez **structurer automatiquement** les informations

### Exemple d'utilisation

**Input (récit narratif)** :
```
Mon client, M. Ahmed Ben Ali, a signé un contrat de location le 15/01/2023
avec Mme Fatma Trabelsi pour un local commercial situé à Tunis, Avenue
Habib Bourguiba. Le loyer mensuel est de 1200 DT.

Depuis le 01/10/2023, le locataire ne paie plus le loyer. Le propriétaire
a envoyé une mise en demeure le 15/11/2023, restée sans réponse.

Le bailleur souhaite maintenant résilier le bail et récupérer son local
commercial, ainsi que les loyers impayés (4 mois = 4800 DT).
```

**Output (dossier structuré)** :
```json
{
  "type": "Droit immobilier - Bail commercial",
  "parties": [
    {
      "nom": "Ahmed Ben Ali",
      "role": "Demandeur (Bailleur)",
      "adresse": "..."
    },
    {
      "nom": "Fatma Trabelsi",
      "role": "Défendeur (Locataire)",
      "adresse": "Avenue Habib Bourguiba, Tunis"
    }
  ],
  "faits": [
    "Contrat de location signé le 15/01/2023",
    "Loyer mensuel : 1200 DT",
    "Impayés depuis le 01/10/2023 (4 mois)",
    "Mise en demeure envoyée le 15/11/2023 sans réponse"
  ],
  "procedure": "Résiliation bail + recouvrement loyers impayés (4800 DT)",
  "timeline": [
    {"date": "15/01/2023", "event": "Signature contrat de location"},
    {"date": "01/10/2023", "event": "Début des impayés"},
    {"date": "15/11/2023", "event": "Mise en demeure"}
  ],
  "enjeux": [
    "Résiliation du bail commercial",
    "Recouvrement des loyers impayés (4800 DT)",
    "Libération du local commercial"
  ]
}
```

**Résultat affiché** :
- Dossier pré-rempli avec toutes les informations structurées
- Bouton "Créer le dossier" → Modal de finalisation
- Options : Ajouter des actions, des échéances, définir la priorité

### Configuration technique

- **Prompt système** : Mode extraction structurée (JSON strict)
- **Temperature** : 0.3 (très précis, pas de créativité)
- **Max tokens** : 8000
- **Format sortie** : JSON conforme à `StructuredDossier` interface
- **Server Action** : `structurerDossierAction()` → `dossier-structuring-service.ts`

### Limites

- **Min 20 caractères, max 10 000 caractères** pour le récit
- Pas de recherche dans la base juridique (extraction pure)
- Pas d'historique des analyses précédentes

---

## 3. Conseil Juridique (`/dossiers/consultation`)

### Description

**Consultation juridique rapide** qui fournit un conseil structuré avec actions recommandées concrètes (one-shot).

### Caractéristiques principales

- ❌ **Pas d'historique** : Consultations non persistées
- ✅ **Recherche textuelle bilingue** : ILIKE + traduction automatique AR→FR
- ✅ **Support avancé arabe** : Détection langue + labels bilingues AR/FR
- ✅ **Actions recommandées** : Section dédiée avec checklist d'actions concrètes
- ✅ **Sources juridiques** : Affiche jusqu'à 5 sources avec extraits pertinents
- ✅ **Format structuré** : Réponse en 6 sections (Faits, Problématique, Règles, Analyse, Conclusion, Actions)

### Quand l'utiliser ?

- Vous avez besoin d'un **conseil rapide et ponctuel**
- Vous voulez des **actions concrètes à entreprendre** (checklist)
- Vous posez une **question juridique précise**
- Vous travaillez en **arabe** (traduction automatique vers français)
- Vous voulez un **avis structuré** selon la méthode IRAC (Issue-Rule-Application-Conclusion)

### Exemple d'utilisation

**Question** :
```
Quels sont les délais d'appel d'un jugement civil en première instance en Tunisie ?
Mon client souhaite interjeter appel d'un jugement rendu le 15/01/2024.
```

**Réponse structurée** :
```markdown
## 📋 Problématique Juridique
Déterminer le délai légal d'appel d'un jugement civil de première instance
et calculer la date limite pour votre client.

## 📚 Règles de Droit Applicables
- **Code de Procédure Civile et Commerciale (CPC)**
  - Article 143 : Délai d'appel de 20 jours francs
  - Article 144 : Point de départ = signification du jugement
  - Article 145 : Délai de signification de 6 mois

## 🔍 Analyse Juridique
Le délai d'appel court à partir de la **signification** du jugement au défendeur,
non de la date du prononcé. Sans signification, le délai ne commence pas à courir.

Calcul :
- Jugement rendu : 15/01/2024
- Signification : [à effectuer dans les 6 mois, soit avant le 15/07/2024]
- Délai appel : 20 jours francs après signification

## ✅ Conclusion
Votre client dispose de **20 jours francs** après la signification du jugement
pour interjeter appel. ATTENTION : Sans signification sous 6 mois, le jugement
devient caduc.

## 🎯 Actions Recommandées

1. **URGENT - Faire signifier le jugement**
   - Délai : Dans les 6 mois (avant le 15/07/2024)
   - Par : Huissier notaire
   - À : Partie adverse à son domicile

2. **Préparer la requête d'appel**
   - Délai : 20 jours francs après signification
   - Contenu : Moyens d'appel, conclusions, pièces
   - Format : Requête écrite + 3 copies

3. **Déposer au greffe de la Cour d'Appel**
   - Où : Greffe de la Cour d'Appel compétente (selon siège du TPI)
   - Pièces : Requête + copie jugement + pièces + timbre fiscal

4. **Signifier la requête d'appel**
   - Délai : 10 jours après dépôt au greffe
   - À : Partie adverse (intimé)

## 📚 Sources Juridiques

1. **[Source-1]** Code de Procédure Civile et Commerciale - Article 143
   > "Le délai d'appel est de vingt jours francs à compter de la
   > signification du jugement..."
   Pertinence : 0.95

2. **[KB-2]** Guide pratique - Procédures d'appel en matière civile
   > "Le délai d'appel ne court qu'à partir de la signification effective..."
   Pertinence : 0.89
```

### Configuration technique

- **Prompt système** : Consultation formelle (méthode IRAC)
- **Temperature** : 0.3 (très précis)
- **Max tokens** : 2000
- **Format sortie** : Markdown avec section "## Actions Recommandées"
- **Type recherche** : Recherche textuelle (ILIKE) + traduction automatique
- **Server Action** : `submitConsultation()` → `consultation.ts`

### Support bilingue avancé

- **Détection automatique** : Arabe ou français
- **Traduction requête** : Arabe → Français pour recherche optimisée
- **Labels bilingues** : Affichage AR/FR selon langue détectée
- **Ponctuation arabe** : Support complet (؟،؛)

---

## Tableau Comparatif

| Critère | **Qadhya Chat** | **Structuration IA** | **Conseil Juridique** |
|---------|-----------------|----------------------|----------------------|
| **Route** | `/assistant-ia` | `/dossiers/assistant` | `/dossiers/consultation` |
| **Use Case** | Exploration juridique multi-questions | Création dossier structuré | Conseil rapide + actions |
| **Historique** | ✅ Sauvegardé en BD | ❌ Temporaire (local) | ❌ Non persisté |
| **Type recherche** | RAG vectoriel (embeddings) | Extraction LLM pure | Recherche textuelle (ILIKE) |
| **Format sortie** | Markdown libre | JSON structuré | Markdown IRAC + Actions |
| **Multi-tours** | ✅ Oui (contexte) | ❌ Non (one-shot) | ❌ Non (one-shot) |
| **Sources affichées** | ✅ 5 max avec score | ❌ Intégrées texte | ✅ 5 max avec extraits |
| **Bilingue AR/FR** | Support basique | Support basique | ✅ Avancé (traduction) |
| **Quota check** | ✅ Mensuel utilisateur | ❌ Non | ❌ Non |
| **Temperature** | 0.7 (créatif) | 0.3 (précis) | 0.3 (précis) |
| **Création dossier** | Redirige assistant | ✅ Modal directe | Bouton (partiel) |
| **Actions recommandées** | ❌ Non | ❌ Non | ✅ Checklist dédiée |

---

## FAQ : Quelle page utiliser ?

### "Je veux comprendre un concept juridique en profondeur"
→ **Qadhya Chat** - Posez plusieurs questions, explorez le sujet, l'IA maintient le contexte.

### "J'ai un nouveau cas client et je veux créer un dossier rapidement"
→ **Structuration IA** - Décrivez le cas, l'IA génère automatiquement la structure complète.

### "Mon client me pose une question juridique précise et je veux une réponse rapide"
→ **Conseil Juridique** - Obtenez un avis structuré avec checklist d'actions concrètes.

### "Je veux rechercher de la jurisprudence sur un sujet"
→ **Qadhya Chat** - La recherche vectorielle trouve les arrêts pertinents par similarité sémantique.

### "J'ai un récit de 5 pages d'un client et je veux extraire les informations clés"
→ **Structuration IA** - Copiez le récit, l'IA extrait automatiquement parties, faits, dates, enjeux.

### "Je travaille en arabe et je veux une consultation bilingue"
→ **Conseil Juridique** - Support avancé arabe avec traduction automatique et labels bilingues.

### "Je veux conserver mes recherches juridiques pour les retrouver plus tard"
→ **Qadhya Chat** - Toutes les conversations sont sauvegardées et recherchables dans la sidebar.

### "Je veux savoir quoi faire concrètement pour mon client (actions)"
→ **Conseil Juridique** - Section "Actions Recommandées" avec checklist étape par étape.

---

## Workflow Recommandé

### Scénario 1 : Nouveau cas client

1. **Structuration IA** : Créer le dossier structuré à partir du récit client
2. **Qadhya Chat** : Explorer les questions juridiques liées au cas
3. **Conseil Juridique** : Obtenir des actions recommandées concrètes

### Scénario 2 : Recherche juridique approfondie

1. **Qadhya Chat** : Poser la question initiale et explorer le contexte
2. **Conseil Juridique** : Obtenir un avis formel structuré si besoin d'une synthèse
3. **Qadhya Chat** : Continuer la conversation pour approfondir certains points

### Scénario 3 : Consultation rapide client

1. **Conseil Juridique** : Obtenir un avis structuré avec actions recommandées
2. **Qadhya Chat** : Si besoin d'approfondir certains points juridiques
3. **Structuration IA** : Si le cas nécessite un dossier complet

---

## Notes Techniques

### Différences de Prompts Système

**Qadhya Chat** : Ton avocat chevronné tunisien (20 ans d'expérience), conversationnel
**Structuration IA** : Mode extraction structurée JSON strict, pas de créativité
**Conseil Juridique** : Méthode IRAC (Issue-Rule-Application-Conclusion), format académique

### Différences de Recherche

**Qadhya Chat** : Embeddings vectoriels (similarité sémantique, modèle `qwen3-embedding:0.6b`)
**Structuration IA** : Pas de recherche (extraction LLM pure du narratif)
**Conseil Juridique** : Recherche textuelle PostgreSQL (ILIKE + traduction AR→FR)

### Limitations Connues

- **Qadhya Chat** : Quota mensuel utilisateur (vérifier limites)
- **Structuration IA** : Max 10 000 caractères pour le récit
- **Conseil Juridique** : Pas d'historique (one-shot uniquement)

---

## Support et Documentation

- **Guide utilisateur complet** : [docs/USER_GUIDE.md](./USER_GUIDE.md)
- **Documentation RAG** : [docs/RAG_VALIDATION_REPORT.md](./RAG_VALIDATION_REPORT.md)
- **Prompts juridiques** : [docs/LEGAL_REASONING_PROMPTS.md](./LEGAL_REASONING_PROMPTS.md)
- **Méthode IRAC** : [lib/ai/legal-reasoning-prompts.ts](../lib/ai/legal-reasoning-prompts.ts)

---

## Conclusion

Les **3 pages IA de Qadhya** sont complémentaires et couvrent l'ensemble du workflow juridique :

- **Qadhya Chat** : Exploration et recherche juridique approfondie
- **Structuration IA** : Création rapide de dossiers structurés
- **Conseil Juridique** : Avis formel avec actions concrètes

Choisissez l'outil selon votre besoin immédiat, et n'hésitez pas à **combiner les 3** pour un workflow complet !
