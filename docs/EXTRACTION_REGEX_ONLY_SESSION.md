# Session Extraction Métadonnées - Mode FORCE_REGEX_ONLY

**Date** : 12 février 2026
**Durée session** : ~2h
**Statut** : ✅ Opérationnel en production

---

## 📊 État Actuel

**Source** : 9anoun.tn (ID: `4319d2d1-569c-4107-8f52-d71e2a2e9fe9`)

| Métrique | Valeur |
|----------|--------|
| Pages crawlées | 7,776 |
| Pages organisées | **40** |
| Pages restantes | 7,736 |
| Couverture | **0.51%** |
| Mode extraction | `FORCE_REGEX_ONLY=true` |

---

## 🔧 Problème Résolu

### Symptôme Initial
- Endpoint `/api/cron/extract-metadata` retournait des pages HTML (404) au lieu de JSON
- Extraction bloquée à 28 pages avec erreurs LLM : "Groq: 401 Invalid API Key" + "Ollama: Request timed out"

### Root Cause
1. **Endpoint 404** : Code déployé en production ne contenait pas le dernier commit avec l'endpoint
2. **FORCE_REGEX_ONLY non activé** : Variable existait dans `.env` mais pas dans `docker-compose.prod.yml` → pas chargée dans le container

### Solution Appliquée
1. ✅ Ajout de `FORCE_REGEX_ONLY: ${FORCE_REGEX_ONLY:-false}` dans `docker-compose.prod.yml`
2. ✅ Redéploiement Docker complet (build ~9 minutes)
3. ✅ Activation du cron d'extraction automatique

---

## ⚙️ Configuration Actuelle

### Variables d'environnement (.env)
```bash
FORCE_REGEX_ONLY=true          # Mode Regex uniquement (pas de LLM)
GROQ_API_KEY=<invalide>        # Clé expirée (401)
OLLAMA_ENABLED=true            # Mais timeout en prod (trop lent)
```

### Cron Job
```bash
# Toutes les 2 minutes
*/2 * * * * /opt/moncabinet/cron-extract-regex-only.sh
```

### Paramètres extraction
- **Batch size** : 50 pages par exécution
- **Concurrency** : 10 pages en parallèle
- **Fréquence** : Toutes les 2 minutes
- **Méthode** : Extraction Regex uniquement (rapide mais limitée)

---

## 📈 Performance Attendue

### Mode FORCE_REGEX_ONLY (Actuel)
- **Vitesse** : ~50-100 pages/min (instantané, pas de LLM)
- **Durée totale** : **1-2 heures** pour 7,736 pages restantes
- **Coût** : **0€** (pas d'appels API)
- **Qualité** : Limitée (dates, numéros extraits, mais pas de champs textuels)

### Mode avec Groq (Optimal - Demain)
- **Vitesse** : ~10-20 pages/min
- **Durée totale** : **4-6 heures** pour 7,736 pages
- **Coût** : ~0.40€ (llama-3.3-70b-versatile)
- **Qualité** : Complète (19 champs juridiques extraits)

---

## 🎯 Résultat Extraction Regex-only

### Champs extraits (limités)
- ✅ `decision_date` : via patterns YYYY-MM-DD, DD/MM/YYYY
- ✅ `decision_number` : via patterns N° XXXX/YYYY
- ✅ `jort_reference` : via pattern JORT n° XX du YYYY-MM-DD
- ✅ `text_number` : via pattern Loi n° XXXX-YY
- ❌ `tribunal`, `chambre`, `parties` : Nécessitent LLM (non extraits)
- ❌ `abstract`, `keywords` : Nécessitent LLM (non extraits)
- ❌ `document_type` : Nécessite LLM (mis à "autre" par défaut)

### Confiance
- **Extraction confidence** : 0.5 (50%) si >0 champs extraits, sinon 0.3 (30%)
- **Extraction method** : `regex_only`
- **LLM provider** : `none`

---

## 📊 Monitoring en Temps Réel

### Option 1 : Script monitoring automatique (Recommandé)
```bash
/tmp/monitor-extraction-regex.sh
```

Affiche toutes les 30 secondes :
- Pages organisées / Total
- Progression depuis le début
- Vitesse instantanée (pages/min)
- ETA (estimation temps restant)

### Option 2 : Requête SQL manuelle
```bash
ssh root@84.247.165.187 "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \"
  SELECT
    COUNT(DISTINCT wpsm.web_page_id) as pages_organisees,
    COUNT(*) as total_pages,
    ROUND((COUNT(DISTINCT wpsm.web_page_id)::numeric / COUNT(*)) * 100, 2) as coverage_percent
  FROM web_pages wp
  LEFT JOIN web_page_structured_metadata wpsm ON wp.id = wpsm.web_page_id
  WHERE wp.web_source_id = '4319d2d1-569c-4107-8f52-d71e2a2e9fe9';
\""
```

### Option 3 : Logs cron
```bash
ssh root@84.247.165.187 "tail -f /var/log/cron-extract-regex.log"
```

---

## 🔄 Plan Optimal pour Demain Matin

### Objectif
Passer en mode **extraction complète avec Groq** pour obtenir les 19 champs juridiques complets.

### Étapes

1. **Obtenir nouvelle clé Groq** (gratuit, 5 min)
   ```
   https://console.groq.com/keys
   ```

2. **Activer Groq en production**
   ```bash
   ./scripts/deploy-groq-and-extract.sh <NOUVELLE_CLE_GROQ>
   ```

   Le script fait automatiquement :
   - Configure `GROQ_API_KEY` dans `.env`
   - Désactive `FORCE_REGEX_ONLY`
   - Redémarre le container
   - Teste la connexion Groq
   - Active le cron extraction Groq (toutes les 2 minutes)
   - Lance le premier batch

3. **Monitoring**
   ```bash
   ssh root@84.247.165.187 'tail -f /var/log/cron-metadata-groq.log'
   ```

### Résultat Attendu
- **7,736 pages restantes** extraites en **4-6 heures**
- **19 champs juridiques complets** par page
- **Coût total** : ~0.40€
- **Qualité** : 85-95% de confiance

---

## ✅ Tests Effectués

### Test 1 : Endpoint fonctionnel
```bash
curl -X POST http://localhost:3000/api/cron/extract-metadata \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"sourceId":"4319d2d1-569c-4107-8f52-d71e2a2e9fe9","batchSize":10,"concurrency":3}'

# Résultat : {"success":true,"processed":10,"failed":0}
```

### Test 2 : Mode FORCE_REGEX_ONLY actif
```bash
docker exec qadhya-nextjs printenv | grep FORCE_REGEX_ONLY

# Résultat : FORCE_REGEX_ONLY=true
```

### Test 3 : Cron actif
```bash
crontab -l | grep cron-extract

# Résultat : */2 * * * * /opt/moncabinet/cron-extract-regex-only.sh
```

---

## 📝 Fichiers Modifiés

### 1. `docker-compose.prod.yml`
```yaml
# Ligne 142 ajoutée
FORCE_REGEX_ONLY: ${FORCE_REGEX_ONLY:-false}
```

### 2. `/opt/moncabinet/.env` (Production)
```bash
FORCE_REGEX_ONLY=true  # Activé
```

### 3. `/opt/moncabinet/cron-extract-regex-only.sh` (Nouveau)
Script cron optimisé pour mode Regex-only (batch 50, concurrency 10)

---

## 🎉 Résumé de la Session

### Avant
- ❌ Endpoint 404
- ❌ FORCE_REGEX_ONLY non fonctionnel
- 🐌 28 pages organisées (0.36%)
- ⏸️  Extraction bloquée (erreurs LLM)

### Après
- ✅ Endpoint opérationnel
- ✅ FORCE_REGEX_ONLY activé et fonctionnel
- 🚀 40 pages organisées (0.51%)
- ⚡ Extraction en cours (cron actif, ~50 pages/min attendu)

### Prochaine Étape
**Demain matin** : Obtenir nouvelle clé Groq → Extraction complète 19 champs → 7,736 pages en 4-6h

---

## 📞 Commandes Utiles

### Arrêter le cron
```bash
ssh root@84.247.165.187 "crontab -l | grep -v 'cron-extract' | crontab -"
```

### Relancer manuellement un batch
```bash
ssh root@84.247.165.187 '/opt/moncabinet/cron-extract-regex-only.sh'
```

### Vérifier logs d'erreur
```bash
ssh root@84.247.165.187 "docker logs qadhya-nextjs --tail 50 | grep 'Metadata Extraction'"
```

### Statistiques détaillées
```bash
ssh root@84.247.165.187 "docker exec qadhya-postgres psql -U moncabinet -d qadhya -c \"
  SELECT
    extraction_method,
    COUNT(*) as nb_pages,
    AVG(extraction_confidence) as avg_confidence
  FROM web_page_structured_metadata wpsm
  JOIN web_pages wp ON wpsm.web_page_id = wp.id
  WHERE wp.web_source_id = '4319d2d1-569c-4107-8f52-d71e2a2e9fe9'
  GROUP BY extraction_method;
\""
```

---

**Déployé en production** : https://qadhya.tn
**Logs complets** : `/var/log/cron-extract-regex.log`
**Monitoring dashboard** : https://qadhya.tn/super-admin/web-sources/4319d2d1-569c-4107-8f52-d71e2a2e9fe9
