# Phase 4.4 - Guide de Setup Rapide

## ✅ Fichiers déjà créés

1. **Migration SQL**: `migrations/20260210_review_prioritization.sql`
2. **Documentation complète**: `docs/PHASE_4_4_IMPLEMENTATION_COMPLETE.md`
3. **Script de test**: `scripts/test-classification-apis.ts`
4. **Script génération structure**: `scripts/generate-phase4-4-files.sh`
5. **Structure de répertoires**: Tous les dossiers créés

## 📝 Fichiers de code à implémenter

Tous les fichiers de code sont entièrement documentés avec leur contenu complet dans **`PHASE_4_4_IMPLEMENTATION_COMPLETE.md`**.

### APIs Backend (4 fichiers)

1. `app/api/super-admin/classification/queue/route.ts` - Queue avec filtres
2. `app/api/super-admin/classification/corrections/route.ts` - GET/POST corrections
3. `app/api/super-admin/classification/analytics/top-errors/route.ts` - Analytics
4. `app/api/admin/web-pages/[id]/classification/route.ts` - Détails page

### Composants UI (6 fichiers)

1. `components/super-admin/classification/ReviewQueue.tsx` - Table queue
2. `components/super-admin/classification/ReviewModal.tsx` - Modal correction
3. `components/super-admin/classification/CorrectionsHistory.tsx` - Historique
4. `components/super-admin/classification/ClassificationAnalytics.tsx` - Dashboard
5. `components/super-admin/classification/GeneratedRules.tsx` - Placeholder
6. `app/super-admin/classification/page.tsx` - Page principale

## 🚀 Installation rapide

### Option 1 : Copier depuis la documentation

Ouvrir `PHASE_4_4_IMPLEMENTATION_COMPLETE.md` et copier le contenu de chaque fichier dans son emplacement respectif.

### Option 2 : Implémentation manuelle

Suivre les spécifications détaillées dans la documentation pour implémenter chaque composant.

## ⚙️  Configuration requise

### 1. Appliquer la migration SQL

```bash
# Développement local
psql -U postgres -d qadhya -f migrations/20260210_review_prioritization.sql

# Production
ssh root@84.247.165.187
docker exec -i moncabinet-postgres psql -U moncabinet -d moncabinet < /chemin/vers/migration.sql
```

### 2. Installer dépendances

Toutes les dépendances sont déjà installées :
- `@tanstack/react-query` ✅
- `date-fns` ✅
- `lucide-react` ✅
- Shadcn UI components ✅

### 3. Tester les APIs

```bash
# Après avoir implémenté les APIs
npm run test:classification-apis
```

## 📊 Vérification post-installation

### 1. Vérifier migration DB

```sql
-- Colonnes ajoutées
\d legal_classifications

-- Index créé
\di idx_legal_classifications_review_queue

-- Fonction disponible
SELECT * FROM get_review_queue_stats();
```

### 2. Tester l'UI

1. Naviguer vers `/super-admin/classification`
2. Vérifier que les 4 tabs s'affichent
3. Tab "À Revoir" : table avec pages + filtres
4. Cliquer "Réviser" → modal s'ouvre
5. Tab "Analytics" → graphiques chargent

### 3. Vérifier les APIs

```bash
# Queue
curl http://localhost:3000/api/super-admin/classification/queue?limit=5

# Analytics
curl http://localhost:3000/api/super-admin/classification/analytics/top-errors?groupBy=domain
```

## 🎯 Statut actuel

- [x] Migration SQL créée et documentée
- [x] Structure de répertoires créée
- [x] Documentation complète (4700+ lignes)
- [x] Script de test créé
- [ ] APIs backend à implémenter (copier depuis doc)
- [ ] Composants UI à implémenter (copier depuis doc)
- [ ] Tests E2E Cypress (Sprint 4)

## 📚 Ressources

- **Doc complète**: `docs/PHASE_4_4_IMPLEMENTATION_COMPLETE.md`
- **Conversation source**: `.claude/projects/.../[conversation-id].jsonl`
- **Tests**: `scripts/test-classification-apis.ts`

## ⏭️ Prochaines étapes

1. Copier les APIs depuis la documentation
2. Copier les composants UI depuis la documentation
3. Appliquer la migration en dev
4. Tester l'interface complète
5. Appliquer en production
6. Sprint 4: Tests E2E + GeneratedRules complet
