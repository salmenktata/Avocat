#!/bin/bash
set -e

echo "🧪 Testing health check timing on VPS..."
echo "This will restart the container to measure actual startup time."
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 0
fi

echo "↻ Restarting container..."
ssh root@84.247.165.187 "docker restart qadhya-nextjs"

START_TIME=$(date +%s)
ATTEMPT=1

while true; do
  ELAPSED=$(($(date +%s) - START_TIME))

  RESPONSE=$(ssh root@84.247.165.187 "curl -sf http://localhost:3000/api/health 2>/dev/null" || echo "FAIL")

  if echo "$RESPONSE" | grep -q '"status":"healthy"'; then
    echo "✅ Health check passed after ${ELAPSED}s (attempt #$ATTEMPT)"

    if [ $ELAPSED -lt 20 ]; then
      echo "✅ Timing OK - Well under workflow threshold (30s)"
    elif [ $ELAPSED -lt 30 ]; then
      echo "⚠️  Timing TIGHT - Close to workflow threshold (30s)"
    else
      echo "❌ Timing TOO SLOW - Exceeds workflow threshold (30s)"
      echo "   Recommendation: Increase workflow sleep to ${ELAPSED}s + 10s margin"
    fi

    break
  fi

  echo "⏳ Attempt #$ATTEMPT: Not ready yet (${ELAPSED}s elapsed)..."
  ATTEMPT=$((ATTEMPT + 1))

  if [ $ELAPSED -gt 60 ]; then
    echo "❌ Timeout after 60s - Container may have issues"
    ssh root@84.247.165.187 "docker logs qadhya-nextjs --tail 50"
    exit 1
  fi

  sleep 2
done
