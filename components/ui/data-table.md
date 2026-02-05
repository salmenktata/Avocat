# DataTable Component

Composant de table professionnel et réutilisable avec tri, pagination, recherche et sélection.

## Fonctionnalités

✅ **Tri par colonne** - Cliquez sur l'en-tête pour trier
✅ **Pagination** - 10, 25, 50, 100 items par page
✅ **Recherche** - Filtrage en temps réel
✅ **Sélection multiple** - Checkbox avec sélection all
✅ **Empty state** - Message personnalisable
✅ **Loading state** - Spinner pendant le chargement
✅ **Responsive** - Adaptatif mobile/desktop
✅ **Dark mode** - Support complet
✅ **Actions** - Menu dropdown par ligne
✅ **Click sur ligne** - Navigation personnalisable

## Installation

Le composant utilise shadcn/ui. Assurez-vous d'avoir installé :

```bash
npx shadcn@latest add table button input select checkbox
```

## Utilisation de base

```tsx
import { DataTable, DataTableColumn } from '@/components/ui/data-table'

interface User {
  id: string
  name: string
  email: string
}

const columns: DataTableColumn<User>[] = [
  {
    id: 'name',
    header: 'Nom',
    accessor: (user) => user.name,
    sortable: true,
  },
  {
    id: 'email',
    header: 'Email',
    accessor: (user) => user.email,
    sortable: true,
  },
]

export function UsersTable({ users }: { users: User[] }) {
  return (
    <DataTable
      data={users}
      columns={columns}
      searchable
      pageSize={25}
    />
  )
}
```

## Props

### DataTableProps<T>

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `data` | `T[]` | **requis** | Données à afficher |
| `columns` | `DataTableColumn<T>[]` | **requis** | Définition des colonnes |
| `searchable` | `boolean` | `false` | Activer la recherche |
| `searchPlaceholder` | `string` | `'Rechercher...'` | Placeholder de recherche |
| `onSearch` | `(query: string) => void` | - | Callback recherche |
| `selectable` | `boolean` | `false` | Activer sélection multiple |
| `onSelectionChange` | `(rows: T[]) => void` | - | Callback sélection |
| `pageSize` | `number` | `10` | Nombre d'items par page |
| `pageSizeOptions` | `number[]` | `[10, 25, 50, 100]` | Options de pagination |
| `emptyMessage` | `string` | `'Aucune donnée'` | Message si vide |
| `loading` | `boolean` | `false` | État de chargement |
| `onRowClick` | `(row: T) => void` | - | Click sur une ligne |
| `getRowId` | `(row: T) => string` | - | ID unique pour sélection |

### DataTableColumn<T>

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | ID unique de la colonne |
| `header` | `string` | Texte de l'en-tête |
| `accessor` | `(row: T) => React.ReactNode` | Rendu de la cellule |
| `sortable` | `boolean` | Colonne triable |
| `className` | `string` | Classes CSS personnalisées |

## Exemples avancés

### Avec Avatar et Badge

```tsx
{
  id: 'user',
  header: 'Utilisateur',
  accessor: (user) => (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarFallback>{user.name[0]}</AvatarFallback>
      </Avatar>
      <div>
        <div className="font-medium">{user.name}</div>
        <div className="text-sm text-muted-foreground">{user.email}</div>
      </div>
    </div>
  ),
  sortable: true,
}
```

### Avec Actions

```tsx
{
  id: 'actions',
  header: '',
  accessor: (row) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Icons.moreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleEdit(row)}>
          Modifier
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDelete(row)}>
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}
```

### Avec Badge de statut

```tsx
{
  id: 'status',
  header: 'Statut',
  accessor: (row) => (
    <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
      {row.status}
    </Badge>
  ),
  sortable: true,
}
```

### Sélection multiple avec actions

```tsx
const [selectedUsers, setSelectedUsers] = useState<User[]>([])

return (
  <div className="space-y-4">
    {selectedUsers.length > 0 && (
      <div className="flex items-center gap-2">
        <Button onClick={() => handleDeleteMultiple(selectedUsers)}>
          Supprimer {selectedUsers.length} utilisateur(s)
        </Button>
      </div>
    )}

    <DataTable
      data={users}
      columns={columns}
      selectable
      onSelectionChange={setSelectedUsers}
      getRowId={(user) => user.id}
    />
  </div>
)
```

## Styling

Le composant utilise les tokens du design system :

```css
/* Personnaliser via Tailwind */
- bg-card: Background des cellules
- text-foreground: Texte principal
- text-muted-foreground: Texte secondaire
- border: Bordures
- bg-muted: Ligne sélectionnée
```

## Responsive

Sur mobile (<768px), le composant reste scrollable horizontalement. Pour une version cards sur mobile, créez un composant dédié :

```tsx
<div className="hidden md:block">
  <DataTable {...props} />
</div>
<div className="md:hidden">
  <MobileCardList data={data} />
</div>
```

## Performance

- ✅ Pagination côté client (pas de rechargement)
- ✅ Tri en mémoire (React.useMemo)
- ✅ Recherche optimisée
- ✅ Re-render minimal

Pour de très grandes listes (>1000 items), considérez la pagination serveur.

## Accessibilité

- ✅ Navigation clavier complète
- ✅ ARIA labels
- ✅ Screen reader friendly
- ✅ Focus visible
- ✅ Contrast WCAG AA

## Exemples complets

Voir :
- `components/clients/ClientsDataTable.tsx` - Table clients complète
- `components/dossiers/DossiersDataTable.tsx` - Table dossiers
- `components/factures/FacturesDataTable.tsx` - Table factures
