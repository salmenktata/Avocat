#!/bin/bash
#
# Serveur HTTP minimal pour déclencher backups
# Écoute sur localhost:9999 (accessible uniquement depuis l'hôte et conteneurs)
#
# Usage: nohup ./backup-server.sh &
#
# API Endpoint: POST http://localhost:9999/backup
#

PORT=9999
BACKUP_SCRIPT="/opt/moncabinet/backup.sh"

echo "🚀 Backup API Server démarré sur port $PORT"
echo "Endpoint: http://localhost:$PORT/backup"
echo "Arrêt: pkill -f backup-server.sh"
echo ""

# Fonction pour gérer les requêtes
handle_request() {
  local method="$1"
  local path="$2"

  if [ "$method" = "POST" ] && [ "$path" = "/backup" ]; then
    echo "📦 Backup déclenché à $(date)"

    # Exécuter backup et capturer output
    START_TIME=$(date +%s)
    OUTPUT=$( bash "$BACKUP_SCRIPT" 2>&1 )
    EXIT_CODE=$?
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    if [ $EXIT_CODE -eq 0 ]; then
      # Succès
      echo -e "HTTP/1.1 200 OK\r"
      echo -e "Content-Type: application/json\r"
      echo -e "Access-Control-Allow-Origin: *\r"
      echo -e "\r"
      echo "{\"success\":true,\"duration\":\"${DURATION}s\",\"message\":\"Backup terminé avec succès\"}"
    else
      # Échec
      echo -e "HTTP/1.1 500 Internal Server Error\r"
      echo -e "Content-Type: application/json\r"
      echo -e "Access-Control-Allow-Origin: *\r"
      echo -e "\r"
      echo "{\"success\":false,\"error\":\"Échec du backup\",\"exitCode\":$EXIT_CODE}"
    fi
  elif [ "$method" = "GET" ] && [ "$path" = "/health" ]; then
    # Health check
    echo -e "HTTP/1.1 200 OK\r"
    echo -e "Content-Type: application/json\r"
    echo -e "\r"
    echo "{\"status\":\"healthy\",\"service\":\"backup-server\"}"
  else
    # Not found
    echo -e "HTTP/1.1 404 Not Found\r"
    echo -e "Content-Type: application/json\r"
    echo -e "\r"
    echo "{\"error\":\"Not found\"}"
  fi
}

# Boucle serveur HTTP
while true; do
  {
    # Lire requête HTTP
    read -r REQUEST_LINE
    METHOD=$(echo "$REQUEST_LINE" | cut -d' ' -f1)
    PATH=$(echo "$REQUEST_LINE" | cut -d' ' -f2)

    # Consommer headers
    while read -r header; do
      [ "$header" = $'\r' ] && break
    done

    # Traiter requête
    handle_request "$METHOD" "$PATH"

  } | nc -l -p $PORT -q 1
done
