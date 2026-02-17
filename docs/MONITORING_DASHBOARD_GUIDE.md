# Guide - Dashboard Monitoring Super-Admin

## Vue d'ensemble

Le dashboard monitoring (`/super-admin/monitoring`) offre une observabilité complète de la plateforme Qadhya : qualité KB, crons, batches, RAG, et configuration système.

**Auto-refresh** : 30 secondes
**Accès** : Rôle Super-Admin requis

---

## Navigation par Onglets

| # | Onglet | Tab param | Contenu |
|---|--------|-----------|---------|
| 1 | Overview | `overview` | Vue synthétique, KPIs globaux |
| 2 | KB Quality | `kb-quality` | Qualité Knowledge Base |
| 3 | OpenAI | `openai` | Monitoring budget API |
| 4 | Sources Web | `web-sources` | Statut crawlers |
| 5 | System | `system` | Health check services |
| 6 | Crons | `crons` | Crons planifiés + batches |

---

## Onglet 1 - Overview

**KPIs globaux** :
- Documents KB (total / indexés / en attente)
- Budget OpenAI restant ($/mois)
- Crons actifs (succès 24h / total)
- Alertes actives (warning/critical)

**Actions rapides** :
- Lancer un backup manuel
- Forcer refresh métriques
- Lien vers logs en direct

---

## Onglet 2 - KB Quality

### KPIs (4 indicateurs)

**1. Progression batch**
```
[████████░░░░] 3,460 / 8,735 analysés (39.6%)
```
- Vert : > 80% coverage
- Orange : 40-80%
- Rouge : < 40%

**2. Budget OpenAI**
```
$0.22 / $10.00 utilisé ce mois (2.2%)
```
- Badge rouge : > 80% utilisé
- Badge orange : > 60% utilisé

**3. Score moyen qualité**
```
Score: 78/100 (2,390 analysés)
```
- Score calculé par Gemini/OpenAI (0-100)
- Objectif : > 75

**4. Échecs**
```
266 échecs (90% = docs courts < 500 chars)
```
- Cliquer pour voir le détail par type

### Graphiques

**Timeline 7j par provider** (ligne) :
- OpenAI (bleu) : docs courts haute qualité
- Gemini (vert) : docs longs standard
- Ollama (orange) : fallback gratuit
- Axe Y : nombre de docs analysés

**Distribution scores** (histogramme) :
- Tranches : 0-50, 50-60, 60-70, 70-80, 80-90, 90-100
- Idéal : max de docs dans 80-100

**Performance providers** (barre) :
- Taux de succès par provider (%)
- Temps moyen d'analyse (ms)
- Coût estimé ($/doc)

### Actions

- **Lancer analyse batch** : Démarre `POST /api/admin/kb/analyze-batch`
- **Re-analyser échecs** : Cron manuel `cron-reanalyze-kb-failures`
- **Exporter rapport** : CSV des métriques 30j

---

## Onglet 3 - OpenAI

### Informations affichées

**Statut connexion** :
```
✅ OpenAI API : Connecté
Modèle testé : gpt-4o-mini
Latence : 423ms
```

**Budget mensuel** :
```
Total : $10.00/mois
Utilisé : $3.24 (32.4%)
Restant : $6.76
Réinitialisation : 1er mars 2026
```

**Utilisation par opération** :
| Opération | Docs | Tokens | Coût |
|-----------|------|--------|------|
| KB Quality Analysis | 996 | 698,400 | $2.24 |
| Embeddings | 0 | 0 | $0.00 |
| Assistant IA | - | ~1M | $1.00 |

### Alertes Budget

Les alertes sont envoyées par email automatiquement :
- **Warning** (80%) : "Budget OpenAI à 80%, $2 restants"
- **Critical** (90%) : "Budget critique, basculement Ollama imminent"
- **Épuisé** : Bascule automatique vers Ollama (0€)

**Cron de vérification** : Quotidien à 9h
**Logs** : `/var/log/qadhya/openai-monitor.log`

---

## Onglet 4 - Sources Web

### Table des Sources

Colonnes affichées :
| Colonne | Description |
|---------|-------------|
| Source | Nom + domaine |
| Statut | Actif / Inactif / Erreur |
| Dernier crawl | Date + résultat |
| Pages | Total / Crawlées |
| Actions | Forcer crawl / Désactiver |

### Statuts

- 🟢 **Actif** : Crawl planifié + aucune erreur
- 🟡 **Inactif** : Désactivé manuellement ou `enabled=false`
- 🔴 **Erreur** : Derniers 3 crawls ont échoué
- 🔵 **En cours** : Crawl actif maintenant

### Détail Source

Cliquer une source pour voir :
- Historique 7j des crawls (pages/heure)
- Dernières erreurs (type, URL, message)
- Configuration (requires_javascript, extraction_config)
- Pages crawlées récemment

### Actions en masse

- **Forcer tous les crawls** : Lance immédiatement
- **Désactiver sources en erreur** : Sécurisation
- **Exporter configuration** : JSON de toutes les sources

---

## Onglet 5 - System Health

### Services Monitorés

```
✅ PostgreSQL    : Healthy (ping: 2ms, connexions: 8/100)
✅ Redis Cache   : Healthy (ping: 1ms, mémoire: 45MB)
✅ MinIO Storage : Healthy (5 buckets, 12.4GB)
✅ Ollama AI     : Healthy (modèle: qwen2.5:3b, VRAM: 4.2GB)
⚠️ OpenAI API   : Warning (quota 32% utilisé)
```

### Métriques Système

**Ressources VPS** :
- CPU : 23% usage
- RAM : 5.2GB / 8GB (65%)
- Disque : 124GB / 200GB (62%)
- Uptime : 12j 4h

**Docker Containers** :
```
qadhya-nextjs   : Running  (restart: 0)
qadhya-postgres : Running  (restart: 0)
qadhya-redis    : Running  (restart: 0)
qadhya-minio    : Running  (restart: 1)
```

### Alertes Système

Seuils déclenchant une alerte email :
- RAM > 85% → Warning
- Disque > 90% → Critical
- Container restart > 3/heure → Warning
- CPU > 95% pendant 5min → Critical

---

## Onglet 6 - Crons & Batches

### Vue d'ensemble Crons

**KPIs** :
- Exécutions 24h : 12 (succès) / 14 (total)
- En cours : 1 (index-kb)
- Échecs consécutifs : 0
- Prochaine exécution : 14:00 (check-alerts)

### Table des Crons

| Cron | Planification | Dernier run | Statut | Durée moy |
|------|--------------|-------------|--------|-----------|
| monitor-openai | 9h quotidien | Aujourd'hui 09:00 | ✅ | 1.4s |
| check-alerts | Toutes 2h | Aujourd'hui 12:00 | ✅ | 0.8s |
| refresh-mv | Dimanche 3h | Lundi 03:00 | ✅ | 45s |
| reanalyze-kb | Dimanche 4h | Lundi 04:00 | ✅ | 180s |
| index-kb | 5min | il y a 2min | 🔄 | 30s |
| cleanup-exec | Dimanche 2h | Lundi 02:00 | ✅ | 0.4s |
| acquisition | Lundi 6h | Lundi 06:00 | ✅ | 240s |

### Statuts Crons

- ✅ **Completed** : Dernier run réussi
- 🔄 **Running** : En cours d'exécution
- ❌ **Failed** : Dernier run échoué
- ⏸️ **Disabled** : Désactivé manuellement
- 🔴 **Stuck** : En cours depuis > timeout configuré

### Bouton "Exécuter maintenant"

Lance le cron manuellement via le Trigger Server :
1. Clic → Confirmation dialog
2. Envoi `POST /api/admin/crons/trigger` avec `{cronName}`
3. Le Trigger Server Python injette `CRON_SECRET` + `CRON_API_BASE`
4. Script bash exécuté avec les variables d'environnement correctes
5. Résultat affiché dans la table (refresh auto)

**⚠️ Prérequis** : Trigger Server doit tourner (`systemctl status cron-trigger-server`)

### Timeline 7 Jours

Graphique Recharts affichant :
- Axe X : 7 derniers jours
- Axe Y : Nombre d'exécutions
- Barres vertes : Succès
- Barres rouges : Échecs
- Survol : Détails du jour (crons + durées)

### Batches Temps Réel

Section affichant les opérations batch longues en cours :

**KB Indexation** :
```
[████████░░░░] 847 / 8,735 documents (9.7%)
Vitesse : 2 docs/min | ETA : ~65h
Provider : Ollama (gratuit)
Démarré : 16 fév 2026 08:00
```

**Web Crawls Actifs** :
```
legislation.tn : 234 pages crawlées (en cours)
cassation.tn   : Terminé (118 pages, 0 erreurs)
```

**Quality Analysis** :
```
Batch #47 : 100 docs analysés, 92 succès, 8 échecs
Durée : 8m 32s | Cost : $0.11
```

---

## Alertes et Notifications

### Configuration Email

Les alertes sont envoyées à `ALERT_EMAIL` (env var).

**Anti-spam** : Maximum 1 email par type d'alerte / 6 heures (cache Redis)

### Types d'Alertes

| Niveau | Condition | Exemple |
|--------|-----------|---------|
| 🔴 Critical | Budget > 90% | "OpenAI : seulement $1 restant" |
| 🔴 Critical | Batch arrêté > 24h | "Aucune indexation depuis 24h" |
| 🔴 Critical | Échecs > 100 docs | "266 docs en échec" |
| ⚠️ Warning | Budget > 80% | "Budget OpenAI à 82%" |
| ⚠️ Warning | Batch ralenti < 50/j | "Seulement 23 docs indexés aujourd'hui" |
| ⚠️ Warning | 3+ échecs crons | "check-alerts : 3 échecs consécutifs" |

### Vérification Manuelle

```bash
# SSH VPS
tail -f /var/log/qadhya/alerts.log
tail -f /var/log/qadhya/openai-monitor.log
tail -f /var/log/qadhya/index-kb.log

# Test alerte (sans envoi email)
curl -H "X-Cron-Secret: $CRON_SECRET" \
  https://qadhya.tn/api/admin/alerts/check
```

---

## APIs de Monitoring

### Métriques Temps Réel

```bash
# Métriques KB Quality
GET /api/admin/monitoring/metrics
→ { coverage, scores, budget, providers, timeline7d }

# Crons statut
GET /api/admin/crons/list
→ { crons: [...], stats: { success24h, running, failed } }

# Health check global
GET /api/health
→ { status, uptime, services, rag }
```

### Triggers Manuels

```bash
# Déclencher un cron
POST /api/admin/crons/trigger
Body: { cronName: "monitor-openai" }
Auth: Session super-admin

# Lancer analyse KB
POST /api/admin/kb/analyze-batch
Body: { limit: 100, provider: "auto" }
Auth: Session super-admin
```

---

## Dépannage Courant

### "Cron stuck depuis X minutes"

1. Vérifier si le process bash existe :
   ```bash
   ssh root@84.247.165.187 "ps aux | grep cron-"
   ```
2. Si zombie, killer le process :
   ```bash
   kill -9 <PID>
   ```
3. Mettre à jour manuellement le statut DB :
   ```sql
   UPDATE cron_executions
   SET status = 'failed', completed_at = NOW()
   WHERE status = 'running'
   AND started_at < NOW() - INTERVAL '30 minutes';
   ```

### "Trigger Server non disponible"

```bash
# Vérifier statut
ssh root@84.247.165.187 "systemctl status cron-trigger-server"

# Redémarrer si nécessaire
ssh root@84.247.165.187 "systemctl restart cron-trigger-server"

# Vérifier port
ssh root@84.247.165.187 "ss -tlnp | grep 9998"
```

### "Dashboard ne charge pas les métriques"

1. Vérifier l'API : `curl https://qadhya.tn/api/admin/monitoring/metrics`
2. Vérifier les tables DB : `SELECT COUNT(*) FROM cron_executions;`
3. Forcer refresh navigateur : Ctrl+Shift+R
4. Vérifier session admin active (cookie expiré ?)
