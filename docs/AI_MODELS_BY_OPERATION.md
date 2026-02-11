# Modèles IA par Type d'Opération

**Date** : 12 février 2026
**Version** : 1.0

---

## 📊 Vue d'Ensemble

Ce document détaille **exactement quels modèles LLM et embeddings** sont utilisés pour chaque opération dans Qadhya.

---

## 🎯 Récapitulatif par Opération

### 1️⃣ Indexation (Background Processing)

**Route** : `/api/admin/index-kb` (cron)
**OpérationName** : `indexation`

| Composant | Provider | Modèle | Dimensions | Coût |
|-----------|----------|--------|------------|------|
| **Embeddings** | Ollama | `qwen3-embedding:0.6b` | 1024 | 0€ |
| **LLM Classification** | Ollama | `qwen2.5:3b` | - | 0€ |
| **Fallback LLM** | Groq → Gemini → DeepSeek | Voir stratégie défaut | - | 0€ (si échec Ollama) |

**Stratégie** :
- Ollama embeddings **exclusif** (économie maximale, volume élevé)
- Ollama LLM pour classification (gratuit, illimité)
- Fallback cloud uniquement si Ollama down

**Timeout** : 60s total
**Temperature** : 0.2 (déterministe pour classification)

---

### 2️⃣ Assistant IA (Chat Temps Réel)

**Route** : `/api/chat`
**OpérationName** : `assistant-ia`

| Composant | Provider | Modèle | Dimensions | Latence | Coût |
|-----------|----------|--------|------------|---------|------|
| **Embeddings** | Ollama | `qwen3-embedding:0.6b` | 1024 | ~3-5s | 0€ |
| **LLM Primaire** | Groq | `llama-3.3-70b-versatile` | - | **292ms** | 0€ |
| **LLM Fallback 1** | Gemini | `gemini-2.0-flash-exp` | - | ~1.5s | 0€ |
| **LLM Fallback 2** | DeepSeek | `deepseek-chat` | - | ~1.8s | ~$0.14/1M tokens |
| **LLM Fallback 3** | Ollama | `qwen2.5:3b` | - | ~15-20s | 0€ |

**Stratégie LLM** :
1. **Groq llama-3.3-70b** (ultra-rapide, gratuit) ⚡
2. Si échec/rate limit → **Gemini 2.0 Flash** (rapide, contexte 1M tokens)
3. Si échec → **DeepSeek** (économique, qualité correcte)
4. Si échec → **Ollama qwen2.5:3b** (local, lent mais gratuit)

**Timeout** : 10s total
**Temperature** : 0.3 (conversationnel naturel)
**Format** : Chat conversationnel

**Coût estimé** : 0€/mois (Groq gratuit pour 95%+ des requêtes)

---

### 3️⃣ Assistant Dossiers (Analyse Approfondie)

**Route** : `/api/dossiers/[id]/assistant`
**OpérationName** : `dossiers-assistant`

| Composant | Provider | Modèle | Dimensions | Latence | Coût |
|-----------|----------|--------|------------|---------|------|
| **Embeddings** | OpenAI | `text-embedding-3-small` | **1536** | ~0.5-1s | ~$0.02/1M tokens |
| **Embeddings Fallback** | Ollama | `qwen3-embedding:0.6b` | 1024 | ~3-5s | 0€ |
| **LLM Primaire** | Gemini | `gemini-2.0-flash-exp` | - | ~1.5-3s | 0€ |
| **LLM Fallback 1** | Groq | `llama-3.3-70b-versatile` | - | ~292ms | 0€ |
| **LLM Fallback 2** | DeepSeek | `deepseek-chat` | - | ~1.8s | ~$0.14/1M tokens |

**Stratégie LLM** :
1. **Gemini 2.0 Flash** (contexte 1M tokens, qualité + vitesse)
2. Si échec → **Groq llama-3.3-70b** (ultra-rapide)
3. Si échec → **DeepSeek** (économique)

**Stratégie Embeddings** :
- **OpenAI text-embedding-3-small** (1536-dim) pour qualité maximale
- Fallback Ollama si OpenAI indisponible

**Timeout** : 30s total
**Temperature** : 0.2 (précis et factuel)
**Format** : Chat conversationnel mais approfondi

**Coût estimé** : ~1-2€/mois (OpenAI embeddings uniquement, volume faible)

---

### 4️⃣ Consultation Juridique Formelle (IRAC)

**Route** : `/api/dossiers/[id]/consultation`
**OpérationName** : `dossiers-consultation`

| Composant | Provider | Modèle | Dimensions | Latence | Coût |
|-----------|----------|--------|------------|---------|------|
| **Embeddings** | OpenAI | `text-embedding-3-small` | **1536** | ~0.5-1s | ~$0.02/1M tokens |
| **Embeddings Fallback** | Ollama | `qwen3-embedding:0.6b` | 1024 | ~3-5s | 0€ |
| **LLM Primaire** | Gemini | `gemini-2.0-flash-exp` | - | ~3-10s | 0€ |
| **LLM Fallback 1** | DeepSeek | `deepseek-chat` | - | ~1.8s | ~$0.14/1M tokens |
| **LLM Fallback 2** | Groq | `llama-3.3-70b-versatile` | - | ~292ms | 0€ |

**Stratégie LLM** :
1. **Gemini 2.0 Flash** (contexte 1M tokens, raisonnement approfondi)
2. Si échec → **DeepSeek** (économique, bonne qualité)
3. Si échec → **Groq llama-3.3-70b** (rapide)

**Stratégie Embeddings** :
- **OpenAI text-embedding-3-small** (1536-dim) pour qualité maximale

**Timeout** : 60s total (consultation détaillée)
**Temperature** : 0.1 (très factuel et précis)
**Format** : **IRAC** (Issue, Rule, Application, Conclusion)

**Prompt Type** : `consultation` (voir `lib/ai/legal-reasoning-prompts.ts`)

**Coût estimé** : ~1-2€/mois (OpenAI embeddings uniquement, volume très faible)

---

## 📈 Tableau Récapitulatif Global

| Opération | LLM Principal | LLM Modèle | Embeddings Provider | Embeddings Modèle | Dim | Timeout | Temp | Coût/mois |
|-----------|--------------|------------|-------------------|------------------|-----|---------|------|-----------|
| **Indexation** | Ollama | qwen2.5:3b | Ollama | qwen3-embedding:0.6b | 1024 | 60s | 0.2 | 0€ |
| **Assistant IA** | Groq | llama-3.3-70b | Ollama | qwen3-embedding:0.6b | 1024 | 10s | 0.3 | 0€ |
| **Dossiers Assistant** | Gemini | gemini-2.0-flash | OpenAI | text-embedding-3-small | 1536 | 30s | 0.2 | ~2€ |
| **Consultation** | Gemini | gemini-2.0-flash | OpenAI | text-embedding-3-small | 1536 | 60s | 0.1 | ~2€ |

**Total estimé** : **~4-6€/mois** (vs ~100€/mois avant) = **-95% économies** 🎉

---

## 🔧 Configuration Source

Tous ces modèles sont configurés dans **`lib/ai/operations-config.ts`**.

Pour changer un modèle, modifier ce fichier puis tester avec :
```bash
npm run test:operations-config
```

---

## 🎯 Pourquoi ces Choix ?

### Indexation
- **Volume élevé** (milliers d'embeddings/jour) → Ollama gratuit uniquement
- **Coût critique** → 0€ obligatoire

### Assistant IA
- **Latence critique** (< 3s attendu) → Groq ultra-rapide (292ms)
- **Volume élevé** → Gratuit requis (Groq tier gratuit)
- **Embeddings** → Ollama (volume élevé, cache)

### Dossiers Assistant
- **Qualité critique** → OpenAI embeddings 1536-dim
- **Contexte étendu** → Gemini 1M tokens
- **Volume faible** (~10-50 analyses/mois) → Coût OpenAI acceptable

### Consultation
- **Précision maximale** → Temperature 0.1 + OpenAI embeddings
- **Format structuré** → Gemini excellent pour IRAC
- **Volume très faible** (~5-20 consultations/mois) → Coût acceptable

---

## 📊 Détails Techniques par Provider

### Groq (llama-3.3-70b-versatile)
- **Vitesse** : 292ms moyenne (ultra-rapide)
- **Contexte** : 8K tokens
- **Coût** : Gratuit (tier gratuit généreux)
- **Qualité** : Excellente pour chat conversationnel
- **Usage** : Assistant IA (95%+ des requêtes)

### Gemini (gemini-2.0-flash-exp)
- **Vitesse** : 1.5-3s (rapide)
- **Contexte** : 1M tokens (énorme)
- **Coût** : Gratuit (tier gratuit)
- **Qualité** : Excellente pour raisonnement
- **Usage** : Dossiers + Consultations (primaire)

### DeepSeek (deepseek-chat)
- **Vitesse** : 1.8s (correct)
- **Contexte** : 128K tokens
- **Coût** : ~$0.14/1M tokens (économique)
- **Qualité** : Bonne
- **Usage** : Fallback dossiers/consultations

### Ollama (qwen2.5:3b + qwen3-embedding:0.6b)
- **Vitesse** : 15-20s chat, 3-5s embeddings (lent, CPU-only)
- **Contexte** : 128K tokens chat
- **Coût** : 0€ (local)
- **Qualité** : Correcte pour classification, embeddings
- **Usage** : Indexation (primaire) + fallback chat

### OpenAI (text-embedding-3-small)
- **Vitesse** : 0.5-1s (très rapide)
- **Dimensions** : 1536 (vs 1024 Ollama)
- **Coût** : ~$0.02/1M tokens
- **Qualité** : Excellente (meilleure que Ollama)
- **Usage** : Dossiers + Consultations uniquement

---

## 🔍 Comment Vérifier le Modèle Utilisé ?

### Dans les Logs

```bash
# Chat utilisateur
[LLM-Fallback] Opération: assistant-ia → Stratégie: [groq → gemini → deepseek → ollama]
[LLM-Fallback] ✓ groq llama-3.3-70b-versatile (292ms)

# Dossiers
[LLM-Fallback] Opération: dossiers-assistant → Stratégie: [gemini → groq → deepseek]
[Embeddings] OpenAI text-embedding-3-small (1536-dim)
[LLM-Fallback] ✓ gemini gemini-2.0-flash-exp (1.8s)
```

### Dans la Réponse API

```json
{
  "answer": "...",
  "model": "groq/llama-3.3-70b-versatile",
  "tokensUsed": { "input": 120, "output": 350, "total": 470 }
}
```

---

## 📚 Références

- **Configuration** : `lib/ai/operations-config.ts`
- **LLM Service** : `lib/ai/llm-fallback-service.ts`
- **Embeddings Service** : `lib/ai/embeddings-service.ts`
- **Config AI globale** : `lib/ai/config.ts`
- **Prompts IRAC** : `lib/ai/legal-reasoning-prompts.ts`

---

**Dernière mise à jour** : 12 février 2026
