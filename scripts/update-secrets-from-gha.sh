#!/bin/bash
# ============================================================================
# UPDATE SECRETS FROM GITHUB ACTIONS
# ============================================================================
# Script helper pour mettre à jour secrets .env depuis GitHub Actions
# Centralise les 10+ lignes sed dispersées dans workflow
#
# Usage:
#   bash scripts/update-secrets-from-gha.sh <ENV_FILE>
#
# Variables d'environnement requises (depuis GitHub Secrets):
#   - RESEND_API_KEY
#   - GROQ_API_KEY
#   - GOOGLE_API_KEY
#   - DEEPSEEK_API_KEY
#   - OPENAI_API_KEY
#   - ANTHROPIC_API_KEY
#   - BREVO_API_KEY
#   - CRON_SECRET
#
# Exemple:
#   export RESEND_API_KEY="re_xxx"
#   export GROQ_API_KEY="gsk_xxx"
#   bash scripts/update-secrets-from-gha.sh .env.production
#
# ============================================================================

set -euo pipefail

# ----------------------------------------------------------------------------
# Arguments
# ----------------------------------------------------------------------------

ENV_FILE="${1:-.env.production}"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Fichier environnement introuvable: $ENV_FILE"
    exit 1
fi

echo "ℹ️  Mise à jour secrets dans: $ENV_FILE"

# ----------------------------------------------------------------------------
# Secrets à mettre à jour
# ----------------------------------------------------------------------------

# Tableau associatif: VAR_NAME:ENV_VAR_NAME
declare -A SECRETS=(
    ["RESEND_API_KEY"]="${RESEND_API_KEY:-}"
    ["GROQ_API_KEY"]="${GROQ_API_KEY:-}"
    ["GOOGLE_API_KEY"]="${GOOGLE_API_KEY:-}"
    ["DEEPSEEK_API_KEY"]="${DEEPSEEK_API_KEY:-}"
    ["OPENAI_API_KEY"]="${OPENAI_API_KEY:-}"
    ["ANTHROPIC_API_KEY"]="${ANTHROPIC_API_KEY:-}"
    ["BREVO_API_KEY"]="${BREVO_API_KEY:-}"
    ["CRON_SECRET"]="${CRON_SECRET:-}"
)

# ----------------------------------------------------------------------------
# Update Secrets
# ----------------------------------------------------------------------------

UPDATED_COUNT=0
SKIPPED_COUNT=0

for secret_name in "${!SECRETS[@]}"; do
    secret_value="${SECRETS[$secret_name]}"

    if [ -n "$secret_value" ]; then
        # Remplacer secret dans fichier (sed -i compatible macOS + Linux)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^${secret_name}=.*|${secret_name}=${secret_value}|" "$ENV_FILE"
        else
            # Linux
            sed -i "s|^${secret_name}=.*|${secret_name}=${secret_value}|" "$ENV_FILE"
        fi

        echo "  ✅ $secret_name mis à jour"
        UPDATED_COUNT=$((UPDATED_COUNT + 1))
    else
        echo "  ⚠️  $secret_name ignoré (non défini)"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    fi
done

# ----------------------------------------------------------------------------
# Rapport
# ----------------------------------------------------------------------------

echo ""
echo "📊 Résumé:"
echo "  - Secrets mis à jour: $UPDATED_COUNT"
echo "  - Secrets ignorés: $SKIPPED_COUNT"
echo ""

if [ $UPDATED_COUNT -gt 0 ]; then
    echo "✅ Secrets mis à jour avec succès"
    exit 0
else
    echo "⚠️  Aucun secret mis à jour"
    exit 0
fi
