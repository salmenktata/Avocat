# Guide Troubleshooting : Déploiements et Rollbacks

## 🎯 Objectif

Ce guide permet de diagnostiquer rapidement les problèmes de déploiement en production et de récupérer d'un rollback non désiré.

## 📋 Checklist Diagnostic Rapide

### 1. Vérifier la Version en Production

```bash
# Depuis votre machine locale
./scripts/diagnose-deployment-version.sh
```

**Résultats possibles** :
- ✅ **UP TO DATE** : Production correspond à main
- ❌ **OUTDATED** : Production est en retard (voir commits manquants)
- ⚠️ **CANNOT VERIFY** : Problème accès SSH
- ⚠️ **AHEAD OF MAIN** : Production plus récente que main (attention !)

### 2. Vérifier l'État des Déploiements GitHub Actions

```bash
# Lister les 10 derniers runs
gh run list --workflow="Deploy to VPS Contabo" --limit 10

# Voir détails d'un run spécifique
gh run view <run-id>

# Voir logs en temps réel
gh run watch
```

**Statuts critiques** :
- `cancelled` : Déploiement annulé (cause la plus fréquente)
- `failure` : Échec health check → rollback automatique
- `success` : Déploiement réussi
- `in_progress` : En cours

### 3. Vérifier Health Check en Production

```bash
# Test simple
ssh root@84.247.165.187 "curl -sf http://localhost:3000/api/health | jq"

# Résultat attendu
{
  "status": "healthy",
  "uptime": 123456,
  "services": {
    "database": "healthy",
    "storage": "healthy",
    "api": "healthy"
  }
}
```

**Statuts possibles** :
- `"status": "healthy"` : Tout OK
- `"status": "starting"` : Container en grace period (<45s)
- `"status": "unhealthy"` : Service KO (voir champ `services`)
- `"status": "error"` : Erreur critique

## 🔥 Causes Communes de Rollback

### Cause #1 : Annulation en Cascade (`cancel-in-progress`)

**Symptôme** :
- GitHub Actions affiche `cancelled` pour plusieurs runs consécutifs
- Production reste sur version ancienne
- Aucun log d'erreur

**Root Cause** :
```yaml
# AVANT (problématique)
concurrency:
  group: deploy-production
  cancel-in-progress: true  # ❌ Annule déploiement en cours
```

**Solution** : ✅ Déjà corrigé dans `.github/workflows/deploy-vps.yml:27`
```yaml
concurrency:
  group: deploy-production
  cancel-in-progress: false  # ✅ Laisse déploiement se terminer
```

**Prévention** :
- Éviter pushs rapides consécutifs pendant un déploiement
- Si urgent : annuler run manuellement sur GitHub Actions puis repush

---

### Cause #2 : Health Check Trop Rapide (Race Condition)

**Symptôme** :
- Rollback automatique même si code sain
- Logs GHA montrent "Health check failed after 3 attempts"
- Container démarre normalement 10s après le rollback

**Root Cause** :
```yaml
# AVANT (problématique)
sleep 15  # ❌ Workflow attend 15s
```

vs Docker healthcheck :
```yaml
# docker-compose.prod.yml
healthcheck:
  start_period: 40s  # Container a 40s pour démarrer
```

**Gap critique** : 40s - 15s = **25 secondes de décalage**

**Solution** : ✅ Déjà corrigé dans `.github/workflows/deploy-vps.yml:206`
```yaml
sleep 30  # ✅ Aligner avec docker start_period (40s) - marge sécurité
```

**Prévention** :
- Tester timing avec : `./scripts/test-health-check-timing.sh`
- Résultat attendu : <30s

---

### Cause #3 : Services Externes Lents (PostgreSQL/MinIO)

**Symptôme** :
- Health check échoue parfois aléatoirement
- Logs montrent timeout sur DB ou MinIO
- Container redémarre en boucle

**Root Cause** :
- Aucun retry logic dans health check
- Timeout fixe 5s insuffisant sous charge
- Grace period manquant

**Solution** : ✅ Déjà corrigé dans `app/api/health/route.ts`

**Nouvelles fonctionnalités** :
```typescript
// 1. Retry logic (2 tentatives × 1.5s délai)
const checkWithRetry = async (checkFn, serviceName) => {
  for (let i = 0; i < MAX_RETRIES; i++) {
    // Timeout 6s par tentative
    const result = await Promise.race([
      checkFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 6000)
      )
    ])
    // Retry avec délai si échec
    if (i < MAX_RETRIES - 1) await sleep(1500)
  }
}

// 2. Grace period (45s)
if (containerAge < 45) {
  return { status: 'starting', ... }  // 200 OK pendant init
}
```

**Prévention** :
- Monitoring PostgreSQL : `docker exec qadhya-postgres pg_isready`
- Monitoring MinIO : `curl http://localhost:9000/minio/health/live`

---

## 🚑 Procédures de Récupération

### Scénario A : Forcer Redéploiement Manuel (Contourner cancel-in-progress)

**Quand l'utiliser** : Production outdated, tous les runs cancelled

```bash
# Option 1 : Via GitHub Actions (recommandé)
gh workflow run "Deploy to VPS Contabo" \
  --ref main \
  --field force_docker=true

# Suivre progression
gh run watch

# Vérifier résultat
./scripts/diagnose-deployment-version.sh
```

```bash
# Option 2 : SSH manuel vers VPS (si GHA bloqué)
ssh root@84.247.165.187

cd /opt/moncabinet

# Pull dernière image
docker pull ghcr.io/salmenktata/moncabinet:latest

# Recréer container
docker compose -f docker-compose.prod.yml up -d --no-deps nextjs

# Attendre 30s puis tester
sleep 30
curl -sf http://localhost:3000/api/health | jq

# Vérifier version déployée
docker inspect qadhya-nextjs --format='{{.Config.Labels.org.opencontainers.image.revision}}'
```

---

### Scénario B : Rollback Manuel vers Version Spécifique

**Quand l'utiliser** : Version récente instable, besoin de revenir à SHA connu

```bash
# 1. Identifier SHA stable (ex: e07f306)
git log --oneline -20

# 2. Construire image localement (si pas dans registry)
docker build -t ghcr.io/salmenktata/moncabinet:e07f306 \
  --build-arg GIT_SHA=e07f306 .

# 3. Déployer sur VPS
ssh root@84.247.165.187

cd /opt/moncabinet

# Modifier docker-compose temporairement
sed -i 's|:latest|:e07f306|' docker-compose.prod.yml

docker compose -f docker-compose.prod.yml up -d --no-deps nextjs

# Vérifier
curl -sf http://localhost:3000/api/health | jq
```

---

### Scénario C : Récupération d'un Rollback Automatique Raté

**Quand l'utiliser** : Rollback automatique a échoué, health check fail

```bash
ssh root@84.247.165.187

cd /opt/moncabinet

# 1. Vérifier backup rollback existe
ls -lah /opt/moncabinet/rollback/

# 2. Restaurer manuellement
if [ -f /opt/moncabinet/rollback/server.js ]; then
  docker cp /opt/moncabinet/rollback/server.js qadhya-nextjs:/app/server.js
  docker cp /opt/moncabinet/rollback/.next/. qadhya-nextjs:/app/.next/
  docker cp /opt/moncabinet/rollback/public/. qadhya-nextjs:/app/public/
  docker restart qadhya-nextjs
fi

# 3. Attendre et tester
sleep 30
curl -sf http://localhost:3000/api/health | jq
```

---

## 📊 Logs à Consulter

### Logs GitHub Actions

```bash
# Logs complets d'un run
gh run view <run-id> --log

# Logs d'un job spécifique
gh run view <run-id> --log --job <job-id>
```

**Sections critiques** :
- `Health check` : Détails tentatives (PostgreSQL, MinIO, API)
- `Rollback on failure` : Rapport incident + logs capturés

---

### Logs Container Production

```bash
ssh root@84.247.165.187

# Logs container Next.js (temps réel)
docker logs -f qadhya-nextjs

# Logs 200 dernières lignes
docker logs qadhya-nextjs --tail 200

# Logs depuis 10 minutes
docker logs qadhya-nextjs --since 10m

# Logs PostgreSQL
docker logs qadhya-postgres --tail 100

# Logs MinIO
docker logs qadhya-minio --tail 100
```

---

### Logs Rollback Automatique

**Nouveauté** : Les rollbacks capturent maintenant automatiquement :

```bash
ssh root@84.247.165.187

# Lister incidents
ls -lah /opt/moncabinet/failed-deployments/

# Voir dernier incident
cat /opt/moncabinet/failed-deployments/incident_$(ls -t /opt/moncabinet/failed-deployments/ | head -1)

# Logs capturés au moment du rollback
cat /opt/moncabinet/failed-deployments/logs_<SHA>_<timestamp>.txt
```

**Format rapport incident** :
```
ROLLBACK INCIDENT REPORT
Time: 2026-02-13 01:23:45
Failed Commit: 0c0aa97
Logs: logs_0c0aa97_20260213_012345.txt

Health Check Diagnostics:
- PostgreSQL: accepting connections
- MinIO: OK
- Container uptime: 2026-02-13T00:23:00Z

Next Steps:
1. Review logs: cat /opt/moncabinet/failed-deployments/logs_0c0aa97_20260213_012345.txt
2. Check timing: scripts/test-health-check-timing.sh
3. Fix issue locally and redeploy
```

---

## ✅ Checklist Pré-Déploiement

Avant de push sur `main` :

- [ ] **Tests locaux passent** : `npm run build`
- [ ] **Aucun run GHA en cours** : `gh run list --workflow="Deploy to VPS Contabo" | head -1`
- [ ] **Health check local OK** : `curl http://localhost:3000/api/health`
- [ ] **Timing acceptable** : Si modif infra, tester avec `./scripts/test-health-check-timing.sh`
- [ ] **Commit message clair** : Facilite debug si rollback

---

## 🔍 Tests End-to-End

### Test 1 : Health Check Local

```bash
npm run dev
sleep 5
curl http://localhost:3000/api/health | jq

# Vérifier
# - "status": "healthy" ou "starting" (si <45s uptime)
# - "services.database": "healthy"
# - "services.storage": "healthy"
```

---

### Test 2 : Workflow Complet

```bash
# 1. Modifier fichier simple (ex: README)
echo "Test: $(date)" >> README.md
git add README.md
git commit -m "test: verify deployment workflow"
git push origin main

# 2. Observer GHA (ne doit PAS être cancelled)
gh run watch

# 3. Vérifier version prod après
./scripts/diagnose-deployment-version.sh
# Résultat attendu: ✅ UP TO DATE
```

---

### Test 3 : Timing Health Check Production

```bash
./scripts/test-health-check-timing.sh
# Résultat attendu: ✅ < 30s
```

---

## 📈 Métriques de Succès

**Avant corrections** :
- 🔴 4/4 derniers runs = `cancelled`
- 🔴 Production outdated (-2 commits)
- 🔴 Rollbacks faux positifs : ~80%

**Après corrections** (attendu) :
- ✅ 0 runs `cancelled` (sauf annulation manuelle)
- ✅ Production always up-to-date
- ✅ Rollbacks faux positifs : <10% (seulement vrais échecs)

---

## 🆘 Support

**Si problème persiste** :

1. **Capturer contexte complet** :
   ```bash
   ./scripts/diagnose-deployment-version.sh > diagnosis.txt
   gh run list --workflow="Deploy to VPS Contabo" --limit 5 >> diagnosis.txt
   ssh root@84.247.165.187 "docker logs qadhya-nextjs --tail 200" >> diagnosis.txt
   ```

2. **Créer issue GitHub** avec :
   - Fichier `diagnosis.txt`
   - SHA commit problématique
   - Logs rollback si disponibles (`/opt/moncabinet/failed-deployments/`)

3. **Contourner temporairement** :
   - Forcer Docker rebuild : `gh workflow run "Deploy to VPS Contabo" --field force_docker=true`
   - Rollback manuel vers dernier SHA stable

---

## 📚 Références

- **Workflow déploiement** : `.github/workflows/deploy-vps.yml`
- **Health check API** : `app/api/health/route.ts`
- **Docker healthcheck** : `docker-compose.prod.yml:161-166`
- **Scripts diagnostic** : `scripts/diagnose-deployment-version.sh`, `scripts/test-health-check-timing.sh`

---

**Dernière mise à jour** : 13 février 2026
**Version** : 1.0 - Correction régression cancel-in-progress
