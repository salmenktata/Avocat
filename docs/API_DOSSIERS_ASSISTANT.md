# API Assistant Dossiers & Consultation

**Date** : 12 février 2026
**Version** : 1.0

---

## 🎯 Vue d'Ensemble

Deux nouvelles API pour l'analyse de dossiers juridiques :

1. **Assistant Dossiers** : Analyse approfondie conversationnelle
2. **Consultation** : Génération de consultation formelle IRAC

---

## 📋 1. Assistant Dossiers

### Endpoint

```
POST /api/dossiers/[id]/assistant
GET /api/dossiers/[id]/assistant
```

### Description

Analyse approfondie d'un dossier juridique avec :
- OpenAI embeddings 1536-dim (qualité maximale)
- Gemini LLM (contexte 1M tokens)
- Format conversationnel
- Historique des conversations

### Request Body (POST)

```typescript
{
  question: string              // Question sur le dossier (min 3 chars)
  conversationId?: string       // ID conversation existante (optionnel)
  includeJurisprudence?: boolean // Inclure jurisprudence (défaut: true)
  usePremiumModel?: boolean     // Mode premium (défaut: false)
}
```

### Response (POST)

```typescript
{
  answer: string                // Réponse de l'assistant
  sources: ChatSource[]         // Sources juridiques utilisées
  conversationId?: string       // ID de la conversation
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  model: string                 // Modèle utilisé (ex: "gemini/gemini-2.0-flash-exp")
}
```

### Response (GET)

```typescript
{
  conversations: Array<{
    id: string
    title: string
    messageCount: number
    createdAt: Date
    updatedAt: Date
  }>
}
```

### Exemple d'Utilisation

```bash
# Poser une question sur un dossier
curl -X POST https://qadhya.tn/api/dossiers/123/assistant \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "question": "Quels sont les arguments juridiques principaux dans ce dossier ?",
    "includeJurisprudence": true
  }'
```

**Réponse** :
```json
{
  "answer": "Selon l'analyse du dossier n°2024-001, les arguments juridiques principaux sont :\n\n1. **Violation du contrat de travail**...",
  "sources": [
    {
      "documentId": "doc-123",
      "documentName": "Contrat de travail.pdf",
      "chunkContent": "Article 5 : L'employé s'engage à...",
      "similarity": 0.89
    }
  ],
  "conversationId": "conv-456",
  "tokensUsed": { "input": 450, "output": 320, "total": 770 },
  "model": "gemini/gemini-2.0-flash-exp"
}
```

### Récupérer l'historique

```bash
curl -X GET https://qadhya.tn/api/dossiers/123/assistant \
  -H "Cookie: session=..."
```

**Réponse** :
```json
{
  "conversations": [
    {
      "id": "conv-456",
      "title": "Arguments juridiques principaux",
      "messageCount": 4,
      "createdAt": "2026-02-12T10:30:00Z",
      "updatedAt": "2026-02-12T11:15:00Z"
    }
  ]
}
```

---

## 📜 2. Consultation Juridique (IRAC)

### Endpoint

```
POST /api/dossiers/[id]/consultation
```

### Description

Génère une consultation juridique formelle selon la méthode IRAC :
- **I**ssue : Problématique juridique
- **R**ule : Règles de droit applicables
- **A**pplication : Analyse et application au cas
- **C**onclusion : Conclusion juridique

Configuration :
- OpenAI embeddings 1536-dim
- Gemini LLM (raisonnement approfondi)
- Temperature 0.1 (très factuel)
- Timeout 60s

### Request Body

```typescript
{
  question: string              // Question juridique (min 10 chars)
  facts?: string                // Faits du cas (optionnel)
  usePremiumModel?: boolean     // Mode premium (défaut: false)
}
```

### Response

```typescript
{
  answer: string                // Consultation IRAC complète
  sources: ChatSource[]         // Sources juridiques citées
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  model: string                 // Modèle utilisé
  format: "IRAC"                // Format de réponse
}
```

### Exemple d'Utilisation

```bash
curl -X POST https://qadhya.tn/api/dossiers/123/consultation \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "question": "Mon client peut-il réclamer des dommages-intérêts pour licenciement abusif ?",
    "facts": "Employé licencié après 5 ans de service sans préavis ni motif valable. Contrat CDI signé en 2019."
  }'
```

**Réponse** :
```json
{
  "answer": "# CONSULTATION JURIDIQUE\n\n## I. PROBLÉMATIQUE JURIDIQUE\n\nLa question posée porte sur la possibilité pour votre client de réclamer des dommages-intérêts suite à un licenciement...\n\n## II. RÈGLES DE DROIT APPLICABLES\n\n### Code du Travail Tunisien\n- Article 14 : Conditions du licenciement...\n- Article 23 : Dommages-intérêts...\n\n### Jurisprudence\n- Cassation sociale n°123/2020...\n\n## III. ANALYSE ET APPLICATION\n\nEn l'espèce, les faits révèlent que...\n\n## IV. CONCLUSION\n\nAu regard des éléments exposés, votre client dispose de solides arguments...\n\n## V. SOURCES JURIDIQUES\n\n1. Code du Travail, Articles 14, 23, 24\n2. Cassation sociale n°123/2020\n3. Doctrine : ...",
  "sources": [
    {
      "documentId": "kb-456",
      "documentName": "Code du Travail - Article 14",
      "chunkContent": "Article 14 : Le licenciement d'un salarié...",
      "similarity": 0.92
    }
  ],
  "tokensUsed": { "input": 580, "output": 1850, "total": 2430 },
  "model": "gemini/gemini-2.0-flash-exp",
  "format": "IRAC"
}
```

---

## 🎯 Différences Clés

| Aspect | Assistant Dossiers | Consultation IRAC |
|--------|-------------------|-------------------|
| **Format** | Conversationnel | Formel IRAC |
| **Historique** | Oui (conversations) | Non (one-shot) |
| **Temperature** | 0.2 | 0.1 (plus factuel) |
| **Timeout** | 30s | 60s |
| **Use Case** | Analyse interactive | Consultation formelle |
| **Longueur** | Réponses concises | Consultation détaillée |
| **Contexte** | Multi-tours | Single-shot |

---

## 💰 Coûts

| Opération | Embeddings | LLM | Coût Estimé |
|-----------|-----------|-----|-------------|
| **Assistant Dossiers** | OpenAI 1536-dim | Gemini (gratuit) | ~1€/mois |
| **Consultation** | OpenAI 1536-dim | Gemini (gratuit) | ~1€/mois |

**Total** : ~2€/mois pour les deux (volume faible attendu)

---

## 🔒 Sécurité

- ✅ Authentification requise (session)
- ✅ Vérification propriété dossier
- ✅ Pas de rate limiting (usage interne cabinet)
- ✅ Logs complets

---

## 🧪 Tests

### Test Assistant Dossiers

```bash
# Créer un dossier de test
curl -X POST http://localhost:7002/api/dossiers \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"numero": "TEST-001", "titre": "Test Assistant"}'

# Analyser le dossier
curl -X POST http://localhost:7002/api/dossiers/[id]/assistant \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"question": "Résume ce dossier"}'
```

### Test Consultation

```bash
curl -X POST http://localhost:7002/api/dossiers/[id]/consultation \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "question": "Analyse juridique du litige",
    "facts": "Faits du cas..."
  }'
```

---

## 📊 Monitoring

### Logs à Surveiller

```bash
# Succès
[Assistant Dossier] Analyse dossier #2024-001 - "Quels sont les arguments..."
[LLM-Fallback] Opération: dossiers-assistant → Stratégie: [gemini → groq → deepseek]
[Embeddings] OpenAI text-embedding-3-small (1536-dim)
[LLM-Fallback] ✓ gemini gemini-2.0-flash-exp (1.8s)

# Consultation
[Consultation] Génération consultation IRAC - Dossier #2024-001
[LLM-Fallback] Opération: dossiers-consultation → Stratégie: [gemini → deepseek → groq]
[LLM-Fallback] ✓ gemini gemini-2.0-flash-exp (4.5s)
```

---

## 🐛 Dépannage

### Erreur "Embeddings indisponibles"

**Cause** : OpenAI API key manquante ou invalide
**Solution** : Vérifier `OPENAI_API_KEY` dans `.env.production.local`

```bash
# Prod
ssh qadhya
cat /opt/qadhya/.env.production.local | grep OPENAI_API_KEY
```

### Timeout après 30s (Assistant)

**Cause** : Dossier trop volumineux ou Gemini lent
**Solution** : Le timeout est normal, fallback vers Groq automatique

### Consultation ne respecte pas format IRAC

**Cause** : Prompt type mal configuré
**Solution** : Vérifier `contextType: 'consultation'` dans la route

---

## 📚 Références

- **Routes** :
  - `app/api/dossiers/[id]/assistant/route.ts`
  - `app/api/dossiers/[id]/consultation/route.ts`
- **Configuration** : `lib/ai/operations-config.ts`
- **Prompts IRAC** : `lib/ai/legal-reasoning-prompts.ts`
- **Modèles** : `docs/AI_MODELS_BY_OPERATION.md`

---

**Dernière mise à jour** : 12 février 2026
