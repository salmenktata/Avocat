# Configuration IA par Type d'Opération

**Date de création** : 12 février 2026
**Version** : 1.0
**Statut** : ✅ Implémenté

---

## Vue d'ensemble

Le système Qadhya implémente maintenant une configuration IA **spécifique par type d'opération métier**. Chaque opération (indexation, chat utilisateur, analyse dossier, consultation) dispose de sa propre configuration optimisée en termes de :

- 🎯 **Providers LLM** (Groq, Gemini, DeepSeek, Ollama)
- 📊 **Providers embeddings** (Ollama, OpenAI)
- ⏱️ **Timeouts** adaptés
- 🧠 **Paramètres LLM** (température, maxTokens)
- 💰 **Optimisation coût/performance**

---

## Architecture

### Fichiers Core

| Fichier | Rôle |
|---------|------|
| `lib/ai/operations-config.ts` | **Configuration centralisée** par opération |
| `lib/ai/llm-fallback-service.ts` | Support `operationName` dans `LLMOptions` |
| `lib/ai/embeddings-service.ts` | Support `operationName` dans `EmbeddingOptions` |
| `lib/ai/rag-chat-service.ts` | Support `operationName` dans `ChatOptions` |
| `app/api/chat/route.ts` | Utilise `operationName: 'assistant-ia'` |

### Types d'Opérations

```typescript
type OperationName =
  | 'indexation'              // Indexation KB background
  | 'assistant-ia'            // Chat utilisateur temps réel
  | 'dossiers-assistant'      // Analyse approfondie dossier
  | 'dossiers-consultation'   // Consultation juridique formelle
```

---

## Configuration par Opération

### 1. Indexation (Background Processing)

**Use Case** : Indexation KB en arrière-plan (volume élevé, coût critique)

```typescript
'indexation': {
  context: 'embeddings',  // Utilise stratégie embeddings existante

  embeddings: {
    provider: 'ollama',  // Gratuit pour volume élevé
    fallbackProvider: 'openai',
    model: 'qwen3-embedding:0.6b',
    dimensions: 1024,
  },

  timeouts: {
    embedding: 10000,  // 10s par embedding
    chat: 30000,       // 30s pour classification LLM
    total: 60000,      // 1min total max
  },

  llmConfig: {
    temperature: 0.2,  // Déterministe pour classification
    maxTokens: 2000,
  },
}
```

**Objectifs** :
- ✅ Coût 0€ (Ollama exclusif)
- ✅ Volume élevé supporté (5-10M tokens/jour)
- ✅ Fallback OpenAI si Ollama indisponible

---

### 2. Assistant IA (Chat Temps Réel)

**Use Case** : Chat utilisateur temps réel (performance critique, volume élevé)

```typescript
'assistant-ia': {
  context: 'rag-chat',

  providers: {
    primary: 'groq',  // Ultra-rapide (292ms)
    fallback: ['gemini', 'deepseek', 'ollama'],
  },

  embeddings: {
    provider: 'ollama',  // Gratuit pour volume élevé
    model: 'qwen3-embedding:0.6b',
    dimensions: 1024,
  },

  timeouts: {
    embedding: 3000,   // 3s max (cache attendu)
    chat: 5000,        // 5s max (Groq ultra-rapide)
    total: 10000,      // 10s total
  },

  llmConfig: {
    temperature: 0.3,  // Conversationnel naturel
    maxTokens: 500,    // Réponses concises
    systemPromptType: 'chat',
  },
}
```

**Objectifs** :
- ⚡ Latence < 3s (95% des cas)
- 💰 Coût ~0€ (Groq gratuit + Ollama embeddings)
- 🎯 Qualité conversationnelle

---

### 3. Assistant Dossiers (Analyse Approfondie)

**Use Case** : Analyse approfondie dossier (qualité critique)

```typescript
'dossiers-assistant': {
  context: 'quality-analysis',

  providers: {
    primary: 'gemini',  // Qualité + contexte 1M tokens
    fallback: ['groq', 'deepseek'],
  },

  embeddings: {
    provider: 'openai',   // Qualité supérieure (1536-dim)
    fallbackProvider: 'ollama',
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },

  timeouts: {
    embedding: 5000,   // 5s max
    chat: 15000,       // 15s (analyse approfondie OK)
    total: 30000,      // 30s total
  },

  llmConfig: {
    temperature: 0.2,  // Précis et factuel
    maxTokens: 2000,   // Réponses détaillées
    systemPromptType: 'chat',
  },
}
```

**Objectifs** :
- 🧠 Qualité maximale (embeddings OpenAI 1536-dim)
- 📊 Contexte étendu (Gemini 1M tokens)
- 💰 Coût modéré (~2€/mois estimé)

---

### 4. Consultation (Génération Formelle IRAC)

**Use Case** : Consultation juridique formelle (qualité maximale)

```typescript
'dossiers-consultation': {
  context: 'structuring',

  providers: {
    primary: 'gemini',  // Qualité + raisonnement
    fallback: ['deepseek', 'groq'],
  },

  embeddings: {
    provider: 'openai',   // Qualité maximale
    fallbackProvider: 'ollama',
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },

  timeouts: {
    embedding: 5000,   // 5s max
    chat: 30000,       // 30s (consultation détaillée)
    total: 60000,      // 1min total
  },

  llmConfig: {
    temperature: 0.1,  // Très factuel et précis
    maxTokens: 4000,   // Consultation longue
    systemPromptType: 'consultation',
  },
}
```

**Objectifs** :
- 📜 Format IRAC strict
- 🎓 Raisonnement juridique approfondi
- 💰 Coût acceptable (~2€/mois estimé)

---

## Utilisation

### Dans une Route API

```typescript
// app/api/chat/route.ts
const response = await answerQuestion(question, userId, {
  dossierId,
  conversationId,
  includeJurisprudence,
  usePremiumModel,
  operationName: 'assistant-ia', // ← Configuration optimisée
})
```

### Dans un Service

```typescript
// lib/ai/rag-chat-service.ts
const queryEmbedding = await generateEmbedding(question, {
  operationName: options.operationName, // ← Utilise config opération
})

const llmResponse = await callLLMWithFallback(
  messages,
  {
    temperature,
    maxTokens,
    systemPrompt,
    operationName: options.operationName, // ← Utilise config opération
  },
  usePremiumModel
)
```

---

## Avantages

### 1. Performance Optimisée

- **Chat utilisateur** : Groq ultra-rapide (292ms)
- **Indexation** : Ollama gratuit (0€)
- **Dossiers** : Gemini contexte 1M tokens

### 2. Coût Optimisé

| Opération | Provider Embeddings | Provider LLM | Coût Estimé |
|-----------|-------------------|--------------|-------------|
| Indexation | Ollama | Groq/Gemini | 0€/mois |
| Assistant IA | Ollama | Groq | 0€/mois |
| Dossiers Assistant | OpenAI | Gemini | ~2€/mois |
| Consultation | OpenAI | Gemini | ~2€/mois |
| **TOTAL** | | | **~4-6€/mois** |

**Économies** : ~100€/mois → ~6€/mois = **~1200€/an** 🎉

### 3. Qualité Adaptée

- **Chat** : Rapide et conversationnel (temp=0.3)
- **Consultation** : Factuel et précis (temp=0.1)
- **Dossiers** : Embeddings OpenAI 1536-dim (qualité maximale)

---

## Monitoring

### Métriques par Opération

```typescript
// À implémenter (Phase 5 optionnelle)
await logAIMetrics({
  operationName: 'assistant-ia',
  provider: 'groq',
  latency: 292,
  tokensUsed: 450,
  success: true,
})
```

### Dashboard Métriques

```sql
-- Latence moyenne par opération
SELECT
  operation_name,
  AVG(latency_ms) as avg_latency,
  COUNT(*) as total_calls
FROM ai_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY operation_name;
```

---

## Tests

### Test Assistant IA

```bash
curl -X POST http://localhost:7002/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "Qu'est-ce qu'un contrat de travail?"}'

# Vérifier :
# - Latence < 3s
# - Provider = groq
# - Embedding provider = ollama
```

### Test Indexation

```bash
# Vérifier logs indexation
grep "operationName.*indexation" /var/log/qadhya/indexing.log

# Vérifier provider = ollama (0€)
```

---

## Migration

### Rétrocompatibilité

✅ **100% rétrocompatible** : `operationName` est optionnel. Sans ce paramètre, le comportement actuel est préservé (utilise `context` par défaut).

```typescript
// ✅ AVANT (toujours fonctionnel)
await answerQuestion(question, userId, {
  dossierId,
  conversationId,
})

// ✅ APRÈS (optimisé)
await answerQuestion(question, userId, {
  dossierId,
  conversationId,
  operationName: 'assistant-ia',
})
```

---

## Roadmap

### Phase 1 : Configuration Core ✅ Implémenté

- [x] Créer `operations-config.ts`
- [x] Adapter `llm-fallback-service.ts`
- [x] Adapter `embeddings-service.ts`
- [x] Adapter `rag-chat-service.ts`
- [x] Modifier `/api/chat` route

### Phase 2 : Routes Dossiers (À venir)

- [ ] Créer `/api/dossiers/[id]/assistant` route
- [ ] Créer `/api/dossiers/[id]/consultation` route
- [ ] Implémenter génération consultation IRAC

### Phase 3 : Monitoring (Optionnel)

- [ ] Ajouter logging par opération
- [ ] Dashboard métriques par opération
- [ ] Alertes coût/latence

---

## FAQ

### Pourquoi OpenAI pour les dossiers mais pas pour le chat ?

**Chat** : Volume élevé (2-3M tokens/jour) → Ollama gratuit
**Dossiers** : Volume faible (~10-50 ops/mois) + qualité critique → OpenAI 1536-dim acceptable (~2€/mois)

### Comment forcer un provider spécifique ?

Modifier `operations-config.ts` :

```typescript
'assistant-ia': {
  providers: {
    primary: 'gemini',  // ← Changer ici
    fallback: ['groq', 'deepseek'],
  },
}
```

### Puis-je créer mes propres opérations ?

Oui ! Ajouter dans `operations-config.ts` :

```typescript
export type OperationName =
  | 'indexation'
  | 'assistant-ia'
  | 'mon-operation-custom'  // ← Nouvelle opération

export const AI_OPERATIONS_CONFIG = {
  // ...
  'mon-operation-custom': {
    context: 'default',
    providers: { primary: 'groq', fallback: ['ollama'] },
    // ...
  },
}
```

---

## Références

- **Source unique de vérité** : `lib/ai/operations-config.ts`
- **Doc clés IA** : `docs/API_KEYS_MANAGEMENT.md`
- **Stratégie IA** : `docs/AI_STRATEGY_AND_ORGANIZATION.md`
- **MEMORY.md** : Section "🤖 Option C - IA Hybride"

---

**Dernière mise à jour** : 12 février 2026
**Maintenu par** : Équipe DevOps Qadhya
