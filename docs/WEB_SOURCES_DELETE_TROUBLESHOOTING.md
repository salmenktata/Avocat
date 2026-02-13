# Guide de Dépannage - Suppression Sources Web

**Date**: 13 février 2026
**Version**: 1.0
**Statut**: ✅ Améliorations implémentées

## 🎯 Améliorations Implémentées

### 1. Vérifications Pré-Suppression

Le service vérifie maintenant **avant** de démarrer la transaction :

- ✅ **Existence de la source** → Retourne 404 si non trouvée
- ✅ **Jobs en cours** → Bloque si des jobs de crawl sont actifs (409 Conflict)
- ✅ **Logs détaillés** → Console logs à chaque étape

### 2. Gestion Améliorée des Erreurs

**Avant** :
```javascript
// Erreur générique "Erreur lors de la suppression"
// Pas de détails sur la cause
```

**Après** :
```javascript
// Messages d'erreur spécifiques avec détails :
// - "Source non trouvée" (404)
// - "Impossible de supprimer: 2 job(s) en cours" (409)
// - "Erreur suppression KB: constraint violation..." (500)
// - Stats de suppression affichées
```

### 3. Codes HTTP Appropriés

| Code | Cas | Message |
|------|-----|---------|
| 200 | Succès | "Source supprimée avec succès" + stats |
| 404 | Source inexistante | "Source non trouvée" |
| 409 | Jobs en cours | "Impossible de supprimer: X job(s) en cours" |
| 500 | Erreur transaction | Message d'erreur détaillé + rollback |

### 4. Logging Détaillé

Tous les logs commencent par `[DELETE]` pour faciliter le débogage :

```
[DELETE] Vérification existence source abc123...
[DELETE] ✅ Source trouvée: "legislation.tn"
[DELETE] Vérification jobs en cours...
[DELETE] ✅ Aucun job en cours
[DELETE] Début transaction...
[DELETE] Suppression 42 documents KB...
[DELETE] ✅ 42 documents KB supprimés
[DELETE] Suppression fichiers MinIO...
[DELETE] Suppression source "legislation.tn"...
[DELETE] ✅ Source supprimée avec succès
[DELETE] Commit transaction...
[DELETE] ✅ Suppression terminée avec succès
[DELETE] Stats: KB=42, Pages=156, MinIO=8
```

### 5. UI - Messages Détaillés

**Toast de succès** :
```
Titre: Source supprimée
Description: 156 pages, 42 docs KB supprimés
```

**Toast d'erreur** :
```
Titre: Erreur de suppression
Description: Impossible de supprimer: 2 job(s) en cours.
             Attendez leur fin ou annulez-les.
Duration: 10s (au lieu de 5s par défaut)
```

## 🐛 Cas d'Erreur Fréquents

### Erreur 1: Jobs de Crawl en Cours

**Symptôme** :
```
Status: 409 Conflict
Message: "Impossible de supprimer: 2 job(s) en cours"
```

**Cause** :
Des jobs de crawl sont encore en statut `queued` ou `running` pour cette source.

**Solution** :
```sql
-- 1. Identifier les jobs en cours
SELECT id, job_type, status, started_at
FROM web_crawl_jobs
WHERE web_source_id = 'abc123'
  AND status IN ('queued', 'running');

-- 2. Option A: Attendre la fin des jobs (recommandé)
-- Rafraîchir la page après quelques minutes

-- 3. Option B: Annuler les jobs (DANGER)
UPDATE web_crawl_jobs
SET status = 'cancelled', completed_at = NOW()
WHERE web_source_id = 'abc123'
  AND status IN ('queued', 'running');
```

### Erreur 2: Contrainte Foreign Key

**Symptôme** :
```
Status: 500
Message: "Erreur suppression KB: foreign key constraint..."
```

**Cause** :
Une contrainte FK empêche la suppression (normalement géré par CASCADE).

**Solution** :
```sql
-- Vérifier les contraintes FK
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule != 'CASCADE'
  AND kcu.column_name LIKE '%source%';
```

### Erreur 3: Timeout Transaction

**Symptôme** :
```
Status: 500
Message: "Erreur transaction: timeout exceeded"
```

**Cause** :
La source a trop de données (>10,000 pages, >1,000 docs KB).

**Solution** :
1. **Supprimer les données par batch d'abord** :
```bash
# Supprimer les pages web par batch
npx tsx scripts/delete-web-pages-batch.ts <sourceId> --batch-size=1000

# Supprimer les docs KB par batch
npx tsx scripts/delete-kb-docs-batch.ts <sourceId> --batch-size=500

# Puis supprimer la source
npx tsx scripts/test-delete-web-source.ts <sourceId>
```

2. **Augmenter le timeout PostgreSQL** :
```sql
-- Temporairement augmenter le timeout (en session)
SET statement_timeout = '300000'; -- 5 minutes
```

### Erreur 4: Fichiers MinIO Orphelins

**Symptôme** :
```
Warnings: ["Erreur suppression MinIO web-files/abc123/doc1.pdf: NoSuchKey"]
```

**Cause** :
Les fichiers ont déjà été supprimés manuellement ou le chemin est invalide.

**Solution** :
```bash
# Ces erreurs ne bloquent PAS la suppression (warnings seulement)
# Pour nettoyer les orphelins :
npx tsx scripts/cleanup-minio-orphans.ts --dry-run
npx tsx scripts/cleanup-minio-orphans.ts --execute
```

## 🛠️ Scripts de Diagnostic

### Test Suppression (Dry Run)

```bash
# Aperçu de ce qui sera supprimé SANS supprimer
npx tsx scripts/test-delete-web-source.ts <sourceId> --dry-run

# Exemple de sortie :
# ✅ Source trouvée: "legislation.tn"
# ✅ Données à supprimer:
#    - Documents KB: 42
#    - Chunks KB: 168
#    - Pages web: 156
#    - Fichiers web: 8
#    - Taille estimée: 12.4 MB
# ✅ Aucun job en cours
```

### Diagnostic Complet

```bash
# Analyser toutes les sources et détecter les problèmes
npx tsx scripts/diagnose-delete-issue.ts

# Vérifie :
# - Contraintes FK
# - Jobs en cours
# - Permissions utilisateur
# - Erreurs récentes dans les logs
```

### Suppression Manuelle (Dernier Recours)

```bash
# ATTENTION: Contourne les vérifications !
# À utiliser seulement si l'API échoue de manière irrécupérable
npx tsx scripts/force-delete-web-source.ts <sourceId> --force

# Demande confirmation 3x avant exécution
```

## 🔍 Logs de Débogage

### Où Trouver les Logs ?

**Développement (local)** :
```bash
# Terminal où tourne `npm run dev`
# Tous les logs [DELETE] sont affichés en temps réel
```

**Production (VPS)** :
```bash
# Logs Docker Next.js
ssh root@84.247.165.187
docker logs -f --tail=100 qadhya-nextjs | grep DELETE

# Logs PostgreSQL
docker logs -f --tail=100 qadhya-postgres | grep ERROR
```

### Exemples de Logs

**Succès** :
```
[DELETE] Vérification existence source abc123...
[DELETE] ✅ Source trouvée: "test.tn"
[DELETE] ✅ Aucun job en cours
[DELETE] Début transaction...
[DELETE] Suppression 10 documents KB...
[DELETE] ✅ 10 documents KB supprimés
[DELETE] ✅ Source supprimée avec succès
[DELETE] ✅ Suppression terminée avec succès
```

**Échec (Jobs en cours)** :
```
[DELETE] Vérification existence source abc123...
[DELETE] ✅ Source trouvée: "test.tn"
[DELETE] ⚠️  2 job(s) en cours: incremental (running), full_crawl (queued)
[API DELETE] ⚠️  Jobs en cours, suppression bloquée
```

**Échec (Contrainte FK)** :
```
[DELETE] Suppression 42 documents KB...
[DELETE] ❌ Erreur suppression KB: foreign key constraint "fk_chunks_kb_id"...
[DELETE] ❌ Erreur, rollback en cours...
[API DELETE] ❌ Erreur suppression: [...]
```

## 📋 Checklist Avant Suppression

Avant de supprimer une source web importante, vérifiez :

- [ ] **Backup récent** : Un backup de la base existe (<24h)
- [ ] **Aucun job en cours** : Vérifier `/super-admin/web-sources`
- [ ] **Dry run OK** : `npx tsx scripts/test-delete-web-source.ts <id> --dry-run`
- [ ] **Confirmation** : La source est bien celle à supprimer (vérifier nom + URL)
- [ ] **Staging testé** : Si possible, tester sur une base de staging d'abord

## 🔐 Permissions Requises

L'utilisateur doit avoir :

- ✅ `role = 'admin'` ou `role = 'super_admin'`
- ✅ Permission `DELETE` sur `web_sources` (par défaut OK)
- ✅ Permission `DELETE` sur `knowledge_base` (par défaut OK)

Vérifier les permissions :

```sql
SELECT
  current_user,
  has_table_privilege(current_user, 'web_sources', 'DELETE') AS can_delete_sources,
  has_table_privilege(current_user, 'knowledge_base', 'DELETE') AS can_delete_kb;
```

## 📈 Métriques de Performance

**Temps de suppression typiques** :

| Taille Source | Pages | Docs KB | Temps Moyen |
|---------------|-------|---------|-------------|
| Petite | <100 | <50 | 1-3s |
| Moyenne | 100-1000 | 50-500 | 3-10s |
| Grande | 1000-5000 | 500-2000 | 10-30s |
| Très grande | >5000 | >2000 | 30-120s |

**Si le timeout est dépassé** → Utiliser les scripts de suppression par batch

## 🚀 Déploiement

Les améliorations sont dans les fichiers suivants :

```
lib/web-scraper/delete-service.ts        (service de suppression)
app/api/admin/web-sources/[id]/route.ts  (API route)
components/super-admin/web-sources/
  ├── WebSourcesList.tsx                 (composant liste)
  └── WebSourceActions.tsx                (composant actions)
scripts/
  ├── test-delete-web-source.ts          (script de test)
  ├── diagnose-delete-issue.ts           (script de diagnostic)
  └── check-fk-constraints.sql           (requêtes SQL utiles)
```

**Déployer en production** :

```bash
# Commit les changements
git add .
git commit -m "fix(web-sources): Amélioration gestion erreurs suppression + logs détaillés"

# Push → Déploiement automatique via GHA
git push origin main

# Vérifier le déploiement
gh run watch
```

## 📚 Ressources Additionnelles

- **Documentation API** : `/docs/API_WEB_SOURCES.md`
- **Architecture DB** : `/docs/DATABASE_SCHEMA.md`
- **Logs production** : `ssh root@84.247.165.187 "docker logs qadhya-nextjs"`
- **Monitoring** : https://qadhya.tn/super-admin/monitoring

---

**Dernière mise à jour** : 13 février 2026
**Auteur** : Claude Code
**Version** : 1.0
