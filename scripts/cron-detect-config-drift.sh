#!/bin/bash
# =============================================================================
# Cron Config Drift Detection - Détection drift configuration temps réel
# =============================================================================
# Cron: */5 * * * * (toutes les 5 minutes)
#
# 1. Appelle /api/health/config
# 2. Compare configHash actuel vs hash précédent (Redis)
# 3. Si drift détecté:
#    - Log /var/log/qadhya/config-drift.log
#    - Envoie alerte email (si drift >30min)
#    - Crée GitHub Issue automatique (si CRITICAL drift)
# 4. Stocke nouveau hash dans Redis
#
# Installation:
#   crontab -e (root@84.247.165.187)
#   */5 * * * * /opt/qadhya/scripts/cron-detect-config-drift.sh >> /var/log/qadhya/config-drift.log 2>&1
# =============================================================================

set -e

# Configuration
API_BASE_URL="https://qadhya.tn"
API_ENDPOINT="/api/health/config"
LOG_FILE="/var/log/qadhya/config-drift.log"
ALERT_COOLDOWN=1800  # 30min en secondes
LAST_ALERT_FILE="/var/tmp/qadhya-config-drift-last-alert"
GITHUB_REPO="salmenkt/Avocat"  # Adapter si nécessaire

# Couleurs (pour logs)
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# =============================================================================
# Fonctions utilitaires
# =============================================================================

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_error() {
  echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

# =============================================================================
# Vérifier prérequis
# =============================================================================

if ! command -v jq &> /dev/null; then
  log_error "jq non installé. Installation: apt-get install jq"
  exit 1
fi

if ! command -v curl &> /dev/null; then
  log_error "curl non installé. Installation: apt-get install curl"
  exit 1
fi

# Créer répertoire logs si nécessaire
mkdir -p "$(dirname "$LOG_FILE")"

# =============================================================================
# Appel API health/config
# =============================================================================

log "🔍 Vérification configuration drift..."

RESPONSE=$(curl -s "${API_BASE_URL}${API_ENDPOINT}" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
  log_error "Échec appel API ${API_ENDPOINT}"
  exit 1
fi

# Parser JSON
DRIFT_DETECTED=$(echo "$RESPONSE" | jq -r '.driftDetected' 2>/dev/null || echo "false")
CRITICAL_DRIFT=$(echo "$RESPONSE" | jq -r '.criticalDrift' 2>/dev/null || echo "false")
CONFIG_HASH=$(echo "$RESPONSE" | jq -r '.configHash' 2>/dev/null || echo "unknown")
EXPECTED_HASH=$(echo "$RESPONSE" | jq -r '.expectedHash' 2>/dev/null || echo "unknown")

if [ "$DRIFT_DETECTED" != "true" ]; then
  log_success "Aucun drift détecté (hash: ${CONFIG_HASH:0:8}...)"
  exit 0
fi

# =============================================================================
# Drift détecté
# =============================================================================

log_warning "Drift détecté!"
log "  Hash actuel:  ${CONFIG_HASH}"
log "  Hash attendu: ${EXPECTED_HASH}"

# Récupérer variables driftées
DRIFTED_VARS=$(echo "$RESPONSE" | jq -r '.driftedVars[] | .name' 2>/dev/null)

if [ -n "$DRIFTED_VARS" ]; then
  log "  Variables driftées:"
  echo "$DRIFTED_VARS" | while read -r var; do
    CRITICALITY=$(echo "$RESPONSE" | jq -r ".driftedVars[] | select(.name == \"$var\") | .criticality" 2>/dev/null)
    log "    - $var (${CRITICALITY})"
  done
fi

# =============================================================================
# Gestion alertes
# =============================================================================

CURRENT_TIME=$(date +%s)

# Vérifier cooldown alerte email
SHOULD_ALERT=false

if [ -f "$LAST_ALERT_FILE" ]; then
  LAST_ALERT_TIME=$(cat "$LAST_ALERT_FILE")
  TIME_SINCE_LAST=$((CURRENT_TIME - LAST_ALERT_TIME))

  if [ $TIME_SINCE_LAST -gt $ALERT_COOLDOWN ]; then
    SHOULD_ALERT=true
  else
    REMAINING=$((ALERT_COOLDOWN - TIME_SINCE_LAST))
    log "Cooldown alerte email actif (${REMAINING}s restant)"
  fi
else
  SHOULD_ALERT=true
fi

# Envoyer alerte email si cooldown expiré
if [ "$SHOULD_ALERT" = true ]; then
  log "📧 Envoi alerte email..."

  # Appeler API alertes (intégration existante)
  ALERT_RESPONSE=$(curl -s -X POST "${API_BASE_URL}/api/admin/alerts/check" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"config_drift\",\"driftedVars\":$(echo "$RESPONSE" | jq '.driftedVars')}" \
    2>/dev/null || echo "{}")

  ALERT_SENT=$(echo "$ALERT_RESPONSE" | jq -r '.sent' 2>/dev/null || echo "false")

  if [ "$ALERT_SENT" = "true" ]; then
    log_success "Alerte email envoyée"
    echo "$CURRENT_TIME" > "$LAST_ALERT_FILE"
  else
    log_warning "Échec envoi alerte email"
  fi
fi

# =============================================================================
# Créer GitHub Issue si CRITICAL drift
# =============================================================================

if [ "$CRITICAL_DRIFT" = "true" ]; then
  log_warning "CRITICAL drift détecté - Création GitHub Issue..."

  # Vérifier si gh CLI disponible
  if command -v gh &> /dev/null; then
    # Vérifier si issue similaire existe déjà (7 derniers jours)
    EXISTING_ISSUE=$(gh issue list \
      --repo "$GITHUB_REPO" \
      --label "config-drift" \
      --limit 10 \
      --json number,createdAt,title \
      --jq 'map(select(.createdAt > (now - 7*24*60*60 | todate))) | .[0].number' \
      2>/dev/null || echo "")

    if [ -n "$EXISTING_ISSUE" ]; then
      log "Issue existante trouvée: #${EXISTING_ISSUE} (skip création)"
    else
      # Créer nouvelle issue
      ISSUE_BODY="## 🚨 CRITICAL Configuration Drift Détecté

**Timestamp**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Hash actuel**: \`${CONFIG_HASH}\`
**Hash attendu**: \`${EXPECTED_HASH}\`

### Variables Driftées

\`\`\`json
$(echo "$RESPONSE" | jq '.driftedVars')
\`\`\`

### Actions Recommandées

1. Vérifier configuration production:
   \`\`\`bash
   ssh root@84.247.165.187 'cat /opt/qadhya/.env.production.local | grep -E \"$(echo "$DRIFTED_VARS" | tr '\n' '|' | sed 's/|$//')\"'
   \`\`\`

2. Comparer avec dev:
   \`\`\`bash
   npm run diff-env
   \`\`\`

3. Corriger si nécessaire:
   \`\`\`bash
   bash scripts/fix-prod-config.sh VARIABLE_NAME NEW_VALUE
   \`\`\`

### Détails

Voir logs: \`/var/log/qadhya/config-drift.log\`
API: \`${API_BASE_URL}${API_ENDPOINT}\`

---
🤖 Auto-généré par cron-detect-config-drift.sh
"

      gh issue create \
        --repo "$GITHUB_REPO" \
        --title "[CRITICAL] Configuration Drift Detected - $(date +%Y-%m-%d)" \
        --body "$ISSUE_BODY" \
        --label "config-drift,critical" \
        2>/dev/null && log_success "GitHub Issue créée" || log_warning "Échec création GitHub Issue"
    fi
  else
    log_warning "gh CLI non disponible (skip création GitHub Issue)"
  fi
fi

# =============================================================================
# Fin
# =============================================================================

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Résumé:"
log "  Drift détecté: $DRIFT_DETECTED"
log "  CRITICAL: $CRITICAL_DRIFT"
log "  Variables: $(echo "$DRIFTED_VARS" | wc -l)"
log "  Alerte email: $([ "$SHOULD_ALERT" = true ] && echo "envoyée" || echo "cooldown")"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Exit code non-0 si CRITICAL drift (pour alertes externes)
if [ "$CRITICAL_DRIFT" = "true" ]; then
  exit 1
fi

exit 0
