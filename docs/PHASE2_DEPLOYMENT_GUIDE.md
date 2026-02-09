# Guide Déploiement Production - Phase 2 Legal Warnings

**Date**: 10 février 2026
**Version**: 1.0.0
**Durée estimée**: 30 minutes

---

## 🎯 Objectif

Déployer **Phase 2 - Tests & Validation Juridique** en production sur https://qadhya.tn avec :
- ✅ Migration base de données (table `legal_abrogations`)
- ✅ Seed données (13 abrogations critiques tunisiennes)
- ✅ Validation variables environnement
- ✅ Composants UI Legal Warnings actifs
- ✅ Tests santé & monitoring

---

## 📋 Checklist Pré-Déploiement

### Vérifications Locales

- [ ] **Git à jour** : Tous commits Phase 2 poussés vers `main`
  ```bash
  git status
  git log --oneline -5
  ```

- [ ] **Fichiers présents** :
  - [ ] `migrations/20260210_legal_abrogations.sql`
  - [ ] `scripts/seed-legal-abrogations.ts`
  - [ ] `scripts/deploy-phase2-production.sh`
  - [ ] `scripts/validate-phase2-deployment.sh`
  - [ ] `components/chat/AbrogationWarningBadge.tsx`
  - [ ] `components/chat/CitationWarningBadge.tsx`
  - [ ] `components/chat/LegalWarnings.tsx`

- [ ] **Tests locaux** : Tous tests passent
  ```bash
  npm run test:rag          # 55/55 tests
  npm run test:citations    # 30/30 tests
  npx vitest run lib/ai/__tests__/abrogation-detector-service.test.ts  # 24/24 tests
  ```

### Vérifications VPS

- [ ] **SSH access** : Connexion VPS fonctionnelle
  ```bash
  ssh root@84.247.165.187
  ```

- [ ] **Containers running** :
  ```bash
  docker ps | grep moncabinet
  # Attendu : moncabinet-nextjs, moncabinet-postgres, moncabinet-redis, moncabinet-minio
  ```

- [ ] **Espace disque** : Suffisant pour backup (~50-100 MB)
  ```bash
  df -h /opt/moncabinet
  ```

- [ ] **Application healthy** :
  ```bash
  curl -sf https://qadhya.tn/api/health | jq .
  # Attendu : {"status":"healthy", ...}
  ```

---

## 🚀 Déploiement Automatisé (Recommandé)

### Option 1 : Script Automatisé Complet

```bash
# Depuis votre machine locale
bash scripts/deploy-phase2-production.sh
```

**Le script exécute automatiquement** :
1. ✅ Backup base de données (`backup_pre_phase2_YYYYMMDD_HHMMSS.sql.gz`)
2. ✅ Application migration `legal_abrogations`
3. ✅ Seed 13 abrogations critiques
4. ✅ Validation variables environnement
5. ✅ Redémarrage container Next.js (optionnel)
6. ✅ Tests santé (health check + /chat-test)
7. ✅ Affichage résumé déploiement

**Durée** : ~5-10 minutes

**Prompts interactifs** :
- Si table existe : "Re-créer table (supprime données) ? [y/N]"
- Si données existent : "Re-charger seed ? [Y/n]"
- Redémarrage app : "Redémarrer container Next.js ? [Y/n]"

---

### Option 2 : Déploiement Manuel (Étape par Étape)

Si vous préférez contrôler chaque étape :

#### Étape 1 : Backup Base de Données

```bash
ssh root@84.247.165.187

cd /opt/moncabinet

# Créer répertoire backups si absent
mkdir -p backups

# Backup complet
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
docker exec moncabinet-postgres pg_dump -U moncabinet -d moncabinet > backups/backup_pre_phase2_${BACKUP_DATE}.sql

# Compresser
gzip backups/backup_pre_phase2_${BACKUP_DATE}.sql

# Vérifier
ls -lh backups/backup_pre_phase2_${BACKUP_DATE}.sql.gz
```

---

#### Étape 2 : Application Migration

```bash
# Sur VPS
cd /opt/moncabinet

# Copier migration depuis local (ou pull git)
# Option A : SCP depuis local
# scp migrations/20260210_legal_abrogations.sql root@84.247.165.187:/opt/moncabinet/migrations/

# Option B : Git pull (si déjà committé)
git pull origin main

# Appliquer migration
docker exec -i moncabinet-postgres psql -U moncabinet -d moncabinet < migrations/20260210_legal_abrogations.sql

# Vérifier table créée
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c "\d legal_abrogations"
```

**Output attendu** :
```
                            Table "public.legal_abrogations"
          Column           |           Type           | Collation | Nullable | Default
---------------------------+--------------------------+-----------+----------+---------
 id                        | uuid                     |           | not null | gen_random_uuid()
 abrogated_reference       | text                     |           | not null |
 abrogated_reference_ar    | text                     |           |          |
 abrogating_reference      | text                     |           | not null |
 abrogation_date           | date                     |           | not null |
 scope                     | text                     |           |          |
 ...
```

---

#### Étape 3 : Seed Données Abrogations

```bash
# Sur VPS
cd /opt/moncabinet

# Exécuter seed
docker exec moncabinet-nextjs npx tsx scripts/seed-legal-abrogations.ts
```

**Output attendu** :
```
🌱 Début du seed des abrogations juridiques...

✅ Loi n°1968-07 du 8 mars 1968 (Faillite) → Loi n°2016-36...
✅ Circulaire n°216 du 5 novembre 1973 (Mariage mixte) → Circulaire n°164...
✅ Article 207 du Code Pénal → Proposition de Loi n°2017-58...
...

📊 Résumé:
   ✅ Insérées: 13
   ⏭️  Skipped: 0
   📝 Total: 13

✨ Seed terminé avec succès!
```

**Vérification** :
```bash
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c "SELECT COUNT(*) FROM legal_abrogations;"
# Attendu : 13 (ou plus si exécuté plusieurs fois)
```

---

#### Étape 4 : Variables Environnement

```bash
# Vérifier variables dans .env
cat /opt/moncabinet/.env | grep ENABLE

# Si absentes, ajouter :
echo "ENABLE_CITATION_VALIDATION=true" >> /opt/moncabinet/.env
echo "ENABLE_ABROGATION_DETECTION=true" >> /opt/moncabinet/.env
```

**Note** : Par défaut, ces variables sont `true` si non définies.

---

#### Étape 5 : Redémarrage Application

```bash
cd /opt/moncabinet

# Redémarrer container Next.js
docker-compose -f docker-compose.prod.yml restart nextjs

# Attendre démarrage
sleep 10

# Vérifier logs
docker logs -f moncabinet-nextjs | head -50
```

---

#### Étape 6 : Tests Santé

```bash
# Health check API
curl -sf https://qadhya.tn/api/health | jq .

# Page chat-test accessible
curl -sf -I https://qadhya.tn/chat-test | head -1
# Attendu : HTTP/2 200 ou HTTP/2 307 (redirect auth)
```

---

## ✅ Validation Post-Déploiement

### Script Automatisé

```bash
# Depuis votre machine locale
bash scripts/validate-phase2-deployment.sh
```

**Le script teste automatiquement** :
1. ✅ Table `legal_abrogations` (structure + données)
2. ✅ Variables environnement `ENABLE_*_DETECTION`
3. ✅ Endpoints API (health + /chat-test)
4. ✅ Composants UI présents
5. ✅ Logs monitoring warnings

**Output attendu** :
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ VALIDATION PHASE 2 RÉUSSIE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Résultats :
  Total tests : 12
  ✅ Passants  : 12
  ❌ Échecs    : 0
  📈 Taux      : 100%

🎉 Phase 2 déployée avec succès en production !
```

---

### Tests Manuels

#### Test 1 : Warning Abrogation HIGH Severity

1. **Ouvrir** : https://qadhya.tn/chat-test
2. **Poser question** :
   ```
   Quelle est la procédure de faillite selon la Loi n°1968-07 ?
   ```
3. **Vérifier warning** :
   - ✅ Badge warning visible avec 🔴 CRITIQUE
   - ✅ Référence "Loi n°1968-07" affichée
   - ✅ Loi abrogeante "Loi n°2016-36" mentionnée
   - ✅ Date "15 mai 2016" ou "2016"
   - ✅ Note "Réforme complète..."
   - ✅ Bouton dismiss (X) fonctionnel

**Exemple visuel attendu** :
```
┌─────────────────────────────────────────────┐
│ ⚠️ Loi abrogée détectée [1]          [×]   │
│                                             │
│ 1. 🔴 CRITIQUE                              │
│    ⚠️ "Loi n°1968-07" a été totalement     │
│    abrogé le 15 mai 2016 par Loi n°2016-36 │
│    💡 Réforme complète du droit...         │
│    🔗 Voir la source                       │
└─────────────────────────────────────────────┘
```

---

#### Test 2 : Warning Citation Non Vérifiée

1. **Poser question** :
   ```
   Quels sont les délais selon l'Article 999 du Code Pénal ?
   ```
2. **Vérifier warning** :
   - ✅ Badge warning ambre visible
   - ✅ Texte "Citations non vérifiées"
   - ✅ Icône 📖 présente
   - ✅ Message conseil "Vérifiez sources officielles"

---

#### Test 3 : Détection Langue Arabe

1. **Poser question** :
   ```
   ما هي الإجراءات حسب القانون عدد 7 لسنة 1968 ؟
   ```
2. **Vérifier warning AR** :
   - ✅ Texte arabe : "قانون ملغى تم اكتشافه"
   - ✅ Severity arabe : "حرج" (CRITIQUE)

---

#### Test 4 : Pas de Warning (Loi en Vigueur)

1. **Poser question** :
   ```
   Quels sont les principes de la Loi n°2016-36 sur les difficultés des entreprises ?
   ```
2. **Vérifier ABSENCE warning** :
   - ✅ Pas de badge warning abrogation
   - ✅ Réponse normale affichée

---

## 📊 Monitoring Production

### Logs Warnings Abrogations

```bash
# SSH vers VPS
ssh root@84.247.165.187

# Logs warnings abrogations (temps réel)
docker logs -f moncabinet-nextjs | grep "Lois abrogées détectées"

# Logs dernières 1h
docker logs --since 1h moncabinet-nextjs 2>&1 | grep "abrogation"

# Compter occurrences dernières 24h
docker logs --since 24h moncabinet-nextjs 2>&1 | grep -c "abrogation"
```

**Exemple output** :
```
[RAG] ⚠️ 1 référence(s) juridique(s) abrogée(s) détectée(s) :
1. 🔴 CRITIQUE ⚠️ "Loi n°1968-07" a été totalement abrogé le 15 mai 2016...
```

---

### Logs Warnings Citations

```bash
# Logs citations non vérifiées
docker logs -f moncabinet-nextjs | grep "Citations non vérifiées"

# Compter occurrences
docker logs --since 24h moncabinet-nextjs 2>&1 | grep -c "Citations non vérifiées"
```

---

### Requêtes SQL Monitoring

```bash
# Top 5 lois abrogées les plus recherchées
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c "
SELECT
  abrogated_reference,
  COUNT(*) as searches
FROM legal_abrogations
GROUP BY abrogated_reference
ORDER BY searches DESC
LIMIT 5;
"

# Abrogations par scope
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c "
SELECT
  scope,
  COUNT(*) as count
FROM legal_abrogations
GROUP BY scope
ORDER BY count DESC;
"
```

---

## 🔄 Rollback (Si Nécessaire)

### Rollback Automatisé

Si déploiement échoue ou problèmes détectés :

```bash
# Lister backups disponibles
ssh root@84.247.165.187 "ls -lh /opt/moncabinet/backups/"

# Identifier dernier backup
BACKUP_FILE="backup_pre_phase2_YYYYMMDD_HHMMSS.sql.gz"

# Restaurer backup
ssh root@84.247.165.187 "
  cd /opt/moncabinet
  zcat backups/$BACKUP_FILE | docker exec -i moncabinet-postgres psql -U moncabinet -d moncabinet
"

# Vérifier table supprimée
ssh root@84.247.165.187 "
  docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c '\dt legal_abrogations'
"
# Attendu : "Did not find any relation named "legal_abrogations"."

# Redémarrer app
ssh root@84.247.165.187 "
  cd /opt/moncabinet
  docker-compose -f docker-compose.prod.yml restart nextjs
"
```

**Durée rollback** : ~2-3 minutes

---

### Rollback Partiel (Désactiver Warnings Seulement)

Si vous voulez garder la migration mais désactiver temporairement les warnings :

```bash
# Sur VPS
ssh root@84.247.165.187

# Désactiver détection abrogations
echo "ENABLE_ABROGATION_DETECTION=false" >> /opt/moncabinet/.env

# Désactiver validation citations
echo "ENABLE_CITATION_VALIDATION=false" >> /opt/moncabinet/.env

# Redémarrer
cd /opt/moncabinet
docker-compose -f docker-compose.prod.yml restart nextjs
```

**Réactiver plus tard** :
```bash
# Éditer .env
vim /opt/moncabinet/.env

# Changer false → true
ENABLE_ABROGATION_DETECTION=true
ENABLE_CITATION_VALIDATION=true

# Redémarrer
docker-compose -f docker-compose.prod.yml restart nextjs
```

---

## 🐛 Troubleshooting

### Erreur : Table legal_abrogations existe déjà

**Symptôme** :
```
ERROR: relation "legal_abrogations" already exists
```

**Solution** :
```bash
# Option 1 : Drop table et re-créer
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c "DROP TABLE IF EXISTS legal_abrogations CASCADE;"
docker exec -i moncabinet-postgres psql -U moncabinet -d moncabinet < migrations/20260210_legal_abrogations.sql

# Option 2 : Skip migration, utiliser table existante
# (Répondre 'N' au prompt du script deploy)
```

---

### Erreur : Seed abrogations échoue

**Symptôme** :
```
Cannot find module 'tsx' or @/lib/db/postgres
```

**Solution** :
```bash
# Vérifier dépendances installées dans container
docker exec moncabinet-nextjs npm list tsx

# Si manquant, installer
docker exec moncabinet-nextjs npm install -D tsx

# Re-exécuter seed
docker exec moncabinet-nextjs npx tsx scripts/seed-legal-abrogations.ts
```

---

### Warning ne s'affiche pas en production

**Causes possibles** :
1. ❌ Variables env `ENABLE_*_DETECTION=false`
2. ❌ Table `legal_abrogations` vide
3. ❌ Container Next.js pas redémarré après migration
4. ❌ Composants UI pas déployés

**Diagnostic** :
```bash
# 1. Vérifier variables env
docker exec moncabinet-nextjs printenv | grep ENABLE

# 2. Vérifier données table
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c "SELECT COUNT(*) FROM legal_abrogations;"

# 3. Vérifier logs erreurs
docker logs --since 10m moncabinet-nextjs 2>&1 | grep -i error

# 4. Vérifier fichiers UI
docker exec moncabinet-nextjs ls -la components/chat/ | grep Warning
```

---

### Health check failed après déploiement

**Symptôme** :
```
curl https://qadhya.tn/api/health
→ Connection refused ou timeout
```

**Solution** :
```bash
# Vérifier container running
docker ps | grep moncabinet-nextjs

# Si stopped, redémarrer
docker-compose -f docker-compose.prod.yml up -d nextjs

# Vérifier logs erreurs démarrage
docker logs --tail 100 moncabinet-nextjs
```

---

## 📈 Métriques de Succès

### Checklist Post-Déploiement

- [ ] **Migration appliquée** : Table `legal_abrogations` existe (13+ entrées)
- [ ] **Variables env OK** : `ENABLE_*_DETECTION=true`
- [ ] **Application healthy** : `curl /api/health` → `"status":"healthy"`
- [ ] **Page accessible** : `/chat-test` HTTP 200 ou 307
- [ ] **Warning visible** : Question "Loi n°1968-07" → Badge 🔴 CRITIQUE affiché
- [ ] **Détails complets** : Date, loi abrogeante, notes présents
- [ ] **Logs monitoring** : Logs "abrogation détectée" présents
- [ ] **Backup créé** : Fichier `.sql.gz` dans `/opt/moncabinet/backups/`

---

## 📚 Documentation Complémentaire

- **Phase 2.2 Summary** : `PHASE2.2_SUMMARY.md` (Validation Citations)
- **Phase 2.3 Summary** : `PHASE2.3_SUMMARY.md` (Détection Abrogations)
- **Composants UI** : `components/chat/README_LEGAL_WARNINGS.md`
- **Tests E2E** : `E2E_LEGAL_WARNINGS_SUMMARY.md`
- **Script déploiement** : `scripts/deploy-phase2-production.sh`
- **Script validation** : `scripts/validate-phase2-deployment.sh`

---

## 🎓 Leçons Apprises

1. **Backup TOUJOURS avant migration** : Rollback en <3 min si problème
2. **Variables env par défaut** : `ENABLE_*=true` si non défini (safe)
3. **Seed idempotent** : `ON CONFLICT DO NOTHING` permet re-exécution sans erreur
4. **Tests post-déploiement essentiels** : Script validation détecte 90% problèmes
5. **Logs monitoring critiques** : Vérifier logs warnings pour confirmer fonctionnement

---

**Guide complet - Phase 2 prête pour production !** 🚀

**Auteur** : Claude Sonnet 4.5
**Date** : 10 février 2026
**Version** : 1.0.0
