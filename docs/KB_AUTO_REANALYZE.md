# Réanalyse Automatique KB Échecs

**Date** : 13 février 2026
**Statut** : ✅ Production Ready

## 🎯 Objectif

Corriger automatiquement les documents KB échoués (score=50) en les réanalysant avec OpenAI/Gemini, sans intervention manuelle.

## 📋 Fonctionnement

### Cron Quotidien

- **Schedule** : Tous les jours à **4h du matin**
- **Après** : Indexation overnight (cron 3h)
- **Durée** : ~5-10 minutes (max 250 docs/jour)
- **Logs** : `/var/log/qadhya/reanalyze-kb.log`

### Logique

1. **Détection** : Compte les documents avec `quality_score = 50`
2. **Batches** : Traite par lots de 50 documents
3. **Limite** : Maximum 5 batches = 250 docs/jour
4. **API** : Appelle `/api/admin/kb/reanalyze-failed`
5. **Stats** : Log succès, échecs, améliorations, score moyen

### Sécurité

- ✅ Utilise `X-Cron-Secret` pour authentification
- ✅ Rate limiting : 1s pause entre docs (dans API)
- ✅ Limite quotidienne : 250 docs max
- ✅ Logs détaillés pour audit

## 🚀 Installation Production

### 1. Déployer le Script

```bash
# Le script sera déployé automatiquement dans /opt/qadhya/scripts/
git add scripts/cron-reanalyze-kb-failures.sh
git commit -m "feat(kb): Cron automatique réanalyse échecs KB"
git push origin main
```

### 2. Configurer Crontab VPS

```bash
# SSH sur le VPS
ssh root@84.247.165.187

# Éditer crontab
crontab -e

# Ajouter la ligne suivante :
0 4 * * * /opt/qadhya/scripts/cron-reanalyze-kb-failures.sh >> /var/log/qadhya/cron-reanalyze.log 2>&1
```

### 3. Vérifier Installation

```bash
# Tester le script manuellement
bash /opt/qadhya/scripts/cron-reanalyze-kb-failures.sh

# Vérifier les logs
tail -f /var/log/qadhya/reanalyze-kb.log

# Vérifier crontab
crontab -l | grep reanalyze
```

## 📊 Exemple de Sortie

```
[2026-02-14 04:00:01] ==========================================
[2026-02-14 04:00:01] Début réanalyse automatique KB échecs
[2026-02-14 04:00:01] ==========================================
[2026-02-14 04:00:01] ✅ CRON_SECRET récupéré
[2026-02-14 04:00:01] 📊 Vérification nombre d'échecs...
[2026-02-14 04:00:02] 📋 Échecs détectés: 23
[2026-02-14 04:00:02] 🚀 Lancement de 1 batch(es) de 50 documents
[2026-02-14 04:00:02]
[2026-02-14 04:00:02] 📦 Batch 1/1 en cours...
[2026-02-14 04:01:15] ✅ Traités: 23 | Succès: 23 | Améliorés: 23 | Échecs: 0
[2026-02-14 04:01:15]
[2026-02-14 04:01:15] ==========================================
[2026-02-14 04:01:15] 📈 Résultat final
[2026-02-14 04:01:15] ==========================================
[2026-02-14 04:01:15] ✅ Succès total: 23
[2026-02-14 04:01:15] 📈 Améliorés: 23
[2026-02-14 04:01:15] ❌ Échecs: 0
[2026-02-14 04:01:16] 📊 Échecs restants: 0
[2026-02-14 04:01:16] ⭐ Score moyen KB: 81.8
[2026-02-14 04:01:16]
[2026-02-14 04:01:16] ✅ Réanalyse automatique terminée
[2026-02-14 04:01:16] ==========================================
[2026-02-14 04:01:16] 🎉 Tous les batches ont réussi
```

## 🔧 Configuration

### Variables (dans le script)

```bash
BATCH_SIZE=50        # Docs par batch
MAX_BATCHES=5        # Max batches/jour (= 250 docs)
API_URL="http://localhost:7002/api/admin/kb/reanalyze-failed"
LOG_DIR="/var/log/qadhya"
```

### Modifier le Schedule

```bash
# Changer l'heure d'exécution
# Format crontab : minute heure jour mois jour_semaine

# Exemple : Tous les jours à 2h du matin
0 2 * * * /opt/qadhya/scripts/cron-reanalyze-kb-failures.sh

# Exemple : Toutes les 6 heures
0 */6 * * * /opt/qadhya/scripts/cron-reanalyze-kb-failures.sh

# Exemple : Uniquement le dimanche à 3h
0 3 * * 0 /opt/qadhya/scripts/cron-reanalyze-kb-failures.sh
```

## 📈 Monitoring

### Voir les Logs

```bash
# Logs temps réel
tail -f /var/log/qadhya/reanalyze-kb.log

# Dernières exécutions
tail -100 /var/log/qadhya/reanalyze-kb.log | grep "Début réanalyse"

# Stats dernière exécution
tail -20 /var/log/qadhya/reanalyze-kb.log
```

### Vérifier État KB

```bash
# Compter échecs actuels
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \
  "SELECT COUNT(*) as failures FROM knowledge_base WHERE is_active = true AND quality_score = 50;"

# Score moyen
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \
  "SELECT ROUND(AVG(quality_score), 1) as avg_score FROM knowledge_base WHERE is_active = true AND quality_score IS NOT NULL;"
```

### Dashboard

- **URL** : https://qadhya.tn/super-admin/monitoring?tab=kb-quality
- **Métriques** : Échecs, score moyen, progression batch
- **Auto-refresh** : 30s

## 🐳 Détection Dynamique des Conteneurs

Le script détecte automatiquement les noms des conteneurs Docker, ce qui le rend robuste contre les redémarrages et les noms avec préfixes hash.

```bash
# Détection automatique
NEXTJS_CONTAINER=$(docker ps --filter "name=nextjs" --format "{{.Names}}" | head -1)
POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)

# Exemple de sortie
# Next.js: qadhya-nextjs
# PostgreSQL: 275ce01791bf_qadhya-postgres
```

**Avantages** :
- ✅ Fonctionne même si le nom du conteneur change
- ✅ Robuste contre les préfixes hash Docker
- ✅ Logs affichent les conteneurs détectés pour debugging

## 🛠️ Troubleshooting

### Le Cron Ne S'exécute Pas

```bash
# Vérifier cron service
systemctl status cron

# Vérifier logs cron système
grep CRON /var/log/syslog | tail -20

# Tester manuellement
bash -x /opt/qadhya/scripts/cron-reanalyze-kb-failures.sh
```

### Erreur "CRON_SECRET vide"

```bash
# Vérifier variable dans conteneur
docker exec qadhya-nextjs env | grep CRON_SECRET

# Redémarrer conteneur si nécessaire
docker-compose -f /opt/qadhya/docker-compose.yml restart nextjs
```

### Logs Vides

```bash
# Vérifier permissions
ls -la /var/log/qadhya/

# Créer répertoire si nécessaire
mkdir -p /var/log/qadhya
chmod 755 /var/log/qadhya
```

## 💰 Coûts

### Estimation

- **1 doc** : ~$0.0004 (gpt-4o-mini)
- **50 docs** : ~$0.02
- **250 docs/jour** : ~$0.10/jour = **$3/mois**
- **Budget** : $10/mois → Capacité 3,300 docs/mois

### Optimisation

Le système est déjà optimisé :
- ✅ OpenAI uniquement pour docs courts (<500 chars)
- ✅ Gemini gratuit pour docs longs
- ✅ Limite 250 docs/jour = budget contrôlé

## 📋 Checklist Déploiement

- [x] Script déployé dans `/opt/moncabinet/scripts/` ✅ (13 février 2026, 21h50)
- [x] Permissions exécutables : `chmod +x` ✅ (-rwxr-xr-x root)
- [x] Crontab configuré : `0 4 * * *` ✅ (exécution quotidienne 4h)
- [x] Test manuel réussi ✅ (0 échec détecté, détection conteneurs OK)
- [x] Logs visibles : `/var/log/qadhya/reanalyze-kb.log` ✅ (883 bytes)
- [x] Dashboard monitoring accessible ✅ (https://qadhya.tn/super-admin/monitoring?tab=kb-quality)
- [x] Budget OpenAI surveillé ✅ (cron quotidien 9h)

**Statut** : ✅ Installation complète et opérationnelle (13 février 2026, 21h52)
**Prochaine exécution** : Demain 4h00 (automatique)

## 🎯 Résultats Attendus

Avec ce cron automatique :

- ✅ **0 échec** maintenu quotidiennement
- ✅ **Score moyen >80** constant
- ✅ **Aucune intervention manuelle**
- ✅ **Logs auditables**
- ✅ **Coût prévisible** (~$3/mois)

---

**Dernière mise à jour** : 13 février 2026
**Version** : 1.0
**Status** : Production Ready ✅
