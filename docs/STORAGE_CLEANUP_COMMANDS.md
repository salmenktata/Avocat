# 🧹 Commandes de Nettoyage du Storage

## Commandes NPM

### 1. Afficher les options de nettoyage manuel
```bash
npm run storage:cleanup
```

Cette commande affiche :
- Un **bookmarklet** à ajouter dans vos favoris
- Un **script console** à copier-coller dans le DevTools
- Des instructions pour le nettoyage manuel

### 2. Analyser l'utilisation du storage
```bash
npm run storage:analyze
```

## Nettoyage Manuel dans le Navigateur

### Option A : Bookmarklet (Recommandé)

1. Créez un nouveau favori dans votre navigateur
2. Collez le code JavaScript fourni par `npm run storage:cleanup`
3. Cliquez sur le favori quand vous êtes sur l'application
4. Une popup affichera l'analyse et proposera le nettoyage

**Avantages** : Un seul clic, toujours disponible

### Option B : Console du Navigateur

1. Ouvrez les DevTools (F12 ou Cmd+Opt+I)
2. Allez dans l'onglet "Console"
3. Exécutez `npm run storage:cleanup` dans votre terminal
4. Copiez le script affiché sous "2️⃣ Console du navigateur"
5. Collez dans la console et appuyez sur Entrée

**Avantages** : Voir les détails en temps réel

### Option C : Depuis le Code

```typescript
import {
  cleanupOldItems,
  cleanupToTargetSize,
  logStorageReport
} from '@/lib/utils/storage-cleanup'

// Analyser
logStorageReport(sessionStorage, 'Session')

// Nettoyer items > 30 min
const cleaned = cleanupOldItems(sessionStorage, 30 * 60 * 1000)
console.log(`Nettoyé ${cleaned} items`)

// Réduire à 3 MB max
const sizeCleaned = cleanupToTargetSize(sessionStorage, 3 * 1024 * 1024)
console.log(`Réduit de ${sizeCleaned} items`)
```

## Nettoyage Automatique

**L'application nettoie automatiquement le storage** toutes les 5 minutes via `StorageCleanupProvider`.

### Configuration par défaut
- **Intervalle** : 5 minutes
- **Âge max** : 30 minutes (items plus anciens sont supprimés)
- **Taille max** : 3 MB (si dépassé, les gros items sont supprimés)

### Données protégées
Les clés suivantes ne sont **JAMAIS** supprimées automatiquement :
- `session_cache` : Session utilisateur
- `session_cache_ts` : Timestamp de la session

### Désactiver le nettoyage automatique

Dans `app/layout.tsx` :
```tsx
<StorageCleanupProvider enabled={false}>
  {/* ... */}
</StorageCleanupProvider>
```

### Personnaliser la configuration

```tsx
<StorageCleanupProvider
  interval={3 * 60 * 1000}  // Nettoyer toutes les 3 minutes
  maxAge={15 * 60 * 1000}   // Supprimer items > 15 min
  maxSize={2 * 1024 * 1024} // Limiter à 2 MB
>
  {/* ... */}
</StorageCleanupProvider>
```

## Monitoring en Dev

Quand le serveur de dev tourne, le nettoyage automatique affiche des logs dans la console :

```
[Storage Cleanup] Cleaned 3 old items, 2 for size
📊 Session Storage Report
Total size: 1.5 MB
Items count: 12
Top 5 largest items:
  - assistant-store: 850 KB
  - session_cache: 250 KB
  - theme: 5 KB
  - locale: 2 KB
  - foo_ts: 1 KB
```

## Dépannage

### Le storage continue de grandir

1. Vérifier que `StorageCleanupProvider` est bien actif
2. Réduire `maxAge` et `maxSize` si nécessaire
3. Vérifier les logs de nettoyage dans la console
4. Exécuter un nettoyage manuel : `npm run storage:cleanup`

### Les sessions sont perdues

Si les utilisateurs perdent leur session fréquemment :

1. Vérifier que `session_cache` n'est pas supprimé (protégé par défaut)
2. Augmenter `CACHE_TTL_MS` dans `SessionProvider.tsx`
3. Vérifier que le cookie `auth_session` est bien défini

### Quota dépassé sur mobile

Sur les navigateurs mobiles avec quota limité (< 5 MB) :

1. Réduire `maxSize` à 2 MB ou moins
2. Réduire le TTL du cache session à 1 minute
3. Limiter davantage les données dans `assistant-store`

## Ressources

- **Documentation complète** : `docs/STORAGE_OPTIMIZATION.md`
- **Utilitaires** : `lib/utils/storage-cleanup.ts`
- **Provider** : `components/providers/StorageCleanupProvider.tsx`
- **Store optimisé** : `lib/stores/assistant-store.ts`

## Quick Reference

```bash
# Afficher les options de nettoyage
npm run storage:cleanup

# Analyser l'utilisation
npm run storage:analyze

# Vérifier la compilation
npm run type-check

# Build de production
npm run build
```

---

✅ **Tout est configuré pour un nettoyage automatique et transparent.**

Le nettoyage manuel n'est nécessaire que pour le debugging ou en cas de problème spécifique.
