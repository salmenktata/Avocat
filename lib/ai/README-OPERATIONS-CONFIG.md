# Configuration IA par Opération - Guide Rapide

## 🎯 Objectif

Optimiser **coût/performance/qualité** en configurant l'IA spécifiquement pour chaque type d'opération métier.

## 📝 Utilisation Rapide

### 1. Chat Utilisateur (Route `/api/chat`)

```typescript
// app/api/chat/route.ts
const response = await answerQuestion(question, userId, {
  dossierId,
  conversationId,
  includeJurisprudence,
  usePremiumModel,
  operationName: 'assistant-ia', // ← Groq ultra-rapide (292ms)
})
```

**Résultat** :
- ⚡ Latence < 3s
- 🎯 Providers : Groq → Gemini → DeepSeek → Ollama
- 💰 Coût : 0€ (Groq gratuit + Ollama embeddings)

### 2. Indexation KB

```typescript
// Dans votre service d'indexation
const embedding = await generateEmbedding(text, {
  operationName: 'indexation', // ← Ollama uniquement (0€)
})
```

**Résultat** :
- 💰 Coût : 0€ (Ollama exclusif)
- 📊 Volume élevé supporté
- 🔄 Fallback OpenAI si Ollama down

### 3. Analyse Dossier (À implémenter)

```typescript
// app/api/dossiers/[id]/assistant/route.ts (future)
const response = await answerQuestion(question, userId, {
  dossierId,
  operationName: 'dossiers-assistant', // ← Qualité max
})
```

**Résultat** :
- 🧠 Embeddings OpenAI 1536-dim (qualité max)
- 📚 Providers : Gemini → Groq → DeepSeek
- 💰 Coût : ~2€/mois (volume faible)

### 4. Consultation Juridique (À implémenter)

```typescript
// app/api/dossiers/[id]/consultation/route.ts (future)
const response = await generateConsultation({
  dossierId,
  question,
  facts,
  operationName: 'dossiers-consultation', // ← IRAC format
})
```

**Résultat** :
- 📜 Format IRAC strict
- 🎓 Temperature = 0.1 (très factuel)
- 💰 Coût : ~2€/mois

## 🧪 Tester

```bash
# Tester la configuration
npm run test:operations-config

# Vérifier les embeddings
npx tsx scripts/test-embedding-fallback.ts
```

## 📊 Configuration Actuelle

| Opération | Provider LLM | Provider Embeddings | Timeout Total | Coût |
|-----------|-------------|-------------------|--------------|------|
| Indexation | Ollama | Ollama | 60s | 0€ |
| Assistant IA | Groq | Ollama | 10s | 0€ |
| Dossiers Assistant | Gemini | OpenAI (1536-dim) | 30s | ~2€/mois |
| Consultation | Gemini | OpenAI (1536-dim) | 60s | ~2€/mois |

**Total** : ~4-6€/mois (vs ~100€/mois avant) = **-95% économies** 🎉

## 🔧 Modifier la Configuration

Éditer `lib/ai/operations-config.ts` :

```typescript
export const AI_OPERATIONS_CONFIG = {
  'assistant-ia': {
    context: 'rag-chat',
    providers: {
      primary: 'groq',  // ← Changer ici
      fallback: ['gemini', 'deepseek', 'ollama'],
    },
    embeddings: {
      provider: 'ollama',  // ← Ou 'openai' pour qualité max
    },
    timeouts: {
      total: 10000,  // ← Ajuster timeout
    },
    llmConfig: {
      temperature: 0.3,  // ← Ajuster température
      maxTokens: 500,
    },
  },
}
```

Puis tester :

```bash
npm run test:operations-config
```

## 📚 Documentation Complète

Voir [`docs/AI_OPERATIONS_CONFIGURATION.md`](../../docs/AI_OPERATIONS_CONFIGURATION.md)

## 🐛 Dépannage

### "Operation not configured"

Vérifier que `operationName` est bien l'un des 4 types :
- `'indexation'`
- `'assistant-ia'`
- `'dossiers-assistant'`
- `'dossiers-consultation'`

### Les providers ne changent pas

1. Vérifier que `operationName` est bien passé dans les options
2. Vérifier les logs : `[LLM-Fallback] Opération: assistant-ia → Stratégie: [groq → gemini → ...]`
3. Tester la config : `npm run test:operations-config`

### Embeddings toujours Ollama

Si vous voulez forcer OpenAI pour une opération :

```typescript
const embedding = await generateEmbedding(text, {
  operationName: 'dossiers-assistant', // ← Utilise OpenAI (1536-dim)
})
```

## ✅ Checklist Implémentation

- [x] Créer `lib/ai/operations-config.ts`
- [x] Adapter `llm-fallback-service.ts`
- [x] Adapter `embeddings-service.ts`
- [x] Adapter `rag-chat-service.ts`
- [x] Modifier `/api/chat` route
- [ ] Créer route `/api/dossiers/[id]/assistant` (future)
- [ ] Créer route `/api/dossiers/[id]/consultation` (future)
- [ ] Ajouter monitoring par opération (optionnel)

---

**Dernière mise à jour** : 12 février 2026
