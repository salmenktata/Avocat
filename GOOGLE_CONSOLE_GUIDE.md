# Guide Google Cloud Console - 5 minutes

## 🎯 Objectif
Obtenir `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` pour tester Google Drive.

---

## Étape 1: Créer un Projet (30 secondes)

1. **Ouvrir**: https://console.cloud.google.com
2. En haut à gauche, cliquer sur le nom du projet (ou "Sélectionner un projet")
3. Cliquer "NOUVEAU PROJET"
4. Nom: **qadhya-test** (ou autre)
5. Cliquer "CRÉER"
6. Attendre quelques secondes, puis sélectionner le projet créé

---

## Étape 2: Activer Google Drive API (30 secondes)

1. Menu hamburger (☰) → **APIs et services** → **Bibliothèque**
2. Dans la barre de recherche: **Google Drive API**
3. Cliquer sur "Google Drive API"
4. Cliquer **ACTIVER**
5. Attendre l'activation (quelques secondes)

---

## Étape 3: Configurer l'écran de consentement (1 minute)

1. Menu gauche → **Écran de consentement OAuth**
2. Type d'utilisateur: **Externe** (sélectionner)
3. Cliquer **CRÉER**

**Étape 1 - Informations sur l'application:**
- Nom de l'application: **Qadhya Test**
- E-mail assistance utilisateur: *votre email*
- E-mail du développeur: *votre email*
- Cliquer **ENREGISTRER ET CONTINUER**

**Étape 2 - Champs d'application:**
- Cliquer **ENREGISTRER ET CONTINUER** (laisser vide)

**Étape 3 - Utilisateurs tests:**
- Cliquer **+ ADD USERS**
- Ajouter *votre email Google*
- Cliquer **AJOUTER**
- Cliquer **ENREGISTRER ET CONTINUER**

**Étape 4 - Résumé:**
- Cliquer **RETOUR AU TABLEAU DE BORD**

---

## Étape 4: Créer les Credentials OAuth (1 minute)

1. Menu gauche → **Identifiants**
2. En haut: **+ CRÉER DES IDENTIFIANTS**
3. Sélectionner: **ID client OAuth**

**Configuration:**
- Type d'application: **Application de bureau** (Desktop app)
- Nom: **Qadhya Local Test**
- Cliquer **CRÉER**

**✅ Credentials créés!**

Une popup s'affiche avec:
- **ID client**: `xxx.apps.googleusercontent.com`
- **Code secret du client**: `GOCSPX-xxx...`

**📋 COPIEZ CES DEUX VALEURS** (vous en aurez besoin dans 10 secondes)

---

## Étape 5: Configurer votre application (30 secondes)

1. Retour au terminal où le script `quick-gdrive-setup.ts` attend
2. Répondre **o** (oui)
3. Coller le **CLIENT_ID**
4. Coller le **CLIENT_SECRET**

Le script va:
- Mettre à jour `.env` automatiquement
- Générer une URL d'autorisation
- Vous demander d'autoriser l'application dans le navigateur

---

## Étape 6: Autoriser l'application (1 minute)

1. **Copier l'URL** générée par le script
2. **Ouvrir dans le navigateur**
3. **Sélectionner votre compte Google** (celui que vous avez ajouté en "utilisateur test")
4. ⚠️ Écran "Google n'a pas validé cette application":
   - Cliquer **Paramètres avancés**
   - Cliquer **Accéder à Qadhya Test (dangereux)** (c'est normal, c'est votre app)
5. **Autoriser** l'accès à Google Drive
6. Vous verrez un **code d'autorisation** (commence par `4/`)
7. **COPIER ce code**

---

## Étape 7: Finaliser (10 secondes)

1. Retour au terminal
2. **Coller le code** d'autorisation
3. Appuyer sur Entrée

Le script va:
- ✅ Valider le token
- ✅ Tester l'accès à Google Drive
- ✅ Sauvegarder dans `.env`
- ✅ Tester votre dossier partagé

---

## ✅ Résultat Attendu

```
✅ Token obtenu!
✅ Token valide!
✅ Accès au dossier: Documents Juridiques
✅ 15 fichier(s) découvert(s)

📄 Fichiers trouvés:
   1. Code Civil.pdf (2.3 MB)
   2. Code Pénal.pdf (1.8 MB)
   ...

✨ Configuration terminée!
```

---

## 🆘 Problèmes Courants

### "Google n'a pas validé cette application"

**Normal!** C'est votre application en mode test.
- Cliquer "Paramètres avancés"
- Cliquer "Accéder à Qadhya Test (dangereux)"

### "Cette application est bloquée"

Vous n'avez pas ajouté votre email en "utilisateur test".
- Retour à l'écran de consentement OAuth
- Ajouter votre email dans "Utilisateurs tests"

### "Code d'autorisation invalide"

Le code expire vite (quelques minutes).
- Recommencer l'autorisation
- Copier-coller rapidement

### "403 Forbidden" sur le dossier

Le dossier n'est pas partagé avec votre compte.
- Ouvrir le dossier dans Google Drive
- Partager avec votre email Google

---

## 📝 Après Configuration

Une fois le token obtenu, vous pouvez:

1. **Tester avec votre propre dossier:**
   ```bash
   npx tsx scripts/test-gdrive-connection.ts "https://drive.google.com/drive/folders/VOTRE_FOLDER_ID"
   ```

2. **Créer une source via l'interface:**
   - `http://localhost:3000/super-admin/web-sources/new`
   - Type: Google Drive
   - Coller l'URL du dossier
   - Tester la connexion

3. **Déployer en production:**
   - Voir `GDRIVE_DEPLOYMENT.md` pour configuration service account

---

## ⏱️ Temps Total: ~5 minutes

Une fois les credentials obtenus, **gardez-les** - ils sont réutilisables!

Vous pouvez les ajouter au `.env` de production également.
