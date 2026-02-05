# Corrections Système de Notifications

**Date**: 2026-02-05
**Statut**: ✅ Complété

## Problèmes Identifiés et Résolus

### 1. Fonction SQL Incorrecte ✅

**Problème**: La fonction `saveNotificationPreferencesAction` dans `app/actions/cabinet.ts` avait des indices de placeholders SQL incorrects.

**Solution**:
- Correction des indices SQL : utilisation de `keys.length + 1` au lieu de `values.length`
- Ajout de `updated_at = now()` dans la requête UPDATE

**Fichier**: `app/actions/cabinet.ts:93-132`

### 2. Incohérence Structure Données ✅

**Problème**: Deux approches différentes pour stocker les préférences:
- Colonne JSONB `notification_preferences` dans table `profiles` (obsolète)
- Table dédiée `notification_preferences` (actuelle)

**Solution**:
- Création migration de nettoyage: `20260205140000_cleanup_notification_preferences.sql`
- Suppression de la colonne JSONB obsolète de `profiles`
- La table dédiée `notification_preferences` est maintenant la seule source de vérité

### 3. Fichier Obsolète ❗

**Problème**: Le fichier `app/actions/notifications.ts` contient une implémentation obsolète utilisant l'ancienne structure JSONB et n'est utilisé nulle part dans le codebase.

**Solution**: À supprimer manuellement
```bash
rm app/actions/notifications.ts
```

### 4. Typage TypeScript ✅

**Problème**: La fonction `saveNotificationPreferencesAction` utilisait `any` comme type de paramètre.

**Solution**:
- Création interface TypeScript `NotificationPreferences` dans `app/actions/cabinet.ts`
- Mise à jour de la signature de la fonction
- Export de l'interface pour réutilisation
- Mise à jour du composant `NotificationPreferencesForm` pour utiliser l'interface exportée

**Fichiers**:
- `app/actions/cabinet.ts:8-27`
- `components/parametres/NotificationPreferencesForm.tsx:13`

### 5. Validation des Données ✅

**Ajout**: Validation des préférences avant sauvegarde:
- Délai factures impayées: entre 1 et 365 jours
- Format email: 'html' ou 'text'
- Langue email: 'fr' ou 'ar'
- Format heure: HH:MM:SS

**Fichier**: `app/actions/cabinet.ts:103-121`

## Structure Finale

### Table `notification_preferences`

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  enabled BOOLEAN DEFAULT true,
  daily_digest_enabled BOOLEAN DEFAULT true,
  daily_digest_time TIME DEFAULT '06:00:00',
  alerte_j15_enabled BOOLEAN DEFAULT true,
  alerte_j7_enabled BOOLEAN DEFAULT true,
  alerte_j3_enabled BOOLEAN DEFAULT true,
  alerte_j1_enabled BOOLEAN DEFAULT true,
  alerte_actions_urgentes BOOLEAN DEFAULT true,
  alerte_actions_priorite_haute BOOLEAN DEFAULT true,
  alerte_audiences_semaine BOOLEAN DEFAULT true,
  alerte_audiences_veille BOOLEAN DEFAULT true,
  alerte_factures_impayees BOOLEAN DEFAULT true,
  alerte_factures_impayees_delai_jours INTEGER DEFAULT 30,
  alerte_delais_appel BOOLEAN DEFAULT true,
  alerte_delais_cassation BOOLEAN DEFAULT true,
  alerte_delais_opposition BOOLEAN DEFAULT true,
  email_format TEXT DEFAULT 'html',
  langue_email TEXT DEFAULT 'fr',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

### Interface TypeScript

```typescript
export interface NotificationPreferences {
  enabled: boolean
  daily_digest_enabled: boolean
  daily_digest_time: string
  alerte_j15_enabled: boolean
  alerte_j7_enabled: boolean
  alerte_j3_enabled: boolean
  alerte_j1_enabled: boolean
  alerte_actions_urgentes: boolean
  alerte_actions_priorite_haute: boolean
  alerte_audiences_semaine: boolean
  alerte_audiences_veille: boolean
  alerte_factures_impayees: boolean
  alerte_factures_impayees_delai_jours: number
  alerte_delais_appel: boolean
  alerte_delais_cassation: boolean
  alerte_delais_opposition: boolean
  email_format: 'html' | 'text'
  langue_email: 'fr' | 'ar'
}
```

## Fichiers Modifiés

1. ✅ `app/actions/cabinet.ts` - Ajout interface, correction SQL, ajout validation
2. ✅ `components/parametres/NotificationPreferencesForm.tsx` - Utilisation interface exportée
3. ✅ `supabase/migrations/20260205140000_cleanup_notification_preferences.sql` - Nouveau
4. ❗ `app/actions/notifications.ts` - À supprimer manuellement

## Tests Recommandés

1. **Test création préférences**: Créer un nouveau compte et vérifier que les préférences par défaut sont créées
2. **Test mise à jour**: Modifier les préférences et vérifier la sauvegarde
3. **Test validation**: Tester les validations (délai invalide, format invalide, etc.)
4. **Test interface**: Vérifier que le formulaire affiche correctement les préférences

## Commandes

```bash
# Supprimer fichier obsolète
rm app/actions/notifications.ts

# Appliquer les migrations (si pas déjà fait)
npm run db:migrate

# Tester compilation
npm run build
```

## Prochaines Étapes

1. Supprimer `app/actions/notifications.ts`
2. Tester l'interface utilisateur sur http://localhost:7002/parametres/notifications
3. Implémenter le système d'envoi d'emails de notifications (actuellement TODO)
4. Configurer le cron job pour l'envoi quotidien
