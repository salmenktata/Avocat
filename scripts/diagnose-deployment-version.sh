#!/bin/bash
set -e

echo "┌─────────────────────────────────────────────┐"
echo "│ Diagnostic Version Production Qadhya        │"
echo "└─────────────────────────────────────────────┘"
echo ""

# Récupérer version container actuel (sur VPS)
echo "🔍 Fetching production version..."
CONTAINER_SHA=$(ssh root@84.247.165.187 "docker inspect qadhya-nextjs --format='{{.Config.Labels.org.opencontainers.image.revision}}' 2>/dev/null" || echo "unknown")
CONTAINER_DATE=$(ssh root@84.247.165.187 "docker inspect qadhya-nextjs --format='{{.Created}}' 2>/dev/null | cut -d'T' -f1" || echo "unknown")

# Récupérer version git main locale
MAIN_SHA=$(git rev-parse origin/main 2>/dev/null || git rev-parse main)
MAIN_DATE=$(git log -1 --format=%cd --date=short $MAIN_SHA)

# Comparer
if [ "$CONTAINER_SHA" = "$MAIN_SHA" ]; then
  STATUS="✅ UP TO DATE"
  BEHIND=0
elif [ "$CONTAINER_SHA" = "unknown" ]; then
  STATUS="⚠️  CANNOT VERIFY (check SSH access)"
  BEHIND="?"
else
  BEHIND=$(git rev-list --count ${CONTAINER_SHA}..${MAIN_SHA} 2>/dev/null || echo "?")
  if [ "$BEHIND" -gt 0 ] 2>/dev/null; then
    STATUS="❌ OUTDATED (-$BEHIND commits)"
  else
    STATUS="⚠️  AHEAD OF MAIN"
  fi
fi

# Afficher résultats
echo "┌─────────────────────────────────────────────┐"
echo "│ Version Production vs Main                  │"
echo "├─────────────────────────────────────────────┤"
printf "│ Container:  %-30s │\n" "$(echo $CONTAINER_SHA | cut -c1-7) ($CONTAINER_DATE)"
printf "│ Git Main:   %-30s │\n" "$(echo $MAIN_SHA | cut -c1-7) ($MAIN_DATE)"
echo "├─────────────────────────────────────────────┤"
printf "│ Status: %-35s │\n" "$STATUS"
if [ "$BEHIND" -gt 0 ] 2>/dev/null; then
  echo "│ Missing commits:                            │"
  git log --oneline ${CONTAINER_SHA}..${MAIN_SHA} | head -5 | while read line; do
    printf "│   %-41s │\n" "$line"
  done
fi
echo "└─────────────────────────────────────────────┘"

exit 0
