# Guide Manual Trigger des Crons

Guide utilisateur pour déclencher manuellement les tâches cron via le dashboard d'administration.

## 📊 Accès au Dashboard

1. **URL** : `https://qadhya.tn/super-admin/monitoring`
2. **Authentification** : Session admin requise (Next-Auth)
3. **Onglet** : Cliquer sur "Crons & Batches" (6ème onglet)

## 🎯 Fonctionnalités Disponibles

### 1. Vue d'ensemble des Crons

Le dashboard affiche pour chaque cron :

- **Nom** : Identifiant du cron
- **Description** : Fonction du cron
- **Dernière exécution** : Date et heure
- **Status** : completed, running, failed, cancelled
- **Durée** : Temps d'exécution en ms
- **Actions** : Bouton "Exécuter" pour trigger manuel

### 2. KPIs Temps Réel

Rafraîchissement automatique toutes les 30 secondes :

- **Exécutions 24h** : Nombre total d'exécutions dans les dernières 24h
- **En cours** : Nombre de crons actuellement en cours d'exécution
- **Échecs** : Nombre d'échecs dans les dernières 24h
- **Prochaine exécution** : Countdown jusqu'au prochain cron schedulé

### 3. Timeline 7 Jours

Graphique montrant l'historique des exécutions sur 7 jours avec :
- Code couleur par status (vert=completed, rouge=failed, gris=cancelled)
- Durée d'exécution pour chaque run
- Filtres par cron et par status

## 🚀 Déclencher un Cron Manuellement

### Procédure

1. **Naviguer** vers `/super-admin/monitoring?tab=crons`
2. **Localiser** le cron à exécuter dans la liste
3. **Vérifier** qu'aucune exécution n'est déjà "En cours" (status=running)
4. **Cliquer** sur le bouton "Exécuter" à droite de la ligne
5. **Confirmer** dans la popup (si activée)
6. **Attendre** 5-10 secondes que l'exécution démarre
7. **Rafraîchir** ou attendre l'auto-refresh (30s) pour voir le résultat

### Notification

Après avoir cliqué "Exécuter" :

```json
{
  "success": true,
  "cronName": "monitor-openai",
  "description": "Monitoring Budget OpenAI",
  "estimatedDuration": 5000,
  "message": "Cron execution started. Check table for results.",
  "note": "Execution is asynchronous. Refresh page in a few seconds."
}
```

### Vérification

**Option A - Dashboard** (recommandé)
- Attendre 30s pour auto-refresh
- Vérifier nouvelle ligne dans le tableau
- Status devrait être "completed" ou "running"

**Option B - Base de données**
```sql
SELECT id, cron_name, status, duration_ms,
       TO_CHAR(started_at, 'HH24:MI:SS') as started
FROM cron_executions
WHERE cron_name = 'monitor-openai'
ORDER BY started_at DESC
LIMIT 1;
```

## 📋 Liste des Crons Disponibles

### 1. monitor-openai
- **Description** : Monitoring Budget OpenAI
- **Durée estimée** : 5 secondes
- **Fonction** : Vérifie l'usage mensuel OpenAI et génère alertes si >80% budget
- **Fréquence schedulée** : Quotidien à 8h00

### 2. check-alerts
- **Description** : Vérification Alertes Système
- **Durée estimée** : 2 secondes
- **Fonction** : Détecte alertes critiques (budget, échecs KB, batch arrêté) et envoie emails
- **Fréquence schedulée** : Toutes les 30 minutes

### 3. refresh-mv-metadata
- **Description** : Rafraîchissement Vues Matérialisées
- **Durée estimée** : 8 secondes
- **Fonction** : Rafraîchit les vues matérialisées PostgreSQL pour performance dashboard
- **Fréquence schedulée** : Toutes les 6 heures

### 4. reanalyze-kb-failures
- **Description** : Réanalyse Échecs KB
- **Durée estimée** : 20 secondes
- **Fonction** : Retente analyse qualité pour les docs KB avec score=50 (échecs)
- **Fréquence schedulée** : Toutes les 4 heures

### 5. index-kb-progressive
- **Description** : Indexation KB Progressive
- **Durée estimée** : 45 secondes
- **Fonction** : Indexe 2 documents KB par batch (embeddings + chunks)
- **Fréquence schedulée** : Toutes les 5 minutes

### 6. acquisition-weekly
- **Description** : Acquisition Hebdomadaire
- **Durée estimée** : 30 secondes
- **Fonction** : Crawl sources web configurées pour acquérir nouveaux contenus
- **Fréquence schedulée** : Lundi à 2h00

### 7. cleanup-executions
- **Description** : Nettoyage Anciennes Exécutions
- **Durée estimée** : 1 seconde
- **Fonction** : Supprime exécutions cron >7 jours de la table `cron_executions`
- **Fréquence schedulée** : Quotidien à 3h00

## ⚙️ Cas d'Usage

### Scénario 1 : Budget OpenAI proche de la limite

**Problème** : Vous voulez vérifier le budget OpenAI immédiatement sans attendre le cron quotidien

**Solution** :
1. Aller sur `/super-admin/monitoring?tab=crons`
2. Cliquer "Exécuter" sur `monitor-openai`
3. Attendre 5-10 secondes
4. Vérifier l'onglet "KB Quality" → KPI "Budget OpenAI"

### Scénario 2 : Forcer indexation KB immédiate

**Problème** : Vous venez d'uploader 100 nouveaux documents et voulez les indexer maintenant

**Solution** :
1. Déclencher `index-kb-progressive` manuellement
2. Il indexera 2 docs par exécution
3. Re-cliquer 50 fois OU attendre que le cron schedulé continue toutes les 5min

**Note** : Pour indexation bulk, utiliser plutôt l'API directement :
```bash
curl -X POST https://qadhya.tn/api/admin/index-kb \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10}'
```

### Scénario 3 : Tester une modification de cron

**Problème** : Vous venez de modifier un script cron et voulez le tester sans attendre le schedule

**Solution** :
1. SSH dans le VPS
2. Modifier le script dans `/opt/qadhya/scripts/`
3. Retourner au dashboard
4. Déclencher le cron manuellement
5. Vérifier les logs : `docker logs qadhya-nextjs --tail 50`

### Scénario 4 : Déboguer un cron qui échoue

**Problème** : Un cron montre status "failed" dans la timeline

**Solution** :
1. Cliquer sur la ligne failed dans le tableau
2. Lire le message d'erreur dans `error_message` (si disponible)
3. Vérifier les logs : `journalctl -u cron-trigger-server -n 50`
4. Corriger le problème
5. Re-déclencher manuellement pour valider le fix

## 🚨 Limitations et Contraintes

### 1. Cron déjà en cours

**Erreur** :
```json
{
  "success": false,
  "error": "Cron is already running",
  "runningExecutionId": "uuid-xxx"
}
```

**Solution** : Attendre que l'exécution en cours se termine (vérifier durée estimée)

### 2. Exécution bloquée (stuck)

**Symptôme** : Cron en status "running" depuis >timeout configuré

**Solution manuelle** :
```sql
-- Marquer comme failed
UPDATE cron_executions
SET status = 'failed',
    completed_at = NOW(),
    error_message = 'Timeout - manually cancelled'
WHERE id = 'uuid-xxx';
```

### 3. Rate Limiting

Pour éviter surcharge, limiter à :
- Max 1 exécution manuelle par cron toutes les 30 secondes
- Max 10 exécutions manuelles totales par minute

## 🔐 Sécurité

### Authentification

- Route `/api/admin/cron-executions/trigger` protégée par session admin
- Seuls les utilisateurs avec rôle `admin` ou `super-admin` peuvent trigger
- Logs complets de qui a déclenché quoi (audit trail)

### Variables d'environnement

Les crons manuels utilisent les mêmes variables d'environnement que les crons schedulés :
- `CRON_SECRET` : Authentification API start/complete
- `CRON_TRIGGER_SERVER_URL` : URL serveur Python trigger

## 📊 Monitoring et Logs

### Logs Application

```bash
# Logs Next.js container
docker logs qadhya-nextjs --tail 100 -f | grep "Manual Trigger"

# Exemple output
[Manual Trigger] Parameters for monitor-openai: {}
[Manual Trigger] Env vars: {}
[Manual Trigger] ✅ Cron monitor-openai triggered successfully
```

### Logs Trigger Server

```bash
# Logs systemd service
journalctl -u cron-trigger-server -f

# Exemple output
POST /trigger - cronName=monitor-openai
Executing: /opt/qadhya/scripts/cron-monitor-openai.sh
Exit code: 0
```

### Logs Cron Scripts

```bash
# Logs fichier
tail -f /var/log/qadhya/openai-monitor.log

# Exemple output
[2026-02-14 15:26:04] Starting monitor-openai
[2026-02-14 15:26:05] OpenAI usage: $3.24 / $10.00 (32.4%)
[2026-02-14 15:26:06] Completed successfully (1631ms)
```

## 🛠️ Dépannage

### Trigger ne fonctionne pas

**Diagnostic** :
```bash
# 1. Vérifier règle UFW
ssh root@vps "ufw status | grep 9998"
# Doit afficher: 9998  ALLOW  172.16.0.0/12

# 2. Tester trigger server
curl https://qadhya.tn/api/admin/cron-executions/trigger \
  -H 'Content-Type: application/json' \
  -d '{"cronName":"monitor-openai"}'

# 3. Vérifier logs
docker logs qadhya-nextjs 2>&1 | grep "Manual Trigger"
```

### Dashboard ne rafraîchit pas

**Solution** :
- Vérifier connexion internet (SSE utilise EventSource)
- Hard refresh : Ctrl+Shift+R (Chrome) ou Cmd+Shift+R (Mac)
- Vider cache navigateur

### Aucune exécution créée malgré success

**Root cause probable** : Trigger server pas démarré ou fetch échoue

**Solution** :
```bash
# Vérifier service
systemctl status cron-trigger-server

# Redémarrer si nécessaire
systemctl restart cron-trigger-server

# Vérifier connectivité container → host
docker exec qadhya-nextjs node -e "
fetch('http://host.docker.internal:9998/health')
  .then(r => r.json())
  .then(d => console.log('OK:', d))
  .catch(e => console.error('FAIL:', e.message))
"
```

## 📚 Ressources Complémentaires

- **Architecture Technique** : `/docs/CRON_MONITORING.md`
- **Déploiement VPS** : `/docs/VPS_DEPLOYMENT_CHECKLIST.md`
- **API Reference** : `/docs/API_CRON_EXECUTIONS.md`
- **Troubleshooting Bugs** : `~/.claude/memory/bugs-fixes.md`

---

**Dernière mise à jour** : 14 février 2026
**Version Qadhya** : 1.0.0
**Auteur** : Équipe Qadhya + Claude Sonnet 4.5
