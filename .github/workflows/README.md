# GitHub Actions Workflows - Documentation

Ce dossier contient les workflows GitHub Actions pour le déploiement et CI/CD de Qadhya.

## Workflows Actifs

### `deploy-production.yml` ✅ ACTIF

**Workflow principal simplifié** pour déploiement production.

**Trigger** :
- Push sur branche `main`
- Workflow dispatch (manuel)

**Architecture** : 5 jobs
1. **validate** - Validation pre-deploy (schema + RAG + TypeScript)
2. **build** - Build & push image Docker GHCR
3. **deploy** - Déploiement VPS via `scripts/deploy.sh`
4. **verify** - Health check + E2E tests
5. **notify** - Rapport final

**Durée** : ~5-8 minutes

**Utilisation** :
```yaml
# Automatique (push main)
git push origin main

# Manuel via GitHub UI
Actions → Deploy Production → Run workflow

# Rollback manuel si échec
ssh root@84.247.165.187 'cd /opt/qadhya && bash scripts/deploy.sh --rollback'
```

**Secrets requis** :
- `VPS_SSH_KEY` - Clé SSH VPS
- `RESEND_API_KEY` - Email service
- `GROQ_API_KEY` - LLM Groq
- `GOOGLE_API_KEY` - Gemini
- `DEEPSEEK_API_KEY` - DeepSeek
- `OPENAI_API_KEY` - OpenAI
- `ANTHROPIC_API_KEY` - Claude
- `BREVO_API_KEY` - Email notifications
- `CRON_SECRET` - Authentification crons

---

## Workflows Legacy (Archives)

### `deploy-vps.yml.backup` 📦 ARCHIVÉ

**Ancien workflow 2-Tier** (Feb 2026).

**Raisons archivage** :
- Complexité excessive : 761 lignes, 11 jobs
- Duplication massive : 70+ lignes health check dupliquées
- Logique fragmentée : Tier 1 Lightning vs Tier 2 Docker
- Maintenance difficile : Modifications dispersées dans 11 jobs

**Remplacé par** : `deploy-production.yml` (280 lignes, 5 jobs)

**Gains** :
- Lignes : 761 → 280 (-63%)
- Jobs : 11 → 5 (-55%)
- Duplication : 140+ lignes → 0 (-100%)
- Chemins déploiement : 2 → 1 (Docker uniquement)

**Conservation** : Backup pour référence historique et rollback si nécessaire

---

## Migration depuis Ancien Workflow

### Différences Clés

| Aspect | Ancien (deploy-vps.yml) | Nouveau (deploy-production.yml) |
|--------|-------------------------|----------------------------------|
| **Jobs** | 11 jobs | 5 jobs (-55%) |
| **Lignes** | 761 lignes | 280 lignes (-63%) |
| **Tiers** | Tier 1 Lightning + Tier 2 Docker | Docker uniquement |
| **Détection tier** | Auto-détection fichiers modifiés | N/A (toujours Docker) |
| **Health check** | 70 lignes dupliquées × 2 | 1 script helper réutilisable |
| **Validation** | Dispersée dans 3 jobs | 1 script consolidé |
| **Deploy script** | Inline 100+ lignes × 2 | `scripts/deploy.sh` unifié |
| **Rollback** | Manuel complexe | `scripts/deploy.sh --rollback` |

### Fonctionnalités Conservées

✅ **Toutes les fonctionnalités** de l'ancien workflow sont préservées :
- Validation pre-deploy (schema + RAG + TypeScript)
- Build Docker avec cache GHA
- Push image GHCR
- Déploiement VPS via SSH
- Health check avec retry
- Rollback automatique si échec
- Protection concurrence (concurrency groups)

### Fonctionnalités Améliorées

1. **Scripts réutilisables** : Utilisables localement ET en CI/CD
2. **Validation consolidée** : 1 script vs 3 jobs dispersés
3. **Health check** : Script helper avec diagnostic SSH
4. **Déploiement** : Script unifié `deploy.sh` avec flags CLI
5. **Rollback** : Simplifié via `--rollback` flag

### Fonctionnalités Supprimées

❌ **Tier 1 Lightning** : Supprimé pour simplification
- Raison : Complexité > Gain temps (+3-5 min accepté)
- Alternative : Docker uniquement (fiabilité 100%)

❌ **Auto-détection tier** : Supprimé (toujours Docker)
- Raison : Source de bugs (routes API 70% fiabilité)
- Alternative : Docker systématique (prévisible)

❌ **Merge queue check** : Supprimé (redondant avec concurrency groups)
- Raison : GitHub gère nativement les queues
- Alternative : `concurrency.cancel-in-progress: false`

---

## Rollback vers Ancien Workflow

**Si nouveau workflow pose problème**, rollback en 1 minute :

```bash
# 1. Restaurer ancien workflow
git checkout .github/workflows/deploy-vps.yml.backup
git mv .github/workflows/deploy-vps.yml.backup .github/workflows/deploy-vps.yml

# 2. Désactiver nouveau workflow (renommer)
git mv .github/workflows/deploy-production.yml .github/workflows/deploy-production.yml.disabled

# 3. Commit et push
git add .github/workflows/
git commit -m "chore: rollback to legacy deploy-vps.yml workflow"
git push origin main
```

**Note** : Conserve les scripts helper GHA créés (toujours utiles)

---

## Tests Workflow Nouveau Système

### Test 1 : Validation

```bash
# Local
bash scripts/pre-deploy-validation.sh

# Attendu : Validation réussie (schema + RAG + TypeScript)
```

### Test 2 : Build Docker

```bash
# Trigger workflow
git commit -m "test: trigger deploy workflow" --allow-empty
git push origin main

# Observer job "build" dans GitHub Actions UI
# Attendu : Build réussi, image pushée GHCR
```

### Test 3 : Deploy Production

```bash
# Observer job "deploy" dans GitHub Actions UI
# Attendu : scripts/deploy.sh exécuté, déploiement réussi
```

### Test 4 : Health Check

```bash
# Observer job "verify" dans GitHub Actions UI
# Attendu : https://qadhya.tn/api/health retourne status=healthy
```

### Test 5 : Rollback Manuel

```bash
ssh root@84.247.165.187
cd /opt/qadhya
bash scripts/deploy.sh --rollback

# Attendu : Version précédente restaurée, health check OK
```

---

## Troubleshooting

### Workflow échoue à l'étape "validate"

**Cause** : Configuration invalide (schema, RAG, TypeScript)

**Solution** :
```bash
# Tester localement
bash scripts/pre-deploy-validation.sh

# Corriger erreurs affichées
```

### Workflow échoue à l'étape "build"

**Cause** : Build Docker échoue, dépendances manquantes

**Solution** :
```bash
# Vérifier Dockerfile
docker build -t test .

# Vérifier logs GHA job "build"
```

### Workflow échoue à l'étape "deploy"

**Cause** : SSH connexion, permissions, scripts manquants

**Solution** :
```bash
# Vérifier connexion SSH
ssh root@84.247.165.187 "echo OK"

# Vérifier scripts présents sur VPS
ssh root@84.247.165.187 "ls -la /opt/qadhya/scripts/"
```

### Workflow échoue à l'étape "verify"

**Cause** : Health check échoue, application non démarrée

**Solution** :
```bash
# Health check manuel
bash scripts/gha-health-check.sh https://qadhya.tn/api/health root@84.247.165.187

# Vérifier logs container
ssh root@84.247.165.187 "docker logs qadhya-nextjs --tail 50"
```

---

## Voir Aussi

**Documentation déploiement** :
- `docs/SIMPLIFICATION_PHASE3_COMPLETE.md` - Phase 3 complète
- `docs/DEPLOYMENT.md` - Guide déploiement
- `scripts/deploy.sh --help` - Usage script déploiement

**Configuration** :
- `.env.template` - Template configuration unique
- `docker-compose.yml` - Configuration Docker unifiée
- `scripts/lib/deploy-config.sh` - Configuration déploiement

---

**Date création** : 16 février 2026
**Auteur** : Claude Code
**Simplification** : Phase 3 - Workflow GHA Simplifié
