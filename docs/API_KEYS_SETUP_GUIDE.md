# Guide de Configuration des Clés API Production

**Projet** : Qadhya - Plateforme SaaS Juridique
**Date** : Février 2026
**Environnement** : Production (qadhya.tn)

## 📊 État Actuel

| Provider | Status | Détails |
|----------|--------|---------|
| OpenAI | ✅ FONCTIONNEL | Embeddings KB opérationnels ($3.24/$10 utilisé) |
| Groq | ❌ INVALIDE | HTTP 401 - Clé à renouveler |
| Gemini | ❌ MANQUANTE | Provider prioritaire à configurer |
| DeepSeek | ⚠️ PRÉSENTE | Restart container requis |
| Anthropic | ❌ MANQUANTE | Optionnel |

## 🎯 Objectif

Configurer **minimum 3 providers** pour assurer une cascade fallback fonctionnelle :
- **Gemini** (gratuit, prioritaire)
- **Groq** (gratuit, rapide)
- **OpenAI** (déjà configuré)

## 🔑 Obtenir les Clés API

### 1️⃣ Google Gemini (GRATUIT - PRIORITAIRE)

**URL** : https://makersuite.google.com/app/apikey

**Étapes** :
1. Se connecter avec compte Google
2. Cliquer "Create API Key"
3. Sélectionner projet (ou créer nouveau)
4. Copier la clé (format : `AIza...`)

**Tier Gratuit** :
- 15 requêtes/minute
- 1 million tokens/jour
- Largement suffisant

**Modèle** : `gemini-2.5-flash`
**Latence** : ~1.5s
**Coût** : 0€

---

### 2️⃣ Groq (GRATUIT - RAPIDE)

**URL** : https://console.groq.com/keys

**Étapes** :
1. Se connecter (ou créer compte)
2. Aller dans "API Keys"
3. Supprimer ancienne clé invalide
4. "Create API Key" → Copier (format : `gsk_...`)

**Tier Gratuit** :
- 30 requêtes/minute
- 14,400 requêtes/jour

**Modèle** : `llama-3.3-70b-versatile`
**Latence** : ~292ms (ultra-rapide)
**Coût** : 0€

---

### 3️⃣ DeepSeek (ÉCONOMIQUE)

**URL** : https://platform.deepseek.com/api_keys

**Étapes** :
1. Créer compte (email + vérification)
2. Ajouter $5-10 crédit (carte bancaire)
3. "API Keys" → "Create new secret key"
4. Copier la clé (format : `sk-...`)

**Coûts** :
- $0.14/M tokens input
- $0.28/M tokens output
- ~$2-5/mois estimé

**Modèle** : `deepseek-chat`
**Latence** : ~1.8s
**Coût** : ~$2-5/mois

---

### 4️⃣ Anthropic Claude (OPTIONNEL)

**URL** : https://console.anthropic.com/settings/keys

**Étapes** :
1. Créer compte Anthropic
2. Ajouter crédit ($10 minimum)
3. "Create Key" → Copier (format : `sk-ant-...`)

**Coûts** :
- Claude 3.5 Sonnet : $3/$15 par M tokens
- Puissant mais coûteux

**Modèle** : `claude-3-5-sonnet-20241022`
**Latence** : ~2s
**Coût** : Variable (cher)
**Note** : Fallback ultime seulement

---

## 🚀 Configuration via Script Interactif

### Méthode Recommandée

```bash
# 1. SSH vers VPS
ssh root@84.247.165.187

# 2. Lancer script interactif
bash /opt/qadhya/scripts/configure-api-keys-prod.sh
```

Le script va :
- ✅ Créer backup automatique du `.env`
- ✅ Vous demander chaque clé interactivement
- ✅ Valider les formats
- ✅ Redémarrer le container
- ✅ Tester toutes les clés configurées

### Méthode Manuelle

```bash
# 1. SSH vers VPS
ssh root@84.247.165.187

# 2. Éditer .env
nano /opt/qadhya/.env.production.local

# 3. Ajouter/Modifier clés
GOOGLE_API_KEY=AIza...
GROQ_API_KEY=gsk_...
DEEPSEEK_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# 4. Sauvegarder (Ctrl+X, Y, Enter)

# 5. Restart container
cd /opt/qadhya
docker compose restart nextjs

# 6. Tester
bash /opt/qadhya/scripts/test-api-keys-prod-simple.sh
```

---

## 🧪 Tests et Validation

### Test Automatique

```bash
# Test complet de toutes les clés
bash /opt/qadhya/scripts/test-api-keys-prod-simple.sh
```

**Résultat attendu** :
```
✅ Groq: FONCTIONNEL
✅ Gemini: FONCTIONNEL
✅ OpenAI: FONCTIONNEL
✅ DeepSeek: FONCTIONNEL
⚠️  Ollama: Non disponible (acceptable)
```

### Test Manuel Provider par Provider

```bash
# Test Gemini
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIza..." \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"test"}]}]}'

# Test Groq
curl -X POST https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer gsk_..." \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"test"}],"max_tokens":5}'
```

---

## 📈 Cascade Fallback Attendue

Une fois configuré, voici l'ordre de fallback optimal :

```
1. Gemini (tier gratuit)       → 15 req/min, 0€
   ↓ [échec]
2. DeepSeek (économique)        → ~$0.14/M tokens
   ↓ [échec]
3. Groq (rapide)                → 30 req/min, 0€
   ↓ [échec]
4. OpenAI (stable)              → Budget $10/mois
   ↓ [échec]
5. Anthropic (puissant)         → Coûteux, fallback ultime
   ↓ [échec]
6. Ollama (local)               → 0€ mais lent
```

**Configuration fichier** : `lib/ai/llm-fallback-service.ts`
```typescript
const FALLBACK_ORDER: LLMProvider[] = [
  'gemini',    // Primaire
  'deepseek',  // Fallback 1
  'groq',      // Fallback 2
  'openai',    // Fallback 3
  'anthropic', // Fallback 4
  'ollama'     // Fallback 5 (local)
]
```

---

## 🔒 Sécurité

### Permissions Fichier .env

```bash
# Vérifier permissions (doivent être 600)
ls -la /opt/qadhya/.env.production.local
# -rw------- 1 root root

# Corriger si nécessaire
chmod 600 /opt/qadhya/.env.production.local
```

### Backup et Rollback

```bash
# Backup manuel avant modification
cp /opt/qadhya/.env.production.local \
   /opt/qadhya/.env.production.local.backup.$(date +%s)

# Restaurer backup si problème
cp /opt/qadhya/.env.production.local.backup.TIMESTAMP \
   /opt/qadhya/.env.production.local
docker compose restart nextjs
```

### Synchronisation Base de Données

Les clés sont chiffrées (AES-256-GCM) et synchronisées dans la table `api_keys` :

```bash
# Après modification .env, synchroniser DB
cd /opt/qadhya
npx tsx scripts/sync-env-to-db.ts
```

---

## ⏱️ Temps Estimé

| Tâche | Temps |
|-------|-------|
| Créer clé Gemini (gratuit) | 2 min |
| Renouveler clé Groq (gratuit) | 2 min |
| Créer clé DeepSeek (payant) | 5 min |
| Créer clé Anthropic (payant) | 5 min |
| Configuration via script | 5 min |
| Tests et validation | 3 min |
| **TOTAL (Gemini + Groq)** | **~10-15 min** |

---

## 📚 Documentation Complémentaire

- **Gestion clés** : `docs/API_KEYS_MANAGEMENT.md`
- **Fallback LLM** : `lib/ai/llm-fallback-service.ts`
- **Configuration opérations** : `lib/ai/operations-config.ts`
- **Monitoring** : `docs/CRON_MONITORING.md`

---

## ✅ Checklist Finale

- [ ] Clé Gemini configurée et testée
- [ ] Clé Groq renouvelée et testée
- [ ] (Optionnel) Clé DeepSeek configurée
- [ ] (Optionnel) Clé Anthropic configurée
- [ ] Container redémarré
- [ ] Tests passés (≥ 3 providers fonctionnels)
- [ ] Cascade fallback validée
- [ ] Backup .env créé
- [ ] Documentation mise à jour

---

**Dernière mise à jour** : 14 février 2026
**Auteur** : Claude Sonnet 4.5
**Version** : 1.0
