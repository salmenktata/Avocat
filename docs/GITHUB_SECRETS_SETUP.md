# Configuration GitHub Secrets pour Déploiement Production

Ce document liste tous les secrets GitHub Actions requis pour le déploiement automatique sur le VPS Contabo (qadhya.tn).

## 📍 Accès aux Secrets

**Repository** → `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

---

## 🔐 Secrets Requis

### Infrastructure VPS

| Secret | Description | Exemple | Statut |
|--------|-------------|---------|--------|
| `VPS_HOST` | Adresse IP du serveur | `84.247.165.187` | ✅ Configuré |
| `VPS_USER` | Utilisateur SSH | `root` | ✅ Configuré |
| `VPS_SSH_KEY` | Clé privée SSH (multi-lignes) | `-----BEGIN OPENSSH...` | ✅ Configuré |
| `VPS_PORT` | Port SSH | `22` | ✅ Configuré |

### LLM Providers (Architecture Option C)

| Secret | Description | Obtention | Statut |
|--------|-------------|-----------|--------|
| `GOOGLE_API_KEY` | Gemini API (prioritaire) | [Google AI Studio](https://aistudio.google.com/apikey) | ⚠️ **À AJOUTER** |
| `GROQ_API_KEY` | Groq LLM (fallback rapide) | [Groq Console](https://console.groq.com/keys) | ✅ Configuré |
| `DEEPSEEK_API_KEY` | DeepSeek (fallback qualité) | [DeepSeek Platform](https://platform.deepseek.com/api_keys) | ⚠️ **À AJOUTER** |

### Security & Encryption

| Secret | Description | Génération | Statut |
|--------|-------------|------------|--------|
| `ENCRYPTION_KEY` | Chiffrement AES-256 des clés API en DB | `openssl rand -hex 32` | ⚠️ **À AJOUTER** |
| `CRON_SECRET` | Token d'authentification cron jobs | `openssl rand -hex 32` | ✅ Configuré |

### Email & Notifications

| Secret | Description | Obtention | Statut |
|--------|-------------|-----------|--------|
| `RESEND_API_KEY` | Service email transactionnel | [Resend Dashboard](https://resend.com/api-keys) | ✅ Configuré |
| `BREVO_API_KEY` | Service email marketing | [Brevo Settings](https://app.brevo.com/settings/keys/api) | ✅ Configuré |

---

## 🚀 Valeurs Actuelles à Configurer

### 1. GOOGLE_API_KEY (Gemini)

```bash
AIzaSyBM7kYv8xdHulb5tEBKJ8K2GXAQsD2btl8
```

**Provider prioritaire** (tier gratuit 1M tokens/jour)
- Modèle : `gemini-2.0-flash-exp`
- Projet ID : `106207207546`

### 2. DEEPSEEK_API_KEY

```bash
sk-55734051842a426598313d1432bb7e46
```

**Fallback qualité** (~0.14$/M tokens)
- Modèle : `deepseek-chat`
- Rechargé $10 (Feb 2026)

### 3. ENCRYPTION_KEY

```bash
9876986284a8ad01ef2ab9c10fb6111d8d80ed2225f00ab29625362328995fbb
```

⚠️ **CRITIQUE** : NE JAMAIS CHANGER cette clé une fois en production, sinon les clés API chiffrées en base deviennent irrécupérables !

---

## 📝 Procédure d'Ajout

1. Aller sur : https://github.com/salmenktata/Avocat/settings/secrets/actions
2. Cliquer sur **"New repository secret"**
3. Copier-coller le nom **EXACT** du secret (sensible à la casse)
4. Copier-coller la valeur complète
5. Cliquer sur **"Add secret"**
6. Répéter pour chaque secret manquant

---

## ✅ Vérification

Après configuration, vérifier que tous les secrets apparaissent dans la liste :

```bash
# Secrets visibles (valeur masquée)
BREVO_API_KEY          ***
CRON_SECRET            ***
DEEPSEEK_API_KEY       ***  ⬅️ NOUVEAU
ENCRYPTION_KEY         ***  ⬅️ NOUVEAU
GOOGLE_API_KEY         ***  ⬅️ NOUVEAU
GROQ_API_KEY           ***
RESEND_API_KEY         ***
VPS_HOST               ***
VPS_PORT               ***
VPS_SSH_KEY            ***
VPS_USER               ***
```

---

## 🔄 Workflow de Déploiement

Une fois configuré, le workflow `.github/workflows/deploy-vps.yml` :

1. Build l'image Docker (Job `build`)
2. Push vers GitHub Container Registry (`ghcr.io/salmenktata/moncabinet:latest`)
3. Deploy sur VPS (Job `deploy`) :
   - Met à jour les secrets dans `/opt/moncabinet/.env`
   - Pull la nouvelle image
   - Redémarre le container `nextjs`
4. Vérifie la santé de l'application (Job `verify`)

**Déclenchement** :
- ✅ Automatique sur push vers `main`
- ✅ Manuel via `Actions` → `Deploy to VPS Contabo` → `Run workflow`

---

## 🔗 Liens Utiles

- [Gemini API Keys](https://aistudio.google.com/apikey)
- [Groq Console](https://console.groq.com/keys)
- [DeepSeek Platform](https://platform.deepseek.com/api_keys)
- [GitHub Actions Secrets Docs](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

## 📊 État Actuel (9 février 2026)

| Composant | Environnement Local | Production (qadhya.tn) |
|-----------|---------------------|------------------------|
| Gemini | ✅ Valide | ⚠️ À configurer via Secret |
| Groq | ✅ Valide | ✅ Valide (màj manuelle) |
| DeepSeek | ✅ Valide | ✅ Valide (màj manuelle) |
| Ollama | ✅ qwen2.5:3b | ✅ qwen2.5:3b |
| Encryption | ✅ Configuré | ✅ Configuré (màj manuelle) |

**Prochaine étape** : Configurer les 3 secrets manquants dans GitHub pour automatiser les futurs déploiements.
