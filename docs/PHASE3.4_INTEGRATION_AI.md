# Phase 3.4 - Intégration Assistant IA avec Abrogations

**Date** : 13 février 2026 15:00 CET
**Statut** : ✅ CODE COMPLET | ⏳ TESTS EN ATTENTE

---

## ✅ Travail Complété

### Objectif

Intégrer automatiquement la détection des lois abrogées dans l'Assistant IA pour alerter l'utilisateur **avant** qu'il ne reçoive une réponse potentiellement obsolète.

### Architecture

```
Message Utilisateur
   ↓
[API /api/chat POST]
   ↓
detectAbrogations(question) ← Service de détection
   ↓
extractLegalReferences() → Extraction références juridiques
   ↓
searchAbrogationsForReferences() → Recherche fuzzy dans legal_abrogations
   ↓
generateAbrogationAlerts() → Génération alertes formatées
   ↓
abrogationAlerts[] → Retour API
   ↓
[Frontend] AbrogationAlerts Component → Affichage alertes visuelles
```

---

## 📁 Fichiers Créés / Modifiés

### 1. Service de Détection (Créé)

**Fichier** : `lib/legal/abrogation-detector-service.ts` (443 lignes)

**Fonctionnalités** :
- ✅ Extraction références juridiques via patterns regex (FR/AR)
- ✅ Recherche fuzzy dans `legal_abrogations` table
- ✅ Génération d'alertes avec sévérité (critical/warning/info)
- ✅ Support bilingue FR/AR complet
- ✅ Fonction client-side (via API) et server-side (DB directe)

**Patterns détectés** :
- Codes (pénal, civil, travail, commerce, obligations)
- Articles avec numéros
- Lois (format n°YYYY-NN)
- Décrets-lois
- Lois organiques
- Références arabes (المجلة الجنائية, القانون, etc.)

**Types exportés** :
```typescript
export interface LegalReference {
  text: string
  type: 'law' | 'code' | 'article' | 'decree'
  confidence: number // 0-1
}

export interface AbrogationAlert {
  reference: LegalReference
  abrogation: AbrogationSearchResult
  severity: 'critical' | 'warning' | 'info'
  message: string
  replacementSuggestion?: string
}

// Fonction principale
export async function detectAbrogations(
  userMessage: string,
  options?: { threshold?: number; minConfidence?: number }
): Promise<AbrogationAlert[]>
```

---

### 2. Composant UI Alertes (Créé)

**Fichier** : `components/chat/abrogation-alert.tsx` (126 lignes)

**Fonctionnalités** :
- ✅ Badge sévérité coloré (rouge/orange/bleu)
- ✅ Affichage référence détectée
- ✅ Détails abrogation (loi abrogée + loi abrogeante)
- ✅ Date d'abrogation formatée
- ✅ Articles affectés (badges)
- ✅ Suggestion de remplacement
- ✅ Actions : Lien JORT, Lien détail (/legal/abrogations/[id])
- ✅ Thème clair/sombre
- ✅ Bilingue FR/AR

**Configuration sévérité** :
```typescript
const severityConfig = {
  critical: {
    variant: 'destructive',
    icon: '🚫',
    title: 'Abrogation Totale',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
  },
  warning: {
    variant: 'default',
    icon: '⚠️',
    title: 'Abrogation Confirmée',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
  },
  info: {
    variant: 'default',
    icon: '💡',
    title: 'Information',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
  },
}
```

---

### 3. API Chat (Modifié)

**Fichier** : `app/api/chat/route.ts`

**Changements** :
```diff
+ import { detectAbrogations, type AbrogationAlert } from '@/lib/legal/abrogation-detector-service'

  interface ChatApiResponse {
    answer: string
    sources: ChatSource[]
    conversationId: string
    tokensUsed: { input: number; output: number; total: number }
+   abrogationAlerts?: AbrogationAlert[]
  }

  export async function POST(request: NextRequest) {
    // ...
    await saveMessage(activeConversationId, 'user', question)

+   // Phase 3.4 : Détecter références abrogées dans la question
+   let abrogationAlerts: AbrogationAlert[] = []
+   try {
+     abrogationAlerts = await detectAbrogations(question, {
+       threshold: 0.5,
+       minConfidence: 0.6,
+     })
+     if (abrogationAlerts.length > 0) {
+       console.log(`[Chat API] ${abrogationAlerts.length} alerte(s) détectée(s)`)
+     }
+   } catch (error) {
+     console.error('[Chat API] Erreur détection abrogations:', error)
+   }

    const response = await answerQuestion(question, userId, { /* ... */ })

    return NextResponse.json({
      answer: response.answer,
      sources: response.sources,
      conversationId: activeConversationId,
      tokensUsed: response.tokensUsed,
+     abrogationAlerts: abrogationAlerts.length > 0 ? abrogationAlerts : undefined,
    })
  }
```

---

### 4. Hook Streaming Chat (Modifié)

**Fichier** : `lib/hooks/useStreamingChat.ts`

**Changements** :
```diff
+ export interface AbrogationAlert {
+   reference: { text: string; type: string; confidence: number }
+   abrogation: { /* ... */ }
+   severity: 'critical' | 'warning' | 'info'
+   message: string
+   replacementSuggestion?: string
+ }

  export interface StreamingMessage {
    role: 'user' | 'assistant'
    content: string
    sources?: any[]
    tokensUsed?: number
    isStreaming?: boolean
+   abrogationAlerts?: AbrogationAlert[]
  }

  interface StreamChunk {
    type: 'metadata' | 'content' | 'done' | 'error'
    // ...
+   abrogationAlerts?: AbrogationAlert[]
  }

  // Mode non-streaming
  const assistantMessage: StreamingMessage = {
    role: 'assistant',
    content: data.answer,
    sources: data.sources,
    tokensUsed: data.tokensUsed?.total,
+   abrogationAlerts: data.abrogationAlerts,
  }
```

---

## 🔧 Configuration

### Variables d'Environnement

Aucune variable d'environnement supplémentaire requise. La détection utilise :
- La table `legal_abrogations` (65 abrogations en production)
- L'API REST `/api/legal/abrogations/search` (Phase 3.2)
- Fonction PostgreSQL `find_abrogations()` (fuzzy search)

### Paramètres de Détection

**Dans `app/api/chat/route.ts`** :
```typescript
detectAbrogations(question, {
  threshold: 0.5,      // Seuil similarité fuzzy search (0-1)
  minConfidence: 0.6,  // Seuil confiance extraction référence (0-1)
})
```

**Ajustements recommandés** :
- `threshold` : 0.4-0.7 (plus bas = plus de résultats, mais plus de faux positifs)
- `minConfidence` : 0.5-0.8 (plus haut = seulement références très claires)

---

## 🎨 Affichage UI

### Où afficher les alertes ?

**Option 1 : Dans le composant Chat principal**
```tsx
import { AbrogationAlerts } from '@/components/chat/abrogation-alert'

function ChatMessages({ messages }: { messages: StreamingMessage[] }) {
  return messages.map((msg, idx) => (
    <div key={idx}>
      {/* Message utilisateur */}
      {msg.role === 'user' && <div>{msg.content}</div>}

      {/* ✨ Alertes abrogations (affichées AVANT la réponse IA) */}
      {msg.abrogationAlerts && msg.abrogationAlerts.length > 0 && (
        <AbrogationAlerts alerts={msg.abrogationAlerts} />
      )}

      {/* Message assistant */}
      {msg.role === 'assistant' && <div>{msg.content}</div>}
    </div>
  ))
}
```

**Option 2 : Dans le composant de saisie (feedback immédiat)**
```tsx
function ChatInput({ onSend }: { onSend: (msg: string) => void }) {
  const [alerts, setAlerts] = useState<AbrogationAlert[]>([])

  const handleSend = async (message: string) => {
    // Détection côté client (optionnel, preview avant envoi)
    const detectedAlerts = await fetch('/api/legal/abrogations/detect', {
      method: 'POST',
      body: JSON.stringify({ text: message }),
    }).then(r => r.json())

    if (detectedAlerts.length > 0) {
      setAlerts(detectedAlerts)
      // Afficher modal de confirmation ?
    }

    onSend(message)
  }

  return (
    <div>
      {alerts.length > 0 && <AbrogationAlerts alerts={alerts} />}
      <textarea onSubmit={handleSend} />
    </div>
  )
}
```

---

## 🧪 Tests à Effectuer

### Test 1 : Référence Loi Abrogée
```
Question : "Quelle est la peine prévue par la Loi n°78-50 du 20 octobre 1978 ?"

Résultat attendu :
✅ Alerte abrogation détectée
✅ Sévérité : critical (abrogation totale)
✅ Loi abrogeante affichée
✅ Lien JORT disponible
```

### Test 2 : Référence Code Pénal
```
Question : "Que dit l'article 214 du Code pénal ?"

Résultat attendu :
⚠️ Si article 214 abrogé → Alerte
✅ Sinon → Pas d'alerte (normal)
```

### Test 3 : Référence Arabe
```
Question : "ما هو القانون عدد 78-50 لسنة 1978 ؟"

Résultat attendu :
✅ Détection pattern arabe
✅ Alerte en arabe
✅ Référence abrogeante en arabe (si disponible)
```

### Test 4 : Question Sans Référence
```
Question : "Quels sont mes droits en cas de licenciement ?"

Résultat attendu :
✅ Aucune alerte
✅ Réponse IA normale
```

### Test 5 : Plusieurs Références
```
Question : "Comparer Loi 78-50 et Décret-loi 2011-14 en matière de liberté de presse"

Résultat attendu :
✅ 2 alertes si les deux sont abrogées
✅ Ordre : sévérité décroissante (critical → warning → info)
```

---

## 📊 Métriques de Performance

### Performance Attendue

| Métrique | Valeur Cible |
|----------|--------------|
| **Détection latence** | <150ms (extraction + fuzzy search) |
| **Faux positifs** | <10% (grâce à `minConfidence: 0.6`) |
| **Faux négatifs** | <5% (grâce à `threshold: 0.5`) |
| **Couverture patterns** | 95% (FR + AR) |
| **Render UI** | <50ms (composant React) |

### Monitoring

**Logs à surveiller** :
```bash
# Succès détection
[Chat API] 2 alerte(s) d'abrogation détectée(s) dans la question

# Échec détection (non-bloquant)
[Chat API] Erreur détection abrogations: [error message]

# Détails alertes
[AbrogationDetector] Références détectées: 3
[AbrogationDetector] Abrogations trouvées: 2
```

**SQL query performance** (fonction `find_abrogations()`) :
```sql
-- Vérifier performance recherche fuzzy
EXPLAIN ANALYZE
SELECT * FROM find_abrogations('Loi n°78-50', 0.5, 3);

-- Attendu : < 50ms avec index pgvector
```

---

## 🔄 Différences avec Ancien Système

### Ancien Système (`/lib/ai/abrogation-detector-service.ts`)

✅ **Maintenu** - Détection dans les **réponses IA** (Phase 2.3)
- Objectif : Valider a posteriori que l'IA ne cite pas de lois obsolètes
- Déclenchement : Après génération réponse
- Retourne : `AbrogationWarning[]`
- Utilisé dans : `rag-chat-service.ts` ligne 1442

### Nouveau Système (`/lib/legal/abrogation-detector-service.ts`)

✅ **Phase 3.4** - Détection dans les **questions utilisateur**
- Objectif : Alerter **avant** génération réponse
- Déclenchement : Dès réception question
- Retourne : `AbrogationAlert[]` (UI enrichie)
- Utilisé dans : `app/api/chat/route.ts` ligne 146

**Les deux systèmes coexistent** et se complètent :
1. **Nouveau** : Alerte proactive sur la question
2. **Assistant IA** : Génère la réponse (sans citer la loi abrogée)
3. **Ancien** : Double-vérification dans la réponse

---

## 🎯 Prochaines Étapes

### Court Terme (Avant Déploiement)

1. ✅ **Tests unitaires** : Service de détection
   ```bash
   npx tsx scripts/test-abrogation-detector.ts
   ```

2. ✅ **Tests intégration** : API `/api/chat`
   ```bash
   curl -X POST https://qadhya.tn/api/chat \
     -H "Authorization: Bearer TOKEN" \
     -d '{"question": "Que dit la Loi 78-50 ?"}'
   ```

3. ✅ **UI intégration** : Afficher alertes dans Chat
   - Modifier page chat pour utiliser `AbrogationAlerts` component
   - Tester affichage responsive (mobile/desktop)

4. ✅ **Tests E2E** : Flow complet
   - Question avec référence abrogée → Alerte affichée → Réponse IA sans référence obsolète

### Moyen Terme (Post-Déploiement)

5. **Analytics** :
   - Tracker combien d'alertes générées par jour
   - Tracker taux de clics sur liens JORT
   - Tracker quelles références sont les plus détectées

6. **Améliorations UX** :
   - Permettre à l'utilisateur de "masquer" une alerte (bouton X)
   - Ajouter option "En savoir plus" avec popup détails
   - Toast notification si abrogation critique détectée

7. **Optimisations** :
   - Cache des recherches fuzzy (Redis)
   - Preload abrogations fréquentes (top 20)
   - Lazy load composant alertes (code-splitting)

---

## 💡 Notes Techniques

### Pourquoi Deux Services ?

**Question** : Pourquoi avoir créé un nouveau service au lieu de modifier l'ancien ?

**Réponse** :
- **Objectifs différents** : Proactif (question) vs Réactif (réponse)
- **Types différents** : `AbrogationAlert` (UI riche) vs `AbrogationWarning` (texte simple)
- **Localisation** : `/lib/legal/` (domaine juridique) vs `/lib/ai/` (domaine IA)
- **Phase projet** : Phase 3.4 (UI) vs Phase 2.3 (Backend)

### Performance : Pourquoi Fuzzy Search ?

**Variabilité références** :
- Base de données : "Loi n°78-50 du 26 octobre 1978"
- Utilisateur écrit : "Loi 78-50", "L. 78-50", "loi n° 78-50"
- Fuzzy search (similarité 0.5) → Match toutes ces variantes

---

## ✅ Résumé Checklist

### Code
- [x] Service détection créé (`lib/legal/abrogation-detector-service.ts`)
- [x] Composant UI créé (`components/chat/abrogation-alert.tsx`)
- [x] API modifiée (`app/api/chat/route.ts`)
- [x] Hook modifié (`lib/hooks/useStreamingChat.ts`)
- [x] Types TypeScript ajoutés

### Documentation
- [x] README Phase 3.4 créé
- [x] Commentaires inline ajoutés
- [x] Tests à effectuer documentés

### Tests
- [ ] Tests unitaires service
- [ ] Tests intégration API
- [ ] Tests E2E UI
- [ ] Tests performance (<150ms)

### Déploiement
- [ ] Commit code GitHub
- [ ] Push vers production
- [ ] Vérifier /api/chat en prod
- [ ] Test manuel question avec loi abrogée

---

**Créé par** : Claude Sonnet 4.5
**Date** : 13 février 2026 15:00 CET
**Version** : 1.0 - Intégration Complète Phase 3.4
**Statut** : ✅ CODE PRÊT | ⏳ TESTS EN ATTENTE
