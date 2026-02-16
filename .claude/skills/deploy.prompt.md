# Skill: Deploy to VPS - Prompt

Vous devez déployer l'application Qadhya vers le VPS de production en suivant le plan prédéfini de simplification globale.

## Arguments

- `args` : Options de déploiement (--skip-build, --rollback, --dry-run)

## Instructions

### Étape 1 : Validation Pre-Deploy ✅

1. **Vérifier branche Git**
   ```bash
   git branch --show-current
   ```
   - ✅ Doit être `main`
   - ❌ Si autre branche → Avertir utilisateur

2. **Vérifier status Git**
   ```bash
   git status --short
   ```
   - ✅ Si clean → Continuer
   - ⚠️ Si modifications → Demander si commit nécessaire

3. **Validation configuration**
   ```bash
   bash scripts/pre-deploy-validation.sh
   ```
   - Valide : schema .env.template, RAG config, TypeScript
   - Si échec → Arrêter et afficher erreurs

### Étape 2 : Choix Mode Déploiement 🚀

Demander à l'utilisateur :

**Option A : GitHub Actions (Recommandé)** ⭐
- Automatique, testé, rollback auto
- Durée : 5-8 minutes
- Nécessite : Push vers `main`

**Option B : Manuel SSH**
- Direct, contrôle total
- Durée : 3-5 minutes
- Nécessite : Accès SSH VPS

**Option C : Dry-Run (Test)**
- Simulation sans modifications
- Durée : 1 minute
- Pour : Tests pré-déploiement

### Étape 3A : Déploiement via GitHub Actions

1. **Commit si nécessaire**
   ```bash
   git add -A
   git commit -m "deploy: version YYYY-MM-DD HH:MM"
   ```

2. **Push vers main**
   ```bash
   git push origin main
   ```

3. **Monitoring workflow**
   - Afficher URL : `https://github.com/<user>/<repo>/actions`
   - Attendre 30 secondes puis :
   ```bash
   gh run list --workflow="Deploy Production" --limit 1
   ```

4. **Suivre progression**
   - Job validate (1 min)
   - Job build (3-4 min)
   - Job deploy (1-2 min)
   - Job verify (30s)

5. **Vérifier succès**
   ```bash
   gh run list --workflow="Deploy Production" --limit 1 --json status,conclusion
   ```

### Étape 3B : Déploiement Manuel SSH

1. **Connexion VPS**
   ```bash
   ssh root@84.247.165.187
   ```

2. **Naviguer répertoire**
   ```bash
   cd /opt/qadhya
   ```

3. **Exécuter déploiement**
   ```bash
   bash scripts/deploy.sh --env=prod {args}
   ```

   Options args :
   - `--skip-build` : Skip build Docker
   - `--force` : Force sans confirmation
   - `--dry-run` : Simulation

### Étape 3C : Dry-Run (Test)

```bash
bash scripts/deploy.sh --env=prod --dry-run --verbose
```

### Étape 4 : Vérification Post-Deploy ✅

1. **Health Check**
   ```bash
   curl -s https://qadhya.tn/api/health | jq '.'
   ```

   Attendu :
   ```json
   {
     "status": "healthy",
     "services": {
       "database": "healthy",
       "storage": "healthy",
       "api": "healthy"
     },
     "rag": {
       "enabled": true,
       "status": "ok"
     }
   }
   ```

2. **Test API**
   ```bash
   curl -s https://qadhya.tn/api/test-deploy | jq '.'
   ```

3. **Vérifier Dashboard**
   - URL : https://qadhya.tn/super-admin/monitoring
   - Vérifier : Crons OK, KB indexée, RAG actif

### Étape 5 : Rollback (si nécessaire) ⚠️

Si health check échoue ou erreur détectée :

```bash
ssh root@84.247.165.187 'cd /opt/qadhya && bash scripts/deploy.sh --rollback'
```

Ou via GitHub Actions (si déploiement GHA) :
```bash
# Le rollback automatique est déjà intégré dans le workflow
# Si échec → Rollback automatique
```

### Étape 6 : Rapport Final 📊

Afficher rapport détaillé :

```markdown
## Déploiement Qadhya - Rapport Final

**Date** : {timestamp}
**Commit** : {git SHA}
**Mode** : {GitHub Actions | Manuel SSH | Dry-Run}
**Durée** : {duration}

### Résultats

✅ Validation pre-deploy : OK
✅ Build Docker : OK
✅ Déploiement VPS : OK
✅ Health check : OK

### Application

- URL : https://qadhya.tn
- Dashboard : https://qadhya.tn/super-admin/monitoring
- Status : HEALTHY ✅

### Prochaines Étapes

- Vérifier logs : `ssh root@84.247.165.187 "docker logs qadhya-nextjs --tail 50"`
- Monitoring : https://qadhya.tn/super-admin/monitoring
- Rollback si nécessaire : `/deploy --rollback`
```

## Gestion Erreurs

### Erreur : Branche non-main

```
❌ Erreur : Déploiement uniquement depuis branche 'main'
Branche actuelle : {current_branch}

Actions :
1. Merger vers main : git checkout main && git merge {current_branch}
2. Ou forcer : git checkout main
```

### Erreur : Modifications non commitées

```
⚠️ Modifications non commitées détectées

Options :
1. Commit : /commit
2. Stash : git stash
3. Annuler : git restore .
```

### Erreur : Validation échouée

```
❌ Validation pre-deploy échouée

Erreurs :
{error_details}

Actions :
1. Corriger erreurs ci-dessus
2. Re-tester : bash scripts/pre-deploy-validation.sh
3. Re-déployer : /deploy
```

### Erreur : Health check échoué

```
❌ Health check échoué après déploiement

Status : {status}
Erreur : {error}

Actions automatiques :
✅ Rollback automatique déclenché
✅ Version précédente restaurée

Vérifications :
1. Logs : docker logs qadhya-nextjs --tail 100
2. Containers : docker ps
3. Health : curl https://qadhya.tn/api/health
```

## Résumé Commandes

```bash
# Validation
bash scripts/pre-deploy-validation.sh

# Déploiement GitHub Actions (recommandé)
git push origin main

# Déploiement manuel
ssh root@84.247.165.187 'cd /opt/qadhya && bash scripts/deploy.sh --env=prod'

# Rollback
ssh root@84.247.165.187 'cd /opt/qadhya && bash scripts/deploy.sh --rollback'

# Health check
curl -s https://qadhya.tn/api/health | jq '.status'
```

## Notes

- Toujours tester sur branche test avant production
- Backup automatique créé avant chaque déploiement
- Rollback automatique si health check échoue
- Durée moyenne : 5-8 minutes (GitHub Actions)
- Durée moyenne : 3-5 minutes (Manuel SSH)
