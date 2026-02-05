# Guide des Formulaires avec Validation

Ce guide montre comment créer des formulaires élégants avec validation temps réel en utilisant React Hook Form + Zod.

## Stack utilisée

- **React Hook Form** - Gestion de formulaire performante
- **Zod** - Schéma de validation TypeScript-first
- **shadcn/ui Form** - Composants UI accessibles
- **Icons** - Feedback visuel (✓ ✗)

## Installation

```bash
# Déjà installé dans le projet
npm install react-hook-form @hookform/resolvers zod
npx shadcn@latest add form input textarea select
```

## Pattern de base

### 1. Définir le schéma Zod

```tsx
import * as z from 'zod'

const formSchema = z.object({
  email: z.string().email('Email invalide').min(1, 'Email obligatoire'),
  name: z.string().min(2, 'Minimum 2 caractères'),
  age: z.number().min(18, 'Vous devez avoir 18 ans minimum'),
})

type FormValues = z.infer<typeof formSchema>
```

### 2. Initialiser le formulaire

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: {
    email: '',
    name: '',
    age: 18,
  },
  mode: 'onBlur', // Validation on blur (recommandé)
})
```

### 3. Créer les champs

```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input {...field} type="email" />
          </FormControl>
          <FormMessage /> {/* Affiche les erreurs */}
        </FormItem>
      )}
    />

    <Button type="submit">Enregistrer</Button>
  </form>
</Form>
```

## Fonctionnalités avancées

### Validation conditionnelle

```tsx
const schema = z.object({
  type: z.enum(['PARTICULIER', 'ENTREPRISE']),
  nom: z.string(),
  raison_sociale: z.string().optional(),
}).refine((data) => {
  // Si entreprise, raison sociale obligatoire
  if (data.type === 'ENTREPRISE') {
    return !!data.raison_sociale
  }
  return true
}, {
  message: 'Raison sociale obligatoire pour une entreprise',
  path: ['raison_sociale'],
})
```

### Feedback visuel avec icônes

```tsx
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <div className="relative">
          <Input {...field} />
          {form.formState.errors.email && (
            <Icons.xCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
          )}
          {!form.formState.errors.email && field.value && (
            <Icons.checkCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Champs avec icône à gauche

```tsx
<div className="relative">
  <Icons.mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input {...field} className="pl-10" placeholder="email@example.com" />
</div>
```

### Loading state sur submit

```tsx
const [isSubmitting, setIsSubmitting] = useState(false)

const onSubmit = async (data: FormValues) => {
  setIsSubmitting(true)
  try {
    await saveData(data)
  } finally {
    setIsSubmitting(false)
  }
}

// Dans le bouton
<Button type="submit" disabled={isSubmitting}>
  {isSubmitting && <Icons.loader className="mr-2 h-4 w-4 animate-spin" />}
  Enregistrer
</Button>
```

### Champs dynamiques (watch)

```tsx
const typeClient = form.watch('type_client')

// Affichage conditionnel
{typeClient === 'ENTREPRISE' && (
  <FormField name="raison_sociale" ... />
)}
```

### FormDescription

```tsx
<FormDescription>
  Votre email ne sera jamais partagé
</FormDescription>
```

## Validations Zod courantes

```tsx
// Email
z.string().email('Email invalide')

// Téléphone
z.string().regex(/^[0-9+\s()-]{8,}$/, 'Téléphone invalide')

// CIN Tunisien
z.string().regex(/^[0-9]{8}$/, 'CIN invalide (8 chiffres)')

// Matricule fiscal
z.string().regex(/^[0-9]{7}\/[A-Z]\/[A-Z]\/[0-9]{3}$/, 'Matricule invalide')

// URL
z.string().url('URL invalide')

// Date
z.date().min(new Date('1900-01-01'), 'Date trop ancienne')

// Nombre
z.number().min(0).max(100)

// Optionnel
z.string().optional()

// Optionnel ou vide
z.string().optional().or(z.literal(''))

// Enum
z.enum(['ACTIF', 'CLOTURE', 'ARCHIVE'])

// Array
z.array(z.string()).min(1, 'Au moins un élément')

// Object
z.object({
  street: z.string(),
  city: z.string(),
})
```

## Gestion des erreurs

```tsx
// Erreur globale du formulaire
const onSubmit = async (data: FormValues) => {
  try {
    await api.create(data)
  } catch (error) {
    // Définir une erreur pour un champ spécifique
    form.setError('email', {
      message: 'Cet email existe déjà'
    })

    // Ou erreur globale
    form.setError('root', {
      message: 'Une erreur est survenue'
    })
  }
}

// Afficher l'erreur globale
{form.formState.errors.root && (
  <Alert variant="destructive">
    <AlertDescription>
      {form.formState.errors.root.message}
    </AlertDescription>
  </Alert>
)}
```

## Réinitialiser le formulaire

```tsx
// Après succès
form.reset()

// Ou avec nouvelles valeurs
form.reset({
  email: '',
  name: 'John'
})
```

## Mode de validation

```tsx
useForm({
  mode: 'onBlur',    // Validation on blur (recommandé)
  mode: 'onChange',  // Validation à chaque frappe (peut être lent)
  mode: 'onSubmit',  // Validation uniquement à la soumission
  mode: 'all',       // onChange + onBlur
})
```

## Exemples complets

### ClientFormAdvanced.tsx
Voir `components/clients/ClientFormAdvanced.tsx` pour un exemple complet avec :
- ✅ Validation Zod complexe
- ✅ Champs conditionnels (Particulier vs Entreprise)
- ✅ Feedback visuel (icônes ✓/✗)
- ✅ Loading state
- ✅ Dark mode
- ✅ Responsive

### DossierFormAdvanced.tsx
Voir `components/dossiers/DossierFormAdvanced.tsx` pour un formulaire juridique complexe avec :
- ✅ Select dynamique (workflow dépend du type de procédure)
- ✅ Icônes contextuelles (gavel, briefcase, building, etc.)
- ✅ FormDescription pour expliquer les champs complexes
- ✅ Sections organisées (Parties, Juridiction, etc.)
- ✅ Champs numériques avec validation
- ✅ Gestion dates
- ✅ Notes internes
- ✅ État de soumission avec spinner

## Best Practices

1. **Validation on blur** - Meilleure UX que onChange
2. **Messages clairs** - "Email invalide" > "Erreur"
3. **Feedback visuel** - Icônes ✓/✗ pour confirmation
4. **Loading states** - Désactiver pendant soumission
5. **Erreurs inline** - Sous le champ, pas en alert
6. **FormDescription** - Pour expliquer les champs complexes
7. **Validation côté serveur** - Toujours valider aussi côté serveur
8. **TypeScript** - Utiliser `z.infer` pour les types
9. **Reset après succès** - Vider le formulaire après enregistrement
10. **Accessibilité** - FormLabel + FormMessage = ARIA automatique

## Performance

- ✅ React Hook Form = re-render minimal
- ✅ Validation Zod = rapide (synchrone)
- ✅ Mode onBlur = moins de validations
- ✅ Pas de état manuel = moins de code

## Débogage

```tsx
// Voir l'état du formulaire
console.log('Errors:', form.formState.errors)
console.log('Values:', form.getValues())
console.log('IsDirty:', form.formState.isDirty)
console.log('IsValid:', form.formState.isValid)

// En dev
<pre>{JSON.stringify(form.watch(), null, 2)}</pre>
```
