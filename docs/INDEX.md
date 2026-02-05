# 📚 Index Documentation MonCabinet VPS

Guide de navigation complet de la documentation du déploiement VPS.

---

## 🎯 Par Objectif

### Je veux déployer l'application

1. **Lire d'abord** : [`README_VPS_DEPLOYMENT.md`](../README_VPS_DEPLOYMENT.md) (vue d'ensemble)
2. **Suivre étape par étape** : [`DEPLOYMENT_VPS.md`](./DEPLOYMENT_VPS.md) (guide complet 65+ pages)
3. **Cocher progression** : [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) (checklist interactive)

### Je cherche une commande spécifique

📖 **Consulter** : [`QUICK_COMMANDS.md`](./QUICK_COMMANDS.md)
- Commandes Docker
- PostgreSQL
- MinIO
- Nginx
- SSL
- Monitoring
- Troubleshooting

### J'ai un problème

❓ **Consulter** : [`FAQ_VPS.md`](./FAQ_VPS.md)
- Solutions aux problèmes courants
- Diagnostics rapides
- Dépannage par catégorie

---

## 📁 Fichiers de Configuration

### Infrastructure Docker

| Fichier | Description |
|---------|-------------|
| [`Dockerfile`](../Dockerfile) | Image Docker Next.js multi-stage |
| [`docker-compose.yml`](../docker-compose.yml) | Orchestration complète (PostgreSQL + MinIO + Next.js) |
| [`.dockerignore`](../.dockerignore) | Exclusions build Docker |

### Configuration Serveur

| Fichier | Description |
|---------|-------------|
| [`nginx-moncabinet.conf`](./nginx-moncabinet.conf) | Configuration Nginx complète (reverse proxy + SSL) |
| [`.env.production`](../.env.production) | Variables d'environnement production (NE PAS COMMIT) |
| [`.env.production.example`](../.env.production.example) | Template variables d'environnement |

### Backend & Database

| Fichier | Description |
|---------|-------------|
| [`lib/db/postgres.ts`](../lib/db/postgres.ts) | Client PostgreSQL direct (remplace Supabase) |
| [`lib/storage/minio.ts`](../lib/storage/minio.ts) | Client MinIO pour stockage fichiers |

### Authentification

| Fichier | Description |
|---------|-------------|
| [`app/api/auth/[...nextauth]/route.ts`](../app/api/auth/[...nextauth]/route.ts) | Configuration NextAuth.js |
| [`middleware.ts`](../middleware.ts) | Middleware authentification routes protégées |

### API Routes

| Fichier | Description |
|---------|-------------|
| [`app/api/health/route.ts`](../app/api/health/route.ts) | Endpoint health check (monitoring) |
| [`app/api/cron/send-notifications/route.ts`](../app/api/cron/send-notifications/route.ts) | Notifications quotidiennes (remplace Edge Function) |

### Scripts

| Fichier | Description | Usage |
|---------|-------------|-------|
| [`deploy.sh`](../deploy.sh) | Script déploiement automatisé | `./deploy.sh` |
| [`backup.sh`](../backup.sh) | Script backup PostgreSQL + MinIO + code | `./backup.sh` |
| [`scripts/migrate-from-supabase.ts`](../scripts/migrate-from-supabase.ts) | Migration données Supabase → VPS | `tsx scripts/migrate-from-supabase.ts` |

### CI/CD

| Fichier | Description |
|---------|-------------|
| [`.github/workflows/deploy-vps.yml`](../.github/workflows/deploy-vps.yml) | Pipeline GitHub Actions (tests + déploiement) |

---

## 📖 Documentation Complète

### Guides de Déploiement

| Document | Pages | Contenu | Audience |
|----------|-------|---------|----------|
| [`README_VPS_DEPLOYMENT.md`](../README_VPS_DEPLOYMENT.md) | 15 | Vue d'ensemble, récapitulatif, prochaines étapes | **Tous** |
| [`DEPLOYMENT_VPS.md`](./DEPLOYMENT_VPS.md) | 65+ | Guide complet pas-à-pas avec commandes SSH détaillées | **Administrateurs système** |
| [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) | 10 | Checklist interactive pour suivre progression | **Chef de projet / Déploiement** |

### Références Techniques

| Document | Pages | Contenu | Audience |
|----------|-------|---------|----------|
| [`QUICK_COMMANDS.md`](./QUICK_COMMANDS.md) | 20 | Référence rapide toutes commandes utiles | **Développeurs / DevOps** |
| [`FAQ_VPS.md`](./FAQ_VPS.md) | 18 | Questions fréquentes et troubleshooting | **Support / Maintenance** |
| [`nginx-moncabinet.conf`](./nginx-moncabinet.conf) | 3 | Configuration Nginx prête à l'emploi | **Administrateurs système** |

### Documentation Existante (Hors VPS)

| Document | Contenu |
|----------|---------|
| [`CONFIGURATION.md`](./CONFIGURATION.md) | Configuration Google Drive + WhatsApp |
| [`MIGRATION_GOOGLE_DRIVE.md`](./MIGRATION_GOOGLE_DRIVE.md) | Migration vers Google Drive |

---

## 🎓 Parcours d'Apprentissage

### Niveau 1 : Débutant VPS

**Objectif** : Comprendre architecture et déployer

1. ✅ Lire [`README_VPS_DEPLOYMENT.md`](../README_VPS_DEPLOYMENT.md) (vue d'ensemble)
2. ✅ Comprendre architecture (section "Architecture Implémentée")
3. ✅ Commander VPS Contabo
4. ✅ Suivre [`DEPLOYMENT_VPS.md`](./DEPLOYMENT_VPS.md) Phase 1 (Configuration VPS)

**Temps estimé** : 1 jour

### Niveau 2 : Intermédiaire Docker

**Objectif** : Maîtriser stack Docker

1. ✅ Suivre [`DEPLOYMENT_VPS.md`](./DEPLOYMENT_VPS.md) Phase 2 (Docker)
2. ✅ Comprendre `docker-compose.yml` ligne par ligne
3. ✅ Tester commandes dans [`QUICK_COMMANDS.md`](./QUICK_COMMANDS.md) section Docker
4. ✅ Lire logs et diagnostiquer problèmes

**Temps estimé** : 2 jours

### Niveau 3 : Avancé Production

**Objectif** : Sécurité, monitoring, maintenance

1. ✅ Configurer Nginx + SSL (Phase 3)
2. ✅ Mettre en place monitoring (Phase 5)
3. ✅ Configurer backups automatiques
4. ✅ Maîtriser [`QUICK_COMMANDS.md`](./QUICK_COMMANDS.md) toutes sections
5. ✅ Lire [`FAQ_VPS.md`](./FAQ_VPS.md) entièrement

**Temps estimé** : 3 jours

### Niveau 4 : Expert DevOps

**Objectif** : Optimisation et scaling

1. ✅ Optimiser PostgreSQL (tuning `shared_buffers`, indexes)
2. ✅ Mettre en place backups offsite (rclone)
3. ✅ Configurer Cloudflare CDN
4. ✅ Automatiser rollbacks
5. ✅ Monitorer métriques avancées (Prometheus + Grafana)

**Temps estimé** : 1 semaine

---

## 🔍 Recherche Rapide

### Par Technologie

#### Docker
- Configuration : [`docker-compose.yml`](../docker-compose.yml)
- Commandes : [`QUICK_COMMANDS.md#docker-compose`](./QUICK_COMMANDS.md#-docker-compose)
- Troubleshooting : [`FAQ_VPS.md#docker`](./FAQ_VPS.md#-docker)

#### PostgreSQL
- Client : [`lib/db/postgres.ts`](../lib/db/postgres.ts)
- Commandes : [`QUICK_COMMANDS.md#postgresql`](./QUICK_COMMANDS.md#-postgresql)
- Migration : [`scripts/migrate-from-supabase.ts`](../scripts/migrate-from-supabase.ts)
- Troubleshooting : [`FAQ_VPS.md#base-de-données`](./FAQ_VPS.md#-base-de-données)

#### MinIO
- Client : [`lib/storage/minio.ts`](../lib/storage/minio.ts)
- Commandes : [`QUICK_COMMANDS.md#minio`](./QUICK_COMMANDS.md#-minio)
- Troubleshooting : [`FAQ_VPS.md#docker`](./FAQ_VPS.md#-docker)

#### Nginx
- Configuration : [`nginx-moncabinet.conf`](./nginx-moncabinet.conf)
- Commandes : [`QUICK_COMMANDS.md#nginx`](./QUICK_COMMANDS.md#-nginx)
- Troubleshooting : [`FAQ_VPS.md#réseau--accès`](./FAQ_VPS.md#-réseau--accès)

#### SSL/TLS
- Commandes : [`QUICK_COMMANDS.md#ssltls`](./QUICK_COMMANDS.md#-ssltls)
- Troubleshooting : [`FAQ_VPS.md#sslhttps`](./FAQ_VPS.md#-sslhttps)

### Par Tâche

#### Déploiement Initial
📖 [`DEPLOYMENT_VPS.md`](./DEPLOYMENT_VPS.md)
✅ [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md)

#### Mise à Jour Application
📖 [`DEPLOYMENT_VPS.md#maintenance`](./DEPLOYMENT_VPS.md#maintenance)
⚡ Script : `./deploy.sh`

#### Backup et Restore
📖 [`QUICK_COMMANDS.md#backups`](./QUICK_COMMANDS.md#-backups)
⚡ Script : `./backup.sh`

#### Monitoring
📖 [`DEPLOYMENT_VPS.md#phase-5-monitoring`](./DEPLOYMENT_VPS.md#phase-5-monitoring)
⚡ Commandes : [`QUICK_COMMANDS.md#monitoring`](./QUICK_COMMANDS.md#-monitoring)

#### Troubleshooting
❓ [`FAQ_VPS.md`](./FAQ_VPS.md)
📖 [`DEPLOYMENT_VPS.md#troubleshooting`](./DEPLOYMENT_VPS.md#troubleshooting)

---

## 📊 Statistiques Documentation

| Type | Nombre | Lignes Totales |
|------|--------|----------------|
| **Guides** | 6 | ~8,500 |
| **Scripts** | 3 | ~1,200 |
| **Configs** | 4 | ~800 |
| **Code Backend** | 6 | ~2,000 |
| **Total** | **19** | **~12,500** |

---

## ✅ Checklist Complétude Documentation

### Documentation Écrite
- ✅ Guide déploiement complet (65+ pages)
- ✅ Checklist interactive
- ✅ Référence commandes rapides
- ✅ FAQ troubleshooting
- ✅ Configuration Nginx ready-to-use
- ✅ README récapitulatif
- ✅ Index navigation (ce fichier)

### Fichiers Techniques
- ✅ Dockerfile optimisé
- ✅ docker-compose.yml complet
- ✅ Scripts déploiement/backup
- ✅ Client PostgreSQL
- ✅ Client MinIO
- ✅ NextAuth.js configuré
- ✅ Health check endpoint
- ✅ Cron notifications
- ✅ Script migration Supabase
- ✅ CI/CD GitHub Actions

### Configuration
- ✅ `.env.production` template
- ✅ Nginx configuration
- ✅ `.gitignore` mis à jour
- ✅ `.dockerignore`

---

## 🎯 Prochaines Étapes

Vous avez lu cet index, que faire maintenant ?

### Si vous n'avez pas encore déployé

1. ➡️ Lire [`README_VPS_DEPLOYMENT.md`](../README_VPS_DEPLOYMENT.md)
2. ➡️ Commander VPS Contabo
3. ➡️ Suivre [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md)

### Si vous êtes en cours de déploiement

1. ➡️ Consulter [`DEPLOYMENT_VPS.md`](./DEPLOYMENT_VPS.md) pour votre phase actuelle
2. ➡️ Cocher items dans [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md)
3. ➡️ En cas de problème : [`FAQ_VPS.md`](./FAQ_VPS.md)

### Si déploiement terminé

1. ➡️ Configurer monitoring (Netdata + UptimeRobot)
2. ➡️ Tester backups automatiques
3. ➡️ Bookmark [`QUICK_COMMANDS.md`](./QUICK_COMMANDS.md) pour usage quotidien
4. ➡️ Planifier maintenance régulière

---

## 📞 Support

### Ressources Officielles

- 📖 **Documentation** : Ce dossier `docs/`
- 🐛 **Issues GitHub** : https://github.com/votre-org/moncabinet/issues
- 📧 **Contact** : admin@moncabinet.tn

### Communauté

- 💬 **Discord** : (à créer si besoin)
- 📱 **Twitter** : (à créer si besoin)

---

## 🔄 Mises à Jour

**Version actuelle** : 1.0 (2026-02-05)

Cette documentation sera mise à jour régulièrement avec :
- Nouvelles fonctionnalités
- Retours d'expérience déploiement
- Optimisations découvertes
- Solutions nouveaux problèmes

**Historique** :
- `2026-02-05` : Version 1.0 - Documentation complète initiale

---

## 📝 Contribuer à la Documentation

Vous avez trouvé une erreur ou voulez améliorer la doc ?

1. Fork le repo
2. Créer branche : `git checkout -b docs/amelioration-xyz`
3. Modifier fichiers dans `docs/`
4. Commit : `git commit -m "docs: amélioration xyz"`
5. Push : `git push origin docs/amelioration-xyz`
6. Créer Pull Request

**Merci de contribuer ! 🙏**

---

**Navigation** : [Retour README principal](../README.md) | [Vue d'ensemble VPS](../README_VPS_DEPLOYMENT.md)
