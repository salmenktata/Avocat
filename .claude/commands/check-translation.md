# Vérification des Traductions i18n

Exécute une analyse complète des traductions FR/AR du projet.

## Instructions

1. **Exécuter le script de vérification**
   ```bash
   npm run i18n:check
   ```

2. **Analyser le rapport généré** qui contient:
   - Synchronisation FR/AR (clés manquantes)
   - Clés orphelines (définies mais non utilisées dans le code)
   - Qualité des traductions AR (identiques, ratio longueur, caractères latins)
   - Couverture globale

3. **Si des problèmes sont détectés:**

   ### Clés manquantes en AR
   - Ouvrir `messages/ar.json`
   - Ajouter les traductions manquantes avec le bon contexte juridique tunisien
   - Utiliser la terminologie appropriée en arabe standard

   ### Clés orphelines
   - Vérifier si la clé est utilisée dynamiquement (ex: `t(\`key.${var}\`)`)
   - Si vraiment non utilisée, supprimer de `messages/fr.json` et `messages/ar.json`

   ### Traductions identiques FR=AR
   - Ces clés n'ont probablement pas été traduites
   - Traduire en arabe standard avec le contexte juridique

   ### Ratio longueur suspect
   - Vérifier que la traduction est complète
   - L'arabe peut être plus court ou plus long selon le contexte

4. **Valider les corrections**
   ```bash
   npm run i18n:check
   ```

## Fichiers concernés

- `messages/fr.json` - Traductions françaises (référence)
- `messages/ar.json` - Traductions arabes
- `scripts/i18n-check.ts` - Script d'analyse

## Bonnes pratiques

- Toujours garder les deux fichiers synchronisés
- Utiliser la terminologie juridique tunisienne appropriée
- Tester l'affichage RTL pour l'arabe
- Les variables `{variable}` et `{{variable}}` doivent rester identiques
