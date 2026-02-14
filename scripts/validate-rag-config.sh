#!/bin/bash

#======================================================================
# Script de Validation Configuration RAG
#======================================================================
# Vérifie la cohérence de la configuration RAG avant déploiement
#
# Usage:
#   bash scripts/validate-rag-config.sh [fichier_env]
#
# Exemples:
#   bash scripts/validate-rag-config.sh .env.production
#   bash scripts/validate-rag-config.sh /opt/moncabinet/.env
#
# Exit Codes:
#   0 - Configuration valide
#   1 - Configuration invalide (bloque le déploiement)
#======================================================================

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fichier à valider (défaut: .env.production)
ENV_FILE="${1:-.env.production}"

echo -e "${GREEN}🔍 Validation Configuration RAG${NC}"
echo "Fichier: $ENV_FILE"
echo "========================================"

# Vérifier que le fichier existe
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗${NC} Fichier introuvable: $ENV_FILE"
    exit 1
fi

# Fonction pour extraire valeur d'une variable
get_env_value() {
    local var_name="$1"
    local file="$2"
    grep "^${var_name}=" "$file" 2>/dev/null | cut -d= -f2- | tr -d '"' || echo ""
}

# Charger variables
RAG_ENABLED=$(get_env_value "RAG_ENABLED" "$ENV_FILE")
OLLAMA_ENABLED=$(get_env_value "OLLAMA_ENABLED" "$ENV_FILE")
OPENAI_API_KEY=$(get_env_value "OPENAI_API_KEY" "$ENV_FILE")
OLLAMA_BASE_URL=$(get_env_value "OLLAMA_BASE_URL" "$ENV_FILE")

# Afficher configuration détectée
echo ""
echo "Configuration détectée:"
echo "  RAG_ENABLED       = ${RAG_ENABLED:-<non défini>}"
echo "  OLLAMA_ENABLED    = ${OLLAMA_ENABLED:-<non défini>}"
echo "  OPENAI_API_KEY    = ${OPENAI_API_KEY:+SET (${#OPENAI_API_KEY} chars)}"
echo "  OLLAMA_BASE_URL   = ${OLLAMA_BASE_URL:-<non défini>}"
echo ""

# Compteur d'erreurs
ERRORS=0
WARNINGS=0

# ========================================
# VALIDATIONS CRITIQUES
# ========================================

# Validation 1: Si RAG activé, au moins un provider embeddings requis
if [ "$RAG_ENABLED" = "true" ]; then
    echo -e "${GREEN}✓${NC} RAG activé"

    # Vérifier qu'au moins un provider embeddings est disponible
    HAS_OLLAMA=false
    HAS_OPENAI=false

    if [ "$OLLAMA_ENABLED" = "true" ]; then
        HAS_OLLAMA=true
        echo -e "${GREEN}✓${NC} Ollama activé (embeddings locaux gratuits)"
    fi

    if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "sk-proj-..." ]; then
        HAS_OPENAI=true
        echo -e "${GREEN}✓${NC} OpenAI configuré (embeddings cloud)"
    fi

    # Au moins un provider requis
    if [ "$HAS_OLLAMA" = false ] && [ "$HAS_OPENAI" = false ]; then
        echo -e "${RED}✗ ERREUR CRITIQUE${NC}: RAG activé mais aucun provider embeddings disponible"
        echo ""
        echo "  Solutions possibles:"
        echo "    1. Activer Ollama (gratuit, local):"
        echo "       OLLAMA_ENABLED=true"
        echo ""
        echo "    2. Configurer OpenAI (payant, cloud):"
        echo "       OPENAI_API_KEY=sk-proj-..."
        echo ""
        echo "  Impact si non corrigé:"
        echo "    - Assistant IA non-fonctionnel"
        echo "    - Recherche KB retourne toujours []"
        echo "    - Message utilisateur: 'لم أجد وثائق ذات صلة'"
        echo ""
        ((ERRORS++))
    fi

    # Vérifier OLLAMA_BASE_URL si Ollama activé
    if [ "$HAS_OLLAMA" = true ]; then
        if [ -z "$OLLAMA_BASE_URL" ]; then
            echo -e "${YELLOW}⚠${NC} OLLAMA_BASE_URL non défini (utilise défaut: http://localhost:11434)"
            ((WARNINGS++))
        elif [[ "$OLLAMA_BASE_URL" != *"host.docker.internal"* ]] && [[ "$OLLAMA_BASE_URL" != *"172."* ]]; then
            echo -e "${YELLOW}⚠${NC} OLLAMA_BASE_URL utilise localhost (peut échouer dans Docker)"
            echo "   Recommandé: http://host.docker.internal:11434 (depuis container)"
            ((WARNINGS++))
        fi
    fi

else
    echo -e "${YELLOW}⚠${NC} RAG désactivé (recherche sémantique non disponible)"
    echo "   Recommandation: Activer RAG_ENABLED=true pour utiliser la KB"
    ((WARNINGS++))
fi

# Validation 2: Vérifier cohérence OLLAMA_ENABLED vs OLLAMA_BASE_URL
if [ "$OLLAMA_ENABLED" = "true" ] && [ -z "$OLLAMA_BASE_URL" ]; then
    echo -e "${YELLOW}⚠${NC} OLLAMA_ENABLED=true mais OLLAMA_BASE_URL non défini"
    echo "   Utilisera valeur par défaut: http://localhost:11434"
    ((WARNINGS++))
fi

# Validation 3: Détection configuration localhost problématique
if [ -n "$OLLAMA_BASE_URL" ] && [[ "$OLLAMA_BASE_URL" == "http://localhost:"* ]]; then
    echo -e "${YELLOW}⚠${NC} OLLAMA_BASE_URL utilise 'localhost' (problématique dans Docker)"
    echo "   Contexte Docker: 'localhost' pointe vers le container, pas l'hôte"
    echo "   Solution: Utiliser 'http://host.docker.internal:11434'"
    ((WARNINGS++))
fi

# ========================================
# RAPPORT FINAL
# ========================================

echo ""
echo "========================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Configuration RAG valide${NC}"

    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS avertissement(s) détecté(s)${NC}"
        echo "   (Non-bloquants mais recommandés de corriger)"
    fi

    exit 0
else
    echo -e "${RED}❌ Configuration RAG invalide${NC}"
    echo -e "${RED}$ERRORS erreur(s) critique(s) détectée(s)${NC}"

    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}$WARNINGS avertissement(s) supplémentaire(s)${NC}"
    fi

    echo ""
    echo "🚨 DÉPLOIEMENT BLOQUÉ"
    echo "   Veuillez corriger les erreurs ci-dessus avant de continuer."
    echo ""

    exit 1
fi
