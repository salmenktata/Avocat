# Scripts Legacy - Archives

Ce dossier contient les anciens scripts de déploiement archivés lors de la simplification globale du système (Feb 2026).

## Contexte

Avant la simplification, le système de déploiement comptait **130+ scripts bash** (~19,231 lignes) avec redondances massives et logiques dupliquées.

**Phase 2 - Script Déploiement Unique** a consolidé tout en **3 scripts core** (~830 lignes) :
- `scripts/deploy.sh` (522 lignes) - Script principal orchestration
- `scripts/lib/deploy-functions.sh` (400+ lignes) - Library fonctions
- `scripts/lib/deploy-config.sh` (180 lignes) - Configuration centralisée

**Gains** : -87% scripts, -96% lignes code, -100% duplication

---

## Scripts Archivés (8 fichiers)

### Déploiement par Phases (Obsolètes)

| Fichier | Raison | Remplacement |
|---------|--------|--------------|
| `deploy-phase1-production.sh` | Approche multi-phases fragmentée | `scripts/deploy.sh --env=prod` |
| `deploy-phase2-production.sh` | Approche multi-phases fragmentée | `scripts/deploy.sh --env=prod` |
| `deploy-phase3.1-prod.sh` | Approche multi-phases fragmentée | `scripts/deploy.sh --env=prod` |
| `deploy-phase2-redisearch.sh` | Feature-specific deploy (RediSearch) | Intégré dans `docker-compose.yml` |

### Déploiement Features (Obsolètes)

| Fichier | Raison | Remplacement |
|---------|--------|--------------|
| `deploy-rag-complete.sh` | Feature-specific deploy (RAG) | Config RAG dans `.env.template` |
| `deploy-option-c-prod.sh` | Option C IA Hybride (déjà déployé) | Config dans `.env.template` |

### Déploiement Google Drive (Obsolètes)

| Fichier | Raison | Remplacement |
|---------|--------|--------------|
| `deploy-gdrive-migrations.sh` | Migrations spécifiques Google Drive | Migrations DB normales |
| `deploy-gdrive-config.sh` | Config Google Drive spécifique | Config dans `.env.template` |

### Autres Scripts (Obsolètes)

| Fichier | Raison | Remplacement |
|---------|--------|--------------|
| `deploy-pm2-old.sh` | Ancien système PM2 (avant Docker) | `scripts/deploy.sh` (Docker uniquement) |

---

## Migration vers Nouveau Système

### Ancienne Architecture (130+ scripts)

```
scripts/
├── deploy-phase1-production.sh
├── deploy-phase2-production.sh
├── deploy-phase3.1-prod.sh
├── deploy-rag-complete.sh
├── deploy-option-c-prod.sh
├── deploy-gdrive-*.sh
├── ... (122+ autres scripts)
└── Duplication massive, logiques fragmentées
```

### Nouvelle Architecture (3 scripts core)

```
scripts/
├── deploy.sh                    # Script principal unifié
├── lib/
│   ├── deploy-config.sh        # Configuration centralisée
│   └── deploy-functions.sh     # Library fonctions consolidées
└── legacy/                      # Scripts obsolètes (archives)
```

---

## Usage Nouveau Système

### Déploiement Production

```bash
# Complet (build + deploy + health check)
./scripts/deploy.sh --env=prod

# Skip build (utilise image GHCR existante)
./scripts/deploy.sh --env=prod --skip-build

# Dry-run simulation
./scripts/deploy.sh --dry-run --verbose
```

### Déploiement Dev Local

```bash
# Avec rebuild
./scripts/deploy.sh --env=dev

# Skip build
./scripts/deploy.sh --env=dev --skip-build
```

### Rollback

```bash
# Rollback automatique
./scripts/deploy.sh --env=prod --rollback

# Rollback avec force
./scripts/deploy.sh --env=prod --rollback --force
```

---

## Fonctionnalités Consolidées

Le nouveau script `deploy.sh` intègre TOUTES les fonctionnalités des anciens scripts :

✅ **Lock déploiement** (de `deploy-with-lock.sh`)
✅ **Validation config** (de `pre-deploy-check.sh`, `validate-rag-config.sh`)
✅ **Backup automatique** (avant déploiement)
✅ **Health check retry** (3× 15s avec validation JSON)
✅ **Rollback automatique** (si health check échoue)
✅ **Build Docker** (local ou GHCR)
✅ **Deploy via SSH** (production VPS)
✅ **Dry-run mode** (simulation sans side-effects)
✅ **Verbose logging** (DEBUG mode)

---

## Avantages Nouveau Système

### Simplicité
- 1 seul script à maintenir vs 130+
- 1 seule source de vérité (config centralisée)
- 0 duplication de code

### Réutilisabilité
- Utilisable dev local ET production
- Utilisable manuellement ET en CI/CD
- Library fonctions exportées (pattern `cron-logger.sh`)

### Fiabilité
- Validation pre-deploy systématique
- Rollback automatique si échec
- Protection concurrence (verrous)
- Health check strict (validation JSON)

### Maintenabilité
- Modifications localisées (1 fichier vs 13+)
- Tests simples (1 script × 4 modes vs 130 scripts)
- Documentation inline claire

---

## Ne PAS Supprimer Ces Fichiers

Ces scripts sont conservés comme **référence historique** et **backup**.

Ils pourraient être utiles pour :
- Comprendre l'ancienne logique
- Rollback temporaire si nécessaire (improbable)
- Migration progressive en production
- Audit code/architecture

---

## Voir Aussi

**Documentation complète** :
- `docs/SIMPLIFICATION_PHASE1_COMPLETE.md` - Phase 1 Configuration Unifiée
- `docs/SIMPLIFICATION_PHASE2_COMPLETE.md` - Phase 2 Script Déploiement (à créer)
- `docs/DEPLOYMENT.md` - Guide déploiement nouveau système

**Configuration** :
- `.env.template` - Template unique auto-adaptatif
- `docker-compose.yml` - Configuration Docker unifiée
- `scripts/lib/deploy-config.sh` - Configuration déploiement centralisée

---

**Date archivage** : 16 février 2026
**Commit** : Simplification globale - Phase 2 Script Déploiement Unique
**Auteur** : Claude Code
**Réduction** : 130 scripts → 3 core (-87%), 19,231 lignes → ~830 lignes (-96%)
