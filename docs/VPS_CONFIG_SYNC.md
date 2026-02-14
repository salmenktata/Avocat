# Synchronisation Configuration VPS

Documentation des différences entre config manuelle et déploiements GHA.

## 🔍 Constat

Le workflow GitHub Actions **NE synchronise PAS automatiquement** les fichiers suivants :
- `docker-compose.prod.yml`
- `docker-compose.yml`
- Scripts cron (sauf deploy-with-lock.sh, check-deploy-lock.sh)

**Impact** : Modifications locales de ces fichiers nécessitent copie manuelle sur VPS.

## 📊 État Actuel (14 Feb 2026)

### Container Production

**Méthode création** : `docker run` manuel (via `/tmp/deploy-fix-phase6.sh`)
- **Raison** : Fix urgent Phase 6 Manual Trigger
- **Configuration** : Variables env passées directement via `-e`
- **Variable critique** : `CRON_TRIGGER_SERVER_URL=http://host.docker.internal:9998/trigger`
- **Réseau** : `moncabinet_qadhya-network`
- **Status** : ✅ Fonctionnel

### Fichiers VPS

| Fichier | Status | Version | Méthode Sync |
|---------|--------|---------|--------------|
| `docker-compose.yml` | ✅ À jour | Commit 929a7d7 | Copie manuelle SCP |
| `docker-compose.prod.yml` | ❌ Obsolète | Pré-commit 1b68a29 | **Aucune** |
| `.env.production.local` | ✅ À jour | Secrets GHA | sed in-place |
| Scripts deploy | ✅ À jour | Latest | GHA copie auto |
| Scripts cron | ✅ À jour | - | Manuels |

### Divergence Critique

**docker-compose.prod.yml VPS manque** :
```yaml
CRON_TRIGGER_SERVER_URL: http://host.docker.internal:9998/trigger
```

**Commit avec fix** : `1b68a29` (GitHub ✅, VPS ❌)

## 🔄 Méthodes de Synchronisation

### Option A : Copie Manuelle (Recommandée pour hotfix)

```bash
# Depuis local
scp docker-compose.prod.yml root@84.247.165.187:/opt/moncabinet/

# Vérifier
ssh root@84.247.165.187 "grep CRON_TRIGGER /opt/moncabinet/docker-compose.prod.yml"
```

**Avantages** :
- Immédiat (30 secondes)
- Pas de rebuild container
- Pas de downtime

**Inconvénients** :
- Manuel (oubliable)
- Pas tracé dans logs GHA

### Option B : Déploiement GHA Tier 2 (Validation Complète)

```bash
# Trigger workflow avec force_docker
gh workflow run "Deploy to VPS Contabo" -f force_docker=true
```

**Avantages** :
- Valide workflow end-to-end
- Recrée container avec bonne config
- Tracé dans logs GHA

**Inconvénients** :
- Durée ~8-10 min
- Downtime ~40s
- **NÉCESSITE copie manuelle docker-compose.prod.yml AVANT** (car GHA ne le copie pas !)

### Option C : Améliorer Workflow GHA

Ajouter copie docker-compose.prod.yml dans workflow :

```yaml
# Dans .github/workflows/deploy-vps.yml
# Après ligne 475 (copie scripts)
- name: Copy docker-compose.prod.yml
  run: |
    scp -i ~/.ssh/id_rsa -P ${{ secrets.VPS_PORT }} \
      docker-compose.prod.yml \
      ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/opt/moncabinet/
```

**Avantages** :
- Synchronisation automatique future
- Évite oublis manuels
- Cohérence garantie

**Inconvénients** :
- Nécessite modification workflow
- Commit + test additionnel

## ✅ Recommandation

**Pour l'instant (urgence résolue)** :
1. ✅ Container fonctionne (créé manuellement)
2. ✅ Commits GitHub à jour (929a7d7, 0d38f65, 1b68a29)
3. ⏳ VPS docker-compose.prod.yml obsolète mais **non utilisé actuellement**

**Avant prochain déploiement Tier 2** :
```bash
# Synchroniser docker-compose.prod.yml
scp docker-compose.prod.yml root@84.247.165.187:/opt/moncabinet/

# Vérifier
ssh root@84.247.165.187 "grep -A 1 CRON_SECRET /opt/moncabinet/docker-compose.prod.yml"
```

**À long terme** :
- Améliorer workflow GHA (Option C)
- Documenter fichiers synchronisés vs manuels
- Créer checklist pre-deployment

## 🚨 Checklist Pre-Deployment Tier 2

Avant de déclencher un déploiement Tier 2 Docker :

- [ ] Vérifier docker-compose.prod.yml VPS à jour
  ```bash
  diff <(ssh root@vps cat /opt/moncabinet/docker-compose.prod.yml) docker-compose.prod.yml
  ```

- [ ] Copier si différent
  ```bash
  scp docker-compose.prod.yml root@vps:/opt/moncabinet/
  ```

- [ ] Vérifier règle UFW port 9998
  ```bash
  ssh root@vps "ufw status | grep 9998"
  ```

- [ ] Vérifier trigger server actif
  ```bash
  ssh root@vps "systemctl status cron-trigger-server"
  ```

- [ ] Tester manual trigger après déploiement
  ```bash
  curl https://qadhya.tn/api/admin/cron-executions/trigger \
    -H 'Content-Type: application/json' \
    -d '{"cronName":"monitor-openai"}'
  ```

## 📚 Références

- **Bug #8** : `~/.claude/memory/bugs-fixes.md`
- **VPS Deployment** : `docs/VPS_DEPLOYMENT_CHECKLIST.md`
- **Manual Trigger** : `docs/MANUAL_TRIGGER_GUIDE.md`
- **Workflow GHA** : `.github/workflows/deploy-vps.yml`

---

**Dernière mise à jour** : 14 février 2026
**Container actuel** : `docker run` manuel (fonctionnel)
**Prochain sync requis** : docker-compose.prod.yml avant Tier 2
