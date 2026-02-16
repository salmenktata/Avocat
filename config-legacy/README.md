# Configuration Legacy - Archives

Ce dossier contient les anciens fichiers de configuration archivés lors de la simplification globale du système de déploiement (Feb 2026).

## Fichiers archivés

### `docker-compose.prod.yml` (Obsolète)
- **Raison** : Fusionné dans `docker-compose.yml` unifié
- **Remplacement** : `docker-compose.yml` (config production par défaut)
- **Dev local** : Utiliser `docker-compose.override.yml.example`

### `.env.production.example` (Obsolète)
- **Raison** : Dupliqué par `.env.template` unifié
- **Remplacement** : `.env.template` (source unique de vérité)
- **Différence** : Template unifié avec variables auto-adaptatives

## Migration vers nouveau système

### Ancienne architecture (3 fichiers)
```
.env.production.template  → Production
.env.production.example   → Documentation/Exemple
docker-compose.prod.yml   → Production Docker
```

### Nouvelle architecture (2 fichiers)
```
.env.template                         → Source unique vérité
docker-compose.yml                    → Config unifiée (prod par défaut)
docker-compose.override.yml.example   → Dev local (optionnel)
```

## Avantages nouveau système

1. **Simplicité** : 3 fichiers → 2 fichiers (-33%)
2. **Auto-adaptatif** : Variables `${OLLAMA_CONTEXT}`, `${DB_CONTEXT}` détectées automatiquement
3. **Cohérence** : Plus de divergences dev/prod (seuils RAG, endpoints)
4. **Sécurité** : Secrets séparés (`.env.secrets`, validation pre-commit)
5. **Maintenance** : Une seule source à maintenir

## Ne PAS supprimer ces fichiers

Ces fichiers sont conservés comme référence historique et backup.
Ils pourraient être utiles pour :
- Comprendre l'ancienne configuration
- Rollback si nécessaire
- Migration progressive en production

---

**Date archivage** : 16 février 2026
**Commit** : Simplification globale - Phase 1 Configuration Unifiée
