# Qadhya Design System

Guide de référence pour le système de design unifié de Qadhya, avec support complet du mode sombre.

## 🎨 Couleurs

### Variables CSS

Le design system utilise **16 variables CSS HSL** définies dans `app/globals.css` :

```css
/* Mode Clair */
:root {
  --background: 0 0% 100%;        /* Fond principal (#FFFFFF) */
  --foreground: 222 47% 11%;      /* Texte principal (#1A202C) */
  --card: 0 0% 100%;              /* Fond cartes (#FFFFFF) */
  --card-foreground: 222 47% 11%; /* Texte cartes */
  --popover: 0 0% 100%;           /* Fond popovers */
  --popover-foreground: 222 47% 11%;
  --primary: 221.2 83.2% 53.3%;   /* Couleur primaire (#3B82F6) */
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;     /* Couleur secondaire */
  --secondary-foreground: 222 47% 11%;
  --muted: 210 40% 96.1%;         /* Éléments atténués */
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 38.9 92.2% 50.2%;     /* Accent orange */
  --accent-foreground: 222 47% 11%;
  --destructive: 0 84.2% 60.2%;   /* Actions destructives */
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;    /* Bordures */
  --input: 214.3 31.8% 91.4%;     /* Champs de saisie */
  --ring: 221.2 83.2% 53.3%;      /* Focus ring */
}

/* Mode Sombre */
.dark {
  --background: 222 47% 11%;      /* Fond principal sombre */
  --foreground: 210 40% 98%;      /* Texte clair */
  --card: 217.2 32.6% 17.5%;      /* Cartes sombres */
  --card-foreground: 210 40% 98%;
  --popover: 222 47% 11%;
  --popover-foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;   /* Primaire plus clair */
  --primary-foreground: 222 47% 11%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 38.9 92.2% 60%;
  --accent-foreground: 222 47% 11%;
  --destructive: 0 62.8% 50.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 25%;
  --input: 217.2 32.6% 25%;
  --ring: 217.2 91.2% 59.8%;
}
```

### Usage Tailwind

Les variables CSS sont mappées en classes Tailwind via `tailwind.config.ts` :

```typescript
colors: {
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  card: {
    DEFAULT: 'hsl(var(--card))',
    foreground: 'hsl(var(--card-foreground))',
  },
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },
  muted: {
    DEFAULT: 'hsl(var(--muted))',
    foreground: 'hsl(var(--muted-foreground))',
  },
  // ... etc
}
```

## ✅ Bonnes Pratiques

### DO ✅

```tsx
// Utiliser les variables du design system
<div className="bg-card text-card-foreground">
  <h1 className="text-foreground">Titre</h1>
  <p className="text-muted-foreground">Description</p>
</div>

// Bordures automatiques
<div className="border rounded-lg">
  {/* border utilise --border automatiquement */}
</div>

// Boutons avec variantes
<Button variant="default">Action</Button>
<Button variant="outline">Secondaire</Button>
<Button variant="ghost">Tertiaire</Button>
```

### DON'T ❌

```tsx
// ❌ Couleurs hardcodées sans dark:
<div className="bg-white text-gray-900">
  <p className="text-gray-500">Texte</p>
</div>

// ❌ Couleurs spécifiques sans variantes
<div className="bg-blue-100 text-blue-800">
  {/* Pas de support dark mode */}
</div>

// ❌ Classes custom au lieu du design system
<div className="bg-[#ffffff] text-[#1a202c]">
  {/* Éviter les couleurs arbitraires */}
</div>
```

## 📐 Composants de Base

### Card

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Titre de la carte</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground">Contenu de la carte</p>
  </CardContent>
</Card>
```

### Button

```tsx
import { Button } from '@/components/ui/button'

// Variantes disponibles
<Button variant="default">Défaut</Button>
<Button variant="outline">Contour</Button>
<Button variant="ghost">Fantôme</Button>
<Button variant="destructive">Destructif</Button>

// Tailles
<Button size="sm">Petit</Button>
<Button size="default">Normal</Button>
<Button size="lg">Grand</Button>
```

### Badge

```tsx
import { Badge } from '@/components/ui/badge'

<Badge variant="default">Défaut</Badge>
<Badge variant="secondary">Secondaire</Badge>
<Badge variant="outline">Contour</Badge>
<Badge variant="destructive">Destructif</Badge>
```

## 🎭 Animations

Le design system inclut **10+ animations** globales dans `globals.css` :

```css
/* Fade in avec montée */
.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out;
}

/* Effet brillance */
.animate-glow {
  animation: glow 2s ease-in-out infinite;
}

/* Pulse subtil */
.animate-pulse-subtle {
  animation: pulse-subtle 2s ease-in-out infinite;
}
```

Usage :
```tsx
<div className="animate-fade-in-up">
  {/* Apparition fluide */}
</div>
```

## 🌓 Mode Sombre

### Activation

Le mode sombre est géré par `next-themes` :

```tsx
// components/providers/ThemeProvider.tsx
import { ThemeProvider } from 'next-themes'

<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  {children}
</ThemeProvider>
```

### Toggle UI

```tsx
// components/layout/ThemeToggle.tsx
import { useTheme } from 'next-themes'

const { theme, setTheme } = useTheme()

<button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
  {theme === 'dark' ? '🌙' : '☀️'}
</button>
```

### Prévention FOUC

```tsx
// app/layout.tsx
<html lang={locale} dir={dir} suppressHydrationWarning>
  <head>
    <script
      dangerouslySetInnerHTML={{
        __html: `
          try {
            const theme = localStorage.getItem('theme')
            if (theme) {
              document.documentElement.classList.add(theme)
            }
          } catch {}
        `,
      }}
    />
  </head>
</html>
```

## 🔍 Audit & Validation

### Script d'audit

```bash
# Vérifier la conformité dark mode
npm run check:dark

# Aucun problème détecté !
# Tous les composants sont compatibles dark/light mode.
```

### Patterns recherchés

Le script `scripts/check-dark-mode.sh` détecte :
- `bg-white`, `bg-gray-50`, `bg-gray-100` sans `dark:`
- `text-gray-900`, `text-gray-500` sans `dark:`
- `border-gray-200`, `border-gray-300` sans `dark:`

### Corrections automatiques

```bash
# Corriger automatiquement les patterns courants
bash scripts/fix-dark-mode-batch.sh
```

## 🎨 Palette Étendue

### Couleurs de statut

```tsx
// Succès
<div className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300">
  ✓ Opération réussie
</div>

// Avertissement
<div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
  ⚠️ Attention requise
</div>

// Erreur
<div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300">
  ✗ Erreur détectée
</div>

// Information
<div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
  ℹ️ Information
</div>
```

### Dégradés

```tsx
// Dégradé primaire
<div className="bg-gradient-to-r from-primary to-blue-600">
  Texte avec dégradé
</div>

// Classe helper
<div className="gradient-primary">
  {/* Utilise le dégradé prédéfini */}
</div>
```

## 📱 Support RTL

### Configuration

```tsx
// Support complet arabe + français
<html dir={locale === 'ar' ? 'rtl' : 'ltr'}>
  <body className={locale === 'ar' ? 'font-arabic' : ''}>
    {children}
  </body>
</html>
```

### Classes RTL

```css
/* globals.css */
[dir="rtl"] .text-left {
  text-align: right;
}

[dir="rtl"] .ml-auto {
  margin-right: auto;
  margin-left: unset;
}
```

## 🔧 Outils de Développement

### ESLint Rules

Règles custom dans `.eslintrc.js` (recommandé) :

```javascript
rules: {
  // Interdire couleurs hardcodées
  'no-restricted-syntax': [
    'error',
    {
      selector: 'Literal[value=/bg-white|bg-gray-[0-9]/]',
      message: 'Use design system variables (bg-card, bg-muted)',
    },
  ],
}
```

### VSCode Snippets

Créer `.vscode/snippets.json` :

```json
{
  "Card Component": {
    "prefix": "qcard",
    "body": [
      "<Card>",
      "  <CardHeader>",
      "    <CardTitle>$1</CardTitle>",
      "  </CardHeader>",
      "  <CardContent>",
      "    $2",
      "  </CardContent>",
      "</Card>"
    ]
  }
}
```

## 📚 Ressources

- **Tailwind Config** : `tailwind.config.ts`
- **Variables CSS** : `app/globals.css`
- **Composants UI** : `components/ui/*`
- **Provider Theme** : `components/providers/ThemeProvider.tsx`
- **Script Audit** : `scripts/check-dark-mode.sh`
- **Script Fix** : `scripts/fix-dark-mode-batch.sh`

## 🎯 Checklist Nouveau Composant

- [ ] Utilise variables design system (`bg-card`, `text-foreground`)
- [ ] Support dark mode complet (pas de hardcode)
- [ ] Passe l'audit `npm run check:dark`
- [ ] Animations si pertinent (`animate-fade-in-up`)
- [ ] Support RTL si texte (classes `[dir="rtl"]`)
- [ ] Types TypeScript complets
- [ ] Documenté si composant réutilisable

---

**Dernière mise à jour** : Février 2026
**Version Design System** : 1.0
**Couverture Dark Mode** : 100% ✅
