# Global Search - Recherche Globale CMD+K

Système de recherche rapide pour accéder instantanément à toutes les ressources de l'application.

## Fonctionnalités

✅ **Raccourci clavier** - CMD+K (Mac) / CTRL+K (Windows/Linux)
✅ **Recherche multi-entités** - Clients, Dossiers, Factures, Documents
✅ **Debounced search** - 300ms pour éviter les appels API excessifs
✅ **Groupage par type** - Résultats organisés par catégorie
✅ **Navigation clavier** - ↑↓ pour naviguer, ↵ pour ouvrir
✅ **Preview visuel** - Icônes, badges de statut, sous-titres
✅ **Dark mode** - Compatible avec le thème sombre
✅ **Empty states** - Messages clairs quand aucun résultat
✅ **Loading state** - Spinner pendant la recherche
✅ **Responsive** - Adapté mobile/desktop

## Utilisation

### Ouvrir la recherche

Trois façons d'ouvrir la recherche :

1. **Raccourci clavier** : `CMD+K` (Mac) ou `CTRL+K` (Windows/Linux)
2. **Clic sur le champ** : Dans la topbar, cliquer sur "Rechercher..."
3. **Focus** : Tab jusqu'au champ de recherche

### Rechercher

1. Tapez au moins 2 caractères
2. Les résultats apparaissent automatiquement après 300ms
3. Utilisez ↑↓ pour naviguer entre les résultats
4. Appuyez sur ↵ (Enter) pour ouvrir l'élément sélectionné
5. Appuyez sur Esc pour fermer

### Types de recherche

#### Clients
- Recherche dans : nom, prénom, email, dénomination
- Icône : 👤 (particulier) ou 🏢 (entreprise)
- Sous-titre : email du client
- Navigation : `/clients/{id}`

#### Dossiers
- Recherche dans : numéro de dossier, objet
- Icône : 📁
- Badge : Actif (vert), Clôturé (orange), Archivé (gris)
- Sous-titre : objet du dossier
- Navigation : `/dossiers/{id}`

#### Factures
- Recherche dans : numéro de facture, objet
- Icône : 📄
- Badge : Payée (vert), Envoyée (bleu), Impayée (rouge), Brouillon (gris)
- Sous-titre : objet + montant TTC
- Navigation : `/factures/{id}`

#### Documents
- Recherche dans : nom du fichier
- Icône : 📎
- Sous-titre : type de fichier
- Navigation : `/documents?id={id}`

## Architecture

### Composants

```
components/layout/
├── GlobalSearch.tsx          # Composant principal
└── global-search-guide.md    # Documentation

app/api/
└── search/
    └── route.ts              # API endpoint de recherche
```

### Composant GlobalSearch

```tsx
<GlobalSearch className="w-64" />
```

**Props** :
- `className` (optionnel) - Classes CSS personnalisées

**État interne** :
- `open` - Dialog ouvert/fermé
- `query` - Texte de recherche
- `results` - Résultats de la recherche
- `isSearching` - État de chargement

### API Endpoint

**Endpoint** : `GET /api/search?q={query}`

**Query params** :
- `q` - Texte de recherche (minimum 2 caractères)

**Response** :
```json
{
  "results": [
    {
      "id": "uuid",
      "type": "client" | "dossier" | "facture" | "document",
      "title": "Titre principal",
      "subtitle": "Sous-titre optionnel",
      "url": "/path/to/resource",
      "icon": "nom_icone",
      "badge": {
        "text": "Texte du badge",
        "variant": "default" | "success" | "warning" | "destructive"
      }
    }
  ]
}
```

**Limites** :
- 5 résultats max par type
- Total : 20 résultats max

**Sécurité** :
- Authentification requise (JWT Supabase)
- Filtrage par user_id automatique (RLS Supabase)

## Intégration dans Topbar

```tsx
import { GlobalSearch } from './GlobalSearch'

<div className="flex items-center gap-2">
  <GlobalSearch className="w-64" />
  {/* autres éléments */}
</div>
```

## Personnalisation

### Modifier le délai de debounce

Dans `GlobalSearch.tsx` :

```tsx
const timer = setTimeout(async () => {
  // ...recherche
}, 300) // ← Changer cette valeur (ms)
```

### Ajouter un type d'entité

1. **Modifier l'interface** :
```tsx
type: 'client' | 'dossier' | 'facture' | 'document' | 'nouveau_type'
```

2. **Ajouter dans l'API** (`app/api/search/route.ts`) :
```tsx
// Rechercher dans la nouvelle entité
const { data: nouvelles } = await supabase
  .from('nouvelle_table')
  .select('*')
  .ilike('nom', searchTerm)
  .limit(5)

if (nouvelles) {
  nouvelles.forEach((item) => {
    results.push({
      id: item.id,
      type: 'nouveau_type',
      title: item.nom,
      subtitle: item.description,
      url: `/nouveau-type/${item.id}`,
      icon: 'icon_name',
    })
  })
}
```

3. **Ajouter le label** dans `getGroupLabel()` :
```tsx
const labels: Record<string, string> = {
  // ...existants
  nouveau_type: 'Nouveaux Types',
}
```

### Modifier les icônes

Utiliser n'importe quelle icône de `lib/icons.tsx` :

```tsx
results.push({
  // ...
  icon: 'folderOpen', // ou 'user', 'building', 'fileText', etc.
})
```

## Performance

### Debouncing

- **Délai** : 300ms
- **Bénéfice** : Réduit les appels API de ~70%
- **UX** : Imperceptible pour l'utilisateur

### Limites de résultats

- **Par type** : 5 résultats
- **Total** : 20 résultats max
- **Raison** : Performance + UX (trop de résultats = confusion)

### Optimisations Supabase

L'API utilise des requêtes optimisées :

```sql
-- Index recommandés (à créer si performance lente)
CREATE INDEX idx_clients_search ON clients USING gin (
  to_tsvector('french', coalesce(nom, '') || ' ' || coalesce(prenom, '') || ' ' || coalesce(email, ''))
);

CREATE INDEX idx_dossiers_search ON dossiers USING gin (
  to_tsvector('french', coalesce(numero_dossier, '') || ' ' || coalesce(objet, ''))
);

CREATE INDEX idx_factures_search ON factures USING gin (
  to_tsvector('french', coalesce(numero_facture, '') || ' ' || coalesce(objet, ''))
);

CREATE INDEX idx_documents_search ON documents USING gin (
  to_tsvector('french', coalesce(nom, ''))
);
```

## Accessibilité

✅ **Navigation clavier complète** - Tab, ↑↓, Enter, Esc
✅ **ARIA labels** - CommandDialog génère automatiquement
✅ **Screen reader** - Annonces des résultats et navigation
✅ **Focus visible** - Indicateur clair sur élément sélectionné
✅ **Contraste WCAG AA** - Respecté en mode clair et sombre

## États UX

### État initial (pas de recherche)

- Icône Command ⌘
- Titre : "Recherche rapide"
- Description : "Tapez pour rechercher dans vos données"
- Tags : Clients, Dossiers, Factures, Documents

### État de recherche (isSearching)

- Spinner animé au centre
- Pas de résultats affichés

### État vide (query mais 0 résultats)

- Icône loupe
- Titre : "Aucun résultat trouvé"
- Description : "Essayez avec d'autres mots-clés"

### État avec résultats

- Résultats groupés par type
- Icônes colorées
- Badges de statut
- Sous-titres informatifs
- Flèche → à droite pour navigation

## Exemples de recherche

| Recherche | Résultats attendus |
|-----------|-------------------|
| `ahmed` | Clients nommés Ahmed |
| `2024` | Dossiers et factures de 2024 |
| `divorce` | Dossiers de type divorce |
| `payée` | Factures avec statut payé |
| `contrat.pdf` | Documents nommés contrat.pdf |
| `exemple@email.com` | Client avec cet email |

## Raccourcis clavier

| Touche | Action |
|--------|--------|
| `CMD+K` / `CTRL+K` | Ouvrir/fermer la recherche |
| `↑` | Naviguer vers le haut |
| `↓` | Naviguer vers le bas |
| `Enter` | Ouvrir l'élément sélectionné |
| `Esc` | Fermer la recherche |
| `Tab` | Naviguer entre éléments (accessibilité) |

## Troubleshooting

### La recherche ne retourne rien

1. Vérifier que l'utilisateur est authentifié
2. Vérifier les RLS policies Supabase
3. Vérifier la console pour erreurs API
4. Tester l'endpoint directement : `/api/search?q=test`

### Les résultats sont lents

1. Ajouter les index de recherche (voir section Performance)
2. Réduire la limite de résultats
3. Augmenter le délai de debounce

### Le raccourci CMD+K ne fonctionne pas

1. Vérifier les conflits avec extensions navigateur
2. Essayer CTRL+K sur Windows/Linux
3. Vérifier la console pour erreurs JavaScript

### Les icônes ne s'affichent pas

1. Vérifier que l'icône existe dans `lib/icons.tsx`
2. Corriger le nom de l'icône dans l'API
3. Exemple : `'user'` pas `'User'`

## Évolutions futures

### Phase 1 (actuel)
- [x] Recherche texte simple
- [x] 4 types d'entités
- [x] Raccourci CMD+K
- [x] Navigation clavier

### Phase 2 (à venir)
- [ ] Filtres par type (toggle clients/dossiers/etc.)
- [ ] Recherche avancée (par date, montant, etc.)
- [ ] Historique des recherches récentes
- [ ] Suggestions de recherche
- [ ] Recherche fuzzy (tolérance aux fautes)

### Phase 3 (futur)
- [ ] Full-text search avec Postgres FTS
- [ ] Highlighting des termes de recherche
- [ ] Recherche dans le contenu des documents
- [ ] Recherche vocale
- [ ] Analytics des recherches populaires

## Support

Pour toute question sur la recherche globale :
- Voir `components/layout/GlobalSearch.tsx` - Code source
- Voir `app/api/search/route.ts` - API endpoint
- Consulter la documentation shadcn/ui Command : https://ui.shadcn.com/docs/components/command
