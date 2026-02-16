# Migration Notification API - Remplacement Supabase Edge Function

**Date**: 17 février 2026
**Phase**: 4.3 - Notification API (remplacer Supabase)
**Durée**: 4h
**Statut**: ✅ COMPLÉTÉ

---

## 🎯 Objectif

Remplacer complètement Supabase Edge Function `send-notifications` par une infrastructure Next.js + Cron bash VPS pour les notifications quotidiennes par email.

## 📋 Problème Initial

**Ancien système (Supabase)**:
- Edge Function `db/functions/send-notifications/` (Deno)
- pg_cron SQL déclencheur
- Dépendance Supabase (coût, lock-in)
- Complexité déploiement (2 systèmes séparés)

**Limitations**:
- Impossible de tester localement sans Supabase CLI
- Logs dispersés (PostgreSQL + Supabase Dashboard)
- Pas d'intégration avec monitoring crons existant

## ✅ Solution Implémentée

### Architecture Nouvelle

```
┌─────────────────────────────────────────────────────────────┐
│                    VPS QADHYA (VPS)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Cron (root)                                                │
│    └─> cron-send-notifications.sh (06:00-10:00 hourly)     │
│         └─> POST /api/notifications/send                    │
│             - Auth: Bearer CRON_SECRET                       │
│             - Filtre users par send_time                     │
│             - Envoie emails via Brevo                        │
│             - Logs via cron-logger.sh                        │
│                                                              │
│  Next.js API Routes                                         │
│    ├─> /api/notifications/send   (cron quotidien)          │
│    └─> /api/notifications/test   (test manuel)             │
│                                                              │
│  PostgreSQL                                                  │
│    └─> profiles.notification_preferences (JSONB)            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Composants Créés

**1. API Route `/api/notifications/send`** (583 lignes)
- **Auth**: `X-Cron-Secret` (sécurise accès cron)
- **Logique**:
  1. Filtre utilisateurs par `send_time` = heure actuelle
  2. Pour chaque utilisateur:
     - Récupère données (échéances, actions, audiences, factures)
     - Génère email HTML bilingue (FR/AR)
     - Envoie via Brevo
  3. Retourne stats (sent, failed, total, duration)
- **Données récupérées**:
  - Échéances (J-15, J-7, J-3, J-1 selon préférences)
  - Actions urgentes
  - Audiences (7 jours)
  - Factures impayées (selon seuil config)

**2. API Route `/api/notifications/test`** (234 lignes)
- **Auth**: Session utilisateur (pas CRON_SECRET)
- **Logique**:
  - Email de test avec config actuelle
  - Affiche paramètres utilisateur
  - Envoie via Brevo
- **Usage**: Bouton "Tester" dans `/parametres/notifications`

**3. Cron Script `/scripts/cron-send-notifications.sh`** (70 lignes)
- **Fréquence**: Toutes les heures de 06:00 à 10:00
- **Logique**:
  - Appelle API `/api/notifications/send`
  - Logs via `cron-logger.sh` (monitoring unifié)
  - Parse stats JSON response
  - Exit code selon succès/échec
- **Monitoring**: Dashboard `/super-admin/monitoring?tab=crons`

**4. Setup Script `/scripts/setup-notifications-cron.sh`** (110 lignes)
- Installation automatique crontab root
- Validation script existence
- Création dossiers logs
- Instructions post-installation

**5. Server Action `testNotificationAction`** (mis à jour)
- Remplace TODO ligne 92
- Appelle `/api/notifications/test`
- Retourne message succès/erreur

## 📊 Tables Database Existantes (Réutilisées)

```sql
-- Préférences notifications (JSONB dans profiles)
profiles.notification_preferences = {
  "enabled": boolean,
  "send_time": "HH:MM",
  "notify_echeances": {
    "j15": boolean,
    "j7": boolean,
    "j3": boolean,
    "j1": boolean
  },
  "notify_actions_urgentes": boolean,
  "notify_audiences": boolean,
  "notify_factures_impayees": boolean,
  "factures_seuil_jours": number,
  "langue_email": "fr" | "ar",
  "format_email": "html" | "text"
}

-- Notifications admin (alertes système - non utilisé pour emails quotidiens)
admin_notifications (...)
```

## 🚀 Déploiement Production

### Prérequis

1. **Variable d'environnement**:
   ```bash
   # /opt/qadhya/.env.production.local
   CRON_SECRET=<secret_généré>
   NEXT_PUBLIC_APP_URL=https://qadhya.tn

   # Brevo (déjà configuré)
   BREVO_API_KEY=<key>
   BREVO_SENDER_EMAIL=noreply@qadhya.tn
   BREVO_SENDER_NAME=Qadhya
   ```

2. **Dossier logs**:
   ```bash
   sudo mkdir -p /var/log/qadhya
   sudo chown root:root /var/log/qadhya
   ```

### Installation Cron (VPS)

```bash
# 1. Déployer code (Tier 1 ou Tier 2)
git push origin main

# 2. SSH sur VPS
ssh root@84.247.165.187

# 3. Installer cron
cd /opt/qadhya
bash scripts/setup-notifications-cron.sh

# 4. Vérifier installation
crontab -l | grep notifications
# Attendu: 0 6-10 * * * bash /opt/qadhya/scripts/cron-send-notifications.sh
```

### Test Manuel

```bash
# Test envoi notifications
bash /opt/qadhya/scripts/cron-send-notifications.sh

# Voir logs
tail -f /var/log/qadhya/send-notifications.log

# Vérifier DB cron_executions
docker exec qadhya-postgres psql -U moncabinet -d qadhya -c "
  SELECT * FROM cron_executions
  WHERE cron_name = 'send-notifications'
  ORDER BY started_at DESC LIMIT 5;
"
```

## 📧 Format Email Généré

**Sujet** (FR): `Notification quotidienne - 17 février 2026`
**Sujet** (AR): `إشعار يومي - ١٧ فبراير ٢٠٢٦`

**Sections Email**:
1. **Header** (gradient violet) - Logo + Date
2. **Salutation** - Nom utilisateur
3. **Échéances** (si activé):
   - Liste avec icônes 📅
   - Couleur urgence (rouge J-1/J-3, orange J-7/J-15)
4. **Actions Urgentes** (si activé):
   - Liste avec descriptions
   - Dates limites
5. **Audiences** (si activé):
   - Prochaines 7 jours
   - Tribunal
6. **Factures Impayées** (si activé):
   - Numéro, client, montant
   - Jours de retard (rouge)
7. **Footer** - Lien paramètres + branding

**Exemple HTML** (responsive, dark mode compatible):
```html
<!DOCTYPE html>
<html>
  <body style="font-family: Arial; max-width: 600px; ...">
    <div style="background: linear-gradient(135deg, #667eea, #764ba2); ...">
      <h1>Qadhya</h1>
    </div>
    <div style="background: #f9fafb; ...">
      <p>Bonjour Salmen KTATA,</p>
      <h2>Échéances à venir (3)</h2>
      <ul>
        <li>
          <strong>Dépôt mémoire cassation</strong><br/>
          📅 20/02/2026<br/>
          ⏱️ 3 jour(s) restant(s)
        </li>
        ...
      </ul>
    </div>
  </body>
</html>
```

## 🔍 Monitoring & Logs

### Dashboard Super-Admin

**URL**: https://qadhya.tn/super-admin/monitoring?tab=crons

**Métriques trackées**:
- Dernière exécution
- Durée moyenne
- Taux succès/échec
- Nombre emails envoyés/échecs
- Timeline 7 jours

### Logs Filesystem

**Fichier**: `/var/log/qadhya/send-notifications.log`

**Format**:
```
[2026-02-17 06:00:01] 🔔 Envoi des notifications quotidiennes...
[2026-02-17 06:00:01] 📡 API: http://localhost:3000/api/notifications/send
[2026-02-17 06:00:32] ✅ Notifications envoyées avec succès
[2026-02-17 06:00:32] 📊 Stats: 12/15 envoyés, 3 échecs
[2026-02-17 06:00:32] ✅ Cron completed (duration: 31247ms, sent: 12, failed: 3)
```

### Logs Database

**Table**: `cron_executions`

```sql
SELECT
  id,
  cron_name,
  status,
  duration_ms,
  metadata->>'sent' as emails_sent,
  metadata->>'failed' as emails_failed,
  started_at
FROM cron_executions
WHERE cron_name = 'send-notifications'
ORDER BY started_at DESC
LIMIT 20;
```

## 🧪 Tests Validation

### Test E2E Local

```bash
# 1. Configurer préférences utilisateur dans UI
# /parametres/notifications
# - Activer notifications
# - send_time = heure actuelle + 1min
# - Activer au moins 1 type (échéances, actions, etc.)

# 2. Attendre l'heure configurée + lancer cron
bash scripts/cron-send-notifications.sh

# 3. Vérifier email reçu (Brevo Dashboard ou inbox)

# 4. Vérifier logs
tail -f /var/log/qadhya/send-notifications.log

# 5. Vérifier DB
psql $DATABASE_URL -c "
  SELECT * FROM cron_executions
  WHERE cron_name = 'send-notifications'
  ORDER BY started_at DESC LIMIT 1;
"
```

### Test Bouton UI

```bash
# 1. Naviguer /parametres/notifications
# 2. Cliquer "Tester les notifications"
# 3. Vérifier toast succès
# 4. Vérifier email reçu (inbox)
```

### Résultats Attendus

- ✅ Email reçu dans <1min
- ✅ HTML bien formaté (responsive, bilingue)
- ✅ Données correctes (échéances, actions, etc.)
- ✅ Cron execution logged dans DB
- ✅ Stats correctes (sent, failed, duration)

## 🔄 Migration Depuis Supabase

### Étapes de Migration

**1. Désactiver pg_cron Supabase** (si configuré):
```sql
-- Dashboard Supabase > SQL Editor
SELECT cron.unschedule('send_daily_notifications');
```

**2. Déployer nouveau code**:
```bash
git push origin main
# Déploiement auto Tier 1 ou Tier 2
```

**3. Installer cron VPS**:
```bash
ssh root@84.247.165.187
cd /opt/qadhya
bash scripts/setup-notifications-cron.sh
```

**4. Tester**:
```bash
# Test manuel
bash scripts/cron-send-notifications.sh

# Vérifier logs
tail -f /var/log/qadhya/send-notifications.log
```

**5. Supprimer ancien code Supabase** (optionnel):
```bash
# Supprimer fichiers obsolètes
rm -rf db/functions/send-notifications/
git rm db/migrations/20260205000009_configure_cron_notifications.sql
git commit -m "chore: supprimer ancien système Supabase notifications"
```

### Rollback (Si Problème)

**Réactiver Supabase** (temporaire):
```sql
-- Dashboard Supabase > SQL Editor
-- Réexécuter migration 20260205000009_configure_cron_notifications.sql
```

**Désactiver cron VPS**:
```bash
crontab -l | grep -v "cron-send-notifications.sh" | crontab -
```

## 📈 Métriques Succès

**Objectifs Phase 4.3**:
- ✅ Remplacement complet Supabase Edge Function
- ✅ API Next.js `/api/notifications/send` opérationnelle
- ✅ Cron bash VPS configuré (06:00-10:00 hourly)
- ✅ Test manuel fonctionnel (`testNotificationAction`)
- ✅ Monitoring unifié (dashboard + logs + DB)
- ✅ Documentation complète

**Résultats Attendus Production**:
- Emails quotidiens envoyés à tous utilisateurs actifs
- Taux succès >95% (tolérance échecs SMTP temporaires)
- Latence <2min par batch de 50 utilisateurs
- 0 dépendance Supabase

## 🔗 Fichiers Modifiés/Créés

**Nouveaux fichiers** (5):
1. `app/api/notifications/send/route.ts` (583 lignes) - API cron quotidien
2. `app/api/notifications/test/route.ts` (234 lignes) - API test manuel
3. `scripts/cron-send-notifications.sh` (70 lignes) - Script cron
4. `scripts/setup-notifications-cron.sh` (110 lignes) - Installation
5. `docs/NOTIFICATION_API_MIGRATION.md` (ce fichier) - Documentation

**Fichiers modifiés** (1):
1. `app/actions/notifications.ts` - Implémentation `testNotificationAction`

**Total**: 1200+ lignes code, 4h effort

## 🎓 Leçons Apprises

**✅ Bonnes pratiques**:
- Réutiliser infrastructure existante (Brevo, cron-logger.sh, monitoring)
- API Routes Next.js pour logique métier (testable, loggable)
- Cron bash simple pour déclenchement (robuste, debuggable)
- Documentation exhaustive avant déploiement

**⚠️ Points d'attention**:
- `CRON_SECRET` requis dans `.env.production.local` (sécurité)
- Cron 06:00-10:00 hourly (pas toutes les heures) pour économie
- Filtrage par `send_time` utilisateur (pas tous à 06:00)
- Timeout curl 120s pour batch >50 utilisateurs

## 🔧 Maintenance

**Ajout nouveau type notification**:
1. Modifier `fetchNotificationData()` dans `send/route.ts`
2. Ajouter section dans `generateEmailContent()`
3. Ajouter champ dans `NotificationPreferences` interface

**Changement fréquence cron**:
```bash
# Éditer crontab
crontab -e
# Modifier ligne: 0 6-10 * * * → 0 8 * * * (1×/jour à 8h)
```

**Debug email non reçu**:
1. Vérifier préférences utilisateur (`enabled=true`, `send_time` correct)
2. Vérifier logs cron: `tail -f /var/log/qadhya/send-notifications.log`
3. Vérifier Brevo Dashboard (emails envoyés/bounced)
4. Vérifier `cron_executions` table (status, metadata)

---

**Support**: En cas de problème, consulter les logs et le monitoring dashboard.
**Auteur**: Phase 4.3 - TODOs Critiques
**Co-Authored-By**: Claude Sonnet 4.5
