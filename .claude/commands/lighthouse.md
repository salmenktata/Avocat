# Skill: Audit Lighthouse Performance

Exécute un audit Lighthouse complet sur l'environnement de développement et propose des corrections automatiques.

## Instructions

### Étape 1 : Vérifier le serveur de développement

```bash
# Vérifier si le serveur tourne
lsof -i :7002 2>/dev/null || echo "SERVEUR_NON_ACTIF"
```

Si le serveur n'est pas actif, informer l'utilisateur :
> ⚠️ Le serveur de développement n'est pas actif. Lancez `npm run dev` dans un autre terminal avant de relancer cette commande.

### Étape 2 : Exécuter l'audit Lighthouse

```bash
# Audit sur la page d'accueil (login)
npx lighthouse http://localhost:7002 --output=json --output=html --output-path=./lighthouse-report --chrome-flags="--headless --no-sandbox" --quiet 2>&1
```

### Étape 3 : Extraire et afficher les scores

```bash
cat lighthouse-report.report.json | jq '{
  "Performance": (.categories.performance.score * 100),
  "Accessibilité": (.categories.accessibility.score * 100),
  "Bonnes_Pratiques": ((.categories["best-practices"].score // 0) * 100),
  "SEO": (.categories.seo.score * 100),
  "FCP": .audits["first-contentful-paint"].displayValue,
  "LCP": .audits["largest-contentful-paint"].displayValue,
  "TBT": .audits["total-blocking-time"].displayValue,
  "CLS": .audits["cumulative-layout-shift"].displayValue,
  "TTI": .audits["interactive"].displayValue
}'
```

### Étape 4 : Identifier les problèmes critiques

```bash
# Audits échoués (score < 50%)
cat lighthouse-report.report.json | jq -r '
  .audits | to_entries |
  map(select(.value.score != null and .value.score < 0.5 and .value.scoreDisplayMode == "numeric")) |
  sort_by(.value.score) |
  .[:10] |
  .[] |
  "❌ \(.value.title) - Score: \((.value.score * 100 | floor))%"
'
```

### Étape 5 : Lister les opportunités d'amélioration

```bash
cat lighthouse-report.report.json | jq -r '
  .audits | to_entries |
  map(select(.value.details.type == "opportunity" and .value.score != null and .value.score < 1)) |
  sort_by(.value.numericValue // 0) | reverse |
  .[:8] |
  .[] |
  "💡 \(.value.title) - Gain: \(.value.displayValue // "N/A")"
'
```

### Étape 6 : Analyse et corrections automatiques

Selon les problèmes identifiés, appliquer les corrections suivantes :

#### Si LCP > 2.5s ou TBT > 200ms :
1. Vérifier les imports dynamiques dans `app/(dashboard)/dashboard/page.tsx`
2. S'assurer que les widgets lourds (recharts, PDF) utilisent `dynamic()` avec `ssr: false`
3. Vérifier que les images utilisent le composant `next/image`

#### Si "Reduce unused JavaScript" apparaît :
1. Vérifier `next.config.js` pour `optimizePackageImports`
2. Ajouter les packages manquants dans la liste

#### Si "Reduce initial server response time" (TTFB > 600ms) :
1. Vérifier les requêtes Prisma dans les Server Components
2. Ajouter des index manquants en base
3. Utiliser `unstable_cache` pour les données statiques

#### Si erreurs console détectées :
1. Lister les erreurs avec :
```bash
cat lighthouse-report.report.json | jq -r '.audits["errors-in-console"].details.items[]? | "→ \(.description // .source)"'
```
2. Corriger les erreurs 404/401 pertinentes

### Étape 7 : Résumé et recommandations

Afficher un tableau récapitulatif :

```
## Résultat Audit Lighthouse

| Catégorie | Score | État |
|-----------|-------|------|
| Performance | XX | 🟢/🟠/🔴 |
| Accessibilité | XX | 🟢/🟠/🔴 |
| Bonnes Pratiques | XX | 🟢/🟠/🔴 |
| SEO | XX | 🟢/🟠/🔴 |

### Core Web Vitals
- FCP: X.Xs (🟢 < 1.8s, 🟠 < 3s, 🔴 > 3s)
- LCP: X.Xs (🟢 < 2.5s, 🟠 < 4s, 🔴 > 4s)
- TBT: Xms (🟢 < 200ms, 🟠 < 600ms, 🔴 > 600ms)
- CLS: X.XX (🟢 < 0.1, 🟠 < 0.25, 🔴 > 0.25)

📄 Rapport HTML: lighthouse-report.report.html
```

### Options supplémentaires

L'utilisateur peut spécifier une page différente :
- `/lighthouse /dashboard` → Audit de http://localhost:7002/dashboard
- `/lighthouse /super-admin` → Audit de http://localhost:7002/super-admin

Pour ces pages authentifiées, il faudra :
1. Se connecter manuellement
2. Extraire le cookie de session
3. Passer le cookie à Lighthouse via `--extra-headers`

## Seuils de qualité

| Métrique | Bon | Acceptable | Mauvais |
|----------|-----|------------|---------|
| Performance | ≥ 90 | 50-89 | < 50 |
| FCP | < 1.8s | 1.8-3s | > 3s |
| LCP | < 2.5s | 2.5-4s | > 4s |
| TBT | < 200ms | 200-600ms | > 600ms |
| CLS | < 0.1 | 0.1-0.25 | > 0.25 |
