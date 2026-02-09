# Guide Utilisateur - Suivi Consommation IA par Utilisateur

## 📘 Introduction

Bienvenue dans le guide d'utilisation du **Dashboard de Suivi de Consommation IA par Utilisateur**. Cette fonctionnalité vous permet d'analyser en détail comment chaque utilisateur de votre plateforme utilise les services d'intelligence artificielle.

**Public cible** : Super-administrateurs de la plateforme Qadhya
**Prérequis** : Compte super-admin actif
**URL d'accès** : https://qadhya.tn/super-admin/provider-usage

---

## 🎯 À Quoi Ça Sert ?

Ce dashboard vous permet de :

✅ **Identifier les power users** - Qui utilise le plus l'IA ?
✅ **Analyser les coûts** - Combien coûte chaque utilisateur ?
✅ **Comprendre les patterns** - Quelles features sont populaires ?
✅ **Optimiser le budget** - Où réduire les dépenses ?
✅ **Valider la tarification** - Les plans sont-ils bien calibrés ?
✅ **Détecter les anomalies** - Consommation inhabituelle ?

---

## 🚀 Démarrage Rapide (5 minutes)

### Étape 1 : Accéder au Dashboard

1. Connectez-vous sur https://qadhya.tn/login
2. Naviguez vers **Super-Admin** → **Provider Usage**
3. Vous arrivez sur le dashboard principal

### Étape 2 : Vue d'ensemble Système

Par défaut, vous voyez :
- 📊 **Table des Top Utilisateurs** (50 premiers)
- 📈 **4 Graphiques** avec données agrégées de tous les utilisateurs
- 🔘 **Boutons de période** : 7 jours / 30 jours
- 🔍 **UserSelector** : "Tous les utilisateurs"

### Étape 3 : Filtrer par Utilisateur

**Méthode 1 - Via la table** :
1. Click sur n'importe quelle ligne de la table
2. ➡️ Tous les graphiques se mettent à jour instantanément

**Méthode 2 - Via le dropdown** :
1. Click sur le dropdown "Tous les utilisateurs"
2. Sélectionnez un utilisateur dans la liste
3. ➡️ Même résultat : filtrage complet

### Étape 4 : Revenir à la Vue Système

- **Méthode 1** : Click sur le bouton "✕ Effacer filtre" (en haut à droite)
- **Méthode 2** : Sélectionnez "Tous les utilisateurs" dans le dropdown
- **Méthode 3** : Supprimez `&userId=xxx` de l'URL manuellement

---

## 📊 Composants du Dashboard

### 1️⃣ Top Utilisateurs - Table

#### Vue d'ensemble
La table affiche les **50 meilleurs consommateurs** triés par coût total décroissant.

#### Colonnes

| Colonne | Description | Format |
|---------|-------------|--------|
| **#** | Rang du consommateur | 1, 2, 3... avec médailles 🥇🥈🥉 |
| **Utilisateur** | Nom complet + email | "Prénom Nom" + email en gris |
| **Plan** | Type d'abonnement | Badge coloré (Free/Pro/Enterprise) |
| **Opérations** | Nombre total d'opérations IA | Nombre avec K/M suffix (ex: 1.2K) |
| **Tokens** | Total de tokens consommés | Nombre avec K/M suffix (ex: 567K) |
| **Coût** | Coût total | USD + TND (ratio ~3.2) |
| **Top Provider** | Provider le plus utilisé | Badge (Gemini/DeepSeek/etc.) |
| **👁️** | Action rapide | Bouton "Filtrer" |

#### Médailles du Podium

Les 3 premiers utilisateurs reçoivent des médailles :
- 🥇 **1er place** - Or (meilleur consommateur)
- 🥈 **2ème place** - Argent
- 🥉 **3ème place** - Bronze

#### Interactions

- **Hover sur ligne** : Fond gris foncé
- **Click sur ligne** : Filtre immédiat du dashboard
- **Click sur bouton œil** : Même effet que click sur ligne

#### Exemple de Lecture

```
🥇 1  Ahmed Ben Ali (ahmed@example.com)  [Pro]
      1,234 ops | 567K tokens | 45.67 TND | Gemini
```

**Interprétation** :
- Ahmed est le #1 consommateur
- Plan Pro
- 1,234 opérations IA sur la période
- 567,000 tokens consommés
- Coût de 45.67 TND (~14.71 USD)
- Provider préféré : Gemini

---

### 2️⃣ UserSelector (Dropdown)

#### Utilisation

1. **Click sur le dropdown** "Tous les utilisateurs"
2. **Liste déroulante** apparaît avec tous les utilisateurs actifs
3. **Format d'affichage** : "Prénom Nom (email) - Plan"
4. **Recherche** : Tapez pour filtrer la liste
5. **Sélection** : Click sur un utilisateur

#### États

- **"Tous les utilisateurs"** : Vue système (défaut)
- **Utilisateur spécifique** : Vue filtrée avec nom/email

#### Comportement

- **Sélection** → URL change : `?days=7&userId=xxx`
- **"Tous les utilisateurs"** → URL change : `?days=7`
- **Navigation browser** : Back/Forward fonctionne

---

### 3️⃣ Graphiques Filtrables

Tous les graphiques supportent le filtrage par utilisateur :

#### A. Matrice Provider × Opération

**Description** : Table croisée montrant les coûts par provider et type d'opération

**Colonnes** :
- Providers : Gemini, DeepSeek, Groq, Anthropic, Ollama
- Ligne Total : Somme par provider

**Lignes** :
- Opérations : Embedding, Chat, Generation, Classification, Extraction
- Colonne Total : Somme par opération

**Cellules** :
- Coût en USD (principal)
- Nombre de tokens (secondaire)
- Nombre de requêtes (tertiaire)

**Heatmap** : Les cellules sont colorées selon le coût (rouge = cher)

**Utilisation** :
- Identifier les combinaisons coûteuses
- Exemple : "Gemini + Embedding = 80% du coût"

#### B. Tendance Tokens par Provider

**Description** : Graphique linéaire de l'évolution quotidienne

**Axes** :
- X : Date (format jj/mm)
- Y : Nombre de tokens

**Lignes** :
- Une ligne par provider (5 couleurs différentes)
- Légende interactive (click pour masquer/afficher)

**Utilisation** :
- Détecter les pics de consommation
- Comparer les providers dans le temps
- Identifier les tendances (croissance/décroissance)

#### C. Distribution par Opération

**Description** : Diagramme circulaire (pie chart)

**Sections** :
- Une section par type d'opération
- Taille proportionnelle au coût
- Pourcentage affiché sur chaque section

**Couleurs** :
- Embedding : Bleu
- Chat : Vert
- Generation : Orange
- Classification : Violet
- Extraction : Rose

**Utilisation** :
- Vue d'ensemble rapide des opérations
- Identifier l'opération dominante
- Exemple : "Chat = 60% du budget"

#### D. Coûts Détaillés par Provider

**Description** : Graphique en barres empilées

**Axes** :
- X : Providers
- Y : Coût en USD

**Barres empilées** :
- Chaque couleur = une opération
- Hauteur totale = coût total du provider

**Utilisation** :
- Comparer les providers entre eux
- Voir la décomposition par opération
- Identifier le provider le plus cher

---

### 4️⃣ Badge "Filtré par utilisateur"

Lorsqu'un filtre utilisateur est actif :

**Apparence** :
- Badge bleu/gris "Filtré par utilisateur"
- Affiché dans le titre de chaque graphique
- Aligné à droite du titre

**Signification** :
- Les données affichées concernent **uniquement** cet utilisateur
- Les totaux sont pour cet utilisateur (pas système)

**Exemple** :
```
Matrice Provider × Opération (7 derniers jours) [Filtré par utilisateur]
Coût total : 12.34 USD (39.49 TND)
```

---

### 5️⃣ Bouton "Effacer filtre"

**Apparence** :
- Bouton avec icône ✕ "Effacer filtre"
- Visible uniquement quand un filtre est actif
- Positionné à droite du UserSelector

**Action** :
- Click → Retour à la vue système
- TopUsersTable réapparaît
- Badges "Filtré" disparaissent
- URL redevient : `?days=7`

---

## 📖 Cas d'Usage

### Cas 1 : Identifier les Power Users

**Objectif** : Trouver les 10 utilisateurs les plus actifs

**Étapes** :
1. Accédez au dashboard
2. Regardez la **TopUsersTable**
3. Les 10 premières lignes = top 10 consommateurs
4. Note les médailles 🥇🥈🥉 pour le podium

**Analyse** :
- Comparez les plans (Free/Pro/Enterprise)
- Vérifiez si la consommation correspond au plan
- Identifiez les anomalies (Free avec grosse conso)

**Action** :
- Upgrade recommandé si Free user lourd
- Féliciter les power users
- Analyser leurs patterns d'utilisation

---

### Cas 2 : Analyser un Utilisateur Spécifique

**Objectif** : Comprendre comment Ahmed utilise l'IA

**Étapes** :
1. Click sur la ligne "Ahmed Ben Ali" dans la table
2. **OU** Sélectionnez-le dans le dropdown
3. Observez les 4 graphiques mis à jour

**Questions à poser** :

**Graphique 1 - Matrice** :
- Quel provider Ahmed utilise le plus ? (regarder colonne totaux)
- Quelle opération coûte le plus cher ? (regarder ligne totaux)
- Combinaison dominante ? (cellule la plus rouge)

**Graphique 2 - Tendances** :
- La consommation augmente ou diminue ?
- Y a-t-il des pics ? (dates spécifiques)
- Régulier ou sporadique ?

**Graphique 3 - Distribution** :
- Quelle feature Ahmed utilise le plus ?
- Est-ce équilibré ou concentré ?
- Correspond au use case métier ?

**Graphique 4 - Coûts détaillés** :
- Quel provider coûte le plus cher à Ahmed ?
- Répartition par opération ?
- Opportunité d'optimisation ?

**Conclusion** :
- Ahmed = Heavy user de Gemini pour Embeddings
- Consommation stable (~50 requêtes/jour)
- Opportunité : Tester DeepSeek (moins cher) pour Embeddings

---

### Cas 3 : Comparer Deux Utilisateurs

**Objectif** : Comparer Ahmed (Pro) vs Fatima (Free)

**Méthode** :

**Étape 1 - Analyser Ahmed** :
1. Filtrer par Ahmed
2. Noter les métriques :
   - Opérations : 1,234
   - Tokens : 567K
   - Coût : 45.67 TND
   - Top provider : Gemini
   - Top opération : Chat

**Étape 2 - Analyser Fatima** :
1. Effacer filtre
2. Filtrer par Fatima
3. Noter les métriques :
   - Opérations : 89
   - Tokens : 12K
   - Coût : 2.34 TND
   - Top provider : Ollama (gratuit)
   - Top opération : Chat

**Comparaison** :

| Métrique | Ahmed (Pro) | Fatima (Free) | Ratio |
|----------|-------------|---------------|-------|
| Opérations | 1,234 | 89 | 13.9x |
| Tokens | 567K | 12K | 47.3x |
| Coût | 45.67 TND | 2.34 TND | 19.5x |
| Coût/op | 0.037 TND | 0.026 TND | 1.4x |

**Insights** :
- Ahmed consomme 14x plus que Fatima (normal Pro vs Free)
- Mais coût par opération 1.4x plus élevé (utilise Gemini vs Ollama)
- Fatima utilise bien le plan Free (Ollama)
- Ahmed pourrait optimiser en utilisant DeepSeek

---

### Cas 4 : Détecter une Anomalie

**Objectif** : Un utilisateur Free consomme trop

**Alerte** :
- TopUsersTable montre un user Free dans le top 10
- Exemple : "Mohamed Hassan" - Free - 789 ops - 23.45 TND

**Investigation** :
1. Click sur la ligne Mohamed
2. **Graphique Tendances** : pic soudain hier
3. **Graphique Distribution** : 90% Extraction
4. **Matrice** : Gemini + Extraction = 95% du coût

**Hypothèses** :
- A. Utilisateur a découvert la feature Extraction et l'utilise intensément
- B. Script automatisé qui fait de l'extraction en boucle
- C. Test/bug qui génère des requêtes en masse

**Actions** :
1. Contacter Mohamed pour comprendre
2. Vérifier les logs applicatifs pour patterns suspects
3. Si légitime : proposer upgrade vers Pro
4. Si bug/abus : limiter temporairement + corriger

---

### Cas 5 : Optimiser le Budget Global

**Objectif** : Réduire les coûts IA de 20%

**Analyse Système** (vue "Tous les utilisateurs") :

**Étape 1 - Identifier les leviers** :
1. **Graphique Distribution** : Quelle opération coûte le plus ?
   - Exemple : Embedding = 60% du budget
2. **Graphique Coûts détaillés** : Quel provider coûte le plus ?
   - Exemple : Gemini = 70% du coût total
3. **Matrice** : Quelle combinaison dominer ?
   - Exemple : Gemini × Embedding = 45% du budget total

**Étape 2 - Filtrer les top users** :
Pour chaque top 10 user :
1. Analyser leur provider préféré
2. Vérifier si DeepSeek/Ollama pourrait remplacer
3. Calculer économies potentielles

**Étape 3 - Plan d'action** :

**Quick wins (0-1 semaine)** :
- Migrer Embeddings vers Ollama local (0€)
- Économie : ~40% du budget Embedding
- Impact utilisateur : Minimal (qualité similaire)

**Moyen terme (1-4 semaines)** :
- Proposer DeepSeek pour Chat (10x moins cher que Gemini)
- Pilote avec top 5 users
- Économie : ~30% du budget Chat

**Long terme (1-3 mois)** :
- Implémenter quotas par plan
- Free : Ollama uniquement
- Pro : DeepSeek par défaut, Gemini sur demande
- Enterprise : Tous providers disponibles

**Projection** :
- Budget actuel : 200 TND/mois
- Après optimisation : 160 TND/mois
- Économie : 40 TND/mois = 480 TND/an

---

### Cas 6 : Valider la Tarification

**Objectif** : Les plans Free/Pro/Enterprise sont-ils bien calibrés ?

**Analyse** :

**Free users** :
1. Filtrer TopUsersTable par plan Free (mentalement ou via export)
2. Coût moyen par Free user : X TND/mois
3. Quota prévu : Y opérations/mois
4. **Question** : Free users dépassent-ils le quota ?

**Pro users** :
1. Coût moyen par Pro user : X TND/mois
2. Prix plan Pro : Y TND/mois
3. **Calcul ROI** : Revenu - Coût IA = Marge
4. **Question** : Marge suffisante ? (target: >70%)

**Enterprise users** :
1. Coût moyen : X TND/mois
2. Prix plan : Y TND/mois (négocié)
3. **Question** : Rentable ? Valeur ajoutée ?

**Décisions** :

Si **Free coûte trop** :
- Réduire quotas Free
- Limiter à Ollama uniquement
- Encourager upgrade vers Pro

Si **Pro marge faible** :
- Augmenter prix (+10-20%)
- Optimiser coûts IA (voir Cas 5)
- Ajouter features à valeur

Si **Enterprise non rentable** :
- Renégocier contrat
- Facturer au-delà d'un seuil
- Optimiser leur usage

---

## 🎓 Conseils et Bonnes Pratiques

### ✅ Do's (À Faire)

1. **Consulter régulièrement** (hebdo)
   - Suivre l'évolution des top users
   - Détecter les anomalies tôt

2. **Analyser par période**
   - Comparer 7j vs 30j
   - Identifier tendances saisonnières

3. **Documenter les insights**
   - Noter les patterns découverts
   - Partager avec l'équipe produit

4. **Partager les vues filtrées**
   - URL avec `?userId=xxx` partageables
   - Utile pour discussions équipe

5. **Corréler avec events business**
   - Pic de conso = campagne marketing ?
   - Baisse = bug produit ?

### ❌ Don'ts (À Éviter)

1. **Ne pas filtrer sans contexte**
   - Comprendre le use case de l'utilisateur
   - Ne pas juger sur les métriques seules

2. **Ne pas limiter brutalement**
   - Contacter l'user avant de bloquer
   - Expliquer et proposer alternatives

3. **Ne pas ignorer les Free heavy users**
   - Opportunité de conversion Pro
   - Ou détection d'abus à corriger

4. **Ne pas comparer pommes et oranges**
   - Free vs Pro vs Enterprise = use cases différents
   - Normaliser par plan avant de comparer

5. **Ne pas décider sans données long terme**
   - 7j peut être anormal (pic temporaire)
   - Valider sur 30j minimum

---

## 🆘 FAQ (Questions Fréquentes)

### Q1 : Pourquoi certains utilisateurs n'apparaissent pas dans la TopUsersTable ?

**R** : La table affiche uniquement les **50 meilleurs consommateurs**. Si un utilisateur n'apparaît pas :
- Sa consommation est faible (hors top 50)
- Utilisez le **UserSelector** pour le trouver (liste complète)
- Tous les utilisateurs actifs sont dans le dropdown

### Q2 : Les coûts sont en USD ou TND ?

**R** : Les deux sont affichés :
- **USD** : Coût réel facturé par les providers
- **TND** : Conversion automatique (ratio ~3.2)
- Exemple : `12.34 USD` = `39.49 TND`

### Q3 : Que signifie "Top Provider" dans la table ?

**R** : Le provider (Gemini, DeepSeek, etc.) qui a généré le **coût le plus élevé** pour cet utilisateur sur la période.

Exemple :
- User a utilisé Gemini (10 TND) + DeepSeek (2 TND)
- Top Provider = Gemini (badge affiché)

### Q4 : Puis-je exporter les données ?

**R** : Pas encore implémenté. Roadmap v1.6.0 inclut export CSV/Excel.

En attendant, vous pouvez :
- Faire des screenshots
- Copier-coller depuis la table (sélection texte)
- Utiliser les APIs directement (`/api/admin/user-consumption-summary`)

### Q5 : Les médailles changent chaque jour ?

**R** : Oui, le classement est dynamique :
- Recalculé à chaque visite
- Basé sur la période sélectionnée (7j ou 30j)
- Le #1 aujourd'hui peut être #3 demain

### Q6 : Pourquoi un graphique est vide après filtrage ?

**R** : L'utilisateur sélectionné n'a **aucune donnée** pour ce graphique sur la période.

Exemples :
- Graphique "Tendances" vide = User n'a rien utilisé ces 7 derniers jours
- Graphique "Distribution" vide = Aucune opération enregistrée

**Solution** : Changez la période (7j → 30j) pour plus de données.

### Q7 : La page est lente à charger

**R** : Plusieurs raisons possibles :
1. **Cache froid** : Première visite = données non cached (5s)
2. **Période longue** : 30j = plus de données que 7j
3. **Nombreux users** : Top 50 = requête lourde

**Optimisations appliquées** :
- Cache API 5 minutes
- Index DB optimisés
- Response time cible : <500ms

Si toujours lent : signaler au support technique.

### Q8 : Puis-je filtrer par plusieurs utilisateurs ?

**R** : Non, filtre **mono-utilisateur** uniquement.

Pour comparer plusieurs users :
1. Filtrer User A, noter les métriques
2. Effacer filtre
3. Filtrer User B, noter les métriques
4. Comparer manuellement

Roadmap v1.6.0 : Comparaison multi-utilisateurs native.

### Q9 : Les données sont-elles temps réel ?

**R** : Quasi temps réel avec latence minime :
- **Ingestion** : Logs IA écrits immédiatement après chaque requête
- **Cache API** : 5 minutes (refresh auto toutes les 5min)
- **Affichage** : Instantané après refresh

**Latence totale** : 0-5 minutes maximum

### Q10 : Que faire si je détecte un abus ?

**Procédure recommandée** :
1. **Documenter** : Screenshots, métriques, période
2. **Analyser** : Patterns, timing, opérations
3. **Contacter** : Email ou appel à l'utilisateur
4. **Comprendre** : Bug ? Use case légitime ? Malveillance ?
5. **Agir** :
   - Légitime → Upgrade plan
   - Bug → Corriger + rembourser
   - Abus → Warning puis suspension

**Ne jamais bloquer sans contact préalable**.

---

## 🔗 Ressources Complémentaires

### Documentation Technique
- [Architecture détaillée](./USER_CONSUMPTION_TRACKING_IMPLEMENTATION.md)
- [Guide développeur](./USER_CONSUMPTION_TRACKING_IMPLEMENTATION.md#pour-les-développeurs)
- [Release notes](./releases/RELEASE_v1.5.0_USER_TRACKING.md)

### Support
- **Email** : salmen.ktata@gmail.com
- **GitHub Issues** : https://github.com/salmenktata/MonCabinet/issues

### Vidéos (à venir)
- [ ] Tutorial vidéo 5min "Dashboard User Tracking"
- [ ] Webinar "Optimiser vos coûts IA"
- [ ] Cas pratiques réels

---

## 📞 Besoin d'Aide ?

Si ce guide ne répond pas à vos questions :

1. **Recherchez** dans ce document (Ctrl+F)
2. **Consultez** la [FAQ](#faq-questions-fréquentes)
3. **Contactez** le support : salmen.ktata@gmail.com

**Feedback bienvenu** : Ce guide peut être amélioré grâce à vos retours !

---

**Version du guide** : 1.0
**Dernière mise à jour** : 9 février 2026
**Auteur** : Claude Sonnet 4.5
**Validé par** : Salmen KTATA

---

*Merci d'utiliser le Dashboard de Suivi de Consommation IA !* 🚀
