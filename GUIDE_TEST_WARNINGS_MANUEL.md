# 🧪 Guide Test Manuel Warnings Production

**URL Production** : https://qadhya.tn
**Date** : 10 Février 2026

---

## ⚠️ Important : Authentification Requise

L'API `/api/chat` nécessite une authentification utilisateur (protection sécurité).

Les tests doivent être effectués via l'interface web **après connexion**.

---

## 🚀 Prérequis

1. ✅ Compte utilisateur sur https://qadhya.tn
2. ✅ Connexion active (session authentifiée)
3. ✅ Accès page `/chat-test` ou `/chat`

---

## 📋 4 Scénarios de Test

### Test 1 : Warning Abrogation CRITIQUE 🔴

**Objectif** : Vérifier détection loi abrogée avec warning rouge critique

**Étapes** :
1. Ouvrir https://qadhya.tn/chat-test (ou /chat)
2. Se connecter si nécessaire
3. Poser la question :
   ```
   Quelle est la procédure de faillite selon la Loi n°1968-07 ?
   ```
4. Attendre réponse LLM (~15-20s en mode rapide, ~10s en mode premium)

**Vérifications** :
- [ ] ✅ **Badge rouge 🔴** visible avec texte "CRITIQUE" ou "Loi abrogée"
- [ ] ✅ **Message warning** contient :
  - Mention "abrogée depuis 2016-05-15" ou "2016"
  - Référence loi abrogeante "Loi n°2016-36" ou "2016-36"
  - Texte "remplacée" ou "n'est plus en vigueur"
- [ ] ✅ **Détails complets** affichés :
  - Date abrogation : 2016-05-15
  - Scope : total (abrogation complète)
  - Loi abrogeante : Loi n°2016-36
- [ ] ✅ **Message bilingue** : Texte français visible (si langue détectée = FR)
- [ ] ✅ **Réponse LLM** générée normalement (pas de blocage)
- [ ] ✅ **Sources** retournées et affichées

**Résultat Attendu** :
```
[Réponse LLM avec contexte juridique faillite]

🔴 AVERTISSEMENT CRITIQUE - Loi abrogée

⚠️ AVERTISSEMENT CRITIQUE : Cette loi est abrogée depuis 2016-05-15

La Loi n°1968-07 du 8 mars 1968 relative à la faillite et au règlement judiciaire
a été remplacée par la Loi n°2016-36 du 29 avril 2016 relative au redressement
des entreprises en difficulté économique.

Le texte cité n'est plus en vigueur. Consultez la nouvelle législation.

📅 Date abrogation : 2016-05-15
📋 Scope : total (abrogation complète)
🔗 Nouvelle loi : Loi n°2016-36
```

**Capture d'écran** : Prendre screenshot si possible

---

### Test 2 : Warning Citation Non Vérifiée 📖

**Objectif** : Vérifier détection citation inventée/incorrecte

**Étapes** :
1. Sur la même page /chat-test
2. Poser la question :
   ```
   Quels sont les droits selon l'Article 999 du Code Civil tunisien ?
   ```
3. Attendre réponse

**Vérifications** :
- [ ] ✅ **Badge jaune 📖** visible avec texte "Citations non vérifiées"
- [ ] ✅ **Liste citations** affichée :
  - Contient "Article 999" ou "999"
  - Format liste à puces
- [ ] ✅ **Message advisory** présent :
  - "Veuillez vérifier ces références dans les textes officiels"
  - Mention "JORT" ou "legislation.tn"
- [ ] ✅ **Réponse LLM** générée (pas de blocage)
- [ ] ✅ **Collapse/expand** fonctionnel si >3 citations

**Note** : Si Article 999 existe dans la knowledge base, il n'y aura pas de warning.
Dans ce cas, tester avec "Article 9999" (clairement inexistant).

**Résultat Attendu** :
```
[Réponse LLM sur droits civils]

📖 Citations non vérifiées

Les citations suivantes n'ont pas pu être vérifiées dans nos sources :
• Article 999 Code Civil

⚠️ Ces citations n'ont pas été trouvées dans les documents indexés.

💡 Conseil : Veuillez vérifier ces références dans les textes officiels :
   • JORT : http://www.iort.gov.tn
   • Législation TN : http://www.legislation.tn
```

**Capture d'écran** : Prendre screenshot

---

### Test 3 : Détection Langue Arabe 🇹🇳

**Objectif** : Vérifier détection automatique langue arabe + warnings AR

**Étapes** :
1. Sur /chat-test
2. Poser la question **en arabe** :
   ```
   ما هي الإجراءات حسب القانون عدد 7 لسنة 1968 ؟
   ```
3. Attendre réponse

**Vérifications** :
- [ ] ✅ **Warning abrogation** affiché (même loi que Test 1)
- [ ] ✅ **Messages en arabe** :
  - Badge en arabe ou icône 🔴
  - Texte warning contient mots arabes : "تحذير" (warning), "ملغى" (abrogé), "القانون" (loi)
- [ ] ✅ **Détails bilingues** :
  - Référence loi en arabe "القانون عدد 7 لسنة 1968"
  - Message principal en arabe
- [ ] ✅ **Réponse LLM** en arabe ou bilingue
- [ ] ✅ **Direction RTL** correcte (texte de droite à gauche)

**Résultat Attendu** :
```
[Réponse LLM en arabe sur procédures]

🔴 تحذير هام - قانون ملغى

تحذير هام: هذا القانون ملغى منذ 2016-05-15

القانون عدد 7 لسنة 1968 المتعلق بالإفلاس والتسوية القضائية
عوّض بالقانون عدد 36 لسنة 2016 المتعلق بإنقاذ المؤسسات التي تمرّ بصعوبات اقتصادية.

النص المشار إليه لم يعد ساري المفعول. يرجى مراجعة التشريع الجديد.

📅 تاريخ الإلغاء : 2016-05-15
📋 النطاق : إلغاء كلي
🔗 القانون الجديد : القانون عدد 36 لسنة 2016
```

**Capture d'écran** : Prendre screenshot

---

### Test 4 : Pas de Warning (Loi en vigueur) ✅

**Objectif** : Vérifier absence de warning pour loi récente en vigueur

**Étapes** :
1. Sur /chat-test
2. Poser la question :
   ```
   Quels sont les principes de la Loi n°2016-36 sur le redressement des entreprises ?
   ```
3. Attendre réponse

**Vérifications** :
- [ ] ✅ **AUCUN warning abrogation** (badge rouge absent)
- [ ] ✅ **Réponse LLM** générée normalement
- [ ] ✅ **Sources** retournées et affichées
- [ ] ✅ **Contenu pertinent** sur Loi 2016-36 (entreprises en difficulté)
- [ ] ✅ **Pas d'erreur** ou de message "loi abrogée"

**Résultat Attendu** :
```
[Réponse LLM sur principes Loi 2016-36]

La Loi n°2016-36 du 29 avril 2016 relative au redressement des entreprises
en difficulté économique établit les principes suivants :
1. [Principe 1...]
2. [Principe 2...]
[etc.]

Sources :
• [Source-1] Loi n°2016-36...
• [KB-2] Procédure redressement...

[AUCUN warning - Loi en vigueur, pas de badge rouge]
```

**Note** : Absence de warning = **SUCCÈS** pour ce test

**Capture d'écran** : Prendre screenshot page normale sans warning

---

## 📊 Grille de Validation

| Test | Statut | Notes | Screenshot |
|------|--------|-------|------------|
| 1. Abrogation CRITIQUE 🔴 | ⬜ Pass / ⬜ Fail | | ⬜ Attaché |
| 2. Citation 📖 | ⬜ Pass / ⬜ Fail | | ⬜ Attaché |
| 3. Langue AR 🇹🇳 | ⬜ Pass / ⬜ Fail | | ⬜ Attaché |
| 4. Pas de warning ✅ | ⬜ Pass / ⬜ Fail | | ⬜ Attaché |

**Taux de Réussite** : ___/4 tests (___%)

---

## 🐛 Troubleshooting

### Problème 1 : Pas de warning malgré loi abrogée

**Causes possibles** :
1. ❌ Table `legal_abrogations` vide ou incorrecte
2. ❌ Variable env `ENABLE_ABROGATION_DETECTION=false`
3. ❌ Fonction `find_abrogations()` non appliquée
4. ❌ Service détection désactivé

**Solutions** :
```bash
# Vérifier données DB
ssh root@84.247.165.187
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c \
  "SELECT COUNT(*) FROM legal_abrogations;"
# Attendu : 16 (ou plus)

# Vérifier fonction find_abrogations
docker exec moncabinet-postgres psql -U moncabinet -d moncabinet -c \
  "SELECT * FROM find_abrogations('Loi n°1968-07', 0.6, 5);"
# Attendu : 1-2 résultats

# Vérifier logs
docker logs --tail 100 moncabinet-nextjs | grep "abrogation"
```

---

### Problème 2 : Badge warning non visible

**Causes possibles** :
1. ❌ Composant UI non déployé
2. ❌ CSS non chargé
3. ❌ data-testid manquants
4. ❌ Erreur JavaScript console

**Solutions** :
```bash
# 1. Ouvrir DevTools navigateur (F12)
# 2. Console : Vérifier erreurs JavaScript
# 3. Elements : Rechercher data-testid="abrogation-warning"
# 4. Network : Vérifier requête /api/chat retourne abrogationWarnings

# Si composant manquant → redeployer
cd /opt/moncabinet
docker-compose -f docker-compose.prod.yml restart nextjs
```

---

### Problème 3 : Messages pas en arabe

**Causes possibles** :
1. ❌ Détection langue incorrecte (seuil 20%)
2. ❌ Message AR manquant dans data
3. ❌ Fallback français par défaut

**Solutions** :
```javascript
// DevTools Console : Vérifier data warnings
// Chercher dans Response API :
{
  "abrogationWarnings": [
    {
      "messageAr": "تحذير هام...",  // Doit être présent
      "message": "AVERTISSEMENT..."
    }
  ]
}

// Si messageAr absent → vérifier seed data
SELECT abrogated_reference_ar FROM legal_abrogations WHERE id = '...';
```

---

### Problème 4 : Warning faux positif

**Symptôme** : Warning affiché pour loi en vigueur (Test 4 échoue)

**Causes possibles** :
1. ❌ Loi 2016-36 incorrectement marquée comme abrogée
2. ❌ Fuzzy matching trop permissif (seuil <0.6)
3. ❌ Données seed incorrectes

**Solutions** :
```sql
-- Vérifier que Loi 2016-36 N'EST PAS dans legal_abrogations
SELECT * FROM legal_abrogations
WHERE abrogated_reference ILIKE '%2016-36%';
-- Attendu : 0 rows (loi abrogeante, pas abrogée)

-- Vérifier seuil fuzzy matching
SELECT * FROM find_abrogations('Loi n°2016-36', 0.6, 5);
-- Attendu : 0 rows
```

---

## 📈 Monitoring Production

### Logs Real-Time

**Warnings Abrogations** :
```bash
ssh root@84.247.165.187
docker logs -f moncabinet-nextjs | grep "abrogation warnings detected"

# Format attendu :
# [RAG] ⚠️ 1 abrogation warnings detected
#   [1] HIGH: Loi n°1968-07
#       → Loi n°2016-36
```

**Warnings Citations** :
```bash
docker logs -f moncabinet-nextjs | grep "Citations non vérifiées"

# Format attendu :
# [RAG] Citations non vérifiées: [⚠️ Citations Non Vérifiées]
#   • Article 999 Code Civil
```

### Statistiques SQL

**Comptage Warnings** :
```sql
-- Abrogations par scope
SELECT scope, COUNT(*) as count
FROM legal_abrogations
GROUP BY scope
ORDER BY count DESC;

-- Abrogations récentes
SELECT
  abrogated_reference,
  abrogating_reference,
  abrogation_date
FROM legal_abrogations
ORDER BY abrogation_date DESC
LIMIT 10;
```

---

## ✅ Critères de Succès

### Tests Pass (3/4 minimum)

Pour valider Phase 2 en production, **minimum 3 tests sur 4** doivent passer.

**Acceptables** :
- ✅ Test 1 PASS + Test 3 PASS + Test 4 PASS (3/4) = **75% → OK**
- ✅ Test 1 PASS + Test 2 PASS + Test 4 PASS (3/4) = **75% → OK**

**Non acceptables** :
- ❌ Test 1 FAIL = **BLOQUANT** (détection abrogations critique)
- ❌ Test 4 FAIL = **BLOQUANT** (faux positifs systématiques)

### Qualité UI

- [ ] Warnings visibles et lisibles
- [ ] Couleurs correctes (rouge/jaune)
- [ ] Messages clairs et actionnables
- [ ] Accessibilité ARIA fonctionnelle
- [ ] Responsive mobile correct

### Performance

- [ ] Réponse LLM <30s (mode rapide)
- [ ] Réponse LLM <15s (mode premium)
- [ ] Overhead warnings <200ms (imperceptible)
- [ ] Pas de blocage interface

---

## 📞 Contact & Support

**Problème détecté ?**
1. Prendre screenshot(s)
2. Noter message d'erreur exact
3. Vérifier logs production (voir Troubleshooting)
4. Documenter dans issue GitHub

**Repository** : https://github.com/salmenktata/moncabinet
**Production** : https://qadhya.tn
**Health API** : https://qadhya.tn/api/health

---

## 📝 Rapport Final

Après tests, compléter ce rapport :

**Date** : _______________
**Testeur** : _______________
**Environnement** : Production (https://qadhya.tn)

### Résultats

| Test | Pass/Fail | Commentaires |
|------|-----------|--------------|
| 1. Abrogation 🔴 | ⬜ Pass / ⬜ Fail | |
| 2. Citation 📖 | ⬜ Pass / ⬜ Fail | |
| 3. Langue AR 🇹🇳 | ⬜ Pass / ⬜ Fail | |
| 4. Pas warning ✅ | ⬜ Pass / ⬜ Fail | |

**Taux Réussite** : ___/4 (___%)

**Décision** :
- ⬜ **Phase 2 validée** (≥3/4 tests pass, dont tests 1 et 4)
- ⬜ **Corrections requises** (≤2/4 tests pass)
- ⬜ **Rollback nécessaire** (tests 1 ou 4 fail)

**Observations** :
```
[Notes libres sur expérience utilisateur, bugs détectés, suggestions, etc.]
```

**Screenshots** : [Attachés / Non attachés]

---

**🧪 Guide Test Warnings Production - Phase 2**

_Document à compléter après tests manuels réels en production_

_Date création : 10 Février 2026_
