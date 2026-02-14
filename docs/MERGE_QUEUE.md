# Merge Queue Intelligente - Système de Déploiement

## 🎯 Objectif

Éviter les conflits de déploiement et optimiser les déploiements en regroupant automatiquement les commits proches.

## 🏗️ Architecture

### 3 Stratégies de Skip Automatique

**1. Queue Overflow (≥3 déploiements en queue)**
```
Situation: 3+ déploiements en attente
Action: Skip automatique
Raison: Le dernier déploiement inclura tous les commits
```

**2. Recent Commits (<5min d'écart)**
```
Situation: Push dans les 5min après un autre push
Action: Skip automatique
Raison: Batch automatique des commits proches
Économie: 1 déploiement au lieu de 2-3
```

**3. Manual Override (workflow_dispatch)**
```
Situation: Déploiement manuel déclenché
Action: JAMAIS skip (toujours prioritaire)
Raison: Action intentionnelle de l'utilisateur
```

## 📊 Exemples de Scénarios

### Scénario 1 : Commits Rapides (Optimisé)

```
14:00:00 - Push commit A → Déploiement #1 démarre
14:02:00 - Push commit B → SKIP (< 5min)
14:03:00 - Push commit C → SKIP (< 5min)
14:08:00 - Déploiement #1 termine avec commits A+B+C
```

**Résultat** : 1 déploiement au lieu de 3 ✅

### Scénario 2 : Queue Overflow (Optimisé)

```
14:00 - Run #1 in_progress
14:02 - Run #2 queued
14:04 - Run #3 queued
14:05 - Push commit D → SKIP (≥3 en queue)
```

**Résultat** : Run #3 inclura le commit D ✅

### Scénario 3 : Déploiement Manuel (Prioritaire)

```
14:00 - Run #1 in_progress
14:02 - Run #2 queued
14:03 - gh workflow run ... → Run #3 démarre (pas de skip)
```

**Résultat** : Déploiement manuel respecté ✅

## 🔧 Commandes Utiles

### Vérifier la Queue

```bash
# Voir tous les déploiements en cours/en attente
gh run list --workflow="Deploy to VPS Contabo" --limit 10

# Voir uniquement les runs actifs
gh run list --workflow="Deploy to VPS Contabo" --status=queued,in_progress

# Voir les détails d'un run
gh run view <run-id>
```

### Forcer un Déploiement

```bash
# Bypass la merge queue (toujours prioritaire)
gh workflow run "Deploy to VPS Contabo"

# Forcer Tier 2 Docker
gh workflow run "Deploy to VPS Contabo" -f force_docker=true
```

### Annuler un Déploiement

```bash
# Annuler un run spécifique
gh run cancel <run-id>

# Annuler tous les runs en queue (DANGER)
gh run list --workflow="Deploy to VPS Contabo" --status=queued \
  --json databaseId --jq '.[].databaseId' | xargs -I {} gh run cancel {}
```

## 📈 Métriques & Optimisations

### Avant Merge Queue (Sans Optimisation)

```
10 commits en 1h = 10 déploiements
Temps total: 10 × 5min = 50min
Coût GitHub Actions: 10 × workflow minutes
```

### Après Merge Queue (Avec Optimisation)

```
10 commits en 1h (regroupés en 3 batches)
- Batch 1: Commits 1-4 (5min d'écart)
- Batch 2: Commits 5-7 (5min d'écart)
- Batch 3: Commits 8-10 (5min d'écart)

Résultat: 3 déploiements au lieu de 10
Temps total: 3 × 5min = 15min (-70%)
Économie: -70% de runs GitHub Actions
```

## 🚨 Bonnes Pratiques

### ✅ Recommandé

1. **Grouper les commits localement**
   ```bash
   # Faire plusieurs changements
   git add .
   git commit -m "fix: multiple corrections"
   git push  # → 1 seul déploiement
   ```

2. **Attendre entre les push si urgent**
   ```bash
   git push
   # Attendre 5-10min si autres changements à venir
   # Permet au batch automatique de fonctionner
   ```

3. **Vérifier la queue avant de push**
   ```bash
   gh run list --status=in_progress
   # Si un run est actif, attendre ou accepter le batch
   ```

### ❌ À Éviter

1. **Push multiples rapides si non urgent**
   ```bash
   git push  # Fix 1
   git push  # Fix 2 (2min après)
   git push  # Fix 3 (1min après)
   # → 2-3 déploiements au lieu d'1
   ```

2. **Forcer des déploiements manuels inutiles**
   ```bash
   # Si la merge queue fonctionne, pas besoin de:
   gh workflow run ...  # ← Seulement si vraiment urgent
   ```

3. **Modifier routes API sans force_docker**
   ```bash
   # ❌ ERREUR
   git push  # Modif route API

   # ✅ CORRECT
   gh workflow run "Deploy to VPS Contabo" -f force_docker=true
   ```

## 🔍 Monitoring

### Dashboard GitHub Actions

Accéder à : `https://github.com/salmenktata/MonCabinet/actions/workflows/deploy-vps.yml`

**Indicateurs clés** :
- Runs skipped (merge queue efficace)
- Temps moyen de déploiement
- Taux de succès

### Logs VPS

```bash
# Vérifier le SHA déployé
ssh root@84.247.165.187 "cat /opt/moncabinet/DEPLOYED_SHA"

# Voir l'historique des déploiements
ssh root@84.247.165.187 "ls -lt /opt/moncabinet/failed-deployments/"
```

## 🐛 Troubleshooting

### Problème : Déploiement skipped mais changements urgents

**Solution 1** : Forcer déploiement manuel
```bash
gh workflow run "Deploy to VPS Contabo"
```

**Solution 2** : Attendre le prochain batch (~5min max)
```bash
# Vos changements seront inclus automatiquement
```

### Problème : Trop de runs en queue

**Solution** : Annuler les runs redondants
```bash
# Garder uniquement le dernier
gh run list --workflow="Deploy to VPS Contabo" --status=queued \
  --json databaseId --jq '.[:-1][].databaseId' | \
  xargs -I {} gh run cancel {}
```

### Problème : Merge queue ne fonctionne pas

**Diagnostic** :
```bash
# Vérifier le job check-queue
gh run view <run-id> --log | grep "Merge Queue"

# Vérifier les outputs
gh run view <run-id> --json jobs \
  --jq '.jobs[] | select(.name=="Merge Queue Check") | .steps'
```

## 📚 Ressources

- **Workflow** : `.github/workflows/deploy-vps.yml`
- **Protection concurrence** : `docs/DEPLOYMENT_CONCURRENCY.md`
- **Debugging déploiements** : `docs/DEPLOYMENT_ROLLBACK_TROUBLESHOOTING.md`

---

**Dernière mise à jour** : 14 février 2026
**Version** : Merge Queue v1.0 - Production
