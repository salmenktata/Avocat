# Troubleshooting RAG - Qadhya

## Vue d'ensemble du Système RAG

Le système RAG (Retrieval-Augmented Generation) de Qadhya combine :
- **Recherche vectorielle** : Embeddings 1024-dim (Ollama qwen3-embedding)
- **Recherche BM25** : Indexation plein texte PostgreSQL tsvector
- **Re-ranking neural** : Cross-encoder ms-marco-MiniLM-L-6-v2
- **LLM** : Groq llama-3.3-70b (primaire) → Gemini → DeepSeek → Ollama (cascade)

---

## Diagnostic Rapide

### Test santé global

```bash
# Health check production
curl https://qadhya.tn/api/health | jq '.rag'

# Résultat attendu
{
  "enabled": true,
  "semanticSearchEnabled": true,
  "status": "ok",
  "kbDocsIndexed": "8987",
  "kbChunksAvailable": "25249"
}
```

### Symptômes → Solutions rapides

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| "لم أجد وثائق ذات صلة" (arabe) | OLLAMA_ENABLED=false | Vérifier `.env`, relancer container |
| "Je n'ai trouvé aucun document" | RAG_ENABLED=false | Activer RAG_ENABLED=true |
| Réponses très lentes (>30s) | Ollama model froid | Pre-warm : `curl ollama/api/generate` |
| Réponses sans sources | Seuil trop élevé | Baisser RAG_THRESHOLD_KB |
| 0 résultats pour tout | Chunks non indexés | Vérifier `chunk_count > 0` |
| Erreur 429 LLM | Rate limit Groq | Cascade auto vers Gemini (vérifier GOOGLE_API_KEY) |

---

## Problème 1 : Assistant Répond "Aucun Document Trouvé"

### Symptômes
- L'assistant répond "لم أجد وثائق ذات صلة" ou "Je n'ai trouvé aucun document"
- Les réponses ne citent aucune source KB
- Log : `[RAG] isSemanticSearchEnabled() = false`

### Causes et Solutions

**Cause A : OLLAMA_ENABLED=false**

```bash
# Diagnostic VPS
docker exec qadhya-nextjs env | grep -E "(OLLAMA|RAG)_ENABLED"

# Si OLLAMA_ENABLED=false ou absent :
ssh root@84.247.165.187
nano /opt/qadhya/.env.production.local
# Ajouter/corriger : OLLAMA_ENABLED=true

# Relancer container
cd /opt/qadhya
docker compose up -d --no-deps nextjs

# Vérifier
docker exec qadhya-nextjs env | grep OLLAMA_ENABLED
# Attendu : OLLAMA_ENABLED=true
```

**Cause B : RAG_ENABLED=false**

```bash
docker exec qadhya-nextjs env | grep RAG_ENABLED
# Doit retourner : RAG_ENABLED=true
```

**Cause C : Embeddings dimension mismatch**

```bash
# Vérifier dimensions KB
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c "
  SELECT
    vector_dims(embedding) as dims,
    COUNT(*) as chunks
  FROM knowledge_base_chunks
  WHERE embedding IS NOT NULL
  GROUP BY 1;
"
# Attendu : dims=1024 (Ollama) ou dims=1536 (OpenAI)
```

Si mix de dimensions, il faut soit :
1. Réindexer tous les chunks avec le même modèle
2. Utiliser `search_knowledge_base_flexible()` qui supporte les deux

---

## Problème 2 : Résultats RAG Non Pertinents

### Symptômes
- L'assistant cite des documents sans rapport avec la question
- Score de similarité faible (< 0.40 affiché en debug)
- Hit@5 < 60% au benchmark

### Diagnostic

```bash
# Test recherche directe avec une requête connue
docker exec qadhya-nextjs node -e "
const { searchKnowledgeBase } = require('./.next/server/chunks/lib/ai/rag-service.js')
searchKnowledgeBase({
  query: 'légitime défense pénal',
  limit: 5,
  threshold: 0.30
}).then(r => console.log(JSON.stringify(r, null, 2)))
"
```

### Solutions

**Solution A : Ajuster les seuils**

Dans `/opt/qadhya/.env.production.local` :
```bash
# Seuils actuels (après optimisations Feb 2026)
RAG_THRESHOLD_KB=0.30          # Global
RAG_THRESHOLD_ARABIC=0.30      # Arabe (scores naturellement bas)
RAG_THRESHOLD_SEMANTIC=0.50    # Recherche sémantique standalone
RAG_MAX_RESULTS=15             # Résultats avant re-ranking
```

**Solution B : Activer recherche hybride**

La recherche hybride (vectoriel + BM25) améliore la pertinence.
Vérifier que la colonne `content_tsvector` existe :
```sql
SELECT COUNT(*) FROM knowledge_base_chunks
WHERE content_tsvector IS NOT NULL;
-- Attendu : 25,249 (tous les chunks)
```

Si 0 résultats :
```sql
-- Peupler tsvector (peut prendre 5-10min)
UPDATE knowledge_base_chunks
SET content_tsvector = to_tsvector('simple', content)
WHERE content_tsvector IS NULL;
```

**Solution C : Boost domaine sémantique**

Les queries courtes bénéficient de l'expansion sémantique.
Vérifier que `QUERY_EXPANSION_ENABLED=true` dans `.env`.

---

## Problème 3 : Latence RAG Élevée (> 10s)

### Causes et Solutions

**Cause A : Modèle Ollama froid**

```bash
# Pré-charger le modèle embedding
curl -X POST http://84.247.165.187:11434/api/embeddings \
  -d '{"model":"qwen3-embedding:0.6b","prompt":"test"}'

# Pré-charger le modèle chat
curl -X POST http://84.247.165.187:11434/api/generate \
  -d '{"model":"qwen2.5:3b","prompt":"test","keep_alive":"24h"}'
```

**Cause B : Pas de cache Redis**

```bash
# Vérifier Redis
docker exec qadhya-redis redis-cli ping
# Attendu : PONG

# Vérifier cache recherches
docker exec qadhya-redis redis-cli keys "search:*" | wc -l
```

Le cache est activé via `SEARCH_CACHE_THRESHOLD=0.75` dans `.env`.

**Cause C : Cross-encoder lent**

Le re-ranking neural ajoute 1-3s mais améliore la qualité.
Pour désactiver temporairement (debug seulement) :
```bash
CROSS_ENCODER_ENABLED=false
```

**Cause D : Index vectoriel non créé**

```sql
-- Vérifier index pgvector
\di knowledge_base_chunks

-- Doit contenir :
-- idx_kb_chunks_embedding (ivfflat, cosine)
-- idx_kb_chunks_tsvector_gin (gin, tsvector)

-- Si manquant, créer :
CREATE INDEX idx_kb_chunks_embedding
ON knowledge_base_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

## Problème 4 : Embeddings Mismatch (Régression)

### Symptômes
- Les embeddings existants utilisent Ollama (1024-dim)
- Les nouvelles requêtes utilisent OpenAI (1536-dim)
- Résultat : 0 matchs ou scores aberrants

### Détection

```bash
# Health check enrichi
curl https://qadhya.tn/api/health | jq '.rag'

# Symptôme : status = "misconfigured"
# { "status": "misconfigured", "reason": "dimension mismatch" }
```

```sql
-- Vérifier cohérence dimensions
SELECT
  CASE
    WHEN vector_dims(embedding) = 1024 THEN 'ollama'
    WHEN vector_dims(embedding) = 1536 THEN 'openai'
    ELSE 'unknown-' || vector_dims(embedding)::text
  END as provider,
  COUNT(*) as chunks
FROM knowledge_base_chunks
WHERE embedding IS NOT NULL
GROUP BY 1;
```

### Solution Immédiate

**Option 1 : Utiliser search_knowledge_base_flexible** (recommandé)
La fonction supporte les deux dimensions, aucune migration requise.
S'assurer que `RAG_SEARCH_FUNCTION=flexible` dans `.env`.

**Option 2 : Réindexer avec Ollama** (si tout était en OpenAI par erreur)
```bash
# Script réindexation Ollama
docker exec qadhya-nextjs npx tsx scripts/reindex-kb-ollama.ts \
  --limit=1000 --dry-run
```

**Option 3 : Rollback OLLAMA_ENABLED**
Si un déploiement a accidentellement désactivé Ollama :
```bash
# Sur VPS
docker exec qadhya-nextjs env | grep OLLAMA_ENABLED
# Si false → corriger .env → redémarrer
```

---

## Problème 5 : Réponses LLM de Mauvaise Qualité

### Symptômes
- Réponses hors sujet malgré des sources pertinentes
- Hallucinations (affirmations non présentes dans les sources)
- Réponses trop courtes ou incomplètes

### Solutions

**Solution A : Vérifier le contexte transmis**

```bash
# Activer logs RAG détaillés
RAG_DEBUG_LOGS=true
```

Chercher dans les logs :
```
[RAG] Context tokens: X / 6000
[RAG] Sources passed to LLM: X
```

Si `context tokens = 0` : problème d'embeddings (voir Problème 1)
Si `sources passed = 0` : seuil trop élevé (voir Problème 2)

**Solution B : Augmenter le contexte**

```bash
RAG_MAX_CONTEXT_TOKENS=6000  # Défaut: 6000 (max recommandé)
RAG_MAX_RESULTS=15           # Résultats avant re-ranking
```

**Solution C : Vérifier le prompt système**

Le prompt IRAC est dans `lib/ai/legal-reasoning-prompts.ts`.
Vérifier que `context` est bien interpolé dans le prompt.

**Solution D : Vérifier la cascade LLM**

```bash
# Tester chaque provider manuellement
curl -X POST https://qadhya.tn/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"ما هو الدفاع الشرعي؟","debug":true}'

# Vérifier header de réponse : X-LLM-Provider
```

Si Groq rate-limité → cascade auto vers Gemini. Vérifier `GOOGLE_API_KEY` actif.

---

## Problème 6 : Benchmark RAG (Évaluation Qualité)

### Lancer le Benchmark

```bash
# 20 questions juridiques prédéfinies
curl -X POST https://qadhya.tn/api/admin/rag-eval \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"mode": "benchmark"}'

# Résultats en temps réel (streaming)
```

### Résultats Attendus (Feb 2026)

```
Mode: benchmark (20 questions)
Hit@5: 90% (18/20 questions ≥ 1 source pertinente)
Avg Top Score: 0.598
Processing time: ~45s
```

### Questions Échouant Régulièrement

**1. شيك بدون رصيد** (chèque sans provision arabe)
- Cause : Peu de contenu sur ce sujet dans la KB
- Solution : Ajouter des sources jurisprudentielles sur les chèques

**2. Légitime défense FR**
- Cause : Quasi-absence de contenu pénal français dans la KB
- Solution : Ajouter des sources juridiques françaises

---

## Monitoring Continu

### Alertes Automatiques

Le système envoie des alertes email si :
- `rag.status = "misconfigured"` dans `/api/health`
- 0 docs indexés détectés (voir `kbChunksAvailable`)
- Taux succès queries < 50% sur 1h

### Cron de Vérification

```bash
# Vérification quotidienne à 8h
crontab -l | grep check-rag

# Logs
tail -f /var/log/qadhya/rag-config-check.log
```

### Dashboard Temps Réel

URL : `https://qadhya.tn/super-admin/monitoring?tab=kb-quality`

Métriques clés à surveiller :
- Coverage KB (% docs avec chunks) : Objectif > 90%
- Score moyen : Objectif > 75
- Chunks disponibles : Objectif > 20,000

---

## Variables d'Environnement RAG

### Obligatoires

```bash
RAG_ENABLED=true                    # Active le système RAG
OLLAMA_ENABLED=true                 # Active embeddings Ollama (CRITIQUE)
OLLAMA_BASE_URL=http://host.docker.internal:11434  # URL Ollama depuis container
```

### Optionnelles (avec défauts)

```bash
RAG_THRESHOLD_KB=0.30              # Seuil similarité global
RAG_THRESHOLD_ARABIC=0.30          # Seuil spécifique arabe
RAG_MAX_RESULTS=15                 # Résultats avant re-ranking
RAG_MAX_CONTEXT_TOKENS=6000        # Tokens contexte max pour LLM
SEARCH_CACHE_THRESHOLD=0.75        # Cache hit threshold
CROSS_ENCODER_ENABLED=true         # Re-ranking neural
QUERY_EXPANSION_ENABLED=true       # Expansion requêtes courtes
```

### Variables LLM (Cascade Fallback)

```bash
GROQ_API_KEY=gsk_...               # Primaire (292ms, gratuit)
GOOGLE_API_KEY=AIza...             # Fallback 1 (1.5s, gratuit)
DEEPSEEK_API_KEY=sk-...            # Fallback 2 (1.8s, ~$1/mois)
# Ollama = Fallback final (18s, 0€, local)
```

---

## Scripts de Test

```bash
# Test recherche KB local
npx tsx scripts/test-kb-search-live.ts

# Test complet E2E RAG
npx tsx scripts/test-rag-complete-e2e.ts

# Benchmark 20 questions
npx tsx scripts/benchmark-rag.ts

# Test configuration RAG
bash scripts/validate-rag-config.sh .env.production.local
```

---

## Procédure de Rollback RAG

Si une modification dégrade les résultats :

```bash
# 1. Identifier le commit problématique
git log --oneline | head -10

# 2. Rollback code
git revert HEAD
git push origin main
# Déploiement auto ~3min

# 3. Rollback DB (si migrations appliquées)
# Voir docs/DEPLOYMENT_ROLLBACK_TROUBLESHOOTING.md

# 4. Vérifier récupération
curl https://qadhya.tn/api/health | jq '.rag.status'
# Attendu: "ok"
```
