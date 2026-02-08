# Skill: Réindexation Production

Relance l'indexation des documents en production pour générer les embeddings.

## Arguments

| Argument | Description |
|----------|-------------|
| (aucun) | Lancer l'indexation web crawler |
| `--web` | Indexer uniquement les sources web |
| `--kb` | Indexer uniquement la knowledge base |
| `--status` | Afficher l'état de l'indexation |
| `--logs` | Voir les logs du dernier crawl |

## Instructions (mode par défaut)

### Lancer l'indexation complète

```bash
echo "=== Lancement indexation en production ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'REINDEX_SCRIPT'

echo "Déclenchement du web crawler..."
RESPONSE=$(curl -s -X GET "http://localhost:3000/api/cron/web-crawler")
echo "$RESPONSE" | head -20

echo ""
echo "Indexation lancée en arrière-plan."
echo "Utilisez /reindex-prod --status pour suivre la progression."
REINDEX_SCRIPT
```

## Commandes par argument

### --web : Indexer sources web uniquement

```bash
echo "=== Indexation sources web ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'SCRIPT'
curl -s -X GET "http://localhost:3000/api/cron/web-crawler" | head -20
SCRIPT
```

### --kb : Indexer knowledge base uniquement

```bash
echo "=== Indexation knowledge base ==="
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'SCRIPT'
curl -s -X POST "http://localhost:3000/api/knowledge/reindex" | head -20
SCRIPT
```

### --status : État de l'indexation

```bash
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'STATUS_SCRIPT'
echo "=== État indexation en production ==="
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet << EOSQL

\echo '--- Web Sources ---'
SELECT
  name,
  status,
  pages_count,
  last_crawled_at::timestamp(0) as last_crawl,
  CASE
    WHEN status = 'crawling' THEN 'En cours...'
    WHEN last_crawled_at > NOW() - INTERVAL '1 hour' THEN 'Récent'
    ELSE 'OK'
  END as etat
FROM web_sources
ORDER BY last_crawled_at DESC NULLS LAST;

\echo ''
\echo '--- Chunks générés ---'
SELECT
  'knowledge_base_chunks' as table_name,
  COUNT(*) as total_chunks,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding
FROM knowledge_base_chunks;

\echo ''
\echo '--- Documents par source ---'
SELECT
  COALESCE(source_type, 'unknown') as source,
  COUNT(*) as docs,
  COUNT(CASE WHEN indexed THEN 1 END) as indexed
FROM knowledge_base
GROUP BY source_type
ORDER BY docs DESC;

EOSQL
STATUS_SCRIPT
```

### --logs : Logs du dernier crawl

```bash
sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" << 'LOGS_SCRIPT'
echo "=== Logs récents du container Next.js ==="
docker logs moncabinet-nextjs --tail 100 2>&1 | grep -E "(crawl|index|embed|chunk)" | tail -50
LOGS_SCRIPT
```

## Workflow recommandé

1. Synchroniser les données: `/sync-web-sources`
2. Lancer l'indexation: `/reindex-prod`
3. Vérifier la progression: `/reindex-prod --status`
4. Voir les logs si besoin: `/reindex-prod --logs`

## Notes

- L'indexation tourne en arrière-plan
- Les embeddings sont générés progressivement
- Vérifier avec `--status` après quelques minutes
