# Guide de Test des Réponses LLM en Production

Ce guide explique comment tester les réponses LLM sur qadhya.tn pour valider le bon fonctionnement des API keys et la qualité des réponses.

---

## 🎯 Objectifs

1. **Valider les API keys** fonctionnent correctement en production
2. **Comparer les performances** Mode Rapide (Ollama) vs Mode Premium (Cloud)
3. **Évaluer la qualité** des réponses juridiques
4. **Mesurer les temps de réponse** et consommation de tokens

---

## 🚀 Quick Start

### 1. Configuration de l'authentification

Pour tester les endpoints protégés, vous devez obtenir un cookie de session valide :

```bash
# 1. Se connecter sur https://qadhya.tn dans votre navigateur
# 2. Ouvrir DevTools (F12) → Application → Cookies → qadhya.tn
# 3. Copier la valeur du cookie "next-auth.session-token"
# 4. Ajouter à .env.local :

echo 'NEXTAUTH_SESSION_COOKIE="next-auth.session-token=VOTRE_TOKEN_ICI"' >> .env.local
```

### 2. Exécuter les tests

```bash
# Test complet (3 modes)
npx tsx scripts/test-prod-llm-authenticated.ts

# Avec affichage des réponses complètes
npx tsx scripts/test-prod-llm-authenticated.ts --verbose
```

---

## 📊 Modes Testés

### Mode 1 : ⚡ Mode Rapide (Ollama)

- **Provider** : Ollama local (VPS)
- **Modèle** : qwen2.5:3b (1.9 GB)
- **Coût** : 0€
- **Temps attendu** : 15-20 secondes
- **Use case** : Usage quotidien, tests rapides

**Paramètres API** :
```json
{
  "question": "ما هي الإجراءات القانونية لرفع دعوى إيجار في تونس؟",
  "usePremiumModel": false,
  "includeJurisprudence": true
}
```

### Mode 2 : 🧠 Mode Premium (Cloud)

- **Provider** : Groq → DeepSeek → Anthropic (fallback automatique)
- **Modèle** : Selon provider (llama-3.3-70b, deepseek-chat, claude-3-5-sonnet)
- **Coût** : ~0.001-0.01€ par requête
- **Temps attendu** : 10-30 secondes
- **Use case** : Consultations importantes, analyses complexes

**Paramètres API** :
```json
{
  "question": "ما هي الإجراءات القانونية لرفع دعوى إيجار في تونس؟",
  "usePremiumModel": true,
  "includeJurisprudence": true
}
```

### Mode 3 : Sans Jurisprudence

- **Provider** : Ollama local
- **RAG** : Désactivé (pas de recherche dans la base de connaissances)
- **Temps attendu** : 5-10 secondes (plus rapide sans RAG)
- **Use case** : Questions générales, pas besoin de sources juridiques

**Paramètres API** :
```json
{
  "question": "ما هي الإجراءات القانونية لرفع دعوى إيجار في تونس؟",
  "usePremiumModel": false,
  "includeJurisprudence": false
}
```

---

## 📈 Interprétation des Résultats

### Exemple de sortie

```
======================================================================
📊 TABLEAU COMPARATIF
======================================================================

Page                      | Time       | Provider        | Model
-------------------------------------------------------------------------------------
Mode Rapide (⚡ Ollama)   | 18500ms    | ollama          | qwen2.5:3b
Mode Premium (🧠 Cloud)   | 12300ms    | groq            | llama-3.3-70b
Sans Jurisprudence        | 6200ms     | ollama          | qwen2.5:3b

Statistiques:
  Temps moyen      : 12333ms
  Longueur moyenne : 1200 chars
  Tokens totaux    : 3500

⚡ Plus rapide : Sans Jurisprudence (6200ms)
🐌 Plus lent   : Mode Rapide (⚡ Ollama) (18500ms)
```

### Critères d'évaluation

| Critère | Bon ✅ | Moyen ⚠️ | Mauvais ❌ |
|---------|--------|---------|-----------|
| **Temps réponse** | < 15s | 15-30s | > 30s |
| **Longueur réponse** | 800-2000 chars | 400-800 chars | < 400 chars |
| **Tokens utilisés** | 1000-3000 | 500-1000 | < 500 |
| **Provider** | Celui attendu | Fallback normal | Tous en erreur |

---

## 🔍 Troubleshooting

### Erreur : "Non authentifié" (401)

**Cause** : Cookie de session invalide ou expiré

**Solution** :
1. Vérifier que `NEXTAUTH_SESSION_COOKIE` est défini dans `.env.local`
2. Se reconnecter sur qadhya.tn et récupérer un nouveau cookie
3. Vérifier que le cookie n'a pas expiré (durée : 30 jours par défaut)

### Erreur : "Chat IA désactivé" (503)

**Cause** : Aucune API key valide configurée

**Solution** :
1. Vérifier le dashboard : https://qadhya.tn/super-admin/api-keys-health
2. Consulter les logs : `docker logs -f moncabinet-nextjs | grep LLM-Fallback`
3. Synchroniser les clés : `./scripts/sync-api-keys.sh`

### Tous les tests échouent

**Cause** : Production inaccessible ou problème réseau

**Solution** :
1. Vérifier que le site est accessible : `curl https://qadhya.tn/api/health`
2. Vérifier la configuration : `echo $NEXT_PUBLIC_APP_URL`
3. Tester avec le script de diagnostic : `./scripts/diagnose-prod-llm-issues.sh`

### Mode Premium utilise Ollama au lieu de Cloud

**Cause** : Providers cloud tous en erreur, fallback vers Ollama

**Solution** :
1. Vérifier les clés API : https://qadhya.tn/super-admin/api-keys-health
2. Vérifier les quotas/soldes des providers (Groq, DeepSeek)
3. Consulter les logs d'erreur : `docker logs moncabinet-nextjs | grep "LLM-Fallback"`

---

## 📝 Exemples de Prompts de Test

### Prompt 1 : Procédure judiciaire (utilisé par défaut)
```
ما هي الإجراءات القانونية لرفع دعوى إيجار في تونس؟
```

### Prompt 2 : Droit commercial
```
ما هي شروط تأسيس شركة ذات مسؤولية محدودة في تونس؟
```

### Prompt 3 : Droit du travail
```
كيفية رفع دعوى تعويض عن فصل تعسفي في تونس؟
```

### Prompt 4 : Droit immobilier
```
ما هي الإجراءات القانونية لتسجيل عقد بيع عقار؟
```

---

## 🔗 Liens Utiles

- **Dashboard Santé API Keys** : https://qadhya.tn/super-admin/api-keys-health
- **Dashboard Monitoring Providers** : https://qadhya.tn/super-admin/provider-usage
- **Logs Production** : `ssh root@84.247.165.187 'docker logs -f moncabinet-nextjs'`
- **Documentation API** : `docs/API_KEYS_SYNC_GUIDE.md`
- **Script Diagnostic** : `scripts/diagnose-prod-llm-issues.sh`

---

## 🛠️ Scripts Complémentaires

### Test Accessibilité (sans authentification)
```bash
./scripts/test-prod-llm-responses.sh
```

### Diagnostic Complet
```bash
./scripts/diagnose-prod-llm-issues.sh
```

### Synchronisation Clés
```bash
./scripts/sync-api-keys.sh --check-only
./scripts/sync-api-keys.sh  # Synchroniser automatiquement
```

### Health Check API Keys
```bash
curl https://qadhya.tn/api/admin/api-keys/health | jq
```

---

**Dernière mise à jour** : 9 février 2026
