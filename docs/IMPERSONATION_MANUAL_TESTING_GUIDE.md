# Guide de Test Manuel UI - Système d'Impersonnalisation

**Date** : 16 février 2026
**Version** : 1.0.0
**Statut Backend** : ✅ 100% Opérationnel (17/17 tests automatisés passés)

---

## 📋 Pré-requis

### Compte de Test
- ✅ Compte **super_admin** : Nécessaire pour tester
- ✅ Compte **utilisateur cible** : Créer un compte utilisateur normal approuvé pour les tests

### Environnement
- ✅ URL Production : https://qadhya.tn
- ✅ Migrations DB appliquées
- ✅ Cron configuré
- ✅ Code déployé (commit a116cea)

---

## 🧪 Tests Manuels UI

### Test 1 : Dashboard Impersonations (P1.1)

**Objectif** : Vérifier le nouvel onglet de monitoring temps réel

#### Étapes :
1. Se connecter en tant que super_admin
2. Aller sur : https://qadhya.tn/super-admin/monitoring?tab=impersonations
3. Observer l'interface

#### Attendu :
- [ ] **Onglet "Impersonations"** visible (8ème onglet, icône 👁️)
- [ ] **Card avec titre** : "Impersonnalisations Actives"
- [ ] **Badge** affichant le nombre de sessions actives (0 si aucune)
- [ ] **Bouton "Actualiser"** présent
- [ ] Si **aucune session** :
  - Message : "Aucune session d'impersonnalisation active"
  - Icône ✅ verte
  - Texte explicatif : "Les impersonnalisations apparaîtront ici en temps réel"
- [ ] **Auto-refresh** : Observer pendant 10-15 secondes (devrait refresh automatiquement)

#### Screenshot Attendu :
```
┌─────────────────────────────────────────────────────────┐
│ 👁️ Impersonnalisations Actives [0]                      │
│                                                           │
│ [↻ Actualiser]                                           │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │            ✅                                      │  │
│  │  Aucune session d'impersonnalisation active      │  │
│  │  Les impersonnalisations apparaîtront ici        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

### Test 2 : Dialog de Confirmation (P0.4)

**Objectif** : Vérifier que la confirmation obligatoire fonctionne

#### Étapes :
1. Aller sur : https://qadhya.tn/super-admin/users
2. Sélectionner un utilisateur **approuvé** (status = approved, role ≠ super_admin)
3. Cliquer sur **"Voir comme cet utilisateur"** (bouton orange avec icône 👁️)
4. **NE PAS** voir d'impersonation directe → Dialog doit s'ouvrir

#### Attendu - Dialog :
- [ ] **Dialog s'ouvre** (pas de redirection immédiate)
- [ ] **Titre orange** : "Action Sensible - Impersonnalisation"
- [ ] **Description** : "Vous allez voir l'application en tant que [email]"
- [ ] **Alert Warning (fond orange)** avec :
  - ⚠️ Icône triangle
  - Points importants :
    - "Cette action sera tracée dans l'audit"
    - "Durée maximale : 2 heures"
    - "Toutes vos actions seront enregistrées"
    - "Autres super-admins peuvent voir cette session"
- [ ] **Champ Textarea** :
  - Label : "Raison de l'impersonnalisation *" (astérisque rouge)
  - Placeholder : "Expliquez la raison (support client, débogage, test UX, etc.)"
  - Minimum 10 caractères
  - Compteur : "X/10 caractères minimum"
  - MaxLength : 500 caractères
- [ ] **Boutons** :
  - "Annuler" (gris, à gauche)
  - "Confirmer l'impersonnalisation" (orange, à droite)

#### Test Validation Raison :
1. **Taper moins de 10 caractères** (ex: "test")
   - [ ] Bouton "Confirmer" **désactivé** (disabled, grisé)
   - [ ] Compteur affiche "4/10 caractères minimum"

2. **Taper 10+ caractères** (ex: "Support client urgent")
   - [ ] Bouton "Confirmer" **activé** (orange vif)
   - [ ] Compteur affiche "22/10 caractères minimum"

3. **Cliquer "Annuler"**
   - [ ] Dialog se ferme
   - [ ] Aucune impersonation démarrée
   - [ ] Reste sur la page utilisateur

4. **Cliquer "Confirmer" avec raison valide**
   - [ ] Toast : "Impersonnalisation démarrée - Redirection en cours..."
   - [ ] Redirection vers `/dashboard`

---

### Test 3 : Bannière Sticky + Timer (P1.2)

**Objectif** : Vérifier la bannière durant l'impersonation

#### Étapes :
1. Démarrer une impersonation (suivre Test 2)
2. Observer la bannière en haut de page
3. Scroller la page vers le bas

#### Attendu - Bannière :
- [ ] **Position sticky** : Reste **toujours visible** en haut (même après scroll)
- [ ] **Couleur** : Fond rouge (`bg-red-600`)
- [ ] **Contenu** :
  - Texte : "Impersonation active : [Nom Utilisateur ou Email]"
  - **Timer live** : "⏱️ Xm YYs" (incrémente chaque seconde)
    - Format : minutes et secondes (ex: "0m 05s", "5m 23s")
  - Bouton : "Arrêter" (blanc sur rouge)
- [ ] **Timer incrémente** :
  - Attendre 5 secondes
  - Timer doit passer de "0m 00s" → "0m 05s"

#### Test Scroll :
1. **Scroller vers le bas** de la page (ex: vers le footer)
   - [ ] Bannière reste **fixe en haut** de la fenêtre
   - [ ] Timer continue d'incrémenter

#### Test Arrêt :
1. **Cliquer "Arrêter"**
   - [ ] Bouton affiche "Arrêt..." (disabled pendant traitement)
   - [ ] Redirection vers `/super-admin/users`
   - [ ] Bannière disparaît
   - [ ] Toast éventuel : "Impersonation arrêtée"

---

### Test 4 : Bannière Warning (P1.2 - Avancé)

**Objectif** : Vérifier les alertes de durée

⚠️ **Note** : Ce test nécessite de **modifier le timestamp** dans le cookie pour simuler une longue durée.

#### Méthode :
1. Démarrer une impersonation
2. Ouvrir **DevTools** (F12) → **Application** → **Cookies**
3. Trouver cookie `impersonation_original`
4. **Copier la valeur**, la décoder (base64) et modifier `startedAt`
5. **Simuler 1h45 écoulées** : `startedAt = Date.now() - (105 * 60 * 1000)`
6. **Recharger la page**

#### Attendu - Warning (> 1h30) :
- [ ] Timer affiche format horaire : "1h 45m 30s"
- [ ] Timer a classe `animate-pulse` (clignotement)
- [ ] Timer couleur change : `text-yellow-300`
- [ ] **Barre de progression jaune** apparaît sous le texte
  - Largeur : 87.5% (1h45 / 2h)
- [ ] **Toast warning** apparaît :
  - Titre : "⚠️ Impersonnalisation longue"
  - Description : "Session active depuis plus de 1h45. Arrêt automatique dans 15 minutes."

#### Attendu - Critique (> 1h58) :
- [ ] **Toast critique** apparaît :
  - Titre : "🚨 Expiration imminente"
  - Description : "Arrêt automatique dans 2 minutes !"

---

### Test 5 : Auto-Logout 2h (P0.1)

**Objectif** : Vérifier l'arrêt automatique après 2 heures

⚠️ **Note** : Test simulation car attendre 2h est impraticable.

#### Méthode :
1. Démarrer une impersonation
2. Ouvrir **DevTools** → **Application** → **Cookies**
3. Modifier `impersonation_original` : `startedAt = Date.now() - (2*60*60*1000 + 60000)` (2h01)
4. **Recharger la page**

#### Attendu :
- [ ] **Redirection automatique** vers `/super-admin/users?impersonation=expired`
- [ ] **Bannière disparaît**
- [ ] **Toast/Message** : "Session d'impersonation expirée (2h maximum)"
- [ ] Retour à la session admin normale

#### Vérification DB :
```sql
-- Vérifier audit log d'expiration
SELECT * FROM admin_audit_logs
WHERE action_type = 'impersonation_expired'
ORDER BY created_at DESC
LIMIT 1;
```

---

### Test 6 : Dashboard - Session Active (P1.1 Avancé)

**Objectif** : Vérifier l'affichage d'une session active dans le dashboard

#### Pré-requis :
- Avoir **2 comptes super_admin** (ou simuler avec 2 navigateurs/modes)

#### Étapes :
1. **Navigateur 1** : Démarrer une impersonation (Admin A → User X)
2. **Navigateur 2** : Se connecter avec Admin B
3. Aller sur : https://qadhya.tn/super-admin/monitoring?tab=impersonations

#### Attendu - Dashboard (Navigateur 2) :
- [ ] **Badge** : "[1]" à côté du titre
- [ ] **Table affichée** avec colonnes :
  - Admin : Nom + Email de Admin A
  - Utilisateur cible : Nom + Email de User X
  - Raison : Raison saisie lors du démarrage
  - Durée : Timer live (ex: "2m 15s")
  - IP : Adresse IP de Admin A
  - Actions : Bouton "Forcer arrêt"
- [ ] **Timer live** : S'incrémente chaque seconde
- [ ] **Barre de progression** :
  - Verte si < 1h30
  - Orange/jaune si > 1h30
  - Largeur proportionnelle (ex: 5% si 6min / 2h)

#### Test Forcer Arrêt (Navigateur 2) :
1. Cliquer **"Forcer arrêt"**
2. Confirmer dans le dialog
3. **Attendu** :
   - [ ] Toast : "Session arrêtée - L'impersonnalisation a été forcée à s'arrêter"
   - [ ] Ligne disparaît de la table
   - [ ] Badge passe à "[0]"
4. **Navigateur 1** (Admin A) :
   - Recharger la page
   - [ ] Bannière disparaît
   - [ ] Retour session normale

---

### Test 7 : Audit Logs - Filtres (P1.3)

**Objectif** : Vérifier les nouveaux filtres audit logs

#### Étapes :
1. Démarrer puis arrêter une impersonation (pour générer des logs)
2. Aller sur : https://qadhya.tn/super-admin/audit-logs

#### Attendu - Filtres :
- [ ] **Select "Action"** contient un **optgroup** "Impersonation" avec :
  - "Impersonnalisation démarrée"
  - "Impersonnalisation arrêtée"
  - "Impersonnalisation expirée"

#### Test Filtre :
1. Sélectionner **"Impersonnalisation démarrée"**
2. **Attendu** :
   - [ ] Liste filtrée affiche uniquement logs `impersonation_start`
   - [ ] **Badge orange** avec emoji "🔐 Impersonnalisation démarrée"
   - [ ] Détails affichent :
     - Admin : Email qui a fait l'impersonation
     - Cible : Email de l'utilisateur impersoné
     - Raison : Visible dans `new_value` JSON
     - IP address : Adresse IP de l'admin
     - User-Agent : Navigateur utilisé

3. Sélectionner **"Impersonnalisation arrêtée"**
   - [ ] **Badge orange** avec emoji "🔐 Impersonnalisation arrêtée"

4. Sélectionner **"Impersonnalisation expirée"**
   - [ ] **Badge rouge** avec emoji "⏱️ Impersonnalisation expirée"

---

### Test 8 : Actions Tracées (P0.2)

**Objectif** : Vérifier que toutes actions pendant impersonation sont tracées

#### Étapes :
1. Démarrer une impersonation (Admin A → User X)
2. **Effectuer des actions** pendant l'impersonation :
   - Aller sur `/super-admin/users`
   - Changer le rôle d'un autre utilisateur
   - Changer le plan d'un utilisateur
   - Approuver/rejeter un utilisateur
3. Arrêter l'impersonation
4. Aller sur : https://qadhya.tn/super-admin/audit-logs

#### Attendu :
- [ ] **Toutes les actions** effectuées pendant l'impersonation ont :
  - Colonne `is_impersonation = true` (vérifier en DB)
  - Colonne `impersonated_user_id = [ID de User X]` (vérifier en DB)
- [ ] Dans l'interface, possibilité de filtrer les logs par :
  - Actions normales vs actions en impersonation (futur feature)

#### Vérification DB :
```sql
-- Compter les actions en impersonation
SELECT COUNT(*) FROM admin_audit_logs WHERE is_impersonation = true;

-- Voir détails
SELECT
  admin_email,
  action_type,
  target_identifier,
  is_impersonation,
  impersonated_user_id,
  created_at
FROM admin_audit_logs
WHERE is_impersonation = true
ORDER BY created_at DESC
LIMIT 10;
```

---

### Test 9 : Restrictions (P0.4)

**Objectif** : Vérifier que les restrictions fonctionnent

#### Test 9.1 - Pas d'impersonation super_admin :
1. Aller sur un profil utilisateur avec `role = 'super_admin'`
2. **Attendu** :
   - [ ] Bouton **"Voir comme cet utilisateur"** est **absent** ou **disabled**

#### Test 9.2 - Pas d'impersonation soi-même :
1. Aller sur son propre profil admin
2. **Attendu** :
   - [ ] Bouton **"Voir comme cet utilisateur"** est **absent** ou **disabled**

#### Test 9.3 - Seulement utilisateurs approuvés :
1. Aller sur un profil avec `status = 'pending'` ou `'suspended'`
2. Cliquer "Voir comme cet utilisateur" si présent
3. **Attendu** :
   - [ ] **Erreur** : "L'utilisateur n'est pas approuvé"
   - [ ] Aucune impersonation démarrée

---

### Test 10 : Alertes Email (P1.4)

**Objectif** : Vérifier les alertes email automatiques

⚠️ **Note** : Nécessite de laisser une impersonation active > 1h ou de tester manuellement l'API.

#### Méthode Manuelle (Test API) :
```bash
# Se connecter au serveur
ssh root@84.247.165.187

# Exécuter manuellement le cron
bash /opt/qadhya/scripts/cron-check-impersonations.sh

# Vérifier les logs
tail -f /var/log/qadhya/impersonation-checks.log
```

#### Méthode Réelle (Attendre 1h) :
1. Démarrer une impersonation
2. **Attendre 1 heure** (ou simuler en modifiant DB)
3. Le cron horaire détectera la session > 1h
4. **Email automatique** envoyé à tous super-admins

#### Attendu - Email :
- [ ] **Objet** : "🚨 X Impersonnalisation(s) Active(s) Longue(s)"
- [ ] **Contenu HTML** formaté avec :
  - Nombre de sessions longues détectées
  - **Tableau** avec colonnes : Admin, Utilisateur, Durée, IP, Raison
  - Warning : "Durée maximale : 2 heures"
  - **Lien** : "Voir le Dashboard" → `/super-admin/monitoring?tab=impersonations`
- [ ] **Destinataires** : Tous comptes `role = 'super_admin'` et `status = 'approved'`

---

## 📊 Checklist Complète

### Tests Backend (Automatisés) ✅
- [x] Health Check (2/2)
- [x] Base de Données (3/3)
- [x] Routes API (2/2)
- [x] Cron (3/3)
- [x] Exécution Cron (1/1)
- [x] Index DB (2/2)
- [x] Contraintes (2/2)
- [x] Logs (2/2)

**Total Backend** : 17/17 ✅

### Tests UI (Manuels)
- [ ] Test 1 : Dashboard Impersonations
- [ ] Test 2 : Dialog de Confirmation
- [ ] Test 3 : Bannière Sticky + Timer
- [ ] Test 4 : Bannière Warning
- [ ] Test 5 : Auto-Logout 2h
- [ ] Test 6 : Dashboard - Session Active
- [ ] Test 7 : Audit Logs - Filtres
- [ ] Test 8 : Actions Tracées
- [ ] Test 9 : Restrictions
- [ ] Test 10 : Alertes Email

**Total UI** : 0/10 (à effectuer)

---

## 🐛 Signalement de Bugs

Si vous trouvez un bug durant les tests :

### Informations à Collecter :
1. **Test** : Numéro et nom du test
2. **Étapes** : Reproduction exacte
3. **Attendu** : Comportement attendu
4. **Obtenu** : Comportement réel
5. **Screenshots** : Si applicable
6. **Console** : Erreurs JS (DevTools → Console)
7. **Network** : Requêtes échouées (DevTools → Network)

### Exemple de Bug Report :
```markdown
## Bug : Bannière Timer ne s'incrémente pas

**Test** : Test 3 - Bannière Sticky + Timer

**Étapes** :
1. Démarrer impersonation
2. Observer timer pendant 10 secondes

**Attendu** : Timer passe de "0m 00s" à "0m 10s"

**Obtenu** : Timer reste bloqué à "0m 00s"

**Console** :
```
TypeError: Cannot read property 'startedAt' of null
  at ImpersonationBanner.tsx:42
```

**Screenshot** : [Joindre capture]
```

---

## 📝 Notes Importantes

### DevTools Utiles
- **Console** : Voir les erreurs JavaScript
- **Network** : Voir les requêtes API (filtrer "impersonation")
- **Application** → **Cookies** : Inspecter/modifier cookies
- **React DevTools** : Inspecter composants (si installé)

### Cookies à Connaître
- `auth_session` : Session utilisateur courante
- `impersonation_original` : Token admin sauvegardé
  - Structure JSON : `{ token: "...", startedAt: 1234567890 }`

### Commandes SQL Utiles
```sql
-- Sessions actives
SELECT * FROM active_impersonations WHERE is_active = true;

-- Audit logs impersonation
SELECT * FROM admin_audit_logs WHERE is_impersonation = true ORDER BY created_at DESC LIMIT 20;

-- Dernière expiration
SELECT * FROM admin_audit_logs WHERE action_type = 'impersonation_expired' ORDER BY created_at DESC LIMIT 1;
```

---

## ✅ Validation Finale

Une fois **tous les tests UI passés** :

1. ✅ Cocher tous les tests dans la checklist
2. ✅ Documenter les bugs trouvés (si applicable)
3. ✅ Valider avec l'équipe/client
4. ✅ Mettre à jour la documentation si modifications

---

**Guide créé par** : Claude Sonnet 4.5
**Date** : 16 février 2026
**Version** : 1.0.0
