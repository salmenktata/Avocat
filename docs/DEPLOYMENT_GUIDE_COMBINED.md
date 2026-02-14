# Guide Déploiement Combiné - Qadhya IA + Dynamic Providers

**Date:** 15 février 2026
**Commits:** `bfdd949`, `5087f62`, `2adeef9`, `9c89bca`

---

## 🎯 Systèmes à Déployer

### 1. Qadhya IA Unifiée
- Interface unifiée `/qadhya-ia`
- 3 modes (Chat, Structure, Consult)
- Création dossier automatique
- Migration : `20260215000001_add_chat_messages_metadata.sql`

### 2. Dynamic Providers
- Configuration IA par opération
- UI admin `/super-admin/settings?tab=operations-config`
- Test providers temps réel
- Migration : `20260215_create_operation_provider_configs.sql`

---

## ⏱️ Temps Estimé Total

- Backup : **2 min**
- Push/Deploy GHA : **10-12 min** (Tier 2 Docker)
- Migrations DB : **1 min** (2 migrations)
- Tests validation : **8-10 min** (2 systèmes)

**Total : ~25-30 minutes**

---

## 📋 Checklist Pré-Déploiement

- [x] Code pushé sur GitHub (`9c89bca`)
- [ ] Backup DB production
- [ ] Tag Git créé
- [ ] Variables d'environnement vérifiées
- [ ] Migrations SQL prêtes

---

## 🚀 Étape 1 : Backup & Préparation

### 1.1 Backup Critique

```bash
# SSH vers VPS
ssh root@84.247.165.187

# Backup complet
/opt/qadhya/backup.sh

# Vérifier backup créé
ls -lh /opt/backups/moncabinet/ | tail -5
```

**Résultat attendu :**
```
-rw-r--r-- 1 root root  45M Feb 15 20:45 postgres_qadhya_20260215_2045.sql.gz
-rw-r--r-- 1 root root  49M Feb 15 20:45 moncabinet_code_20260215_2045.tar.gz
```

### 1.2 Tag Git

```bash
# Local
git tag v1.1.0-qadhya-ia-dynamic-providers
git push --tags
```

### 1.3 Vérifier Variables Environnement

```bash
# SSH VPS
ssh root@84.247.165.187

# Vérifier fichier .env
docker exec qadhya-nextjs env | grep -E "(GROQ|GOOGLE|DEEPSEEK|OLLAMA|OPENAI)" | head -10
```

**Variables requises :**
- `GROQ_API_KEY`
- `GOOGLE_API_KEY` (Gemini)
- `DEEPSEEK_API_KEY`
- `OLLAMA_ENABLED=true`
- `OPENAI_API_KEY` (embeddings)

---

## 🔄 Étape 2 : Déploiement GitHub Actions

### 2.1 Vérifier Workflow Ready

```bash
# Vérifier dernier commit
git log --oneline -1
# 9c89bca feat(ai-config): Système Dynamic Providers

# Code déjà pushé, GHA devrait se déclencher automatiquement
```

### 2.2 Monitorer Déploiement

```bash
# Voir runs GitHub Actions
gh run list --limit 5

# Suivre le run en cours
gh run watch
```

**OU** via navigateur : https://github.com/salmenktata/MonCabinet/actions

### 2.3 Attendre Fin Déploiement

**Temps estimé : 10-12 min** (Tier 2 - Docker rebuild)

**Étapes du workflow :**
1. ✅ Checkout code
2. ✅ Build Docker image
3. ✅ Upload vers VPS
4. ✅ Deploy (docker-compose up)
5. ✅ Health check

---

## 💾 Étape 3 : Migrations Base de Données

### 3.1 Migration 1 : Qadhya IA (chat_messages.metadata)

```bash
# SSH VPS
ssh root@84.247.165.187

# Exécuter migration
docker exec qadhya-postgres psql -U moncabinet -d qadhya -f \
  /opt/qadhya/db/migrations/20260215000001_add_chat_messages_metadata.sql
```

**Résultat attendu :**
```
ALTER TABLE
CREATE INDEX
COMMENT
NOTICE: ✅ Colonne metadata ajoutée à chat_messages
NOTICE: 📊 Index GIN créé pour metadata->actionType
```

### 3.2 Migration 2 : Dynamic Providers

```bash
# Toujours en SSH sur VPS
docker exec qadhya-postgres psql -U moncabinet -d qadhya -f \
  /opt/qadhya/db/migrations/20260215_create_operation_provider_configs.sql
```

**Résultat attendu :**
```
CREATE TYPE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
INSERT 0 4
NOTICE: ✅ Table operation_provider_configs créée
NOTICE: 📊 4 configurations par défaut insérées
```

### 3.3 Vérification Migrations

```bash
# Vérifier colonne metadata
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \
  "SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'chat_messages' AND column_name = 'metadata';"

# Résultat attendu:
# column_name | data_type
# ------------+-----------
# metadata    | jsonb

# Vérifier table operation_provider_configs
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \
  "SELECT operation_name, provider, priority, is_active
   FROM operation_provider_configs
   ORDER BY operation_name, priority;"

# Résultat attendu: 4 configs (indexation, assistant-ia, dossiers-assistant, dossiers-consultation)
```

---

## ✅ Étape 4 : Validation Système

### 4.1 Health Check API

```bash
curl https://qadhya.tn/api/health | jq
```

**Résultat attendu :**
```json
{
  "status": "healthy",
  "uptime": 125,
  "services": {
    "database": "healthy",
    "storage": "healthy",
    "api": "healthy"
  },
  "rag": {
    "enabled": true,
    "kbDocsIndexed": "8987",
    "kbChunksAvailable": "14248",
    "status": "ok"
  }
}
```

### 4.2 Test Qadhya IA

#### Test 1 : Interface Accessible

```bash
# Vérifier page charge
curl -I https://qadhya.tn/qadhya-ia | grep "200 OK"
```

#### Test 2 : Chat API

```bash
# Créer session (remplacer avec votre session cookie)
curl -X POST https://qadhya.tn/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "question": "Test déploiement",
    "actionType": "chat"
  }' | jq '.answer'
```

**Résultat attendu :** Réponse IA valide

#### Test 3 : Metadata Sauvegardée

```bash
# Vérifier metadata en DB
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \
  "SELECT id, metadata->>'actionType' as action_type
   FROM chat_messages
   WHERE metadata IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 5;"
```

### 4.3 Test Dynamic Providers

#### Test 1 : API Operations Config

```bash
# Liste configurations
curl https://qadhya.tn/api/admin/operations-config \
  -H "Cookie: session=YOUR_SESSION_COOKIE" | jq
```

**Résultat attendu :**
```json
{
  "success": true,
  "configs": [
    {
      "operation_name": "indexation",
      "provider": "ollama",
      "priority": 1,
      "is_active": true
    },
    // ... 3 autres configs
  ]
}
```

#### Test 2 : Test Provider

```bash
# Tester Groq
curl -X POST https://qadhya.tn/api/admin/operations-config/test-provider \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "provider": "groq",
    "operationName": "assistant-ia"
  }' | jq
```

**Résultat attendu :**
```json
{
  "success": true,
  "responseTime": 250,
  "response": "Test successful",
  "model": "llama-3.3-70b-versatile"
}
```

---

## 🖥️ Étape 5 : Tests Manuels UI

### 5.1 Qadhya IA Unifiée

**URL :** https://qadhya.tn/qadhya-ia

**Checklist :**
- [ ] Page charge correctement
- [ ] 3 boutons d'action visibles (Chat, Structure, Consult)
- [ ] Sidebar conversations affichée
- [ ] Responsive mobile (Sheet)

**Test Workflow Chat :**
1. Cliquer "💬 Conversation"
2. Entrer : "Quelle est la prescription civile ?"
3. Envoyer
4. ✅ Réponse avec sources

**Test Workflow Structure :**
1. Cliquer "📋 Structurer un dossier"
2. Entrer : "Mon client a été licencié abusivement le 10 janvier 2026. Il travaillait depuis 5 ans comme comptable chez ABC SARL."
3. Envoyer
4. ✅ Card structure affichée (parties, faits)
5. Cliquer "Créer le dossier"
6. ✅ Redirection vers `/dossiers/{id}`
7. ✅ Vérifier dossier créé

**Test Workflow Consult :**
1. Cliquer "⚖️ Conseil juridique"
2. Entrer : "Puis-je attaquer en diffamation ?"
3. Envoyer
4. ✅ Card IRAC affichée (Problématique, Règles, Analyse, Conclusion)
5. ✅ Sources juridiques citées

### 5.2 Dynamic Providers

**URL :** https://qadhya.tn/super-admin/settings?tab=operations-config

**Checklist :**
- [ ] Onglet "Operations Config" visible
- [ ] 4 cards opérations affichées
- [ ] Providers listés avec priorités
- [ ] Boutons "Tester" fonctionnels

**Test Workflow :**
1. Sélectionner opération "assistant-ia"
2. Voir providers : Groq (priorité 1), Gemini (2), etc.
3. Cliquer "Tester" sur Groq
4. ✅ Badge vert "✓ 250ms"
5. Modifier priorité (drag & drop)
6. Cliquer "Enregistrer les modifications"
7. ✅ Toast succès
8. Recharger page
9. ✅ Modifications persistées

---

## 📊 Étape 6 : Monitoring Post-Déploiement

### 6.1 Logs Application

```bash
# Logs Next.js
docker logs qadhya-nextjs --tail 100 -f

# Filtrer erreurs
docker logs qadhya-nextjs --tail 500 | grep -i error
```

### 6.2 Métriques DB

```bash
# Nouvelles conversations Qadhya IA
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \
  "SELECT COUNT(*) FROM chat_conversations
   WHERE created_at > NOW() - INTERVAL '1 hour';"

# Messages par actionType
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \
  "SELECT
     metadata->>'actionType' as action_type,
     COUNT(*) as count
   FROM chat_messages
   WHERE metadata IS NOT NULL
   AND created_at > NOW() - INTERVAL '1 hour'
   GROUP BY metadata->>'actionType';"

# Configs Dynamic Providers
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \
  "SELECT operation_name, COUNT(*) as providers_count
   FROM operation_provider_configs
   WHERE is_active = true
   GROUP BY operation_name;"
```

### 6.3 Monitoring Dashboard

**URL :** https://qadhya.tn/super-admin/monitoring

**Vérifier :**
- [ ] Aucune alerte critique
- [ ] Métriques normales
- [ ] Pas de spike erreurs

---

## 🔙 Plan Rollback (Si Problème Critique)

### Rollback Code

```bash
# Local
git revert 9c89bca  # Dynamic Providers
git revert 5087f62  # Qadhya IA Phase 6-8
git revert bfdd949  # Qadhya IA Phase 1-5
git push origin main

# Attendre redéploiement GHA (~10 min)
```

### Rollback DB

```bash
# SSH VPS
ssh root@84.247.165.187

# Rollback migrations
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c "
  -- Rollback Qadhya IA
  ALTER TABLE chat_messages DROP COLUMN IF EXISTS metadata;
  DROP INDEX IF EXISTS idx_chat_messages_metadata_action_type;

  -- Rollback Dynamic Providers
  DROP TABLE IF EXISTS operation_provider_configs;
  DROP TYPE IF EXISTS ai_provider_enum;
"
```

### Restaurer Backup (Dernier Recours)

```bash
# Voir backups disponibles
ls -lh /opt/backups/moncabinet/

# Restaurer (ATTENTION: perte données depuis backup)
# À ne faire QUE si absolument nécessaire
/opt/qadhya/scripts/restore-backup.sh /opt/backups/moncabinet/postgres_qadhya_20260215_2045.sql.gz
```

**Temps rollback : 15-20 min**

---

## 📝 Checklist Post-Déploiement

### Fonctionnel

- [ ] Qadhya IA : 3 modes fonctionnels
- [ ] Qadhya IA : Création dossier OK
- [ ] Qadhya IA : Metadata sauvegardée
- [ ] Dynamic Providers : UI accessible
- [ ] Dynamic Providers : Test providers OK
- [ ] Dynamic Providers : Modifications persistées

### Technique

- [ ] 0 erreur logs
- [ ] Health check OK
- [ ] Migrations appliquées
- [ ] DB cohérente
- [ ] Performance normale

### Documentation

- [ ] Changelog mis à jour
- [ ] Équipe notifiée
- [ ] Tests validés documentés

---

## 🎉 Validation Finale

**Si tous les tests passent :**

✅ **Déploiement réussi !**

**Les 2 systèmes sont maintenant en production :**
1. Qadhya IA Unifiée (`/qadhya-ia`)
2. Dynamic Providers (`/super-admin/settings`)

**Métriques à surveiller (premières 24h) :**
- Utilisation Qadhya IA par mode (chat/structure/consult)
- Taux conversion structuration → dossier
- Temps réponse par provider
- Erreurs API

---

## 📞 Support

**En cas de problème :**

1. **Vérifier logs :** `docker logs qadhya-nextjs`
2. **Consulter monitoring :** https://qadhya.tn/super-admin/monitoring
3. **Rollback si critique :** Voir section "Plan Rollback"

**Documentation complète :**
- `/docs/QADHYA_IA_FINAL_SUMMARY.md`
- `/docs/DYNAMIC_PROVIDERS_README.md`
- `/docs/DEPLOYMENT_ROLLBACK_TROUBLESHOOTING.md`

---

**Dernière mise à jour :** 15 février 2026 - 21h00
**Auteur :** Claude Sonnet 4.5
**Statut :** ✅ Prêt pour déploiement production

🚀 **Let's Deploy!**
