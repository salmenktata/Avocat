# Classification UI - TODO List

**Statut** : ⏳ EN COURS (Phase 4.3 partiellement implémentée)

Cette documentation liste les composants UI à créer pour l'interface de correction de classification (Sprint 3 - Phase 4.3).

---

## Architecture Complète (Plan Initial)

```
/super-admin/classification (page principale)
├─ Tab 1 : À Revoir (ReviewQueue)
│  └─ Modal de révision (ReviewModal)
├─ Tab 2 : Historique Corrections (CorrectionsHistory)
├─ Tab 3 : Règles Auto-générées (GeneratedRules)
├─ Tab 4 : Suggestions Taxonomie (TaxonomySuggestions)
└─ Tab 5 : Analytics (ClassificationAnalytics)
```

---

## Composants - État d'Implémentation

### ✅ Complétés

Aucun pour l'instant.

### ⏳ En Cours

- [ ] **Page Principale** (`app/super-admin/classification/page.tsx`)
  - Structure tabs Shadcn UI
  - Navigation entre tabs
  - État global via Zustand/Context

### 📋 À Faire (Priorité Haute)

1. **ReviewQueue.tsx** - Table pages nécessitant revue
   - Props : `filters`, `onPageSelect`
   - Colonnes : URL, Titre, Priorité (badge coloré), Confiance, Raison, Actions
   - Filtres multi-select : Priorité (urgent/high/medium/low), Effort (quick/moderate/complex), Source
   - Pagination : Infinite scroll ou buttons prev/next
   - Action "Réviser" → ouvre ReviewModal
   - API : `GET /api/super-admin/classification/queue`

2. **ReviewModal.tsx** - Modal correction classification
   - Props : `pageId`, `onClose`, `onSave`
   - Affichage classification actuelle + signaux utilisés (Accordion)
   - Formulaire correction :
     - Select Catégorie (dropdown taxonomie)
     - Select Domaine (dropdown taxonomie)
     - Select Document Type (dropdown taxonomie)
   - Feedback binaire : "Utile" / "Pas utile" (pour scoring corrections)
   - Bouton "Sauvegarder" → POST `/api/super-admin/classification/corrections`
   - Affichage toast si règle générée automatiquement

3. **CorrectionsHistory.tsx** - Liste corrections avec impact
   - Colonnes : Date, Page URL, Original → Corrigé, Par qui, Impact (badge "Règle générée")
   - Badge "Règle générée" (vert) si `hasGeneratedRule === true`
   - Colonne "Pages affectées" : nombre pages impactées par règle
   - Action "Voir règle" → lien vers `/super-admin/web-sources/[id]/rules`
   - Filtre "Ayant généré règle" (true/false)
   - API : `GET /api/super-admin/classification/corrections?hasRule=true`

4. **GeneratedRules.tsx** - Table règles avec accuracy
   - Colonnes : Nom, Times Matched, Accuracy, Status (badge), Actions
   - Badge status :
     - Vert "Active" : accuracy >= 70%
     - Orange "À Réviser" : 50% <= accuracy < 70%
     - Rouge "À Désactiver" : accuracy < 50%
   - Accuracy = (times_correct / times_matched) * 100
   - Actions : Activer/Désactiver, Éditer (lien)
   - API : `GET /api/admin/classification-rules` (à créer)

5. **ClassificationAnalytics.tsx** - Graphiques analytics
   - **Histogramme** : Distribution confiance (buckets 0-10%, 10-20%, ..., 90-100%)
   - **BarChart** : Top 20 erreurs par domaine (COUNT pages WHERE requires_validation GROUP BY domain)
   - **Table Heatmap** : Usage taxonomie (éléments jamais utilisés = usage_count 0)
   - API : `GET /api/super-admin/classification/analytics/top-errors`

### 📋 À Faire (Priorité Moyenne)

6. **TaxonomySuggestions.tsx** - Suggestions IA en attente approbation
   - Liste suggestions nouvelles catégories/domaines détectés par LLM
   - Actions : Approuver (ajoute à taxonomie), Rejeter (ignore)
   - Statut : En attente, Approuvé, Rejeté
   - API : `GET /api/admin/taxonomy-suggestions` (à créer)

---

## Patterns UI à Réutiliser

### Composants Shadcn/UI

- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` - Navigation tabs
- `Table`, `TableHeader`, `TableRow`, `TableCell` - Tables
- `Badge` - Badges priorité/statut
- `Dialog`, `DialogContent` - Modals
- `Select`, `SelectTrigger`, `SelectContent` - Dropdowns
- `Button` - Boutons actions
- `Input`, `Label` - Formulaires
- `Accordion`, `AccordionItem` - Sections pliables

### Composants Existants à Réutiliser

- `ProviderOperationMatrix.tsx` - Pattern heatmap (pour analytics)
- `WebSourcesTable.tsx` - Pattern table avec filtres et pagination
- `ClassificationRulesManager.tsx` - Pattern gestion règles

### Hooks Utiles

```typescript
import { useQuery, useMutation } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { useState } from 'react'

// Fetching queue
const { data: queue, isLoading } = useQuery({
  queryKey: ['classification-queue', filters],
  queryFn: () => fetch('/api/super-admin/classification/queue?' + params).then(r => r.json())
})

// Mutation correction
const saveCorrectionMutation = useMutation({
  mutationFn: (data) => fetch('/api/super-admin/classification/corrections', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  onSuccess: () => {
    toast({ title: "Correction enregistrée" })
    queryClient.invalidateQueries({ queryKey: ['classification-queue'] })
  }
})
```

---

## Checklist Implémentation

### Phase 4.3.1 : Page Principale + ReviewQueue (MVP)
- [ ] Créer `app/super-admin/classification/page.tsx`
  - [ ] Structure 5 tabs
  - [ ] Tab "À Revoir" actif par défaut
- [ ] Créer `components/super-admin/classification/ReviewQueue.tsx`
  - [ ] Table avec colonnes URL, Priorité, Confiance
  - [ ] Filtres priorité (multi-select)
  - [ ] Bouton "Réviser" → TODO (Phase 4.3.2)
  - [ ] Fetch API `/api/super-admin/classification/queue`
  - [ ] Pagination (simple prev/next)

### Phase 4.3.2 : Modal Révision
- [ ] Créer `components/super-admin/classification/ReviewModal.tsx`
  - [ ] Affichage classification actuelle
  - [ ] Formulaire correction (3 selects)
  - [ ] Feedback binaire
  - [ ] POST `/api/super-admin/classification/corrections`
  - [ ] Intégrer dans ReviewQueue

### Phase 4.3.3 : Historique + Règles
- [ ] Créer `components/super-admin/classification/CorrectionsHistory.tsx`
  - [ ] Table corrections avec badge "Règle générée"
  - [ ] Filtre `hasRule`
- [ ] Créer `components/super-admin/classification/GeneratedRules.tsx`
  - [ ] Table règles avec accuracy badges
  - [ ] Actions Activer/Désactiver

### Phase 4.3.4 : Analytics
- [ ] Créer `components/super-admin/classification/ClassificationAnalytics.tsx`
  - [ ] Histogramme confiance (Recharts)
  - [ ] BarChart top erreurs
  - [ ] Heatmap taxonomie (réutiliser pattern ProviderOperationMatrix)

---

## APIs Manquantes (À Créer)

### 1. GET `/api/admin/classification-rules`
**Objectif** : Récupérer toutes les règles avec accuracy
**Response** :
```typescript
{
  rules: {
    id: string
    name: string
    pattern: string
    targetCategory: string
    timesMatched: number
    timesCorrect: number
    accuracy: number // (timesCorrect / timesMatched) * 100
    isActive: boolean
    createdAt: string
  }[]
}
```

### 2. GET `/api/admin/taxonomy-suggestions`
**Objectif** : Récupérer suggestions nouvelles catégories détectées
**Response** :
```typescript
{
  suggestions: {
    id: string
    type: 'category' | 'domain' | 'documentType'
    suggestedValue: string
    detectedFromPages: number
    status: 'pending' | 'approved' | 'rejected'
    createdAt: string
  }[]
}
```

### 3. POST `/api/admin/classification-rules/[id]/toggle`
**Objectif** : Activer/désactiver une règle
**Body** : `{ isActive: boolean }`

---

## Estimation Effort

| Composant | Lignes Code | Temps Estimé |
|-----------|-------------|--------------|
| Page principale | ~150 | 1h |
| ReviewQueue | ~250 | 2h |
| ReviewModal | ~300 | 3h |
| CorrectionsHistory | ~200 | 1.5h |
| GeneratedRules | ~250 | 2h |
| ClassificationAnalytics | ~400 | 4h |
| **TOTAL** | **~1550** | **~14h** |

**Note** : Estimation pour implémentation MVP (version fonctionnelle, pas polissage UI)

---

## Priorités pour MVP

**Phase 1 (Immédiat)** :
1. Page principale avec tabs ✅
2. ReviewQueue basique (table + filtres)
3. ReviewModal basique (formulaire correction)

**Phase 2 (Court terme)** :
4. CorrectionsHistory
5. Analytics basique (top erreurs seulement)

**Phase 3 (Moyen terme)** :
6. GeneratedRules
7. Analytics complet (histogramme + heatmap)

**Phase 4 (Long terme)** :
8. TaxonomySuggestions
9. Polissage UI/UX
10. Tests E2E

---

## Notes d'Implémentation

### Gestion État

Utiliser Zustand store pour état global :

```typescript
// stores/classification-ui-store.ts
interface ClassificationUIStore {
  activeTab: 'queue' | 'history' | 'rules' | 'suggestions' | 'analytics'
  setActiveTab: (tab) => void
  filters: {
    priority: ReviewPriority[]
    effort: ReviewEffort[]
    sourceId: string | null
  }
  setFilters: (filters) => void
}
```

### Permissions

Toutes les pages sous `/super-admin/*` nécessitent :
- Role `admin` ou `super_admin`
- TODO : Ajouter middleware auth Next.js

### Tests

Scripts de test à créer :
- `scripts/test-classification-ui.ts` - Tests API calls
- Cypress E2E pour flow complet : Filtrer → Réviser → Sauvegarder → Vérifier historique

---

## Décisions Design

### Couleurs Badges Priorité

- 🔴 **Urgent** : `bg-red-100 text-red-800` (Rouge)
- 🟠 **High** : `bg-orange-100 text-orange-800` (Orange)
- 🟡 **Medium** : `bg-yellow-100 text-yellow-800` (Jaune)
- 🟢 **Low** : `bg-green-100 text-green-800` (Vert)
- ⚪ **Aucune** : `bg-gray-100 text-gray-800` (Gris)

### Couleurs Badges Effort

- ⚡ **Quick** : `bg-blue-100 text-blue-800` (< 2min)
- ⏱️ **Moderate** : `bg-purple-100 text-purple-800` (2-5min)
- 🧠 **Complex** : `bg-indigo-100 text-indigo-800` (> 5min)

### Couleurs Badges Status Règles

- ✅ **Active (accuracy >= 70%)** : `bg-green-100 text-green-800`
- ⚠️ **À Réviser (50-70%)** : `bg-orange-100 text-orange-800`
- ❌ **À Désactiver (< 50%)** : `bg-red-100 text-red-800`

---

## Prochaines Actions

1. ✅ Créer cette doc TODO
2. ⏳ Implémenter page principale + structure tabs
3. ⏳ Implémenter ReviewQueue MVP
4. ⏸️ Implémenter ReviewModal
5. ⏸️ Implémenter autres composants selon priorités

**Mise à jour** : 10 février 2026, 00:30 - Documentation créée
