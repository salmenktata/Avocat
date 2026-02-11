# Simplification Interface Web Sources - Split Buttons

**Date**: 11 février 2026
**Objectif**: Réduire les doublons et les clics dans les actions des web sources

---

## Problème Initial

### Doublons identifiés
1. ❌ **Crawl** : "Crawler" (bouton) vs "Crawl complet" (menu)
2. ❌ **Index** : "Indexer" (bouton) vs "Réindexer tout" + "Indexer les PDF" (menu)

### Trop de clics
- Actions avancées nécessitaient d'ouvrir le menu "⋮" (2 clics minimum)
- Menu dropdown surchargé avec 8 items

---

## Solution Implémentée : Split Buttons

### Architecture

```
┌─────────────┬─┐  ┌──────────┬─┐  ┌─┐
│  Crawler    │▼│  │ Indexer  │▼│  │⋮│
└─────────────┴─┘  └──────────┴─┘  └─┘
```

**Composants créés** :
- `components/ui/split-button.tsx` (nouveau composant réutilisable)

**Composants modifiés** :
- `components/super-admin/web-sources/WebSourceActions.tsx`

---

## Détail des Actions

### 🔄 Split Button "Crawler"

**Clic gauche** (1 clic) :
- ✅ Crawl incrémental (action par défaut - 90% des cas)

**Clic dropdown "▼"** (2 clics) :
- ✅ Crawl incrémental (badge "Par défaut")
- 🔄 Crawl complet (réindexe tout depuis zéro)

**État** :
- Désactivé si source inactive (`!source.is_active`)
- Loading state avec spinner

---

### 📦 Split Button "Indexer"

**Clic gauche** (1 clic) :
- ✅ Indexer nouveau contenu (action par défaut - 90% des cas)

**Clic dropdown "▼"** (2 clics) :
- ✅ Indexer nouveau (badge "Par défaut")
- 🔁 Réindexer tout (recalcule tous les embeddings)
- 📄 Indexer les PDF uniquement

**État** :
- Variant outline avec bordure violette
- Loading state avec spinner

---

### ⋮ Menu Actions Secondaires (simplifié)

**Avant** : 8 items
**Après** : 4 items (-50%)

Items conservés :
1. ✏️ **Modifier** (lien vers /edit)
2. 📁 **Voir les fichiers** (lien vers /files)
3. ⏸️ **Désactiver** / ▶️ **Activer** (toggle)
4. 🗑️ **Supprimer** (rouge, avec confirmation)

Items retirés (déplacés dans split buttons) :
- ❌ ~~Crawl complet~~ → dans dropdown "Crawler"
- ❌ ~~Réindexer tout~~ → dans dropdown "Indexer"
- ❌ ~~Indexer les PDF~~ → dans dropdown "Indexer"

---

## Bénéfices

### UX améliorée
✅ **-50% items menu** : 8 → 4 items dans le menu "⋮"
✅ **Zéro doublon** : Chaque action a un seul emplacement
✅ **1 clic** pour actions courantes (incrémental, indexer nouveau)
✅ **2 clics** pour actions avancées (crawl complet, réindexer tout)

### Code amélioré
✅ **Composant réutilisable** : `SplitButton` peut être utilisé ailleurs
✅ **Props typées** : Interface `SplitButtonOption` claire
✅ **Badge intégré** : Indique l'action par défaut
✅ **Loading states** : Gestion cohérente des états de chargement

---

## Structure Technique

### SplitButton Props

```typescript
interface SplitButtonOption {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
  badge?: string  // "Par défaut" pour l'action principale
}

interface SplitButtonProps {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  options: SplitButtonOption[]
  disabled?: boolean
  loading?: boolean
  variant?: 'default' | 'outline' | ...
  className?: string
}
```

### Exemple d'utilisation

```tsx
<SplitButton
  label="Crawler"
  icon={<Icons.refresh className="h-4 w-4" />}
  onClick={() => handleCrawl('incremental')}
  disabled={!source.is_active}
  loading={loading === 'crawl'}
  className="bg-blue-600 hover:bg-blue-700"
  options={[
    {
      label: 'Crawl incrémental',
      icon: <Icons.refresh className="h-4 w-4" />,
      onClick: () => handleCrawl('incremental'),
      badge: 'Par défaut',
    },
    {
      label: 'Crawl complet',
      icon: <Icons.refresh className="h-4 w-4" />,
      onClick: () => handleCrawl('full_crawl'),
      className: 'text-blue-400',
    },
  ]}
/>
```

---

## Tests

### Tests à effectuer
- [ ] Crawl incrémental (clic gauche "Crawler")
- [ ] Crawl complet (dropdown "Crawler")
- [ ] Indexer nouveau (clic gauche "Indexer")
- [ ] Réindexer tout (dropdown "Indexer")
- [ ] Indexer PDF (dropdown "Indexer")
- [ ] Loading states (spinner pendant l'action)
- [ ] Disabled states (source inactive)
- [ ] Responsive mobile (split button s'adapte)

### Validation visuelle
- [ ] Badge "Par défaut" visible dans dropdown
- [ ] Couleurs cohérentes (bleu crawl, violet index)
- [ ] Icônes alignées
- [ ] Espacement correct entre boutons
- [ ] Menu "⋮" allégé (4 items)

---

## Prochaines Étapes

### Extensions possibles
1. **Autres pages** : Appliquer le pattern split button ailleurs si pertinent
2. **Tooltips** : Ajouter des tooltips explicatifs sur hover
3. **Keyboard shortcuts** : Ctrl+R pour crawl, Ctrl+I pour indexer
4. **Analytics** : Tracker usage crawl incrémental vs complet

### Maintenance
- Composant `SplitButton` centralisé dans `components/ui/`
- Facile à étendre avec nouvelles options
- Pas de breaking change (API /crawl, /index inchangées)

---

## Références

**Fichiers modifiés** :
- ✅ `components/ui/split-button.tsx` (nouveau, 96 lignes)
- ✅ `components/super-admin/web-sources/WebSourceActions.tsx` (refacto, -60 lignes)

**Pattern inspiré de** :
- GitHub Actions (split button deploy)
- VSCode (split button run/debug)
- Azure DevOps (split button pipeline)

**Documentation liée** :
- `docs/CATEGORY_ALIGNMENT.md` (autre simplification UI)
- `docs/PERFORMANCE_AUDIT.md` (optimisations bundle)
