# API de Réindexation OpenAI

Documentation de l'API `/api/admin/reindex-kb-openai` pour réindexer la Knowledge Base avec OpenAI embeddings.

## Vue d'ensemble

Cette API permet de réindexer progressivement les chunks de la Knowledge Base avec des embeddings OpenAI (text-embedding-3-small, 1536 dimensions) au lieu des embeddings Ollama (1024 dimensions).

### Avantages OpenAI vs Ollama

| Aspect | Ollama (qwen3) | OpenAI (text-embedding-3-small) |
|--------|----------------|----------------------------------|
| **Qualité** | Bonne (scores ~60-70%) | Excellente (scores ~80-90%) |
| **Vitesse** | Lent (~500ms/chunk) | Rapide (~50ms/chunk) |
| **Coût** | Gratuit (0€) | ~$0.02 per 1K chunks |
| **Dimensions** | 1024 | 1536 (plus précis) |
| **Multilingue** | Bon (AR/FR) | Excellent (100+ langues) |

## Endpoints

### GET /api/admin/reindex-kb-openai

Récupère le statut de la réindexation.

**Headers requis:**
```bash
Authorization: Bearer ${CRON_SECRET}
```

**Réponse:**
```json
{
  "total": 13996,
  "embeddings": {
    "ollama": {
      "indexed": 13996,
      "percentage": 100
    },
    "openai": {
      "indexed": 0,
      "remaining": 13996,
      "percentage": 0
    }
  },
  "tsvector": {
    "indexed": 13996,
    "percentage": 100
  },
  "estimatedCost": {
    "perBatch": "$0.001",
    "remaining": "$0.28",
    "total": "$0.28"
  }
}
```

### POST /api/admin/reindex-kb-openai

Lance un batch de réindexation.

**Headers requis:**
```bash
Authorization: Bearer ${CRON_SECRET}
```

**Query Parameters:**
- `batch_size` (int, défaut: 50) - Nombre de chunks à traiter par appel
- `category` (string, optionnel) - Catégorie spécifique à réindexer
- `skip_indexed` (boolean, défaut: true) - Ignorer les chunks déjà indexés

**Exemples:**

```bash
# Batch de 50 chunks (défaut)
curl -X POST "https://qadhya.tn/api/admin/reindex-kb-openai" \
  -H "Authorization: Bearer $CRON_SECRET"

# Batch de 100 chunks
curl -X POST "https://qadhya.tn/api/admin/reindex-kb-openai?batch_size=100" \
  -H "Authorization: Bearer $CRON_SECRET"

# Réindexer uniquement la catégorie "jurisprudence"
curl -X POST "https://qadhya.tn/api/admin/reindex-kb-openai?category=jurisprudence" \
  -H "Authorization: Bearer $CRON_SECRET"

# Réindexer TOUS les chunks (même déjà indexés)
curl -X POST "https://qadhya.tn/api/admin/reindex-kb-openai?skip_indexed=false" \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Réponse:**
```json
{
  "success": true,
  "batch": {
    "indexed": 50,
    "errors": 0,
    "errorDetails": []
  },
  "progress": {
    "totalChunks": 13996,
    "indexed": 50,
    "remaining": 13946,
    "percentage": 0
  },
  "next": {
    "message": "Relancer pour continuer la réindexation",
    "endpoint": "https://qadhya.tn/api/admin/reindex-kb-openai"
  }
}
```

## Script Automatisé

Un script shell est fourni pour automatiser la réindexation complète.

### Usage

```bash
# Définir le CRON_SECRET
export CRON_SECRET="votre_secret_ici"

# Lancer la réindexation complète
bash scripts/run-reindex-openai.sh

# Avec options personnalisées
API_URL="https://qadhya.tn/api/admin/reindex-kb-openai" \
BATCH_SIZE=100 \
SLEEP_BETWEEN_BATCHES=1 \
bash scripts/run-reindex-openai.sh
```

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `API_URL` | URL de l'API | https://qadhya.tn/api/admin/reindex-kb-openai |
| `CRON_SECRET` | Secret d'authentification | (requis) |
| `BATCH_SIZE` | Chunks par batch | 50 |
| `SLEEP_BETWEEN_BATCHES` | Pause entre batches (secondes) | 2 |

## Déploiement en Production

### 1. Récupérer le CRON_SECRET

```bash
ssh root@84.247.165.187
cat /opt/moncabinet/.env.production.local | grep CRON_SECRET
```

### 2. Lancer la réindexation

**Option A: Script automatisé (recommandé)**

```bash
# Sur votre machine locale
export CRON_SECRET="..." # Copier depuis .env.production.local

bash scripts/run-reindex-openai.sh
```

**Option B: Manuel batch par batch**

```bash
# Vérifier le statut
curl "https://qadhya.tn/api/admin/reindex-kb-openai" \
  -H "Authorization: Bearer $CRON_SECRET" | jq

# Lancer un batch
curl -X POST "https://qadhya.tn/api/admin/reindex-kb-openai?batch_size=50" \
  -H "Authorization: Bearer $CRON_SECRET" | jq

# Relancer jusqu'à remaining = 0
```

**Option C: Cron job sur le VPS**

```bash
# Sur le VPS
cat > /opt/moncabinet/reindex-cron.sh << 'EOF'
#!/bin/bash
source /opt/moncabinet/.env.production.local
curl -X POST "https://qadhya.tn/api/admin/reindex-kb-openai?batch_size=50" \
  -H "Authorization: Bearer $CRON_SECRET" \
  >> /var/log/reindex-openai.log 2>&1
EOF

chmod +x /opt/moncabinet/reindex-cron.sh

# Ajouter au crontab (toutes les 5 minutes)
crontab -e
*/5 * * * * /opt/moncabinet/reindex-cron.sh
```

## Monitoring

### Vérifier la progression

```bash
# Statut complet
curl "https://qadhya.tn/api/admin/reindex-kb-openai" \
  -H "Authorization: Bearer $CRON_SECRET" | jq '.embeddings.openai'

# Directement en SQL
ssh root@84.247.165.187 "docker exec 275ce01791bf_qadhya-postgres psql -U moncabinet -d qadhya -c \"
SELECT
  COUNT(*) as total,
  COUNT(embedding_openai) FILTER (WHERE embedding_openai IS NOT NULL) as indexed,
  ROUND(100.0 * COUNT(embedding_openai) FILTER (WHERE embedding_openai IS NOT NULL) / COUNT(*), 1) as pct
FROM knowledge_base_chunks;
\""
```

### Logs

Les logs sont visibles dans les logs Docker du container Next.js :

```bash
# Sur le VPS
docker logs -f qadhya-nextjs | grep ReindexOpenAI
```

## Coûts

### Estimation

- **Modèle**: text-embedding-3-small
- **Prix**: $0.00002 per 1K tokens
- **Tokens moyens**: ~100 tokens/chunk
- **13,996 chunks**: ~1.4M tokens = **$0.028** (~3 cents)

### Par catégorie

| Catégorie | Chunks estimés | Coût |
|-----------|----------------|------|
| Jurisprudence | ~3,000 | $0.006 |
| Codes | ~2,000 | $0.004 |
| Legislation | ~4,000 | $0.008 |
| Doctrine | ~2,000 | $0.004 |
| Autres | ~3,000 | $0.006 |

## Dépannage

### Erreur "Unauthorized"

Vérifiez que le CRON_SECRET est correct :
```bash
echo $CRON_SECRET
```

### Erreur "Embedding invalide"

L'API utilise `operationName: 'dossiers-assistant'` qui est configuré pour utiliser OpenAI. Vérifiez que la clé API OpenAI est définie :

```bash
ssh root@84.247.165.187 "docker exec qadhya-nextjs env | grep OPENAI_API_KEY"
```

### Progression bloquée

Si la réindexation semble bloquée :

1. Vérifier les logs :
   ```bash
   docker logs qadhya-nextjs | grep ReindexOpenAI
   ```

2. Vérifier manuellement la base :
   ```sql
   SELECT COUNT(*) FROM knowledge_base_chunks WHERE embedding_openai IS NULL;
   ```

3. Relancer avec `skip_indexed=false` pour forcer la réindexation :
   ```bash
   curl -X POST "...?skip_indexed=false&batch_size=10"
   ```

## Performance

### Optimisation

- **Batch size**: 50-100 optimal (balance vitesse/mémoire)
- **Sleep**: 1-2s recommandé (éviter rate limiting)
- **Parallèle**: Ne PAS lancer plusieurs instances simultanément

### Temps estimés

| Chunks | Batch 50 | Batch 100 |
|--------|----------|-----------|
| 1,000 | ~2 min | ~1 min |
| 5,000 | ~10 min | ~5 min |
| 13,996 | ~28 min | ~14 min |

## Rollback

Pour revenir aux embeddings Ollama uniquement :

```sql
-- Supprimer les embeddings OpenAI
UPDATE knowledge_base_chunks SET embedding_openai = NULL;

-- Utiliser search_knowledge_base() au lieu de search_knowledge_base_flexible()
```

Ou configurer `operations-config.ts` pour utiliser Ollama.
