# Guide d'Activation du Tier Gratuit Gemini

**Problème identifié** : Votre clé API Gemini retourne `limit: 0` pour le tier gratuit.

```
❌ Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests
❌ limit: 0, model: gemini-2.0-flash
```

**Cause** : Le compte Google Cloud n'a pas la facturation activée. Même le tier gratuit nécessite un compte avec facturation configurée.

---

## Solution : Activer la Facturation

### Étape 1 : Accéder à Google Cloud Console

1. Allez sur https://console.cloud.google.com/
2. Connectez-vous avec le compte Google de votre clé API
3. Sélectionnez le projet **`projects/891729335554`** dans le menu déroulant en haut

### Étape 2 : Activer la Facturation

**Option A : Depuis la console principale**

1. Cliquez sur le menu hamburger ☰ (en haut à gauche)
2. Allez dans **"Facturation"** (Billing)
3. Si le projet n'a pas de compte de facturation :
   - Cliquez sur **"Associer un compte de facturation"**
   - Ou **"Créer un compte de facturation"**

**Option B : Lien direct**

1. Allez sur https://console.cloud.google.com/billing/projects/891729335554
2. Cliquez sur **"Lier un compte de facturation"**

### Étape 3 : Créer/Lier un Compte de Facturation

**Si vous n'avez pas encore de compte de facturation** :

1. Cliquez sur **"Créer un compte de facturation"**
2. Entrez les informations requises :
   - Nom du compte (ex: "Mon Cabinet Avocat")
   - Pays : Tunisie
   - Type de compte : Individu ou Entreprise
3. Ajoutez un mode de paiement :
   - Carte bancaire (Visa/Mastercard)
   - **Note** : $0 sera débité tant que vous restez dans les limites gratuites
4. Acceptez les conditions
5. Cliquez sur **"Démarrer mon essai gratuit"**

**Si vous avez déjà un compte de facturation** :

1. Sélectionnez le compte existant dans la liste
2. Cliquez sur **"Définir le compte"**

### Étape 4 : Vérifier l'Activation

1. Retournez sur https://aistudio.google.com/
2. Allez dans **"Get API key"**
3. Vérifiez que votre clé `AIzaSyDxikA7vPktcn-2-oPBQGzpMis-eL_lKl0` est bien liée au projet avec facturation

### Étape 5 : Activer l'API Generative AI

1. Allez sur https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
2. Vérifiez que le projet **`projects/891729335554`** est sélectionné
3. Si l'API n'est pas activée, cliquez sur **"Activer"**

### Étape 6 : Tester l'Activation

Depuis votre terminal local :

```bash
# Test avec votre clé API
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent" \
  -H 'Content-Type: application/json' \
  -H 'X-goog-api-key: AIzaSyDxikA7vPktcn-2-oPBQGzpMis-eL_lKl0' \
  -X POST \
  -d '{
    "contents": [{"parts": [{"text": "Hello"}]}]
  }'
```

**Résultat attendu** :
```json
{
  "candidates": [
    {
      "content": {
        "parts": [{"text": "Hello! How can I help you today?"}]
      }
    }
  ]
}
```

**Si erreur 429 persiste** :
- Attendez 5-10 minutes pour propagation
- Vérifiez que la facturation est bien liée au projet
- Essayez de régénérer une nouvelle clé API

---

## Tier Gratuit Gemini (après activation)

Une fois la facturation activée, vous aurez accès au **tier gratuit** :

### Quotas Gratuits (Février 2026)

| Modèle | RPM (gratuit) | RPD (gratuit) | Tokens/jour |
|--------|---------------|---------------|-------------|
| gemini-2.0-flash | 15 | 1500 | Illimité |
| gemini-2.5-flash | 15 | 1500 | Illimité |
| gemini-2.5-pro | 2 | 50 | Illimité |

**RPM** = Requêtes Par Minute
**RPD** = Requêtes Par Jour

### Tarification (si dépassement du gratuit)

| Type | Prix par million de tokens |
|------|---------------------------|
| Input | $0.075 |
| Output | $0.30 |

**Exemple** : 1000 requêtes RAG/jour
- Input moyen : 2000 tokens
- Output moyen : 500 tokens
- **Coût quotidien** : (2M × $0.075 + 0.5M × $0.30) / 1000 = **$0.30/jour** = **$9/mois**

---

## Monitoring des Quotas

### Dashboard Google Cloud

1. Allez sur https://console.cloud.google.com/iam-admin/quotas
2. Recherchez "generativelanguage.googleapis.com"
3. Surveillez les métriques :
   - `generate_content_free_tier_requests` (RPM)
   - `generate_content_input_token_count` (tokens)

### Dashboard Avocat (après activation)

1. Allez sur http://localhost:7002/admin/ai-usage
2. Vérifiez la carte "Gemini" :
   - RPM utilisé / 15
   - Tokens consommés
   - Coût estimé ($0 si tier gratuit)

---

## Alertes Budget (optionnel mais recommandé)

Pour éviter les surprises de facturation :

### Créer une Alerte Budget

1. Allez sur https://console.cloud.google.com/billing/budgets
2. Cliquez sur **"Créer un budget"**
3. Configurez :
   - **Nom** : "Budget Gemini API"
   - **Projets** : Sélectionnez `projects/891729335554`
   - **Services** : Generative Language API
   - **Montant** : $10/mois (ou votre limite)
   - **Seuils d'alerte** : 50%, 80%, 100%
   - **Email** : Votre adresse email
4. Cliquez sur **"Terminer"**

### Notification si Dépassement

Vous recevrez un email automatique si :
- 50% du budget atteint ($5)
- 80% du budget atteint ($8)
- 100% du budget atteint ($10)

---

## Dépannage

### Erreur : "Billing account required"

**Cause** : Le projet n'est pas lié à un compte de facturation.

**Solution** :
1. Vérifiez sur https://console.cloud.google.com/billing/projects/891729335554
2. Assurez-vous qu'un compte de facturation est bien lié
3. Si non, suivez Étape 2 ci-dessus

### Erreur : "API not enabled"

**Cause** : L'API Generative Language n'est pas activée.

**Solution** :
1. Allez sur https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
2. Cliquez sur **"Activer"**
3. Attendez 1-2 minutes pour propagation

### Erreur : "Invalid API key"

**Cause** : La clé API est invalide ou révoquée.

**Solution** :
1. Allez sur https://aistudio.google.com/app/apikey
2. Vérifiez que la clé `AIzaSyDxikA7vPktcn-2-oPBQGzpMis-eL_lKl0` existe
3. Si non, créez une nouvelle clé
4. Mettez à jour `.env` avec la nouvelle clé

### Quota 0 persiste après activation

**Cause** : Délai de propagation (5-30 minutes).

**Solution** :
1. Attendez 10-30 minutes après activation facturation
2. Testez avec `curl` (voir Étape 6)
3. Si toujours quota 0 après 1h, contactez support Google Cloud

---

## Comparaison Coûts (estimé pour votre usage)

Basé sur une utilisation typique de **2-3M tokens/jour RAG** :

| Scénario | Provider | Coût/mois |
|----------|----------|-----------|
| **Tier gratuit uniquement** | Gemini (gratuit) | $0 |
| **Dépassement léger** | Gemini (payant) | $2-5 |
| **Sans Gemini** | Groq + DeepSeek | $8-12 |
| **Sans Gemini ni Groq** | DeepSeek seul | $15-20 |
| **Ollama seul** | Ollama (local) | $0 |

**Recommandation** : Activer Gemini pour bénéficier du tier gratuit + performance 10x meilleure qu'Ollama.

---

## Checklist Finale

- [ ] Compte facturation créé/lié sur Google Cloud
- [ ] Projet `891729335554` associé au compte
- [ ] API Generative Language activée
- [ ] Test `curl` réussi (réponse JSON attendue)
- [ ] Clé API mise à jour dans `.env` local
- [ ] Dashboard `/admin/ai-usage` affiche stats Gemini
- [ ] Alerte budget configurée ($10/mois)
- [ ] Test intégration : `npx tsx scripts/test-gemini-integration.ts`

---

## Support

- **Documentation officielle** : https://ai.google.dev/gemini-api/docs
- **Pricing** : https://ai.google.dev/pricing
- **Support Google Cloud** : https://console.cloud.google.com/support
- **Status** : https://status.cloud.google.com/

---

**Dernière mise à jour** : 9 Février 2026
**Clé API** : `AIzaSyDxikA7vPktcn-2-oPBQGzpMis-eL_lKl0`
**Projet** : `891729335554`
