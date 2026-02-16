# Skill: Deploy to VPS

Déploie l'application Qadhya vers le VPS de production en suivant le plan prédéfini de simplification globale.

## Usage

```
/deploy [--skip-build] [--rollback] [--dry-run]
```

## Options

- `--skip-build` : Skip build Docker (utilise image GHCR existante)
- `--rollback` : Rollback version précédente
- `--dry-run` : Simulation sans modifications

## Plan de Déploiement Prédéfini

### Étape 1 : Validation Pre-Deploy

1. Vérifier branche actuelle (doit être `main`)
2. Vérifier aucune modification non commitée
3. Validation configuration :
   - Schema .env.template
   - Configuration RAG
   - TypeScript type check

### Étape 2 : Commit & Push (si nécessaire)

1. Si modifications non commitées → créer commit
2. Push vers `main`
3. Attendre workflow GitHub Actions

### Étape 3 : Déploiement VPS

**Mode 1 : Via GitHub Actions (Recommandé)**
- Workflow `deploy-production.yml` se déclenche automatiquement
- 5 jobs : validate → build → deploy → verify → notify
- Durée : 5-8 minutes

**Mode 2 : Manuel via SSH (Fallback)**
- Connexion SSH au VPS
- Exécution `scripts/deploy.sh --env=prod`

### Étape 4 : Vérification Post-Deploy

1. Health check : `https://qadhya.tn/api/health`
2. Test API : `https://qadhya.tn/api/test-deploy`
3. Dashboard monitoring : `https://qadhya.tn/super-admin/monitoring`

### Étape 5 : Rollback (si échec)

Si health check échoue ou erreur détectée :
```bash
ssh root@84.247.165.187 'cd /opt/qadhya && bash scripts/deploy.sh --rollback'
```

## Validations Automatiques

Avant chaque déploiement :
- ✅ Validation schema .env.template
- ✅ Validation RAG (OLLAMA_ENABLED ou OPENAI_API_KEY)
- ✅ TypeScript type check
- ✅ Git repository clean
- ✅ Branche main

## Monitoring

Pendant le déploiement :
- Logs workflow GitHub Actions
- Logs container VPS : `docker logs qadhya-nextjs --tail 50`
- Status containers : `docker ps`

Après déploiement :
- Health check endpoint
- Dashboard monitoring
- Métriques application

## Rollback Automatique

Le système rollback automatiquement si :
- Build Docker échoue
- Health check échoue (3 tentatives × 15s)
- Erreur déploiement VPS

## Secrets Requis

Variables d'environnement GitHub Actions :
- `VPS_SSH_KEY` - Clé SSH VPS
- `RESEND_API_KEY`, `GROQ_API_KEY`, `GOOGLE_API_KEY`
- `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- `BREVO_API_KEY`, `CRON_SECRET`

## Exemples

```bash
# Déploiement complet (recommandé)
/deploy

# Déploiement skip build (plus rapide)
/deploy --skip-build

# Rollback version précédente
/deploy --rollback

# Simulation dry-run
/deploy --dry-run
```

## Documentation

- `docs/SIMPLIFICATION_GLOBALE_FINAL.md` - Plan complet
- `docs/DEPLOYMENT.md` - Guide déploiement détaillé
- `scripts/deploy.sh --help` - Usage script déploiement

## Durée Estimée

- Validation : ~1 minute
- Build Docker : ~3-4 minutes
- Déploiement : ~1-2 minutes
- Health check : ~30 secondes

**Total** : ~5-8 minutes
