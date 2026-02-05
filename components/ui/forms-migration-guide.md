# Guide de Migration des Formulaires

Ce guide explique comment migrer les formulaires existants vers le pattern avancé avec React Hook Form + Zod + shadcn/ui.

## Vue d'ensemble

### Avant (Ancien pattern)
```tsx
// Utilise register() directement dans les inputs
<input {...register('nom')} className="..." />
{errors.nom && <p className="text-red-600">{errors.nom.message}</p>}
```

### Après (Pattern avancé)
```tsx
// Utilise FormField wrapper avec icônes et feedback visuel
<FormField
  control={form.control}
  name="nom"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Nom *</FormLabel>
      <FormControl>
        <div className="relative">
          <Input {...field} placeholder="..." />
          {errors.nom && <Icons.xCircle className="..." />}
          {!errors.nom && field.value && <Icons.checkCircle className="..." />}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Étapes de migration

### 1. Importer les composants shadcn/ui

```tsx
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/lib/icons'
```

### 2. Ajouter le mode de validation

```tsx
const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: { ... },
  mode: 'onBlur', // ← Ajouter cette ligne
})
```

### 3. Wrapper le formulaire dans <Form>

```tsx
// Avant
<form onSubmit={handleSubmit(onSubmit)}>
  ...
</form>

// Après
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    ...
  </form>
</Form>
```

### 4. Migrer les inputs simples

#### Avant
```tsx
<div>
  <label className="block text-sm font-medium text-foreground">
    Nom *
  </label>
  <input
    {...register('nom')}
    className="mt-1 block w-full rounded-md border px-3 py-2..."
    placeholder="Entrez le nom"
  />
  {errors.nom && (
    <p className="mt-1 text-sm text-red-600">{errors.nom.message}</p>
  )}
</div>
```

#### Après
```tsx
<FormField
  control={form.control}
  name="nom"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Nom *</FormLabel>
      <FormControl>
        <div className="relative">
          <Input {...field} placeholder="Entrez le nom" />
          {form.formState.errors.nom && (
            <Icons.xCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
          )}
          {!form.formState.errors.nom && field.value && (
            <Icons.checkCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 5. Migrer les inputs avec icône à gauche

```tsx
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email *</FormLabel>
      <FormControl>
        <div className="relative">
          <Icons.mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input {...field} type="email" placeholder="email@example.com" className="pl-10" />
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

### 6. Migrer les selects

#### Avant
```tsx
<select {...register('statut')} className="...">
  <option value="ACTIF">Actif</option>
  <option value="CLOS">Clôturé</option>
</select>
{errors.statut && <p className="...">{errors.statut.message}</p>}
```

#### Après
```tsx
<FormField
  control={form.control}
  name="statut"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Statut *</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionnez le statut" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="ACTIF">
            <div className="flex items-center gap-2">
              <Icons.checkCircle className="h-4 w-4 text-green-500" />
              <span>Actif</span>
            </div>
          </SelectItem>
          <SelectItem value="CLOS">
            <div className="flex items-center gap-2">
              <Icons.xCircle className="h-4 w-4 text-orange-500" />
              <span>Clôturé</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 7. Migrer les textarea

#### Avant
```tsx
<textarea
  {...register('description')}
  rows={4}
  className="..."
  placeholder="Description..."
/>
```

#### Après
```tsx
<FormField
  control={form.control}
  name="description"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Description</FormLabel>
      <FormControl>
        <Textarea {...field} placeholder="Description..." rows={4} />
      </FormControl>
      <FormDescription>
        Informations complémentaires (optionnel)
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 8. Migrer les champs numériques

```tsx
<FormField
  control={form.control}
  name="montant_ht"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Montant HT *</FormLabel>
      <FormControl>
        <div className="relative">
          <Icons.banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            {...field}
            type="number"
            step="0.01"
            placeholder="0.00"
            className="pl-10"
            onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
          />
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 9. Améliorer les boutons

#### Avant
```tsx
<button
  type="submit"
  disabled={loading}
  className="rounded-md bg-blue-600 px-6 py-2 text-white..."
>
  {loading ? 'Enregistrement...' : 'Enregistrer'}
</button>
```

#### Après
```tsx
<Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
  {isSubmitting && <Icons.loader className="mr-2 h-4 w-4 animate-spin" />}
  {isEditing ? 'Mettre à jour' : 'Créer'}
</Button>
```

### 10. Améliorer les messages d'erreur globaux

#### Avant
```tsx
{error && (
  <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
    {error}
  </div>
)}
```

#### Après
```tsx
{error && (
  <Alert variant="destructive">
    <Icons.alertCircle className="h-4 w-4" />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

## Checklist de migration

Pour chaque formulaire à migrer :

- [ ] Importer les composants shadcn/ui Form
- [ ] Importer Icons depuis lib/icons
- [ ] Ajouter `mode: 'onBlur'` dans useForm
- [ ] Wrapper le form dans `<Form {...form}>`
- [ ] Remplacer tous les inputs par FormField + Input
- [ ] Ajouter icônes de validation (✓/✗) à droite
- [ ] Ajouter icônes contextuelles à gauche (mail, phone, etc.)
- [ ] Remplacer les selects natifs par Select shadcn/ui
- [ ] Ajouter FormDescription aux champs complexes
- [ ] Remplacer boutons HTML par Button shadcn/ui
- [ ] Ajouter spinner dans le bouton submit
- [ ] Remplacer erreur globale par Alert
- [ ] Tester la validation (blur, submit, erreurs)
- [ ] Vérifier le dark mode
- [ ] Tester sur mobile

## Icônes recommandées par champ

| Champ | Icône | Usage |
|-------|-------|-------|
| Email | `Icons.mail` | Gauche |
| Téléphone | `Icons.phone` | Gauche |
| Adresse | `Icons.mapPin` | Gauche |
| Date | `Icons.calendar` | Gauche |
| Montant | `Icons.banknote` ou `Icons.dollar` | Gauche |
| Numéro | `Icons.hash` | Gauche |
| Client | `Icons.user` ou `Icons.users` | Select item |
| Entreprise | `Icons.building` | Select item |
| Dossier | `Icons.folderOpen` | Select item |
| Statut Actif | `Icons.checkCircle` (vert) | Select item |
| Statut Clôturé | `Icons.xCircle` (orange) | Select item |
| Statut Archivé | `Icons.archive` (gris) | Select item |
| Tribunal | `Icons.building` | Gauche |
| RG | `Icons.fileText` | Gauche |
| Avocat | `Icons.briefcase` | Gauche |
| Procédure | `Icons.gavel` | Select item |
| Workflow | `Icons.listTodo` | Select item |

## Formulaires à migrer

### Priorité Haute (formulaires critiques)
- [x] ClientForm → ClientFormAdvanced ✅
- [x] DossierForm → DossierFormAdvanced ✅
- [ ] FactureForm → FactureFormAdvanced
- [ ] EcheanceForm → EcheanceFormAdvanced

### Priorité Moyenne
- [ ] TimeEntryForm → TimeEntryFormAdvanced
- [ ] TemplateForm → TemplateFormAdvanced
- [ ] DocumentUploadForm → DocumentUploadFormAdvanced

### Priorité Basse
- [ ] AddActionForm → AddActionFormAdvanced
- [ ] GenerateDocumentForm → GenerateDocumentFormAdvanced

## Pattern pour valeurs numériques

Les champs numériques nécessitent un traitement spécial :

```tsx
// Dans le schéma Zod
montant: z.number().min(0, 'Le montant doit être positif').optional()

// Dans le formulaire
<Input
  {...field}
  type="number"
  step="0.01"
  onChange={(e) => {
    const value = e.target.valueAsNumber
    field.onChange(isNaN(value) ? undefined : value)
  }}
/>
```

## Pattern pour dates

```tsx
// Dans le schéma Zod
date_emission: z.string().optional()

// Dans le formulaire
<Input {...field} type="date" />
```

## Pattern pour validation conditionnelle

Voir ClientFormAdvanced.tsx pour un exemple de validation conditionnelle avec `.refine()` :

```tsx
const schema = z.object({
  type_client: z.enum(['PARTICULIER', 'ENTREPRISE']),
  raison_sociale: z.string().optional(),
}).refine((data) => {
  if (data.type_client === 'ENTREPRISE') {
    return !!data.raison_sociale
  }
  return true
}, {
  message: 'La raison sociale est obligatoire pour une entreprise',
  path: ['raison_sociale'],
})
```

## Bénéfices de la migration

✅ **UX améliorée** : Feedback visuel immédiat avec icônes
✅ **Accessibilité** : ARIA labels automatiques via FormLabel/FormMessage
✅ **Cohérence** : Design system unifié avec shadcn/ui
✅ **Validation** : Mode onBlur évite les validations intrusives
✅ **Dark mode** : Compatibilité automatique avec les variables CSS
✅ **Maintenabilité** : Code plus lisible et organisé
✅ **TypeScript** : Meilleure sécurité des types avec FormField
✅ **Performance** : Re-render minimal grâce à React Hook Form

## Support

Pour toute question sur la migration, référez-vous à :
- `components/ui/forms-guide.md` - Guide général des formulaires
- `components/clients/ClientFormAdvanced.tsx` - Exemple formulaire client
- `components/dossiers/DossierFormAdvanced.tsx` - Exemple formulaire dossier
