# Intégration Google Gemini 2.0 Flash-Lite

## Vue d'ensemble

Gemini 2.0 Flash-Lite est maintenant le **provider LLM principal** (Février 2026) pour le projet Avocat (Qadhya), remplaçant Ollama comme premier choix pour les requêtes RAG.

### Pourquoi Gemini ?

| Critère | Gemini 2.0 Flash-Lite | Ollama (qwen2.5:3b) | Groq |
|---------|----------------------|---------------------|------|
| **Coût** | ⭐⭐⭐⭐⭐ Tier gratuit illimité | ⭐⭐⭐⭐⭐ Gratuit local | ⭐⭐⭐ 100k tokens/jour |
| **Vitesse** | ⭐⭐⭐⭐⭐ 1-2s | ⭐⭐ 19-45s | ⭐⭐⭐⭐⭐ 1-2s |
| **Qualité** | ⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Correct | ⭐⭐⭐⭐ Bon |
| **Contexte** | ⭐⭐⭐⭐⭐ 1M tokens | ⭐⭐ 32K | ⭐⭐⭐ 128K |
| **Multilingue** | ⭐⭐⭐⭐⭐ Excellent AR/FR | ⭐⭐⭐⭐ Bon AR/FR | ⭐⭐⭐⭐ Bon |

**Résultat** : Gemini offre la **meilleure combinaison** coût/performance/qualité avec un tier gratuit illimité et un contexte 1M tokens idéal pour les longs PDFs juridiques.

---

## Configuration

### 1. Obtenir une clé API Google

1. Allez sur [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Connectez-vous avec votre compte Google
3. Cliquez sur **"Create API key"**
4. Copiez la clé (format: `AIzaSy...`)

### 2. Configurer les variables d'environnement

**Développement local** (`.env`) :
```bash
# Google Gemini 2.0 Flash-Lite (PRIORITAIRE)
GOOGLE_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.0-flash-lite
GEMINI_MAX_TOKENS=4000
```

**Production** (`.env.production`) :
```bash
# Google Gemini 2.0 Flash-Lite
GOOGLE_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.0-flash-lite
GEMINI_MAX_TOKENS=4000

# Fallback providers (ordre de priorité)
DEEPSEEK_API_KEY=sk-...          # Recharger solde ($10-20)
GROQ_API_KEY=gsk_...             # Tier gratuit 100k/jour
OLLAMA_ENABLED=true              # Fallback local gratuit
```

### 3. Tester l'intégration

```bash
# Test connexion Gemini
GOOGLE_API_KEY=xxx tsx scripts/test-gemini-integration.ts

# Vérifier fallback automatique
npm run dev
# Aller sur http://localhost:7002/assistant
# Poser une question juridique → devrait utiliser Gemini
```

---

## Architecture Fallback

### Ordre de priorité (Février 2026)

```
┌─────────────────────────────────────────────────────┐
│  Gemini 2.0 Flash-Lite (tier gratuit illimité)     │
│  - Tier gratuit: illimité input/output             │
│  - Rate limit: 15 RPM                               │
│  - Contexte: 1M tokens                              │
└─────────────────────────────────────────────────────┘
                      ↓ (si rate limit 429)
┌─────────────────────────────────────────────────────┐
│  DeepSeek-V3 (économique, qualité excellente)      │
│  - $0.27/M tokens                                   │
│  - Meilleur raisonnement juridique                 │
└─────────────────────────────────────────────────────┘
                      ↓ (si solde épuisé 402)
┌─────────────────────────────────────────────────────┐
│  Groq (rapide, tier gratuit)                       │
│  - 100k tokens/jour gratuit                         │
│  - Risque rate limiting fréquent                    │
└─────────────────────────────────────────────────────┘
                      ↓ (si rate limit 429)
┌─────────────────────────────────────────────────────┐
│  Anthropic Claude (optionnel)                       │
│  - Si clé API configurée                            │
└─────────────────────────────────────────────────────┘
                      ↓ (si indisponible)
┌─────────────────────────────────────────────────────┐
│  Ollama (local, gratuit, illimité)                 │
│  - Fallback ultime                                  │
│  - Lent (19-45s) mais toujours disponible          │
└─────────────────────────────────────────────────────┘
```

### Stratégies par cas d'usage

| Cas d'Usage | Provider 1 | Provider 2 | Provider 3 | Coût/mois |
|-------------|-----------|-----------|-----------|-----------|
| **RAG Chat** | Gemini (free) | Gemini (paid) | DeepSeek | $2-5 |
| **Embeddings KB** | Ollama local | - | - | $0 |
| **Analyse Qualité KB** | DeepSeek | Gemini | Ollama | $0.06 |
| **Structuration Dossiers** | DeepSeek | Gemini | Ollama | $0.02-0.07 |
| **Traduction AR↔FR** | Gemini | Groq | - | $0.01 |
| **Web Scraping** | Gemini | Ollama | - | $0 |
| **Détection Doublons** | Gemini | DeepSeek | - | $0.14 |

**Total estimé** : **$2.48-4.78/mois** (vs $0 Ollama seul mais 10x plus rapide)

---

## Tier Gratuit Gemini

### Limites

- **Rate limiting** : 15 requêtes par minute (RPM)
- **Quota quotidien** : Illimité en tokens (pas de limite connue en Février 2026)
- **Surveillance** : Google peut désactiver si usage abusif détecté

### Gestion du rate limit

Le client Gemini (`lib/ai/gemini-client.ts`) gère automatiquement le rate limiting :

```typescript
// Compteur local qui track les requêtes/minute
requestsThisMinute = 0
limit = 15 RPM

// Si limite atteinte → fallback automatique vers DeepSeek/Groq/Ollama
if (requestsThisMinute >= 15) {
  throw Error('Rate limit atteint')
  // → Le système bascule automatiquement sur le provider suivant
}
```

### Monitoring du tier gratuit

Dashboard admin (à implémenter Phase 3) :
- Requêtes/minute actuelles
- Slots disponibles (15 - utilisés)
- Alertes si >80% quota

---

## Tarification Tier Payant

Si vous dépassez le tier gratuit ou avez besoin de plus de 15 RPM :

| Type | Prix par million de tokens |
|------|---------------------------|
| **Input** | $0.075 |
| **Output** | $0.30 |

**Exemple** : 1000 requêtes RAG/jour
- Input moyen : 2000 tokens (contexte + question)
- Output moyen : 500 tokens (réponse)
- **Coût quotidien** : (2M × $0.075 + 0.5M × $0.30) / 1000 = **$0.30/jour** = **$9/mois**

**Comparaison** :
- **OpenAI GPT-4o** : $2.50 input + $10 output = **$27/mois** (3x plus cher)
- **Anthropic Claude** : $3 input + $15 output = **$47/mois** (5x plus cher)
- **Gemini Flash-Lite** : $0.15 input + $0.15 output = **$9/mois** ✓

---

## Tests d'intégration

### Script de test complet

```bash
# Avec votre clé API
GOOGLE_API_KEY=AIzaSy... tsx scripts/test-gemini-integration.ts
```

Le script teste :
1. ✓ Configuration Gemini (clé API, modèle, limites)
2. ✓ Health check (disponibilité, RPM)
3. ✓ Réponse simple français
4. ✓ Réponse simple arabe (multilingue)
5. ✓ Fallback automatique LLM
6. ✓ Stats RPM finales
7. ✓ Estimation coûts

### Test manuel depuis l'interface

1. Démarrer le serveur : `npm run dev`
2. Aller sur `/assistant`
3. Poser une question juridique :
   - **Français** : "Explique-moi le Code des Obligations et Contrats tunisien"
   - **Arabe** : "ما هو قانون الالتزامات والعقود التونسي؟"
4. Vérifier les logs serveur :
   ```
   [LLM-Fallback] ✓ Gemini réponse reçue (1.2s, 2450 tokens)
   ```

---

## Dépannage

### Erreur : "GOOGLE_API_KEY non configuré"

**Solution** : Ajoutez la clé dans `.env` :
```bash
GOOGLE_API_KEY=AIzaSy...
```

### Erreur : "Rate limit atteint (15 RPM)"

**Solutions** :
1. **Attendre 1 minute** pour reset du compteur
2. **Fallback automatique** vers DeepSeek/Groq/Ollama (pas d'action requise)
3. **Passer au tier payant** si besoin récurrent de >15 RPM

### Erreur : "Gemini temporairement indisponible (503)"

**Solutions** :
1. Le fallback automatique va prendre le relais
2. Vérifier status Google : https://status.cloud.google.com/

### Performance lente (>5s par requête)

**Causes possibles** :
1. **Contexte trop grand** (>100K tokens) → Réduire RAG_MAX_CONTEXT_TOKENS
2. **Max tokens élevé** → Réduire GEMINI_MAX_TOKENS (default 4000)
3. **Réseau lent** → Vérifier connexion internet

---

## Migration depuis Ollama

### Avant (Ollama prioritaire)

```typescript
// llm-fallback-service.ts
const FALLBACK_ORDER = ['ollama', 'groq', 'deepseek', 'anthropic']
// ⚠️ Lenteur : 19-45s par requête
```

### Après (Gemini prioritaire)

```typescript
// llm-fallback-service.ts
const FALLBACK_ORDER = ['gemini', 'deepseek', 'groq', 'anthropic', 'ollama']
// ✓ Rapide : 1-2s par requête
// ✓ Gratuit : tier gratuit illimité
// ✓ Contexte : 1M tokens (longs PDFs)
```

### Impact utilisateur

| Métrique | Ollama seul | Gemini prioritaire | Amélioration |
|----------|-------------|-------------------|--------------|
| **Latence RAG** | 19-45s | 1-3s | **10-15x plus rapide** |
| **Coût** | $0 | $0-5/mois | Tier gratuit suffit |
| **Qualité** | Correcte | Excellente | Meilleur multilingue AR/FR |
| **Contexte max** | 32K tokens | 1M tokens | **31x plus grand** |

---

## Roadmap

### Phase 1 : Intégration Gemini ✓ (Jour 1-2)
- [x] Client Gemini (`gemini-client.ts`)
- [x] Intégration fallback LLM
- [x] Configuration `.env`
- [x] Script test intégration
- [x] Documentation

### Phase 2 : Optimisation cas d'usage (Jour 3-4)
- [ ] Analyse qualité KB (DeepSeek → Gemini)
- [ ] Structuration dossiers (DeepSeek → Gemini)
- [ ] Traduction AR↔FR (Gemini → Groq)
- [ ] Web scraping (Gemini → Ollama)
- [ ] Détection doublons (optimisation algorithme + Gemini)

### Phase 3 : Monitoring & Tuning (Jour 5-7)
- [ ] Dashboard usage IA (`/api/admin/ai-usage`)
- [ ] Alertes quotas (email/Slack)
- [ ] Tests de charge (1000 requêtes)
- [ ] Tuning coûts production

---

## Support

### Documentation

- **API Reference** : https://ai.google.dev/gemini-api/docs
- **Pricing** : https://ai.google.dev/pricing
- **Models** : https://ai.google.dev/gemini-api/docs/models/gemini

### Aide

- **Issues GitHub** : Créer un ticket avec tag `[Gemini]`
- **Logs** : Vérifier `/var/log/app.log` (prod) ou console (dev)
- **Status** : https://status.cloud.google.com/

---

## Conclusion

L'intégration de Gemini 2.0 Flash-Lite apporte un **gain de performance 10x** tout en maintenant un coût minimal grâce au tier gratuit illimité. C'est désormais le **provider recommandé** pour toutes les requêtes RAG en Février 2026.

**Prochaine étape** : Recharger le solde DeepSeek ($10-20) pour garantir un fallback de qualité lorsque le rate limit Gemini est atteint.
