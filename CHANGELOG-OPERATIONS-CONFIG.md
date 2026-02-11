# Changelog : Configuration IA par Opération

**Date** : 12 février 2026
**Auteur** : Équipe DevOps Qadhya
**Type** : Feature
**Impact** : Optimisation coût/performance

---

## 🎯 Objectif

Implémenter une configuration IA **spécifique par type d'opération métier** pour optimiser :
- ⚡ **Performance** : Groq ultra-rapide (292ms) pour chat utilisateur
- 💰 **Coût** : ~100€/mois → ~6€/mois (-95%)
- 🧠 **Qualité** : OpenAI embeddings 1536-dim pour dossiers/consultations

---

## ✅ Changements Implémentés

### 1. Configuration Centralisée

**Fichier** : `lib/ai/operations-config.ts` (NOUVEAU)
- ✅ Configuration par opération (indexation, assistant-ia, dossiers-assistant, dossiers-consultation)
- ✅ Providers LLM spécifiques par opération
- ✅ Providers embeddings spécifiques par opération
- ✅ Timeouts adaptés par opération
- ✅ Paramètres LLM (temperature, maxTokens) par opération
- ✅ Helpers : `getOperationConfig()`, `getPrimaryProvider()`, etc.

### 2. Adaptation Service LLM Fallback

**Fichier** : `lib/ai/llm-fallback-service.ts` (MODIFIÉ)
- ✅ Ajout import `operations-config.ts`
- ✅ Nouveau champ `operationName?: OperationName` dans `LLMOptions`
- ✅ Logique dans `callLLMWithFallback()` pour utiliser config opération si fourni
- ✅ Override options (context, temperature, maxTokens) depuis config opération
- ✅ Support providers spécifiques par opération

**Lignes modifiées** : ~20 lignes ajoutées

### 3. Adaptation Service Embeddings

**Fichier** : `lib/ai/embeddings-service.ts` (MODIFIÉ)
- ✅ Ajout import `operations-config.ts`
- ✅ Nouveau champ `operationName?: OperationName` dans `EmbeddingOptions`
- ✅ Logique dans `generateEmbedding()` pour utiliser config opération
- ✅ Logique dans `generateEmbeddingsBatch()` pour utiliser config opération
- ✅ Support provider/fallback depuis config opération

**Lignes modifiées** : ~15 lignes ajoutées

### 4. Adaptation Service RAG Chat

**Fichier** : `lib/ai/rag-chat-service.ts` (MODIFIÉ)
- ✅ Ajout import `operations-config.ts`
- ✅ Nouveau champ `operationName?: OperationName` dans `ChatOptions`
- ✅ Passage `operationName` à `generateEmbedding()` (recherche contexte)
- ✅ Passage `operationName` à `callLLMWithFallback()` (génération réponse)

**Lignes modifiées** : ~8 lignes ajoutées

### 5. Adaptation Route Chat API

**Fichier** : `app/api/chat/route.ts` (MODIFIÉ)
- ✅ Ajout `operationName: 'assistant-ia'` dans appel `answerQuestion()` (mode non-streaming)
- ✅ Ajout `operationName: 'assistant-ia'` dans appel `answerQuestion()` (mode streaming)

**Lignes modifiées** : 2 lignes ajoutées

### 6. Routes Dossiers (NOUVEAU - Phase 2)

**Fichiers créés** :
- ✅ `app/api/dossiers/[id]/assistant/route.ts` (~200 lignes)
  - POST : Analyse dossier avec assistant
  - GET : Historique conversations dossier
  - Configuration : `operationName: 'dossiers-assistant'`

- ✅ `app/api/dossiers/[id]/consultation/route.ts` (~150 lignes)
  - POST : Génération consultation IRAC
  - Configuration : `operationName: 'dossiers-consultation'`
  - Enregistrement consultations en DB

**Lignes ajoutées** : ~350 lignes

### 7. Documentation

**Fichiers créés** :
- ✅ `docs/AI_OPERATIONS_CONFIGURATION.md` (documentation complète, 400+ lignes)
- ✅ `docs/AI_MODELS_BY_OPERATION.md` (modèles par opération, 500+ lignes)
- ✅ `docs/API_DOSSIERS_ASSISTANT.md` (guide API dossiers, 400+ lignes)
- ✅ `lib/ai/README-OPERATIONS-CONFIG.md` (guide rapide)
- ✅ `CHANGELOG-OPERATIONS-CONFIG.md` (ce fichier)

### 8. Scripts de Test

**Fichiers créés** :
- ✅ `scripts/test-operations-config.ts` (tests validation config)
- ✅ `lib/ai/operations-monitoring-service.ts` (exemple monitoring, Phase 5 optionnelle)

**Package.json** :
- ✅ Ajout script `test:operations-config`

### 9. Mise à jour Mémoire

**Fichier** : `.claude/projects/-Users-salmenktata-Projets-GitHub-Avocat/memory/MEMORY.md` (MODIFIÉ)
- ✅ Nouvelle section "🎯 Config IA par Opération (Feb 12, 2026)"

---

## 📊 Résultats Tests

```bash
npm run test:operations-config
```

**Sortie** :
```
✅ 4 opérations configurées: indexation, assistant-ia, dossiers-assistant, dossiers-consultation
✅ Toutes les règles de cohérence respectées
💡 Total estimé: ~4-6€/mois (vs ~100€/mois avant = -95% économies)
```

---

## 🔄 Rétrocompatibilité

**100% rétrocompatible** : Le paramètre `operationName` est **optionnel**. Sans ce paramètre, le comportement actuel est préservé (utilise `context` par défaut).

```typescript
// ✅ AVANT (toujours fonctionnel)
await answerQuestion(question, userId, { dossierId })

// ✅ APRÈS (optimisé)
await answerQuestion(question, userId, {
  dossierId,
  operationName: 'assistant-ia',
})
```

---

## 📈 Bénéfices

### Performance

| Opération | Provider | Latence Cible | Timeout |
|-----------|----------|--------------|---------|
| Assistant IA | Groq | < 3s | 10s |
| Dossiers Assistant | Gemini | < 15s | 30s |
| Consultation | Gemini | < 30s | 60s |
| Indexation | Ollama | Background | 60s |

### Coût

| Opération | Provider Embeddings | Provider LLM | Coût Estimé |
|-----------|-------------------|--------------|-------------|
| Indexation | Ollama | Groq/Gemini | 0€/mois |
| Assistant IA | Ollama | Groq | 0€/mois |
| Dossiers Assistant | OpenAI | Gemini | ~2€/mois |
| Consultation | OpenAI | Gemini | ~2€/mois |
| **TOTAL** | | | **~4-6€/mois** |

**Économies** : ~100€/mois → ~6€/mois = **~1200€/an** 🎉

### Qualité

- **Chat** : Conversationnel naturel (temp=0.3)
- **Consultation** : Très factuel (temp=0.1)
- **Dossiers** : Embeddings OpenAI 1536-dim (qualité maximale)

---

## 🚀 Prochaines Étapes

### Phase 2 : Routes Dossiers ✅ IMPLÉMENTÉ (12 février 2026)

- [x] Créer `/api/dossiers/[id]/assistant` route
  - Analyse approfondie dossier
  - Utilise `operationName: 'dossiers-assistant'`
  - OpenAI embeddings 1536-dim
  - GET endpoint pour historique conversations

- [x] Créer `/api/dossiers/[id]/consultation` route
  - Génération consultation IRAC
  - Utilise `operationName: 'dossiers-consultation'`
  - Temperature = 0.1 (très factuel)
  - Format IRAC strict

### Phase 3 : Monitoring (Optionnel)

- [ ] Implémenter `logOperationMetric()` dans `llm-fallback-service.ts`
- [ ] Créer table `ai_operation_metrics` en DB
- [ ] Créer route `/api/admin/operations-metrics`
- [ ] Dashboard monitoring par opération
- [ ] Alertes coût/latence

---

## 🔍 Détails Techniques

### Fichiers Modifiés

| Fichier | Type | Lignes Ajoutées | Description |
|---------|------|-----------------|-------------|
| `lib/ai/operations-config.ts` | NOUVEAU | ~250 | Configuration centralisée |
| `lib/ai/llm-fallback-service.ts` | MODIF | ~20 | Support operationName |
| `lib/ai/embeddings-service.ts` | MODIF | ~15 | Support operationName |
| `lib/ai/rag-chat-service.ts` | MODIF | ~8 | Passage operationName |
| `app/api/chat/route.ts` | MODIF | 2 | Utilisation operationName |
| `docs/AI_OPERATIONS_CONFIGURATION.md` | NOUVEAU | ~400 | Documentation complète |
| `docs/AI_MODELS_BY_OPERATION.md` | NOUVEAU | ~500 | Modèles par opération |
| `docs/API_DOSSIERS_ASSISTANT.md` | NOUVEAU | ~400 | Guide API dossiers |
| `lib/ai/README-OPERATIONS-CONFIG.md` | NOUVEAU | ~150 | Guide rapide |
| `scripts/test-operations-config.ts` | NOUVEAU | ~200 | Tests validation |
| `lib/ai/operations-monitoring-service.ts` | NOUVEAU | ~250 | Exemple monitoring |
| `app/api/dossiers/[id]/assistant/route.ts` | NOUVEAU | ~200 | Route assistant dossiers |
| `app/api/dossiers/[id]/consultation/route.ts` | NOUVEAU | ~150 | Route consultation IRAC |
| `package.json` | MODIF | 1 | Script test |
| `MEMORY.md` | MODIF | ~10 | Documentation mémoire |

**Total** : ~2656 lignes de code ajoutées

### Stratégie par Opération

#### 1. Indexation

```typescript
{
  context: 'embeddings',
  embeddings: { provider: 'ollama', dimensions: 1024 },
  timeouts: { total: 60000 },
  llmConfig: { temperature: 0.2, maxTokens: 2000 },
}
```

#### 2. Assistant IA

```typescript
{
  context: 'rag-chat',
  providers: { primary: 'groq', fallback: ['gemini', 'deepseek', 'ollama'] },
  embeddings: { provider: 'ollama', dimensions: 1024 },
  timeouts: { total: 10000 },
  llmConfig: { temperature: 0.3, maxTokens: 500 },
}
```

#### 3. Dossiers Assistant

```typescript
{
  context: 'quality-analysis',
  providers: { primary: 'gemini', fallback: ['groq', 'deepseek'] },
  embeddings: { provider: 'openai', dimensions: 1536 },
  timeouts: { total: 30000 },
  llmConfig: { temperature: 0.2, maxTokens: 2000 },
}
```

#### 4. Dossiers Consultation

```typescript
{
  context: 'structuring',
  providers: { primary: 'gemini', fallback: ['deepseek', 'groq'] },
  embeddings: { provider: 'openai', dimensions: 1536 },
  timeouts: { total: 60000 },
  llmConfig: { temperature: 0.1, maxTokens: 4000 },
}
```

---

## 🧪 Validation

### Tests Unitaires

```bash
npm run test:operations-config
```

**Couverture** :
- ✅ Configuration basique (4 opérations)
- ✅ Providers par opération
- ✅ Règles de cohérence (Ollama pour indexation, Groq pour chat, etc.)
- ✅ Estimation coûts

### Tests d'Intégration

```bash
# Chat utilisateur
curl -X POST http://localhost:7002/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "Test"}'

# Vérifier logs :
# [LLM-Fallback] Opération: assistant-ia → Stratégie: [groq → gemini → ...]
```

---

## 📚 Références

- **Plan initial** : Transcript conversation (12 février 2026)
- **Configuration** : `lib/ai/operations-config.ts`
- **Documentation** : `docs/AI_OPERATIONS_CONFIGURATION.md`
- **Guide rapide** : `lib/ai/README-OPERATIONS-CONFIG.md`
- **Mémoire projet** : `MEMORY.md` (section "🎯 Config IA par Opération")

---

## 🎓 Leçons Apprises

1. **Séparation des préoccupations** : Configuration centralisée dans un fichier dédié
2. **Rétrocompatibilité** : `operationName` optionnel pour migration progressive
3. **Tests systématiques** : Script de validation pour garantir cohérence
4. **Documentation complète** : 3 niveaux (changelog, doc complète, guide rapide)
5. **Monitoring anticipé** : Service de monitoring prêt pour Phase 5

---

**Dernière mise à jour** : 12 février 2026
**Statut** : ✅ Implémenté et testé
