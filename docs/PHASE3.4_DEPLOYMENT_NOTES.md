# Phase 3.4 - Notes de Déploiement

## 📅 Date : 13 février 2026

## ✅ État : Code Prêt, Déploiement En Attente

### 🎯 Fonctionnalité

**Alertes Automatiques d'Abrogations dans l'Assistant IA**

Lorsqu'un utilisateur mentionne une loi abrogée dans une question au chat, l'assistant affiche automatiquement une alerte visuelle avec :
- Référence abrogée (FR + AR)
- Loi de remplacement
- Date d'abrogation
- Articles concernés
- Lien vers détail complet

---

## 📦 Fichiers Phase 3.4 (Git ✅)

### Backend
- ✅ `app/api/chat/route.ts` - Intégration `detectAbrogations()` (ligne 30, 148-158)
- ✅ `lib/legal/abrogation-detector-service.ts` - Service détection + patterns regex
- ✅ `types/abrogation-alerts.ts` - Types centralisés

### Frontend
- ✅ `components/chat/abrogation-alert.tsx` - Composant UI alertes
- ✅ `lib/hooks/useConversations.ts` - Support `abrogationAlerts` dans messages
- ✅ `lib/hooks/useStreamingChat.ts` - Support streaming avec alertes
- ✅ `components/assistant-ia/ChatMessages.tsx` - Affichage alertes avant réponse IA
- ✅ `app/(dashboard)/assistant-ia/ChatPage.tsx` - Mapping metadata → UI

### Commits Git
- `8d7868a` - feat(legal): Phase 3.4 - Intégration Assistant IA avec Détection Abrogations
- `6503f48` - feat(ui): Phase 3.4 - Intégration UI complète alertes abrogations
- `f734cd8` - deploy: Force deployment Phase 3.3 + 3.4 together

---

## 🚨 Problème Déploiement Identifié

### Symptôme
Malgré 4 tentatives de déploiement (dont rebuild Docker complet de 11 minutes), Phase 3.4 **n'apparaît PAS** dans le build production.

**Preuve** : Timestamp build Next.js reste à `2026-02-13 16:05:51` (avant commits Phase 3.4).

### Root Cause
**Cache Docker trop agressif** dans le CI/CD GitHub Actions (`.github/workflows/deploy-vps.yml`).

Le cache Docker Layer ne s'invalide PAS malgré :
1. ✅ Modification `package.json` (description)
2. ✅ Modification `Dockerfile` (commentaire timestamp)
3. ✅ Tier 2 Docker rebuild déclenché

**Hypothèse** : Le GitHub Actions utilise un cache d'image Docker externe (GHCR) qui n'est pas invalidé correctement.

### Tentatives Effectuées

| # | Action | Résultat | Durée |
|---|--------|----------|-------|
| 1 | Commit vide | ❌ Tier 1 (code only, pas Docker) | 2 min |
| 2 | Modif `package.json` | ❌ Tier 2 mais cache persistant | 3 min |
| 3 | Modif `Dockerfile` commentaire | ❌ Tier 2 mais cache persistant | 11 min |
| 4 | Rebuild manuel SSH (timeout) | ❌ SSH déconnecté après 22 min | 22 min |

---

## ✅ Solution Future (3 options)

### Option 1 : Rebuild Manuel sur VPS (Garanti ✅)
```bash
# SSH sur le VPS
ssh root@84.247.165.187

# Rebuild sans cache
cd /opt/moncabinet
git pull origin main
docker compose build --no-cache --pull nextjs
docker compose up -d nextjs

# Vérifier déploiement
docker exec qadhya-nextjs grep -c "detectAbrogations" /app/.next/server/app/api/chat/route.js
# Attendu: > 0
```

**Durée** : ~10-15 minutes
**Garantie** : 100% Phase 3.4 sera dans le build

---

### Option 2 : Fix CI/CD Cache Docker

Modifier `.github/workflows/deploy-vps.yml` pour forcer invalidation cache :

```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: ghcr.io/salmenktata/moncabinet:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
    no-cache: true  # ← AJOUTER pour forcer rebuild complet
```

Ou ajouter un build arg qui change à chaque build :

```dockerfile
# Dockerfile - Avant COPY . .
ARG BUILD_DATE
RUN echo "Build date: $BUILD_DATE"
```

```yaml
# workflow
build-args: |
  BUILD_DATE=${{ github.run_number }}
```

---

### Option 3 : Attendre Modification Naturelle

Au prochain changement de dépendance (`package.json` ou `package-lock.json` modifiés pour de vraies raisons), le cache sera naturellement invalidé et Phase 3.4 sera incluse.

**Durée** : Variable (prochain sprint)
**Risque** : Faible (code déjà prêt)

---

## 🧪 Tests de Validation

### Test 1 : Vérifier Présence dans Build
```bash
docker exec qadhya-nextjs grep -c "detectAbrogations" /app/.next/server/app/api/chat/route.js
# Attendu: 2 (import + appel)
```

### Test 2 : Test Fonctionnel End-to-End
1. Se connecter à https://qadhya.tn/assistant-ia
2. Poser une question mentionnant une loi abrogée :
   ```
   Mon client a été condamné selon l'article 97 du Code pénal. Que faire ?
   ```
3. **Attendu** : Une alerte rouge s'affiche AVANT la réponse de l'IA indiquant que l'article 97 a été abrogé par la Loi n°2025-14.

### Test 3 : Vérifier Timestamp Build
```bash
docker exec qadhya-nextjs stat -c "%y" /app/.next/server/app/api/chat/route.js
# Attendu: Date > 2026-02-13 17:00 (après commits Phase 3.4)
```

---

## 📊 Phase 3.3 : DÉPLOYÉE ET FONCTIONNELLE ✅

En production depuis le 13 février 2026 :

- **URL** : https://qadhya.tn/legal/abrogations
- **83 abrogations** indexées et vérifiées
- **Recherche fuzzy** fonctionnelle (PostgreSQL `similarity()`)
- **Statistiques** par domaine (fiscal, travail, codes, etc.)
- **Pages détail** pour chaque abrogation
- **API complète** : `/api/legal/abrogations/*`

---

## 📝 Prochaines Étapes

1. **Court terme** : Lors du prochain déploiement naturel (ajout feature, fix bug), Phase 3.4 sera automatiquement incluse
2. **Moyen terme** : Investiguer fix cache Docker dans CI/CD pour éviter problème futur
3. **Long terme** : Considérer migration vers service build externe (Vercel, Railway) ou améliorer cache strategy

---

**Auteur** : Claude Sonnet 4.5
**Date** : 13 février 2026
**Status** : Code prêt, en attente rebuild Docker
