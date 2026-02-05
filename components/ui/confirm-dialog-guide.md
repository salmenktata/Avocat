# ConfirmDialog - Dialogs de Confirmation Élégants

Composant de dialog de confirmation pour remplacer les `confirm()` natifs par une interface élégante et accessible.

## Pourquoi remplacer confirm() ?

### Problèmes avec confirm() natif

❌ **Style non personnalisable** - Apparence système (différente par navigateur)
❌ **Bloquant** - Bloque l'interface utilisateur
❌ **Pas de dark mode** - Toujours clair
❌ **Pas d'icônes** - Texte seulement
❌ **Pas de loading state** - Pas de feedback pendant l'action
❌ **Non accessible** - Support clavier limité
❌ **Mobile peu adapté** - Expérience médiocre sur mobile

### Avantages de ConfirmDialog

✅ **Cohérence visuelle** - Suit le design system
✅ **Non bloquant** - N'interrompt pas l'UI
✅ **Dark mode** - Compatible automatiquement
✅ **Icônes** - Feedback visuel clair (warning, danger, info, question)
✅ **Loading state** - Spinner pendant l'action async
✅ **Accessible** - ARIA, navigation clavier, screen reader
✅ **Mobile friendly** - Responsive et touch-friendly
✅ **Animations** - Entrée/sortie fluides

## Installation

Le composant utilise shadcn/ui AlertDialog (déjà installé).

```bash
# Déjà installé dans le projet
npx shadcn@latest add alert-dialog
```

## Utilisation de base

### Pattern 1 : État local (Controlled)

```tsx
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function DeleteButton() {
  const [isOpen, setIsOpen] = useState(false)

  const handleDelete = async () => {
    // Votre logique de suppression
    await deleteClient(clientId)
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setIsOpen(true)}>
        Supprimer
      </Button>

      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Supprimer le client ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="destructive"
        icon="danger"
        onConfirm={handleDelete}
      />
    </>
  )
}
```

### Pattern 2 : Hook useConfirmDialog (Simplifié)

```tsx
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'

export function ArchiveButton() {
  const { confirm, dialog } = useConfirmDialog()

  const handleArchive = async () => {
    await confirm({
      title: 'Archiver le dossier ?',
      description: 'Le dossier sera déplacé vers les archives.',
      confirmLabel: 'Archiver',
      variant: 'default',
      icon: 'warning',
      onConfirm: async () => {
        await archiveDossier(dossierId)
      },
    })
  }

  return (
    <>
      {dialog}
      <Button onClick={handleArchive}>Archiver</Button>
    </>
  )
}
```

## API

### ConfirmDialog Props

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `open` | `boolean` | - | État ouvert/fermé (requis) |
| `onOpenChange` | `(open: boolean) => void` | - | Callback changement état (requis) |
| `title` | `string` | - | Titre du dialog (requis) |
| `description` | `string` | - | Description/message (requis) |
| `confirmLabel` | `string` | `'Confirmer'` | Texte bouton de confirmation |
| `cancelLabel` | `string` | `'Annuler'` | Texte bouton d'annulation |
| `variant` | `'default' \| 'destructive'` | `'default'` | Style du bouton confirm |
| `icon` | `'warning' \| 'info' \| 'danger' \| 'question'` | `'warning'` | Icône affichée |
| `onConfirm` | `() => void \| Promise<void>` | - | Fonction à exécuter (requis) |

### useConfirmDialog Hook

Retourne un objet avec :

```tsx
{
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>
  dialog: ReactNode
}
```

**Usage** :

```tsx
const { confirm, dialog } = useConfirmDialog()

// Afficher le dialog
await confirm({
  title: 'Titre',
  description: 'Description',
  onConfirm: async () => { /* action */ }
})

// Ne pas oublier de rendre {dialog}
return <>{dialog}<Button>...</Button></>
```

## Variantes

### Variante Default (Bleu)

Pour actions non destructives : archiver, clôturer, exporter, etc.

```tsx
<ConfirmDialog
  variant="default"
  icon="question"
  title="Clôturer le dossier ?"
  description="Le dossier ne pourra plus être modifié."
  confirmLabel="Clôturer"
  // ...
/>
```

### Variante Destructive (Rouge)

Pour actions irréversibles : supprimer, annuler, etc.

```tsx
<ConfirmDialog
  variant="destructive"
  icon="danger"
  title="Supprimer définitivement ?"
  description="Cette action est irréversible."
  confirmLabel="Supprimer"
  // ...
/>
```

## Icônes

### Warning (⚠️ Orange)

Usage : Actions réversibles mais importantes

```tsx
icon="warning"
// Archiver, déplacer, modifier en masse
```

### Danger (🔺 Rouge)

Usage : Actions destructives irréversibles

```tsx
icon="danger"
// Supprimer, annuler définitivement
```

### Info (ℹ️ Bleu)

Usage : Actions informatives

```tsx
icon="info"
// Se déconnecter, quitter, rafraîchir
```

### Question (❓ Primaire)

Usage : Questions sans danger

```tsx
icon="question"
// Clôturer, marquer comme lu, changer de vue
```

## Cas d'usage

### 1. Supprimer un client

```tsx
<ConfirmDialog
  title="Supprimer le client ?"
  description="Le client et toutes ses données associées seront définitivement supprimés."
  confirmLabel="Supprimer"
  variant="destructive"
  icon="danger"
  onConfirm={async () => await deleteClient(id)}
/>
```

### 2. Supprimer plusieurs éléments

```tsx
<ConfirmDialog
  title={`Supprimer ${count} éléments ?`}
  description={`${count} éléments seront définitivement supprimés.`}
  confirmLabel="Supprimer tout"
  variant="destructive"
  icon="danger"
  onConfirm={async () => await deleteMultiple(ids)}
/>
```

### 3. Archiver un dossier

```tsx
<ConfirmDialog
  title="Archiver le dossier ?"
  description="Le dossier sera déplacé vers les archives. Vous pourrez le restaurer."
  confirmLabel="Archiver"
  variant="default"
  icon="warning"
  onConfirm={async () => await archiveDossier(id)}
/>
```

### 4. Clôturer un dossier

```tsx
<ConfirmDialog
  title="Clôturer le dossier ?"
  description="Une fois clôturé, le dossier ne pourra plus être modifié."
  confirmLabel="Clôturer"
  variant="default"
  icon="question"
  onConfirm={async () => await closeDossier(id)}
/>
```

### 5. Annuler une facture

```tsx
<ConfirmDialog
  title="Annuler la facture ?"
  description="La facture sera marquée comme annulée. Cette action ne peut pas être annulée."
  confirmLabel="Annuler la facture"
  variant="destructive"
  icon="danger"
  onConfirm={async () => await cancelInvoice(id)}
/>
```

### 6. Quitter sans enregistrer

```tsx
<ConfirmDialog
  title="Modifications non enregistrées"
  description="Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ?"
  confirmLabel="Quitter sans enregistrer"
  cancelLabel="Rester"
  variant="destructive"
  icon="warning"
  onConfirm={async () => router.back()}
/>
```

### 7. Se déconnecter

```tsx
<ConfirmDialog
  title="Se déconnecter ?"
  description="Vous serez redirigé vers la page de connexion."
  confirmLabel="Se déconnecter"
  variant="default"
  icon="info"
  onConfirm={async () => await signOut()}
/>
```

## Loading State

Le composant gère automatiquement l'état de chargement :

```tsx
const handleDelete = async () => {
  // Pendant cette fonction :
  // - Bouton Confirmer affiche un spinner
  // - Boutons désactivés
  // - Dialog ne peut pas être fermé

  await deleteClient(id)

  // Une fois terminé :
  // - Spinner disparaît
  // - Dialog se ferme automatiquement
}
```

## Gestion d'erreurs

Si `onConfirm` échoue, le dialog reste ouvert :

```tsx
onConfirm={async () => {
  try {
    await deleteClient(id)
    // Dialog se ferme automatiquement si succès
  } catch (error) {
    // Dialog reste ouvert, afficher un toast d'erreur
    toast.error('Échec de la suppression')
    throw error // Important : re-throw pour empêcher la fermeture
  }
}}
```

## Accessibilité

✅ **Navigation clavier**
- `Tab` - Naviguer entre boutons
- `Enter` - Confirmer
- `Esc` - Annuler

✅ **ARIA labels**
- `role="alertdialog"` - Annonce l'importance
- `aria-labelledby` - Titre
- `aria-describedby` - Description

✅ **Focus management**
- Focus automatique sur bouton Annuler à l'ouverture
- Trap du focus dans le dialog
- Restauration du focus après fermeture

✅ **Screen reader**
- Annonce du titre et description
- État des boutons (loading, disabled)

## Animations

Animations par défaut (via AlertDialog) :
- **Entrée** : Fade in + scale 0.95 → 1
- **Sortie** : Fade out + scale 1 → 0.95
- **Durée** : 200ms
- **Easing** : ease-out

## Responsive

- **Desktop** : Dialog centré, largeur max 450px
- **Tablet** : Largeur 90%, max 450px
- **Mobile** : Plein écran avec padding
- **Touch** : Boutons min-height 44px

## Migration depuis confirm()

### Avant (confirm natif)

```tsx
const handleDelete = async () => {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
    await deleteClient(id)
  }
}

<button onClick={handleDelete}>Supprimer</button>
```

### Après (ConfirmDialog)

```tsx
const [isOpen, setIsOpen] = useState(false)

const handleDelete = async () => {
  await deleteClient(id)
}

<>
  <Button onClick={() => setIsOpen(true)}>Supprimer</Button>

  <ConfirmDialog
    open={isOpen}
    onOpenChange={setIsOpen}
    title="Supprimer le client ?"
    description="Cette action est irréversible."
    variant="destructive"
    icon="danger"
    onConfirm={handleDelete}
  />
</>
```

Ou avec le hook (plus court) :

```tsx
const { confirm, dialog } = useConfirmDialog()

const handleDelete = async () => {
  await confirm({
    title: 'Supprimer le client ?',
    description: 'Cette action est irréversible.',
    variant: 'destructive',
    icon: 'danger',
    onConfirm: async () => await deleteClient(id)
  })
}

<>
  {dialog}
  <Button onClick={handleDelete}>Supprimer</Button>
</>
```

## Best Practices

### 1. Soyez explicite

❌ Mauvais : "Supprimer ?"
✅ Bon : "Supprimer le client Ahmed Ben Ali ?"

### 2. Expliquez les conséquences

❌ Mauvais : "Voulez-vous continuer ?"
✅ Bon : "Le client et toutes ses données seront définitivement supprimés."

### 3. Utilisez la bonne variante

- Destructive (rouge) = Irréversible
- Default (bleu) = Réversible ou important

### 4. Choisissez l'icône appropriée

- `danger` = Suppression définitive
- `warning` = Action importante
- `info` = Information
- `question` = Simple confirmation

### 5. Labels clairs

❌ Mauvais : "OK" / "Non"
✅ Bon : "Supprimer" / "Annuler"

### 6. Gérez les erreurs

```tsx
onConfirm={async () => {
  try {
    await action()
  } catch (error) {
    toast.error('Erreur')
    throw error // Garde le dialog ouvert
  }
}}
```

## Exemples complets

Voir `components/ui/confirm-dialog-examples.tsx` pour 7 exemples complets :

1. Supprimer un client
2. Archiver un dossier
3. Clôturer un dossier
4. Annuler une facture
5. Suppression multiple
6. Se déconnecter
7. Quitter sans enregistrer

## Troubleshooting

### Le dialog ne se ferme pas après confirmation

Vérifiez que `onConfirm` ne throw pas d'erreur. Si vous voulez garder le dialog ouvert en cas d'erreur, throw l'erreur.

### Le loading state ne s'affiche pas

Assurez-vous que `onConfirm` est une fonction `async` ou retourne une Promise.

### Le bouton Confirmer n'a pas la bonne couleur

Vérifiez la prop `variant` :
- `variant="destructive"` → rouge
- `variant="default"` → primaire (bleu)

## Performance

- ✅ Lazy render : Le dialog n'est rendu que quand `open={true}`
- ✅ Pas de re-render parent pendant loading
- ✅ Animations GPU-accelerated (transform)

## Support

Pour toute question :
- Voir `components/ui/confirm-dialog.tsx` - Code source
- Voir `components/ui/confirm-dialog-examples.tsx` - 7 exemples
- Consulter shadcn/ui AlertDialog : https://ui.shadcn.com/docs/components/alert-dialog
