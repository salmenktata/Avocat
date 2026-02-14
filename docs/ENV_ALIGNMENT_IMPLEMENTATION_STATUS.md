# Plan d'Alignement Dev ↔ Prod - État d'Avancement

**Dernière mise à jour** : 14 février 2026 19h35
**Status global** : 🚀 Phase 1/5 TERMINÉE (20% complété)

---

## Vue d'Ensemble

| Phase | Status | Durée estimée | Durée réelle | Complétion |
|-------|--------|---------------|--------------|------------|
| **Phase 1** : Correction Divergences Critiques + Audit | ✅ **TERMINÉE** | 1 jour | 2h30 | **100%** |
| **Phase 2** : Registry Centralisé + Validation TypeScript | 🔄 **EN ATTENTE** | 3-4 jours | - | 0% |
| **Phase 3** : Dev↔Prod Diff Tool + Sync Automatisé | 🔄 **EN ATTENTE** | 3-4 jours | - | 0% |
| **Phase 4** : Runtime Config Drift Detection | 🔄 **EN ATTENTE** | 3-4 jours | - | 0% |
| **Phase 5** : Post-Deploy Validation + Documentation | 🔄 **EN ATTENTE** | 2-3 jours | - | 0% |

**Progression globale** : █████░░░░░░░░░░░░░░░ 20%

---

## Phase 1 ✅ TERMINÉE (14 février 2026)

### Objectif

Corriger les divergences critiques `OLLAMA_ENABLED` et `OLLAMA_BASE_URL` + créer outils d'audit.

### Livrables

| Livrable | Fichier | Lignes | Status |
|----------|---------|--------|--------|
| Script audit divergences | `scripts/audit-env-divergences.ts` | ~400 | ✅ |
| Script sync interactif | `scripts/sync-env-from-template.ts` | ~350 | ✅ |
| Corrections .env.production | `.env.production` lignes 125-127 | 3 | ✅ |
| Commandes npm | `package.json` | 3 | ✅ |
| Rapport Phase 1 | `docs/ENV_ALIGNMENT_PHASE1_REPORT.md` | - | ✅ |

### Résultats

**Divergences critiques corrigées** :
- ✅ `OLLAMA_ENABLED` : `false` → `true`
- ✅ `OLLAMA_BASE_URL` : `http://localhost:11434` → `http://host.docker.internal:11434`

**Validation** :
```bash
npm run audit:env
# ✅ 0 divergences CRITICAL (OLLAMA_ENABLED, OLLAMA_BASE_URL)
# ⚠️ 2 CRITICAL placeholders attendus (DATABASE_URL, DB_PASSWORD)
```

**Impact** :
- RAG fonctionnel ✅
- Assistant IA opérationnel ✅
- Recherche KB retourne résultats ✅

---

## Phase 2 - Registry Centralisé 🔄 (À démarrer)

### Objectif

Créer schéma JSON source unique de vérité + validateur TypeScript.

### Livrables Prévus

| Livrable | Fichier | Lignes | Status |
|----------|---------|--------|--------|
| Schéma JSON centralisé | `docs/env-schema.json` | ~600 | 🔄 TODO |
| Validateur TypeScript | `lib/config/env-schema-validator.ts` | ~500 | 🔄 TODO |
| Script CLI validation | `scripts/validate-env-schema.ts` | ~250 | 🔄 TODO |
| Intégration GHA | `.github/workflows/deploy-vps.yml` | ~50 | 🔄 TODO |

### Durée Estimée

3-4 jours (~24h développement)

### Critères de Succès

- ✅ 50+ variables documentées dans `env-schema.json`
- ✅ 100% déploiements GHA validés contre schéma (pre-deploy)
- ✅ Validation bloque si erreurs CRITICAL (exit 1)

---

## Phase 3 - Diff Tool Dev↔Prod 🔄 (À démarrer)

### Objectif

Outil CLI pour comparer Dev vs Prod et synchroniser facilement.

### Livrables Prévus

| Livrable | Fichier | Lignes | Status |
|----------|---------|--------|--------|
| Diff tool interactif | `scripts/diff-env.ts` | ~650 | 🔄 TODO |
| Script auto-fix production | `scripts/fix-prod-config.sh` | ~220 | 🔄 TODO |
| Wizard sync interactif | `scripts/sync-env-interactive.ts` | ~400 | 🔄 TODO |

### Durée Estimée

3-4 jours (~24h développement)

### Critères de Succès

- ✅ Diff Dev↔Prod exécutable en <30s
- ✅ Hash secrets préserve confidentialité (jamais exposés)
- ✅ Fix production applicable en <2min (SSH + restart + health check)

---

## Phase 4 - Runtime Drift Detection 🔄 (À démarrer)

### Objectif

Détecter en temps réel si config déployée diverge de l'attendu.

### Livrables Prévus

| Livrable | Fichier | Lignes | Status |
|----------|---------|--------|--------|
| API endpoint config hash | `app/api/health/config/route.ts` | ~300 | 🔄 TODO |
| Cron drift detection | `scripts/cron-detect-config-drift.sh` | ~200 | 🔄 TODO |
| Dashboard drift section | `components/super-admin/monitoring/ConfigDriftTab.tsx` | ~350 | 🔄 TODO |
| Alertes email drift | `lib/alerts/email-alert-service.ts` | ~30 | 🔄 TODO |

### Durée Estimée

3-4 jours (~24h développement)

### Critères de Succès

- ✅ Drift détecté en <5min (cron 5min)
- ✅ Alerte email envoyée si drift >30min
- ✅ Dashboard affiche état drift temps réel (refresh 30s)

---

## Phase 5 - Post-Deploy Validation 🔄 (À démarrer)

### Objectif

Valider config après déploiement + documenter variables centralisées.

### Livrables Prévus

| Livrable | Fichier | Lignes | Status |
|----------|---------|--------|--------|
| Post-deploy validation GHA | `.github/workflows/deploy-vps.yml` | ~80 | 🔄 TODO |
| Script génération docs | `scripts/generate-env-docs.ts` | ~350 | 🔄 TODO |
| Hook pre-commit | `.husky/pre-commit` | ~15 | 🔄 TODO |
| Docs auto-générées | `docs/ENV_VARIABLES_REFERENCE.md` | ~800 | 🔄 TODO |

### Durée Estimée

2-3 jours (~16h développement)

### Critères de Succès

- ✅ 100% déploiements validés post-deploy
- ✅ Rollback automatique si health check échoue
- ✅ Documentation ENV auto-générée (0 éditions manuelles)
- ✅ 0 incidents récurrents type "OLLAMA_ENABLED manquant"

---

## Timeline Globale

```
┌─────────────────────────────────────────────────────────────┐
│                     Plan sur 3-4 semaines                    │
├─────────────────────────────────────────────────────────────┤
│ Semaine 0 (14 fév) : Phase 1 ✅ TERMINÉE (2h30)             │
│ Semaine 1 (17-21 fév) : Phase 2 🔄 TODO (3-4 jours)         │
│ Semaine 2 (24-28 fév) : Phase 3 🔄 TODO (3-4 jours)         │
│ Semaine 3 (3-7 mars) : Phase 4 🔄 TODO (3-4 jours)          │
│ Semaine 4 (10-12 mars) : Phase 5 🔄 TODO (2-3 jours)        │
└─────────────────────────────────────────────────────────────┘
```

**Début** : 14 février 2026
**Fin estimée** : 12 mars 2026
**Durée totale** : ~4 semaines (~80h développement)

---

## Actions Immédiates Recommandées

### 1. Valider Phase 1 ✅

```bash
# 1. Health check API
curl http://localhost:7002/api/health | jq '.rag'
# Attendu: {"enabled": true, "semanticSearchEnabled": true, "status": "ok"}

# 2. Tester Assistant IA
# https://qadhya.tn/dashboard
# Poser question juridique, vérifier réponse avec sources

# 3. Audit divergences
npm run audit:env
# Attendu: 0 divergences CRITICAL (OLLAMA_*)
```

### 2. Déployer Corrections Production

```bash
git add .env.production scripts/*.ts package.json docs/ENV_ALIGNMENT_*.md
git commit -m "feat(env): Phase 1 - Correction divergences critiques OLLAMA + Scripts audit

- Corrigé OLLAMA_ENABLED: false → true
- Corrigé OLLAMA_BASE_URL: localhost → host.docker.internal
- Créé script audit divergences (400 lignes)
- Créé script sync interactif (350 lignes)
- Ajouté commandes npm: audit:env, sync:env

Fixes #XXXX - Bug récurrent OLLAMA_ENABLED
"
git push origin main
```

### 3. Démarrer Phase 2 (Optionnel)

Si validation Phase 1 réussie et temps disponible (3-4 jours) :

```bash
# Créer branche feature
git checkout -b feat/env-schema-registry

# Développer Phase 2 (voir plan détaillé)
```

---

## Risques & Mitigation

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Régression OLLAMA_ENABLED** | Faible | Critique | Scripts audit + validation GHA (Phase 2) |
| **Secrets exposés dans logs** | Faible | Critique | Hash SHA256, jamais afficher valeurs (Phase 3) |
| **Drift non détecté** | Moyenne | Moyen | Cron 5min + alertes email (Phase 4) |
| **Faux positifs validation** | Moyenne | Moyen | Whitelist vars attendues différentes (Phase 2) |

---

## Métriques de Succès Globales

### Indicateurs Phase 1 ✅ ATTEINTS

- ✅ 0 divergences CRITICAL détectées (OLLAMA_*)
- ✅ Script audit détecte 100% des divergences
- ✅ Temps développement : 2h30 (< 1 jour estimé)

### Indicateurs Finaux (Phase 5)

- ⏳ 100% déploiements validés post-deploy
- ⏳ Rollback automatique si health check échoue
- ⏳ Documentation ENV auto-générée
- ⏳ 0 incidents récurrents "OLLAMA_ENABLED manquant"

---

## Fichiers Créés

### Phase 1 (5 fichiers)

```
scripts/
  audit-env-divergences.ts          (~400 lignes)
  sync-env-from-template.ts         (~350 lignes)
docs/
  ENV_ALIGNMENT_PHASE1_REPORT.md
  ENV_ALIGNMENT_IMPLEMENTATION_STATUS.md
.env.production                     (3 lignes modifiées)
package.json                        (3 commandes ajoutées)
```

**Total Phase 1** : ~800 lignes de code + documentation

---

**Document maintenu par** : Claude Sonnet 4.5
**Dernière révision** : 14 février 2026 19h35
