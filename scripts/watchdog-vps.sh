#!/bin/bash
# Watchdog VPS Qadhya — détecte et corrige CPU runaway + RAM saturée + container unhealthy
# Déployé sur VPS : /opt/qadhya/scripts/watchdog.sh
# Cron : */5 * * * * /opt/qadhya/scripts/watchdog.sh
#
# Installation :
#   scp scripts/watchdog-vps.sh root@84.247.165.187:/opt/qadhya/scripts/watchdog.sh
#   ssh root@84.247.165.187 "chmod +x /opt/qadhya/scripts/watchdog.sh && \
#     mkdir -p /var/log/qadhya && \
#     (crontab -l 2>/dev/null | grep -v watchdog; echo '*/5 * * * * /opt/qadhya/scripts/watchdog.sh') | crontab -"

LOG="/var/log/qadhya/watchdog.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
CONTAINER="qadhya-nextjs"

mkdir -p "$(dirname "$LOG")"

# Charger cron-logger pour tracking en DB
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/lib/cron-logger.sh" ]; then
  source "$SCRIPT_DIR/lib/cron-logger.sh"
fi
cron_start "watchdog-vps" "scheduled" 2>/dev/null || true

# 1. Vérifier le health status Docker
STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null)
if [ "$STATUS" = "unhealthy" ]; then
  echo "[$TIMESTAMP] 🔴 Container $CONTAINER unhealthy → restart" >> "$LOG"
  docker restart "$CONTAINER"
  cron_complete '{}' 2>/dev/null || true
  exit 0
fi

# 2. Vérifier RAM > 85%
MEM_PCT=$(free | awk 'NR==2{printf "%.0f", $3/$2*100}')
if [ "${MEM_PCT:-0}" -gt 85 ]; then
  echo "[$TIMESTAMP] ⚠️  RAM saturée (${MEM_PCT}%) → restart Next.js" >> "$LOG"
  docker restart "$CONTAINER"
  cron_complete '{}' 2>/dev/null || true
  exit 0
fi

# 3. Vérifier CPU runaway (> 300%)
CPU_RAW=$(docker stats --no-stream --format "{{.CPUPerc}}" "$CONTAINER" 2>/dev/null | tr -d '%')
CPU_INT=${CPU_RAW%.*}
if [ "${CPU_INT:-0}" -gt 300 ]; then
  echo "[$TIMESTAMP] 🔴 CPU runaway (${CPU_RAW}%) → restart $CONTAINER" >> "$LOG"
  docker restart "$CONTAINER"
  cron_complete '{}' 2>/dev/null || true
  exit 0
fi

# Tout OK
cron_complete '{}' 2>/dev/null || true
# echo "[$TIMESTAMP] ✅ OK — status=$STATUS RAM=${MEM_PCT}% CPU=${CPU_RAW}%" >> "$LOG"
